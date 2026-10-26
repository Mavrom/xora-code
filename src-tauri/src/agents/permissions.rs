//! `session/request_permission` round trip (design doc 3.7): the agent waits
//! while the user picks an option in the UI. `None` means "cancelled".

use std::collections::HashMap;
use std::sync::{Arc, Mutex, PoisonError};
use tokio::sync::oneshot;

struct Pending {
    session_id: String,
    tx: oneshot::Sender<Option<String>>,
}

#[derive(Clone, Default)]
pub struct PermissionBroker {
    pending: Arc<Mutex<HashMap<String, Pending>>>,
}

impl PermissionBroker {
    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<String, Pending>> {
        self.pending.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Registers a request and returns its id plus the receiver for the answer.
    pub fn open(&self, session_id: &str) -> (String, oneshot::Receiver<Option<String>>) {
        let id = format!("perm_{}", uuid::Uuid::new_v4().simple());
        let (tx, rx) = oneshot::channel();
        self.lock().insert(
            id.clone(),
            Pending {
                session_id: session_id.to_owned(),
                tx,
            },
        );
        (id, rx)
    }

    /// The user's answer. Returns false for an unknown or already answered id.
    pub fn respond(&self, request_id: &str, option_id: Option<String>) -> bool {
        match self.lock().remove(request_id) {
            Some(pending) => pending.tx.send(option_id).is_ok(),
            None => false,
        }
    }

    /// Cancels every open request of a session; returns their ids.
    pub fn cancel_session(&self, session_id: &str) -> Vec<String> {
        let mut map = self.lock();
        let ids: Vec<String> = map
            .iter()
            .filter(|(_, p)| p.session_id == session_id)
            .map(|(id, _)| id.clone())
            .collect();
        for id in &ids {
            if let Some(pending) = map.remove(id) {
                let _ = pending.tx.send(None);
            }
        }
        ids
    }

    /// Cancels everything (agent crash or app shutdown); returns the ids.
    pub fn cancel_all(&self) -> Vec<String> {
        let mut map = self.lock();
        let ids: Vec<String> = map.keys().cloned().collect();
        for (_, pending) in map.drain() {
            let _ = pending.tx.send(None);
        }
        ids
    }
}

/// The ACP result for an answered (or cancelled) permission request.
pub fn outcome_json(option_id: Option<&str>) -> serde_json::Value {
    match option_id {
        Some(id) => serde_json::json!({ "outcome": { "outcome": "selected", "optionId": id } }),
        None => serde_json::json!({ "outcome": { "outcome": "cancelled" } }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn respond_delivers_the_choice_once() {
        let broker = PermissionBroker::default();
        let (id, rx) = broker.open("s1");
        assert!(broker.respond(&id, Some("allow".into())));
        assert_eq!(rx.await.unwrap(), Some("allow".to_owned()));
        assert!(!broker.respond(&id, None));
    }

    #[tokio::test]
    async fn cancel_session_only_touches_that_session() {
        let broker = PermissionBroker::default();
        let (a, rx_a) = broker.open("s1");
        let (b, rx_b) = broker.open("s2");
        assert_eq!(broker.cancel_session("s1"), vec![a]);
        assert_eq!(rx_a.await.unwrap(), None);
        assert!(broker.respond(&b, Some("x".into())));
        assert_eq!(rx_b.await.unwrap(), Some("x".to_owned()));
    }

    #[test]
    fn outcome_shapes_match_acp() {
        assert_eq!(
            outcome_json(Some("o1")),
            serde_json::json!({ "outcome": { "outcome": "selected", "optionId": "o1" } })
        );
        assert_eq!(
            outcome_json(None),
            serde_json::json!({ "outcome": { "outcome": "cancelled" } })
        );
    }
}
