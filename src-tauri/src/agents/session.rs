//! Per-session state shared between the core and the client bridges.

use super::events::{AgentId, SessionSetup};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

#[derive(Debug, Clone)]
pub struct SessionState {
    pub agent_id: AgentId,
    /// Workspace folder the session was opened in (ACP `cwd`).
    pub cwd: PathBuf,
    /// Allowed roots for fs/terminal access: `cwd` plus any additional directories.
    pub roots: Vec<PathBuf>,
    /// Latest controls snapshot (modes / configOptions / models).
    pub setup: SessionSetup,
    /// A `session/prompt` is in flight.
    pub turn_active: bool,
}

impl SessionState {
    pub fn new(agent_id: AgentId, cwd: PathBuf, setup: SessionSetup) -> Self {
        Self {
            agent_id,
            roots: vec![cwd.clone()],
            cwd,
            setup,
            turn_active: false,
        }
    }
}

/// Cheaply cloneable map of open sessions keyed by ACP session id.
#[derive(Debug, Clone, Default)]
pub struct SessionRegistry(Arc<Mutex<HashMap<String, SessionState>>>);

impl SessionRegistry {
    fn lock(&self) -> MutexGuard<'_, HashMap<String, SessionState>> {
        // Entries are replaced whole, so a poisoned map is still consistent.
        self.0.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn insert(&self, state: SessionState) {
        self.lock().insert(state.setup.session_id.clone(), state);
    }

    pub fn remove(&self, session_id: &str) -> Option<SessionState> {
        self.lock().remove(session_id)
    }

    pub fn get(&self, session_id: &str) -> Option<SessionState> {
        self.lock().get(session_id).cloned()
    }

    /// Workspace roots an fs/terminal request of this session may touch.
    /// `None` means the session is unknown and the request must be rejected.
    pub fn roots(&self, session_id: &str) -> Option<Vec<PathBuf>> {
        self.lock().get(session_id).map(|s| s.roots.clone())
    }

    pub fn agent_of(&self, session_id: &str) -> Option<AgentId> {
        self.lock().get(session_id).map(|s| s.agent_id)
    }

    /// Applies `f` to the session if it exists; returns whether it did.
    pub fn update(&self, session_id: &str, f: impl FnOnce(&mut SessionState)) -> bool {
        match self.lock().get_mut(session_id) {
            Some(state) => {
                f(state);
                true
            }
            None => false,
        }
    }

    /// Ids of all sessions hosted by `agent_id`.
    pub fn ids_for(&self, agent_id: AgentId) -> Vec<String> {
        let map = self.lock();
        map.iter()
            .filter(|(_, s)| s.agent_id == agent_id)
            .map(|(id, _)| id.clone())
            .collect()
    }

    pub fn all_ids(&self) -> Vec<String> {
        self.lock().keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn state(id: &str, agent_id: AgentId) -> SessionState {
        let setup = SessionSetup {
            session_id: id.into(),
            agent_id,
            modes: None,
            config_options: None,
            models: None,
            agent_capabilities: json!({}),
        };
        SessionState::new(agent_id, PathBuf::from(r"C:\work"), setup)
    }

    #[test]
    fn roots_default_to_cwd_and_unknown_session_is_none() {
        let reg = SessionRegistry::default();
        reg.insert(state("s1", AgentId::Claude));
        assert_eq!(reg.roots("s1"), Some(vec![PathBuf::from(r"C:\work")]));
        assert_eq!(reg.roots("nope"), None);
    }

    #[test]
    fn update_and_filter_by_agent() {
        let reg = SessionRegistry::default();
        reg.insert(state("a", AgentId::Claude));
        reg.insert(state("b", AgentId::Gemini));
        assert!(reg.update("a", |s| s.turn_active = true));
        assert!(!reg.update("zz", |_| {}));
        assert!(reg.get("a").unwrap().turn_active);
        assert_eq!(reg.ids_for(AgentId::Gemini), vec!["b".to_string()]);
        assert_eq!(reg.remove("a").map(|s| s.agent_id), Some(AgentId::Claude));
        assert_eq!(reg.all_ids(), vec!["b".to_string()]);
    }
}
