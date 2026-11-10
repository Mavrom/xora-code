//! "Edit and retry": `session/fork` cut at an earlier message. ACP v1 has no field for
//! the cut (its unstable `session/fork` copies the whole conversation), so the point
//! rides in an adapter extension. Everything that depends on that extension is here, so
//! an adapter upgrade has one place to check.

use serde_json::{Value, json};
use std::path::Path;

/// Adapters checked to read the fork point from `_meta.jetbrains.air.fork`, by the
/// `agentInfo` they send in `initialize` (name, version):
///
/// - `claude-agent-acp` 0.95.0: `dist/fork-session.js` `forkPoint` reads `{ version: 1,
///   messageId }` and forks with the Agent SDK's `forkSession(id, { upToMessageId })`,
///   keeping the assistant message with that id (its Anthropic `msg_…` id, the
///   `messageId` stamped on `agent_message_chunk`). An unknown id is an error.
/// - `codex-acp` 2.2.2: `dist/index.js` `readAirForkPoint` / `resolveForkTurnId` find the
///   turn holding the item with that id (the `messageId` on its chunks) and fork with
///   `thread/fork { lastTurnId }`, keeping that turn. An unknown id is an error.
///
/// Any other adapter or version (one that may ignore the `_meta` and copy the whole
/// conversation) is not asked; the chat falls back to a new chat seeded with the
/// transcript. Re-check both files before changing a pinned version in `registry.rs`
/// (a test fails until this list follows it).
pub const FORK_POINT_ADAPTERS: [(&str, &str); 2] = [
    ("@agentclientprotocol/claude-agent-acp", "0.95.0"),
    ("@agentclientprotocol/codex-acp", "2.2.2"),
];

/// Whether this adapter (its `initialize` result) can fork at a message: it advertises
/// `sessionCapabilities.fork` and is one of [`FORK_POINT_ADAPTERS`].
pub fn fork_point_supported(init: &Value) -> bool {
    let advertised = init
        .pointer("/agentCapabilities/sessionCapabilities/fork")
        .is_some_and(|v| !v.is_null() && v != &Value::Bool(false));
    let info = |key: &str| {
        init.get("agentInfo")
            .and_then(|i| i.get(key))
            .and_then(Value::as_str)
    };
    advertised
        && FORK_POINT_ADAPTERS
            .iter()
            .any(|(name, version)| info("name") == Some(name) && info("version") == Some(version))
}

/// `session/fork` params: a new session holding `session_id`'s conversation up to and
/// including the agent message `message_id`.
pub fn fork_request(session_id: &str, cwd: &Path, message_id: &str) -> Value {
    json!({
        "sessionId": session_id,
        "cwd": cwd,
        "mcpServers": [],
        "_meta": { "jetbrains": { "air": { "fork": { "version": 1, "messageId": message_id } } } }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::registry::SPECS;

    fn init(name: &str, version: &str, fork: Value) -> Value {
        json!({
            "protocolVersion": 1,
            "agentInfo": { "name": name, "version": version },
            "agentCapabilities": { "loadSession": true, "sessionCapabilities": { "fork": fork } }
        })
    }

    #[test]
    fn request_carries_the_fork_point_both_adapters_read() {
        let req = fork_request("s-1", Path::new("C:\\repo"), "msg_01ABC");
        assert_eq!(req["sessionId"], "s-1");
        assert_eq!(req["cwd"], "C:\\repo");
        assert_eq!(req["mcpServers"], json!([]));
        // claude-agent-acp `forkPoint` and codex-acp `readAirForkPoint` both require
        // `version === 1` and a non-empty `messageId` at exactly this path.
        assert_eq!(
            req["_meta"]["jetbrains"]["air"]["fork"],
            json!({ "version": 1, "messageId": "msg_01ABC" })
        );
    }

    #[test]
    fn verified_adapters_that_advertise_fork_are_asked() {
        for (name, version) in FORK_POINT_ADAPTERS {
            assert!(fork_point_supported(&init(name, version, json!({}))));
        }
    }

    #[test]
    fn no_capability_no_fork() {
        let (name, version) = FORK_POINT_ADAPTERS[0];
        assert!(!fork_point_supported(&init(name, version, Value::Null)));
        assert!(!fork_point_supported(&init(name, version, json!(false))));
        let mut bare = init(name, version, json!({}));
        bare["agentCapabilities"] = json!({ "loadSession": true });
        assert!(!fork_point_supported(&bare));
    }

    #[test]
    fn unknown_adapters_and_versions_are_not_asked() {
        // Gemini CLI advertises no fork at all; an unchecked adapter could ignore the cut.
        assert!(!fork_point_supported(&init(
            "gemini-cli",
            "0.65.0",
            json!({})
        )));
        assert!(!fork_point_supported(&init(
            "some-agent",
            "1.0.0",
            json!({})
        )));
        let (name, _) = FORK_POINT_ADAPTERS[1];
        assert!(!fork_point_supported(&init(name, "9.9.9", json!({}))));
        assert!(!fork_point_supported(&json!({})));
    }

    #[test]
    fn verified_versions_follow_the_pinned_adapters() {
        for (name, version) in FORK_POINT_ADAPTERS {
            let spec = SPECS
                .iter()
                .find(|s| s.package == name)
                .expect("a verified adapter is a pinned one");
            assert_eq!(
                spec.version, version,
                "{name} was upgraded: re-check its fork point (see FORK_POINT_ADAPTERS)"
            );
        }
    }
}
