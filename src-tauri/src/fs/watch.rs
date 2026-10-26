//! Watches the open workspace root and tells the frontend which paths changed.
//!
//! Raw `notify` events arrive in bursts (a save is often several events, a `git checkout`
//! or a build can be thousands). A [`Coalescer`] collects them until the file system has
//! been quiet for [`QUIET`] (or [`MAX_WAIT`] has passed since the first event), then one
//! `fs://changed` event carries the de-duplicated paths.

use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::BTreeSet;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::sync::mpsc::{self, RecvTimeoutError};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

/// Event name the frontend listens to.
pub const CHANGED_EVENT: &str = "fs://changed";

/// Flush once nothing has changed for this long.
pub const QUIET: Duration = Duration::from_millis(150);
/// Never hold a batch longer than this, even while events keep coming.
pub const MAX_WAIT: Duration = Duration::from_millis(1_000);
/// Above this many distinct paths the batch is sent as "everything changed".
pub const MAX_PATHS: usize = 500;

/// Folders whose churn is never interesting (and hidden from listings anyway).
const IGNORED: &[&str] = &[".git"];

/// Payload of [`CHANGED_EVENT`]. `full` means "too much changed, refresh everything".
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ChangedPayload {
    pub root: String,
    pub paths: Vec<String>,
    pub full: bool,
}

/// Pure debounce state: no threads or clocks of its own, so it is easy to test.
#[derive(Debug, Default)]
pub struct Coalescer {
    paths: BTreeSet<String>,
    overflow: bool,
    first: Option<Instant>,
    last: Option<Instant>,
}

impl Coalescer {
    /// Records changed paths observed at `now`.
    pub fn push<I: IntoIterator<Item = String>>(&mut self, paths: I, now: Instant) {
        let mut any = false;
        for path in paths {
            any = true;
            if self.overflow {
                continue;
            }
            self.paths.insert(path);
            if self.paths.len() > MAX_PATHS {
                self.overflow = true;
                self.paths.clear();
            }
        }
        if any {
            self.first.get_or_insert(now);
            self.last = Some(now);
        }
    }

    /// How long the caller may sleep before the batch could become due (`None` when empty).
    pub fn wait_hint(&self, now: Instant) -> Option<Duration> {
        let (first, last) = (self.first?, self.last?);
        let quiet_at = last + QUIET;
        let max_at = first + MAX_WAIT;
        Some(quiet_at.min(max_at).saturating_duration_since(now))
    }

    /// Takes the batch when it is due: quiet for [`QUIET`] or older than [`MAX_WAIT`].
    pub fn take_due(&mut self, now: Instant) -> Option<(Vec<String>, bool)> {
        let (first, last) = (self.first?, self.last?);
        if now < last + QUIET && now < first + MAX_WAIT {
            return None;
        }
        let batch = (
            std::mem::take(&mut self.paths).into_iter().collect(),
            self.overflow,
        );
        *self = Self::default();
        Some(batch)
    }
}

/// True when `path` lies inside an ignored folder such as `.git`.
pub fn is_ignored(path: &Path) -> bool {
    path.components().any(|c| match c {
        Component::Normal(name) => IGNORED.iter().any(|ignored| name == *ignored),
        _ => false,
    })
}

/// Paths of a raw notify event that the frontend should hear about.
fn relevant_paths(event: &Event) -> Vec<String> {
    // Pure access events (reads) never change what the tree or an editor shows.
    if matches!(event.kind, notify::EventKind::Access(_)) {
        return Vec::new();
    }
    event
        .paths
        .iter()
        .filter(|p| !is_ignored(p))
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}

/// The single active watcher; replaced whenever another root is opened.
#[derive(Default)]
pub struct WatchState(Mutex<Option<RecommendedWatcher>>);

impl WatchState {
    /// Starts watching `root` recursively, dropping any previous watcher.
    pub fn watch(&self, app: AppHandle, root: PathBuf) -> notify::Result<()> {
        let (tx, rx) = mpsc::channel::<notify::Result<Event>>();
        let mut watcher = notify::recommended_watcher(tx)?;
        watcher.watch(&root, RecursiveMode::Recursive)?;
        let root_str = root.to_string_lossy().into_owned();
        std::thread::Builder::new()
            .name("xora-fs-watch".into())
            .spawn(move || pump(&app, &root_str, &rx))
            .map_err(notify::Error::io)?;
        // Dropping the old watcher closes its channel, which ends its thread.
        *self.0.lock().unwrap_or_else(|e| e.into_inner()) = Some(watcher);
        Ok(())
    }

    pub fn unwatch(&self) {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).take();
    }
}

/// Debounce loop for one watcher; returns when the watcher (the sender) is dropped.
fn pump(app: &AppHandle, root: &str, rx: &mpsc::Receiver<notify::Result<Event>>) {
    let mut batch = Coalescer::default();
    loop {
        let wait = batch
            .wait_hint(Instant::now())
            .unwrap_or(Duration::from_secs(3600));
        match rx.recv_timeout(wait) {
            Ok(Ok(event)) => batch.push(relevant_paths(&event), Instant::now()),
            // A watcher error (e.g. buffer overflow) means events were lost: refresh all.
            Ok(Err(_)) => {
                batch.push([root.to_owned()], Instant::now());
                batch.overflow = true;
            }
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => return,
        }
        if let Some((paths, full)) = batch.take_due(Instant::now()) {
            let payload = ChangedPayload {
                root: root.to_owned(),
                paths,
                full,
            };
            if let Err(err) = app.emit(CHANGED_EVENT, payload) {
                eprintln!("fs watch: cannot emit change event: {err}");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ms(n: u64) -> Duration {
        Duration::from_millis(n)
    }

    #[test]
    fn empty_batch_is_never_due() {
        let mut c = Coalescer::default();
        let now = Instant::now();
        assert_eq!(c.wait_hint(now), None);
        assert_eq!(c.take_due(now + ms(10_000)), None);
    }

    #[test]
    fn flushes_after_quiet_period_with_deduplicated_paths() {
        let mut c = Coalescer::default();
        let t0 = Instant::now();
        c.push(["/r/a.ts".to_owned(), "/r/b.ts".to_owned()], t0);
        c.push(["/r/a.ts".to_owned()], t0 + ms(100));
        assert_eq!(
            c.take_due(t0 + ms(200)),
            None,
            "still within quiet period of last event"
        );
        let (paths, full) = c.take_due(t0 + ms(250)).unwrap();
        assert_eq!(paths, vec!["/r/a.ts", "/r/b.ts"]);
        assert!(!full);
        assert_eq!(
            c.take_due(t0 + ms(10_000)),
            None,
            "batch is reset after flushing"
        );
    }

    #[test]
    fn a_steady_stream_still_flushes_after_max_wait() {
        let mut c = Coalescer::default();
        let t0 = Instant::now();
        for i in 0..20 {
            c.push([format!("/r/{i}")], t0 + ms(i * 60));
        }
        assert!(c.take_due(t0 + MAX_WAIT).is_some());
    }

    #[test]
    fn wait_hint_points_at_the_earlier_deadline() {
        let mut c = Coalescer::default();
        let t0 = Instant::now();
        c.push(["/r/a".to_owned()], t0);
        assert_eq!(c.wait_hint(t0), Some(QUIET));
        c.push(["/r/b".to_owned()], t0 + ms(950));
        assert_eq!(c.wait_hint(t0 + ms(950)), Some(ms(50)));
    }

    #[test]
    fn too_many_paths_turn_into_a_full_refresh() {
        let mut c = Coalescer::default();
        let t0 = Instant::now();
        c.push((0..=MAX_PATHS).map(|i| format!("/r/{i}")), t0);
        let (paths, full) = c.take_due(t0 + QUIET).unwrap();
        assert!(paths.is_empty());
        assert!(full);
    }

    #[test]
    fn empty_push_does_not_start_a_batch() {
        let mut c = Coalescer::default();
        c.push(Vec::<String>::new(), Instant::now());
        assert_eq!(c.wait_hint(Instant::now()), None);
    }

    #[test]
    fn ignores_git_internals_only() {
        assert!(is_ignored(Path::new("/r/.git/index")));
        assert!(is_ignored(Path::new("/r/.git")));
        assert!(!is_ignored(Path::new("/r/src/.gitignore")));
        assert!(!is_ignored(Path::new("/r/src/main.ts")));
    }

    #[test]
    fn payload_serializes_camel_free_fields() {
        let p = ChangedPayload {
            root: "/r".into(),
            paths: vec!["/r/a".into()],
            full: false,
        };
        assert_eq!(
            serde_json::to_string(&p).unwrap(),
            r#"{"root":"/r","paths":["/r/a"],"full":false}"#
        );
    }
}
