//! Find in files (Ctrl+Shift+F): a literal or regex search over the workspace's files.
//!
//! The file list is the quick-open index (`super::index`), so `.gitignore` and the skipped
//! dependency folders apply here too, `.git` is never entered and every path stays under the
//! root (symlinks are not followed). Files are read on a few threads. Each search takes a
//! ticket from [`SearchState`]; a newer search (or an explicit cancel) bumps the generation,
//! and the workers check their ticket between files and every few hundred lines, so a
//! superseded search stops promptly and reports [`SearchOutcome::Cancelled`].
//!
//! Columns and ranges are UTF-16 code units, the unit of JS strings and Monaco columns.

use regex::{Regex, RegexBuilder};
use serde::Serialize;
use std::io;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};

/// Larger files are skipped (minified bundles, data dumps).
pub const MAX_FILE_BYTES: u64 = 2 * 1024 * 1024;
/// A NUL byte in this many leading bytes marks a file as binary.
const SNIFF_BYTES: usize = 8 * 1024;
/// Matches returned for the whole search; more set `truncated`.
pub const MAX_TOTAL_MATCHES: usize = 2000;
/// Matches taken from one file, so a single file cannot fill the whole list.
pub const MAX_FILE_MATCHES: usize = 250;
/// Characters of a line shown in a result (an ellipsis marks each cut).
pub const MAX_TEXT_CHARS: usize = 200;
/// Characters kept before the first match when a long line is cut.
const CONTEXT_CHARS: usize = 40;
/// How often (in lines) a worker checks for cancellation inside one file.
const CANCEL_EVERY_LINES: usize = 512;
const MAX_THREADS: usize = 8;
const ELLIPSIS: char = '\u{2026}';

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SearchOptions {
    pub query: String,
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub regex: bool,
}

/// One matching line.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LineMatch {
    /// 1-based line number.
    pub line: u32,
    /// 1-based UTF-16 column of the first match in the full line (a Monaco column).
    pub column: u32,
    /// The line as shown: indentation dropped, long lines cut around the first match.
    pub text: String,
    /// `[start, end)` UTF-16 offsets of the matches inside `text`.
    pub ranges: Vec<[u32; 2]>,
    /// Matches on the line, including any cut off from `text`.
    #[serde(skip)]
    pub hits: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileMatches {
    /// Relative to the root, with `/` separators.
    pub path: String,
    /// Matches in this file (at most [`MAX_FILE_MATCHES`]).
    pub count: usize,
    pub matches: Vec<LineMatch>,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SearchResults {
    pub files: Vec<FileMatches>,
    pub total_matches: usize,
    pub total_files: usize,
    /// A cap was hit: there may be more matches than listed.
    pub truncated: bool,
}

/// `{ "status": "done", ...results }` or `{ "status": "cancelled" }`.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum SearchOutcome {
    Done(SearchResults),
    /// A newer search started (or the search was cancelled) before this one finished.
    Cancelled,
}

/// Latest-wins bookkeeping, managed by Tauri: one generation counter for all searches.
#[derive(Default)]
pub struct SearchState {
    generation: Arc<AtomicU64>,
}

impl SearchState {
    /// Starts a search, superseding any running one.
    pub fn begin(&self) -> Ticket {
        let id = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
        Ticket {
            generation: Arc::clone(&self.generation),
            id,
        }
    }

    /// Stops the running search, if any.
    pub fn cancel(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
    }
}

/// A running search's claim; it is cancelled once another search begins.
pub struct Ticket {
    generation: Arc<AtomicU64>,
    id: u64,
}

impl Ticket {
    pub fn is_cancelled(&self) -> bool {
        self.generation.load(Ordering::Relaxed) != self.id
    }
}

/// The compiled query.
pub struct Matcher {
    re: Regex,
    whole_word: bool,
}

impl Matcher {
    /// Literal unless `regex` is set; an invalid pattern is a `[bad_regex]` error.
    pub fn new(options: &SearchOptions) -> io::Result<Self> {
        let pattern = if options.regex {
            options.query.clone()
        } else {
            regex::escape(&options.query)
        };
        let re = RegexBuilder::new(&pattern)
            .case_insensitive(!options.case_sensitive)
            .build()
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, format!("[bad_regex] {e}")))?;
        Ok(Self {
            re,
            whole_word: options.whole_word,
        })
    }

    /// Byte ranges of the non-empty matches in `line`, at most `limit`.
    pub fn find(&self, line: &str, limit: usize) -> Vec<(usize, usize)> {
        self.re
            .find_iter(line)
            .filter(|m| !m.is_empty())
            .filter(|m| !self.whole_word || is_whole_word(line, m.start(), m.end()))
            .take(limit)
            .map(|m| (m.start(), m.end()))
            .collect()
    }
}

fn is_word_char(c: char) -> bool {
    c.is_alphanumeric() || c == '_'
}

/// A match edge that is a word character must not continue a word outside the match
/// (`foo` is not found in `food`, but `.foo` is found in `a.foo`).
fn is_whole_word(line: &str, start: usize, end: usize) -> bool {
    let inner = &line[start..end];
    let starts_word = inner.chars().next().is_some_and(is_word_char);
    let ends_word = inner.chars().next_back().is_some_and(is_word_char);
    let before = line[..start].chars().next_back().is_some_and(is_word_char);
    let after = line[end..].chars().next().is_some_and(is_word_char);
    let glued = (starts_word && before) || (ends_word && after);
    !glued
}

/// Length of `s` in UTF-16 code units.
pub fn utf16_len(s: &str) -> usize {
    s.chars().map(char::len_utf16).sum()
}

/// Byte offset `n` characters after `from` (or the end of `s`).
fn chars_ahead(s: &str, from: usize, n: usize) -> usize {
    s[from..]
        .char_indices()
        .nth(n)
        .map_or(s.len(), |(i, _)| from + i)
}

/// Byte offset `n` characters before `to`, but not before `floor`.
fn chars_back(s: &str, floor: usize, to: usize, n: usize) -> usize {
    s[floor..to]
        .char_indices()
        .rev()
        .take(n)
        .last()
        .map_or(to, |(i, _)| floor + i)
}

/// The line as shown in the results and its matches as UTF-16 `[start, end)` offsets in it.
/// Indentation is dropped; a line over [`MAX_TEXT_CHARS`] is cut to a window that starts a
/// little before the first match, with `…` marking each cut. `matches` are sorted byte ranges.
pub fn snippet(line: &str, matches: &[(usize, usize)]) -> (String, Vec<[u32; 2]>) {
    let first = matches.first().map_or(0, |m| m.0);
    let indent = line.len() - line.trim_start().len();
    let mut start = indent.min(first);
    let mut end = chars_ahead(line, start, MAX_TEXT_CHARS);
    if end < line.len() {
        start = chars_back(line, start, first, CONTEXT_CHARS);
        end = chars_ahead(line, start, MAX_TEXT_CHARS);
    }
    let cut_before = start > indent;
    let cut_after = end < line.len();

    let mut text = String::with_capacity(end - start + 6);
    if cut_before {
        text.push(ELLIPSIS);
    }
    text.push_str(&line[start..end]);
    if cut_after {
        text.push(ELLIPSIS);
    }

    let offset = if cut_before { ELLIPSIS.len_utf16() } else { 0 };
    let ranges = matches
        .iter()
        .filter(|&&(a, b)| a < end && b > start)
        .map(|&(a, b)| {
            let (a, b) = (a.max(start), b.min(end));
            let from = offset + utf16_len(&line[start..a]);
            [from as u32, (from + utf16_len(&line[a..b])) as u32]
        })
        .collect();
    (text, ranges)
}

/// The matches of one file.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct FileHits {
    pub matches: Vec<LineMatch>,
    pub count: usize,
    /// More matches than `limit`.
    pub capped: bool,
}

/// Searches `text` line by line, keeping at most `limit` matches; `None` when cancelled.
pub fn search_text(
    text: &str,
    matcher: &Matcher,
    limit: usize,
    cancelled: &dyn Fn() -> bool,
) -> Option<FileHits> {
    let mut hits = FileHits::default();
    for (index, line) in text.lines().enumerate() {
        if index > 0 && index % CANCEL_EVERY_LINES == 0 && cancelled() {
            return None;
        }
        let remaining = limit - hits.count;
        let mut found = matcher.find(line, remaining + 1);
        if found.len() > remaining {
            found.truncate(remaining);
            hits.capped = true;
        }
        if let Some(&(first, _)) = found.first() {
            let (shown, ranges) = snippet(line, &found);
            hits.count += found.len();
            hits.matches.push(LineMatch {
                line: index as u32 + 1,
                column: utf16_len(&line[..first]) as u32 + 1,
                text: shown,
                ranges,
                hits: found.len(),
            });
        }
        if hits.capped {
            break;
        }
    }
    Some(hits)
}

/// A NUL byte near the start means binary (this also skips UTF-16 encoded text).
pub fn is_binary(bytes: &[u8]) -> bool {
    bytes[..bytes.len().min(SNIFF_BYTES)].contains(&0)
}

/// A file's text for searching, or `None` for symlinks, large or binary files and read
/// errors. Invalid UTF-8 is decoded lossily so the rest of a Latin-1 file stays searchable;
/// a UTF-8 BOM is dropped so columns match the editor's.
fn read_text(path: &Path) -> Option<String> {
    let meta = std::fs::symlink_metadata(path).ok()?;
    if !meta.is_file() || meta.len() > MAX_FILE_BYTES {
        return None;
    }
    let bytes = std::fs::read(path).ok()?;
    if is_binary(&bytes) {
        return None;
    }
    let text = match String::from_utf8(bytes) {
        Ok(text) => text,
        Err(e) => String::from_utf8_lossy(e.as_bytes()).into_owned(),
    };
    Some(match text.strip_prefix('\u{feff}') {
        Some(rest) => rest.to_owned(),
        None => text,
    })
}

/// Joins per-file results (in path order) under the total cap. `more` says matches may
/// exist beyond the given files.
fn merge(found: Vec<(FileMatches, bool)>, limit: usize, more: bool) -> SearchResults {
    let mut out = SearchResults {
        truncated: more,
        ..SearchResults::default()
    };
    for (mut file, capped) in found {
        out.truncated |= capped;
        let room = limit - out.total_matches;
        if room == 0 {
            out.truncated = true;
            break;
        }
        if file.count > room {
            let mut taken = 0;
            file.matches.retain(|m| {
                let keep = taken < room;
                taken += if keep { m.hits } else { 0 };
                keep
            });
            file.count = taken;
            out.truncated = true;
        }
        out.total_matches += file.count;
        out.files.push(file);
    }
    out.total_files = out.files.len();
    out
}

/// Searches the files of `root` for `options.query`, in path order.
pub fn search(
    root: &Path,
    options: &SearchOptions,
    cancelled: &(dyn Fn() -> bool + Sync),
) -> io::Result<SearchOutcome> {
    let matcher = Matcher::new(options)?;
    if options.query.is_empty() {
        return Ok(SearchOutcome::Done(SearchResults::default()));
    }
    let files = super::index::list_files(root, super::index::MAX_FILES)?;
    if cancelled() {
        return Ok(SearchOutcome::Cancelled);
    }

    let next = AtomicUsize::new(0);
    let total = AtomicUsize::new(0);
    let threads = std::thread::available_parallelism()
        .map_or(4, |n| n.get())
        .clamp(1, MAX_THREADS)
        .min(files.len().max(1));
    // Workers pull files in order, so the files searched are always a prefix of the list
    // and cutting the merged result at the cap gives the same answer as a sequential walk.
    let worker = || {
        let mut out = Vec::new();
        while !cancelled() && total.load(Ordering::Relaxed) < MAX_TOTAL_MATCHES {
            let index = next.fetch_add(1, Ordering::Relaxed);
            let Some(rel) = files.get(index) else { break };
            let Some(text) = read_text(&root.join(rel)) else {
                continue;
            };
            let Some(hits) = search_text(&text, &matcher, MAX_FILE_MATCHES, cancelled) else {
                break;
            };
            if hits.count == 0 {
                continue;
            }
            total.fetch_add(hits.count, Ordering::Relaxed);
            let file = FileMatches {
                path: rel.clone(),
                count: hits.count,
                matches: hits.matches,
            };
            out.push((index, file, hits.capped));
        }
        out
    };
    let mut found: Vec<(usize, FileMatches, bool)> = std::thread::scope(|scope| {
        let handles: Vec<_> = (0..threads).map(|_| scope.spawn(worker)).collect();
        handles
            .into_iter()
            .flat_map(|h| h.join().unwrap_or_default())
            .collect()
    });
    if cancelled() {
        return Ok(SearchOutcome::Cancelled);
    }
    found.sort_by_key(|(index, _, _)| *index);
    let unvisited = next.load(Ordering::Relaxed) < files.len();
    let more = files.len() >= super::index::MAX_FILES || unvisited;
    let found = found
        .into_iter()
        .map(|(_, f, capped)| (f, capped))
        .collect();
    Ok(SearchOutcome::Done(merge(found, MAX_TOTAL_MATCHES, more)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn opts(query: &str) -> SearchOptions {
        SearchOptions {
            query: query.into(),
            ..SearchOptions::default()
        }
    }

    fn matcher(options: SearchOptions) -> Matcher {
        Matcher::new(&options).unwrap()
    }

    const NEVER: &(dyn Fn() -> bool + Sync) = &|| false;

    fn done(outcome: SearchOutcome) -> SearchResults {
        match outcome {
            SearchOutcome::Done(results) => results,
            SearchOutcome::Cancelled => panic!("search was cancelled"),
        }
    }

    #[test]
    fn literal_search_escapes_the_query_and_ignores_case_by_default() {
        let m = matcher(opts("a.b"));
        assert_eq!(m.find("axb A.B a.b", 10), [(4, 7), (8, 11)]);
        let m = matcher(SearchOptions {
            case_sensitive: true,
            ..opts("a.b")
        });
        assert_eq!(m.find("axb A.B a.b", 10), [(8, 11)]);
    }

    #[test]
    fn regex_search_and_bad_regex_error() {
        let m = matcher(SearchOptions {
            regex: true,
            ..opts(r"fo+\d")
        });
        assert_eq!(m.find("f1 foo2 fooo3", 10), [(3, 7), (8, 13)]);
        let err = Matcher::new(&SearchOptions {
            regex: true,
            ..opts("(unclosed")
        })
        .err()
        .unwrap();
        assert!(err.to_string().starts_with("[bad_regex] "), "{err}");
        assert!(err.to_string().contains("unclosed group"), "{err}");
    }

    #[test]
    fn empty_regex_matches_are_ignored() {
        let m = matcher(SearchOptions {
            regex: true,
            ..opts("x*")
        });
        assert_eq!(m.find("abxxc", 10), [(2, 4)]);
    }

    #[test]
    fn whole_word_checks_word_edges_including_non_ascii_letters() {
        let m = matcher(SearchOptions {
            whole_word: true,
            ..opts("foo")
        });
        assert_eq!(m.find("food foo _foo foo_ (foo)", 10), [(5, 8), (20, 23)]);
        // `ş` is a letter, so `kuş` is not a whole word inside `kuşu`.
        let m = matcher(SearchOptions {
            whole_word: true,
            ..opts("kuş")
        });
        assert_eq!(m.find("kuşu kuş", 10), [(6, 10)]);
        // An edge that is not a word character needs no boundary.
        let m = matcher(SearchOptions {
            whole_word: true,
            ..opts(".foo")
        });
        assert_eq!(m.find("a.foo", 10), [(1, 5)]);
    }

    #[test]
    fn find_respects_the_limit() {
        assert_eq!(matcher(opts("a")).find("aaaa", 2).len(), 2);
    }

    #[test]
    fn snippet_drops_indentation_and_counts_utf16_units() {
        // "    şöyle 😀 foo": the emoji is two UTF-16 units.
        let line = "    şöyle 😀 foo";
        let m = matcher(opts("foo")).find(line, 10);
        let (text, ranges) = snippet(line, &m);
        assert_eq!(text, "şöyle 😀 foo");
        assert_eq!(ranges, [[9, 12]]);
        let units: Vec<u16> = text.encode_utf16().collect();
        assert_eq!(String::from_utf16(&units[9..12]).unwrap(), "foo");
    }

    #[test]
    fn snippet_ranges_cover_non_ascii_matches() {
        let line = "İstanbul'da ğüzel 😀😀 çiçek";
        let m = matcher(opts("çiçek")).find(line, 10);
        let (text, ranges) = snippet(line, &m);
        let units: Vec<u16> = text.encode_utf16().collect();
        let [a, b] = ranges[0];
        assert_eq!(
            String::from_utf16(&units[a as usize..b as usize]).unwrap(),
            "çiçek"
        );
    }

    #[test]
    fn snippet_cuts_long_lines_around_the_first_match() {
        let line = format!("{}needle{}", "ş".repeat(500), "x".repeat(500));
        let m = matcher(opts("needle")).find(&line, 10);
        let (text, ranges) = snippet(&line, &m);
        assert!(text.starts_with('…') && text.ends_with('…'));
        assert_eq!(text.chars().count(), MAX_TEXT_CHARS + 2);
        // The ellipsis plus the 40 characters of context come first.
        assert_eq!(ranges, [[41, 47]]);
    }

    #[test]
    fn snippet_drops_matches_outside_the_window() {
        let line = format!("ab{}ab", " ".repeat(400));
        let m = matcher(opts("ab")).find(&line, 10);
        assert_eq!(m.len(), 2);
        let (text, ranges) = snippet(&line, &m);
        assert!(!text.starts_with('…') && text.ends_with('…'));
        assert_eq!(ranges, [[0, 2]]);
    }

    #[test]
    fn search_text_reports_lines_and_utf16_columns() {
        let text = "first\r\n\tçay 😀 çay\nnone\n";
        let hits = search_text(text, &matcher(opts("çay")), 100, &|| false).unwrap();
        assert_eq!(hits.count, 2);
        assert!(!hits.capped);
        let m = &hits.matches[0];
        assert_eq!((m.line, m.column), (2, 2));
        assert_eq!(m.text, "çay 😀 çay");
        assert_eq!(m.ranges, [[0, 3], [7, 10]]);
        let hits = search_text("x😀foo", &matcher(opts("foo")), 100, &|| false).unwrap();
        // Monaco column: x (1) + emoji (2 units) then foo at column 4.
        assert_eq!(hits.matches[0].column, 4);
    }

    #[test]
    fn search_text_caps_matches_per_file() {
        let text = "a a a\na a\n";
        let hits = search_text(text, &matcher(opts("a")), 4, &|| false).unwrap();
        assert_eq!(hits.count, 4);
        assert!(hits.capped);
        assert_eq!(hits.matches.len(), 2);
        assert_eq!(hits.matches[1].ranges.len(), 1);
        // Exactly at the limit is not capped.
        let hits = search_text("a a\nb", &matcher(opts("a")), 2, &|| false).unwrap();
        assert!(!hits.capped);
    }

    #[test]
    fn search_text_stops_when_cancelled() {
        let text = "x\n".repeat(CANCEL_EVERY_LINES * 2);
        assert_eq!(
            search_text(&text, &matcher(opts("x")), 10_000, &|| true),
            None
        );
    }

    #[test]
    fn binary_sniffing() {
        assert!(is_binary(b"abc\0def"));
        assert!(!is_binary("çay".as_bytes()));
    }

    #[test]
    fn merge_cuts_at_the_total_cap_in_order() {
        let file = |path: &str, lines: usize| FileMatches {
            path: path.into(),
            count: lines,
            matches: (0..lines)
                .map(|i| LineMatch {
                    line: i as u32 + 1,
                    column: 1,
                    text: "a".into(),
                    ranges: vec![[0, 1]],
                    hits: 1,
                })
                .collect(),
        };
        let out = merge(vec![(file("a", 3), false), (file("b", 3), false)], 4, false);
        assert_eq!(out.total_matches, 4);
        assert_eq!(out.total_files, 2);
        assert_eq!(out.files[1].matches.len(), 1);
        assert!(out.truncated);
        let out = merge(vec![(file("a", 2), false)], 4, false);
        assert!(!out.truncated);
    }

    #[test]
    fn walk_respects_gitignore_skips_binaries_and_large_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
        fs::write(root.join("src/a.ts"), "const needle = 1;\n").unwrap();
        fs::write(root.join("b.md"), "a needle\nNEEDLE\n").unwrap();
        fs::write(root.join("node_modules/pkg/i.js"), "needle").unwrap();
        fs::write(root.join("bin.dat"), b"needle\0\x01").unwrap();
        fs::write(root.join("latin1.txt"), b"caf\xe9 needle\n").unwrap();
        let big = format!("needle\n{}", "x".repeat(MAX_FILE_BYTES as usize));
        fs::write(root.join("big.txt"), big).unwrap();
        // A real repository, so the git index (and .gitignore) is used when git exists.
        let git = std::process::Command::new("git")
            .arg("-C")
            .arg(root)
            .arg("init")
            .output();
        if git.is_ok_and(|o| o.status.success()) {
            fs::write(root.join(".gitignore"), "ignored.txt\nnode_modules/\n").unwrap();
            fs::write(root.join("ignored.txt"), "needle").unwrap();
        }

        let out = done(search(root, &opts("needle"), NEVER).unwrap());
        let paths: Vec<&str> = out.files.iter().map(|f| f.path.as_str()).collect();
        assert_eq!(paths, ["b.md", "latin1.txt", "src/a.ts"]);
        assert_eq!(out.total_matches, 4);
        assert_eq!(out.total_files, 3);
        assert!(!out.truncated);
        // The invalid byte became U+FFFD; the column still counts it as one unit.
        assert_eq!(out.files[1].matches[0].text, "caf\u{fffd} needle");
        assert_eq!(out.files[1].matches[0].column, 6);
    }

    #[test]
    fn walk_hits_the_total_cap() {
        let dir = tempfile::tempdir().unwrap();
        let line = "e ".repeat(100);
        for i in 0..30 {
            fs::write(dir.path().join(format!("f{i:02}.txt")), &line).unwrap();
        }
        let out = done(search(dir.path(), &opts("e"), NEVER).unwrap());
        assert_eq!(out.total_matches, MAX_TOTAL_MATCHES);
        assert!(out.truncated);
        // In path order: the first files are the ones kept.
        assert_eq!(out.files[0].path, "f00.txt");
        assert_eq!(out.files.len(), MAX_TOTAL_MATCHES / 100);
    }

    #[test]
    fn a_newer_search_cancels_the_running_one() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "needle").unwrap();
        let state = SearchState::default();
        let first = state.begin();
        assert!(!first.is_cancelled());
        let second = state.begin();
        assert!(first.is_cancelled());
        let cancelled = || first.is_cancelled();
        assert_eq!(
            search(dir.path(), &opts("needle"), &cancelled).unwrap(),
            SearchOutcome::Cancelled
        );
        state.cancel();
        assert!(second.is_cancelled());
    }

    #[test]
    fn outcome_serializes_with_a_status_tag() {
        let json = serde_json::to_value(SearchOutcome::Cancelled).unwrap();
        assert_eq!(json, serde_json::json!({ "status": "cancelled" }));
        let json = serde_json::to_value(SearchOutcome::Done(SearchResults::default())).unwrap();
        assert_eq!(
            json,
            serde_json::json!({
                "status": "done", "files": [], "totalMatches": 0, "totalFiles": 0, "truncated": false
            })
        );
    }

    #[test]
    fn missing_root_is_an_error_and_empty_query_finds_nothing() {
        let dir = tempfile::tempdir().unwrap();
        assert!(search(&dir.path().join("nope"), &opts("x"), NEVER).is_err());
        assert_eq!(
            done(search(dir.path(), &opts(""), NEVER).unwrap()),
            SearchResults::default()
        );
    }
}
