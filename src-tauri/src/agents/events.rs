//! Shared event contract between the Rust agent core and the frontend
//! (design doc section 5.1). Mirrored one-to-one by
//! `src/features/agents/types.ts`; change both together.

use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, Copy, Serialize, serde::Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum AgentId {
    Claude,
    Codex,
    Gemini,
}

#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "state",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum AgentStatus {
    /// `reason`: "node-missing" | "node-too-old" | "package-missing".
    NotInstalled {
        reason: String,
    },
    Installing {
        progress: Option<f32>,
    },
    Starting,
    Ready {
        agent_info: Value,
        capabilities: Value,
        auth_methods: Value,
    },
    AuthRequired {
        auth_methods: Value,
    },
    Crashed {
        code: Option<i32>,
        stderr_tail: Vec<String>,
    },
    Stopped,
}

#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum AgentEvent {
    AgentStatus {
        agent_id: AgentId,
        status: AgentStatus,
    },
    /// Raw ACP `SessionUpdate` object (has `sessionUpdate` discriminator); passed through unmodified.
    SessionUpdate {
        session_id: String,
        update: Value,
    },
    PermissionRequested {
        request_id: String,
        session_id: String,
        tool_call: Value,
        options: Value,
    },
    PermissionResolved {
        request_id: String,
        option_id: Option<String>,
    },
    /// `stop_reason`: end_turn | max_tokens | max_turn_requests | refusal | cancelled.
    TurnEnded {
        session_id: String,
        stop_reason: String,
    },
    TurnFailed {
        session_id: String,
        message: String,
        code: Option<i32>,
    },
    FileWritten {
        session_id: String,
        path: String,
    },
    TerminalOutput {
        session_id: String,
        terminal_id: String,
        chunk: String,
    },
    TerminalExited {
        session_id: String,
        terminal_id: String,
        exit_code: Option<i32>,
        signal: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSetup {
    pub session_id: String,
    pub agent_id: AgentId,
    /// ACP `SessionModeState`.
    pub modes: Option<Value>,
    /// ACP `SessionConfigOption[]`.
    pub config_options: Option<Value>,
    /// Legacy unstable (Gemini): `{ availableModels, currentModelId }`.
    pub models: Option<Value>,
    pub agent_capabilities: Value,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn to_json<T: Serialize>(value: &T) -> Value {
        serde_json::to_value(value).unwrap()
    }

    #[test]
    fn agent_id_is_lowercase() {
        assert_eq!(to_json(&AgentId::Claude), json!("claude"));
        let parsed: AgentId = serde_json::from_value(json!("gemini")).unwrap();
        assert_eq!(parsed, AgentId::Gemini);
    }

    #[test]
    fn status_uses_state_tag_and_camel_case_fields() {
        let status = AgentStatus::Crashed {
            code: Some(1),
            stderr_tail: vec!["boom".into()],
        };
        assert_eq!(
            to_json(&status),
            json!({ "state": "crashed", "code": 1, "stderrTail": ["boom"] })
        );
        assert_eq!(
            to_json(&AgentStatus::Starting),
            json!({ "state": "starting" })
        );
        let missing = AgentStatus::NotInstalled {
            reason: "node-missing".into(),
        };
        assert_eq!(
            to_json(&missing),
            json!({ "state": "notInstalled", "reason": "node-missing" })
        );
        let ready = AgentStatus::Ready {
            agent_info: Value::Null,
            capabilities: json!({}),
            auth_methods: json!([]),
        };
        assert_eq!(
            to_json(&ready),
            json!({ "state": "ready", "agentInfo": null, "capabilities": {}, "authMethods": [] })
        );
    }

    #[test]
    fn events_use_type_tag_and_camel_case_fields() {
        let ev = AgentEvent::AgentStatus {
            agent_id: AgentId::Codex,
            status: AgentStatus::Stopped,
        };
        assert_eq!(
            to_json(&ev),
            json!({ "type": "agentStatus", "agentId": "codex", "status": { "state": "stopped" } })
        );
        let ev = AgentEvent::TerminalExited {
            session_id: "s".into(),
            terminal_id: "t".into(),
            exit_code: None,
            signal: None,
        };
        assert_eq!(
            to_json(&ev),
            json!({
                "type": "terminalExited", "sessionId": "s", "terminalId": "t",
                "exitCode": null, "signal": null
            })
        );
    }

    #[test]
    fn session_update_passes_raw_value_through() {
        let update = json!({ "sessionUpdate": "agent_message_chunk", "content": { "type": "text", "text": "hi" } });
        let ev = AgentEvent::SessionUpdate {
            session_id: "s1".into(),
            update: update.clone(),
        };
        assert_eq!(
            to_json(&ev),
            json!({ "type": "sessionUpdate", "sessionId": "s1", "update": update })
        );
    }

    #[test]
    fn session_setup_is_camel_case() {
        let setup = SessionSetup {
            session_id: "s1".into(),
            agent_id: AgentId::Gemini,
            modes: None,
            config_options: None,
            models: Some(json!({ "availableModels": [], "currentModelId": "auto" })),
            agent_capabilities: json!({ "loadSession": true }),
        };
        assert_eq!(
            to_json(&setup),
            json!({
                "sessionId": "s1", "agentId": "gemini", "modes": null, "configOptions": null,
                "models": { "availableModels": [], "currentModelId": "auto" },
                "agentCapabilities": { "loadSession": true }
            })
        );
    }
}
