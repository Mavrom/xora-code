pub mod commands;
pub mod wallpaper;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::fs::File;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

/// Bumped when the stored shape changes in a way that needs a migration.
pub const SETTINGS_VERSION: u32 = 1;

/// Every user preference Xora persists. Unknown or invalid values in the file
/// fall back to their defaults one field at a time (see [`from_value`]), so a
/// hand-edited typo never resets everything else.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub version: u32,
    pub general: General,
    pub agent: Agent,
    pub editor: Editor,
    pub appearance: Appearance,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            general: General::default(),
            agent: Agent::default(),
            editor: Editor::default(),
            appearance: Appearance::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct General {
    pub open_last_folder: bool,
    pub confirm_dirty_close: bool,
    pub reduced_motion: ReducedMotion,
}

impl Default for General {
    fn default() -> Self {
        Self {
            open_last_folder: true,
            confirm_dirty_close: true,
            reduced_motion: ReducedMotion::System,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum ReducedMotion {
    #[default]
    System,
    Always,
    Never,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Agent {
    pub default_agent: AgentId,
    pub default_mode: AgentMode,
    pub approval_policy: ApprovalPolicy,
    pub default_effort: Effort,
    /// Start Claude without `ANTHROPIC_API_KEY` so it uses the subscription login.
    pub claude_ignore_api_key: bool,
    /// Write agent protocol traffic to the log for troubleshooting.
    pub debug_logs: bool,
}

impl Default for Agent {
    fn default() -> Self {
        Self {
            default_agent: AgentId::default(),
            default_mode: AgentMode::default(),
            approval_policy: ApprovalPolicy::default(),
            default_effort: Effort::default(),
            claude_ignore_api_key: true,
            debug_logs: false,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum AgentId {
    #[default]
    Claude,
    Codex,
    Gemini,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum AgentMode {
    #[default]
    Agent,
    Plan,
    Chat,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum ApprovalPolicy {
    #[default]
    Ask,
    AutoEdits,
    Full,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum Effort {
    Low,
    #[default]
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Editor {
    pub font_size: u32,
    pub tab_size: u32,
    pub word_wrap: bool,
    pub minimap: bool,
    pub ligatures: bool,
    pub render_whitespace: RenderWhitespace,
    pub format_on_save: bool,
}

impl Default for Editor {
    fn default() -> Self {
        Self {
            font_size: 13,
            tab_size: 2,
            word_wrap: false,
            minimap: false,
            ligatures: true,
            render_whitespace: RenderWhitespace::None,
            format_on_save: false,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum RenderWhitespace {
    #[default]
    None,
    Boundary,
    All,
}

pub const FONT_SIZE_RANGE: (u32, u32) = (10, 24);
pub const TAB_SIZE_RANGE: (u32, u32) = (1, 8);

/// How the new-chat background picture is redrawn.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum BackgroundEffect {
    None,
    Dither,
    #[default]
    Ascii,
    Halftone,
    Scanlines,
}

/// The picture behind the new-chat composer.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Appearance {
    /// Whether a new chat shows a picture at all.
    pub picture: bool,
    /// Absolute path of the user's own copy in `app_data_dir/wallpapers/`; none means
    /// the picture that ships with Xora.
    pub wallpaper: Option<String>,
    pub effect: BackgroundEffect,
    /// Darkening over the picture, 0-100.
    pub dim: u32,
}

impl Default for Appearance {
    fn default() -> Self {
        Self {
            picture: true,
            wallpaper: None,
            effect: BackgroundEffect::default(),
            dim: 15,
        }
    }
}

pub const DIM_RANGE: (u32, u32) = (0, 100);

impl Settings {
    /// Pulls numbers back into their supported range and stamps the version.
    fn normalized(mut self) -> Self {
        self.version = SETTINGS_VERSION;
        self.editor.font_size = self
            .editor
            .font_size
            .clamp(FONT_SIZE_RANGE.0, FONT_SIZE_RANGE.1);
        self.editor.tab_size = self
            .editor
            .tab_size
            .clamp(TAB_SIZE_RANGE.0, TAB_SIZE_RANGE.1);
        let look = &mut self.appearance;
        look.dim = look.dim.clamp(DIM_RANGE.0, DIM_RANGE.1);
        if look
            .wallpaper
            .as_deref()
            .is_some_and(|p| p.trim().is_empty())
        {
            look.wallpaper = None;
        }
        self
    }
}

/// Failure of a settings file operation; converted into `AppError` at the IPC edge.
#[derive(Debug, thiserror::Error)]
pub enum SettingsError {
    #[error(transparent)]
    Io(#[from] io::Error),
    #[error("settings could not be encoded: {0}")]
    Json(#[from] serde_json::Error),
    #[error("settings patch must be a JSON object")]
    InvalidPatch,
    #[error("unsupported wallpaper: choose a PNG, JPG, WebP, GIF, AVIF or BMP image")]
    UnsupportedWallpaper,
    #[error("wallpaper is larger than {0} MB")]
    WallpaperTooLarge(u64),
}

/// Builds settings from arbitrary JSON, keeping every field that is valid on
/// its own and using the default for the rest. Unknown keys are dropped.
pub fn from_value(value: &Value) -> Settings {
    let mut merged = serde_json::to_value(Settings::default()).expect("defaults serialize");
    let mut path = Vec::new();
    if let Value::Object(source) = value {
        overlay_valid(&mut merged, source, &mut path);
    }
    serde_json::from_value::<Settings>(merged)
        .unwrap_or_default()
        .normalized()
}

/// Walks `source` against `root` (which always deserializes). Each leaf is
/// copied only if `root` still deserializes into [`Settings`] afterwards.
fn overlay_valid(root: &mut Value, source: &Map<String, Value>, path: &mut Vec<String>) {
    for (key, incoming) in source {
        path.push(key.clone());
        let previous = match pointer_mut(root, path) {
            None => None, // unknown key
            Some(Value::Object(_)) if incoming.is_object() => Some(None),
            Some(slot) => Some(Some(std::mem::replace(slot, incoming.clone()))),
        };
        match (previous, incoming) {
            (Some(None), Value::Object(inner)) => overlay_valid(root, inner, path),
            (Some(Some(previous)), _)
                if serde_json::from_value::<Settings>(root.clone()).is_err() =>
            {
                if let Some(slot) = pointer_mut(root, path) {
                    *slot = previous;
                }
            }
            _ => {}
        }
        path.pop();
    }
}

fn pointer_mut<'a>(root: &'a mut Value, path: &[String]) -> Option<&'a mut Value> {
    path.iter()
        .try_fold(root, |node, key| node.as_object_mut()?.get_mut(key))
}

/// Deep-merges `patch` into `current` (objects merge, everything else replaces)
/// and sanitizes the result. Only object patches are accepted.
pub fn apply_patch(current: &Settings, patch: &Value) -> Result<Settings, SettingsError> {
    let Value::Object(patch) = patch else {
        return Err(SettingsError::InvalidPatch);
    };
    let mut value = serde_json::to_value(current)?;
    deep_merge(&mut value, patch);
    Ok(from_value(&value))
}

fn deep_merge(target: &mut Value, patch: &Map<String, Value>) {
    let Value::Object(target) = target else {
        return;
    };
    for (key, incoming) in patch {
        match (target.get_mut(key), incoming) {
            (Some(existing @ Value::Object(_)), Value::Object(inner)) => {
                deep_merge(existing, inner)
            }
            _ => {
                target.insert(key.clone(), incoming.clone());
            }
        }
    }
}

/// Reads the settings file. A missing file means defaults. A file that is not
/// valid JSON is moved aside to `settings.json.corrupt` (so the next save does
/// not destroy it) and defaults are returned.
pub fn load(path: &Path) -> Result<Settings, SettingsError> {
    let bytes = match std::fs::read(path) {
        Ok(bytes) => bytes,
        Err(err) if err.kind() == io::ErrorKind::NotFound => return Ok(Settings::default()),
        Err(err) => return Err(err.into()),
    };
    match serde_json::from_slice::<Value>(&bytes) {
        Ok(value) => Ok(from_value(&value)),
        Err(_) => {
            let _ = std::fs::rename(path, sibling(path, ".corrupt"));
            Ok(Settings::default())
        }
    }
}

/// Atomically replaces the settings file (synced temp file + rename), the same
/// pattern as the notes store.
pub fn save(path: &Path, settings: &Settings) -> Result<(), SettingsError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_vec_pretty(settings)?;
    let tmp = sibling(path, ".tmp");
    if let Err(err) = write_synced(&tmp, &json).and_then(|()| std::fs::rename(&tmp, path)) {
        let _ = std::fs::remove_file(&tmp);
        return Err(err.into());
    }
    Ok(())
}

/// `settings.json` -> `settings.json<suffix>` in the same directory.
fn sibling(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.file_name().unwrap_or_default().to_owned();
    name.push(suffix);
    path.with_file_name(name)
}

fn write_synced(path: &Path, contents: &[u8]) -> io::Result<()> {
    let mut file = File::create(path)?;
    file.write_all(contents)?;
    file.sync_all()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn defaults_serialize_as_camel_case_with_version() {
        let value = serde_json::to_value(Settings::default()).unwrap();
        assert_eq!(value["version"], json!(SETTINGS_VERSION));
        assert_eq!(value["general"]["openLastFolder"], json!(true));
        assert_eq!(value["agent"]["approvalPolicy"], json!("ask"));
        assert_eq!(value["agent"]["defaultEffort"], json!("medium"));
        assert_eq!(value["agent"]["claudeIgnoreApiKey"], json!(true));
        assert_eq!(value["agent"]["debugLogs"], json!(false));
        assert_eq!(value["editor"]["renderWhitespace"], json!("none"));
        assert_eq!(value["editor"]["fontSize"], json!(13));
        assert_eq!(
            value["appearance"],
            json!({ "picture": true, "wallpaper": null, "effect": "ascii", "dim": 15 })
        );
    }

    #[test]
    fn appearance_is_clamped_and_wallpaper_can_be_cleared() {
        let settings = from_value(&json!({
            "appearance": { "wallpaper": "C:/w/a.png", "effect": "sparkle", "dim": 140 }
        }));
        assert_eq!(settings.appearance.wallpaper.as_deref(), Some("C:/w/a.png"));
        assert_eq!(
            settings.appearance.effect,
            BackgroundEffect::Ascii,
            "an unknown effect is invalid, default kept"
        );
        assert_eq!(settings.appearance.dim, DIM_RANGE.1);

        let cleared =
            apply_patch(&settings, &json!({ "appearance": { "wallpaper": null } })).unwrap();
        assert_eq!(cleared.appearance.wallpaper, None);
        assert_eq!(cleared.appearance.dim, DIM_RANGE.1);

        let blank = from_value(&json!({ "appearance": { "wallpaper": "  " } }));
        assert_eq!(blank.appearance.wallpaper, None);
    }

    #[test]
    fn from_value_keeps_valid_fields_and_drops_invalid_ones() {
        let value = json!({
            "editor": { "fontSize": 16, "tabSize": "four", "minimap": true },
            "agent": { "defaultEffort": "extreme", "defaultAgent": "codex" },
            "unknown": 1
        });
        let settings = from_value(&value);
        assert_eq!(settings.editor.font_size, 16);
        assert_eq!(settings.editor.tab_size, 2);
        assert!(settings.editor.minimap);
        assert_eq!(settings.agent.default_effort, Effort::Medium);
        assert_eq!(settings.agent.default_agent, AgentId::Codex);
    }

    #[test]
    fn from_value_tolerates_wrong_section_types() {
        let settings = from_value(&json!({ "general": 5, "editor": { "ligatures": false } }));
        assert_eq!(settings.general, General::default());
        assert!(!settings.editor.ligatures);
    }

    #[test]
    fn numbers_are_clamped_and_version_is_stamped() {
        let settings =
            from_value(&json!({ "version": 0, "editor": { "fontSize": 99, "tabSize": 0 } }));
        assert_eq!(settings.version, SETTINGS_VERSION);
        assert_eq!(settings.editor.font_size, FONT_SIZE_RANGE.1);
        assert_eq!(settings.editor.tab_size, TAB_SIZE_RANGE.0);
    }

    #[test]
    fn apply_patch_merges_deeply() {
        let current = Settings::default();
        let next = apply_patch(
            &current,
            &json!({ "editor": { "wordWrap": true }, "general": { "reducedMotion": "always" } }),
        )
        .unwrap();
        assert!(next.editor.word_wrap);
        assert_eq!(next.editor.font_size, 13);
        assert_eq!(next.general.reduced_motion, ReducedMotion::Always);
        assert!(next.general.open_last_folder);
    }

    #[test]
    fn apply_patch_rejects_non_objects() {
        assert!(matches!(
            apply_patch(&Settings::default(), &json!([1])),
            Err(SettingsError::InvalidPatch)
        ));
    }

    #[test]
    fn load_missing_file_returns_defaults() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            load(&dir.path().join("settings.json")).unwrap(),
            Settings::default()
        );
    }

    #[test]
    fn save_then_load_roundtrip_leaves_no_temp_file() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("nested").join("settings.json");
        let mut settings = Settings::default();
        settings.editor.font_size = 15;
        settings.agent.approval_policy = ApprovalPolicy::AutoEdits;

        save(&file, &settings).unwrap();

        assert_eq!(load(&file).unwrap(), settings);
        assert!(!file.with_file_name("settings.json.tmp").exists());
    }

    #[test]
    fn load_corrupt_file_moves_it_aside_and_returns_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("settings.json");
        std::fs::write(&file, "{ not json").unwrap();

        assert_eq!(load(&file).unwrap(), Settings::default());
        assert!(!file.exists());
        let aside = dir.path().join("settings.json.corrupt");
        assert_eq!(std::fs::read_to_string(aside).unwrap(), "{ not json");
    }
}
