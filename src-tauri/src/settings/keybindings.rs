//! The user's shortcut overrides (`keybindings` in `settings.json`): action id to a binding
//! in canonical text form (`"mod+shift+g"`), or `null` for an action the user unbound.
//! Actions without an entry keep their default. The UI owns the keymap
//! (`src/features/keymap/`); this side only keeps the stored map well-formed, so a
//! hand-edited typo drops that one entry instead of the file.

use serde_json::Value;
use std::collections::BTreeMap;

/// Action id to binding (`None` = unbound).
pub type Keybindings = BTreeMap<String, Option<String>>;

/// The bindable actions. Mirrors `ACTIONS` in `src/features/keymap/actions.ts`
/// (`keymap/rustMirror.test.ts` checks that the two lists match).
pub const ACTION_IDS: &[&str] = &[
    "palette.open",
    "workspace.quickOpen",
    "search.findInFiles",
    "chat.new",
    "view.toggleSidebar",
    "view.explorer",
    "view.sessions",
    "view.inbox",
    "view.changes",
    "view.toggleTerminal",
    "terminal.new",
    "editor.save",
    "editor.closeTab",
    "settings.open",
    "view.zoomIn",
    "view.zoomOut",
    "view.zoomReset",
    "editor.addToChat",
    "diff.next",
    "diff.previous",
    "chat.stop",
];

const NAMED_KEYS: &[&str] = &[
    "enter",
    "escape",
    "tab",
    "space",
    "backspace",
    "delete",
    "insert",
    "home",
    "end",
    "pageup",
    "pagedown",
    "up",
    "down",
    "left",
    "right",
];

fn key_alias(key: &str) -> &str {
    match key {
        "esc" => "escape",
        "return" => "enter",
        "del" => "delete",
        "spacebar" => "space",
        "pgup" => "pageup",
        "pgdn" => "pagedown",
        "arrowup" => "up",
        "arrowdown" => "down",
        "arrowleft" => "left",
        "arrowright" => "right",
        "=" => "plus",
        other => other,
    }
}

fn modifier(part: &str) -> Option<usize> {
    // Index into [mod, ctrl, shift, alt], the canonical order.
    match part {
        "mod" | "cmd" | "command" | "meta" => Some(0),
        "ctrl" | "control" => Some(1),
        "shift" => Some(2),
        "alt" | "option" | "opt" => Some(3),
        _ => None,
    }
}

fn is_function_key(key: &str) -> bool {
    key.strip_prefix('f')
        .and_then(|n| n.parse::<u8>().ok())
        .is_some_and(|n| (1..=24).contains(&n) && !key.starts_with("f0"))
}

fn canonical_key(raw: &str) -> Option<String> {
    let key = key_alias(raw);
    if key == "plus" || NAMED_KEYS.contains(&key) || is_function_key(key) {
        return Some(key.to_owned());
    }
    let mut chars = key.chars();
    match (chars.next(), chars.next()) {
        (Some(c), None) if !c.is_whitespace() => Some(key.to_owned()),
        _ => None,
    }
}

/// The canonical form of a binding (`"Shift+Ctrl+G"` -> `"ctrl+shift+g"`), or `None` when
/// it is not one key with modifiers. Same grammar as `parseBinding` in
/// `src/features/keymap/binding.ts`.
pub fn normalize_binding(text: &str) -> Option<String> {
    let mut source = text.trim().to_lowercase();
    if source == "+" {
        source = "plus".into();
    } else if let Some(head) = source.strip_suffix("++") {
        source = format!("{head}+plus");
    }
    let parts: Vec<&str> = source.split('+').map(str::trim).collect();
    let (last, mods) = parts.split_last()?;
    let mut held = [false; 4];
    for part in mods {
        held[modifier(part)?] = true;
    }
    if modifier(last).is_some() {
        return None;
    }
    let key = canonical_key(last)?;
    let names = ["mod", "ctrl", "shift", "alt"];
    let mut out: Vec<&str> = names
        .iter()
        .zip(held)
        .filter_map(|(name, on)| on.then_some(*name))
        .collect();
    out.push(&key);
    Some(out.join("+"))
}

/// Reads the stored map, dropping unknown action ids and unreadable bindings one entry at
/// a time; anything that is not an object reads as no overrides.
pub fn sanitize(value: Option<&Value>) -> Keybindings {
    let Some(Value::Object(map)) = value else {
        return Keybindings::new();
    };
    map.iter()
        .filter(|(id, _)| ACTION_IDS.contains(&id.as_str()))
        .filter_map(|(id, binding)| match binding {
            Value::Null => Some((id.clone(), None)),
            Value::String(text) => normalize_binding(text).map(|b| (id.clone(), Some(b))),
            _ => None,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn normalizes_like_the_frontend() {
        for (input, expected) in [
            ("mod+k", "mod+k"),
            ("Shift+Ctrl+G", "ctrl+shift+g"),
            ("alt+shift+F5", "shift+alt+f5"),
            ("cmd+option+k", "mod+alt+k"),
            ("Ctrl+Esc", "ctrl+escape"),
            ("mod+ArrowUp", "mod+up"),
            ("mod++", "mod+plus"),
            ("mod+=", "mod+plus"),
            ("mod+-", "mod+-"),
            ("ctrl+`", "ctrl+`"),
            ("mod+ş", "mod+ş"),
            ("f12", "f12"),
        ] {
            assert_eq!(
                normalize_binding(input).as_deref(),
                Some(expected),
                "{input}"
            );
        }
    }

    #[test]
    fn rejects_what_is_not_one_key() {
        for input in [
            "",
            "mod",
            "mod+",
            "k+mod",
            "mod+k+l",
            "hyper+k",
            "mod+enterr",
            "f25",
            "f0",
        ] {
            assert_eq!(normalize_binding(input), None, "{input}");
        }
    }

    #[test]
    fn sanitize_drops_unknown_ids_and_bad_bindings_only() {
        let stored = json!({
            "chat.new": "Ctrl+Alt+N",
            "editor.save": null,
            "no.such.action": "mod+j",
            "view.changes": "mod+k+l",
            "view.inbox": 5
        });
        let kept = sanitize(Some(&stored));
        assert_eq!(
            kept,
            Keybindings::from([
                ("chat.new".into(), Some("ctrl+alt+n".into())),
                ("editor.save".into(), None),
            ])
        );
        assert!(sanitize(Some(&json!("mod+k"))).is_empty());
        assert!(sanitize(None).is_empty());
    }
}
