//! Wallpaper files: the user's picture is copied into `app_data_dir/wallpapers/`
//! so the asset protocol can serve it from one narrow scope, and so moving or
//! deleting the original does not break the background.

use super::SettingsError;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Folder under the app data dir; must match `assetProtocol.scope` in tauri.conf.json.
pub const WALLPAPER_DIR: &str = "wallpapers";

/// Large enough for a 6K photo, small enough not to fill the disk by accident.
pub const MAX_BYTES: u64 = 40 * 1024 * 1024;

/// Formats WebView2 decodes; kept in sync with the file dialog filter.
pub const EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif", "avif", "bmp"];

/// Lower-cased extension of `path` if it is a supported image type.
pub fn supported_extension(path: &Path) -> Option<String> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    EXTENSIONS.contains(&ext.as_str()).then_some(ext)
}

/// Copies `source` into `dir` under a fresh name (so the webview never shows a
/// cached older picture) and removes every other wallpaper there.
pub fn import(dir: &Path, source: &Path) -> Result<PathBuf, SettingsError> {
    let ext = supported_extension(source).ok_or(SettingsError::UnsupportedWallpaper)?;
    let meta = fs::metadata(source)?;
    if !meta.is_file() {
        return Err(SettingsError::UnsupportedWallpaper);
    }
    if meta.len() > MAX_BYTES {
        return Err(SettingsError::WallpaperTooLarge(MAX_BYTES / (1024 * 1024)));
    }

    fs::create_dir_all(dir)?;
    let dest = dir.join(format!("wallpaper-{}.{ext}", unique_stamp()));
    let tmp = dest.with_extension(format!("{ext}.tmp"));
    if let Err(err) = fs::copy(source, &tmp).and_then(|_| fs::rename(&tmp, &dest)) {
        let _ = fs::remove_file(&tmp);
        return Err(err.into());
    }
    clear(dir, Some(&dest))?;
    Ok(dest)
}

/// Deletes the files in `dir` except `keep`. A missing folder is already clear.
pub fn clear(dir: &Path, keep: Option<&Path>) -> io::Result<()> {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(err) if err.kind() == io::ErrorKind::NotFound => return Ok(()),
        Err(err) => return Err(err),
    };
    for entry in entries {
        let path = entry?.path();
        if Some(path.as_path()) != keep && path.is_file() {
            fs::remove_file(&path)?;
        }
    }
    Ok(())
}

fn unique_stamp() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_images_case_insensitively() {
        assert_eq!(
            supported_extension(Path::new("C:/a/Photo.JPG")).as_deref(),
            Some("jpg")
        );
        assert_eq!(
            supported_extension(Path::new("b.webp")).as_deref(),
            Some("webp")
        );
        assert_eq!(supported_extension(Path::new("notes.txt")), None);
        assert_eq!(supported_extension(Path::new("noext")), None);
    }

    #[test]
    fn import_copies_and_replaces_the_previous_wallpaper() {
        let src = tempfile::tempdir().unwrap();
        let data = tempfile::tempdir().unwrap();
        let dir = data.path().join(WALLPAPER_DIR);
        let first = src.path().join("one.png");
        let second = src.path().join("two.jpg");
        fs::write(&first, b"first").unwrap();
        fs::write(&second, b"second").unwrap();

        let a = import(&dir, &first).unwrap();
        let b = import(&dir, &second).unwrap();

        assert_ne!(a, b);
        assert!(!a.exists(), "the previous copy is removed");
        assert_eq!(fs::read(&b).unwrap(), b"second");
        assert_eq!(b.extension().unwrap(), "jpg");
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 1);
        assert!(first.exists(), "the original is never touched");
    }

    #[test]
    fn import_rejects_other_types_and_folders() {
        let src = tempfile::tempdir().unwrap();
        let dir = src.path().join(WALLPAPER_DIR);
        let text = src.path().join("a.txt");
        fs::write(&text, b"x").unwrap();
        let folder = src.path().join("pics.png");
        fs::create_dir(&folder).unwrap();

        assert!(matches!(
            import(&dir, &text),
            Err(SettingsError::UnsupportedWallpaper)
        ));
        assert!(matches!(
            import(&dir, &folder),
            Err(SettingsError::UnsupportedWallpaper)
        ));
        assert!(!dir.exists());
    }

    #[test]
    fn clear_empties_the_folder_and_tolerates_a_missing_one() {
        let data = tempfile::tempdir().unwrap();
        let dir = data.path().join(WALLPAPER_DIR);
        clear(&dir, None).unwrap();

        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("a.png"), b"a").unwrap();
        clear(&dir, None).unwrap();
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 0);
    }
}
