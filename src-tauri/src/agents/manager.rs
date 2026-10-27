//! `AgentManager` (design doc 3.3): one adapter process per agent kind, many
//! sessions per process. Owns the connections, routes incoming requests to
//! the bridges and the permission broker, and reports everything to the UI
//! through the single `EventSink`.

use super::acp::{ClientHandlers, RpcError};
use super::bridge::Bridges;
use super::events::{AgentEvent, AgentId, AgentStatus, EventSink, SessionSetup};
use super::index::{self, Mark, SessionEntry, SessionIndex};
use super::permissions::{PermissionBroker, outcome_json};
use super::process::{self, AgentProcess, JobObject, LaunchSpec, SharedStderrTail};
use super::registry::{self, AgentSpec, NodeRuntime};
use super::session::{SessionRegistry, SessionState};
use super::transport::{self, IncomingHandler, Responder, RpcPeer};
use serde::Serialize;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, PoisonError, Weak};
use tokio::io::BufReader;

/// `agents_list` row.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInfo {
    pub id: AgentId,
    pub display_name: &'static str,
    pub version: &'static str,
    pub status: AgentStatus,
}

/// What a spawn needs from the user's settings.
#[derive(Debug, Clone, Copy, Default)]
pub struct LaunchPrefs {
    pub claude_ignore_api_key: bool,
    pub debug_logs: bool,
}

/// Error crossing IPC. `-32000` is prefixed `auth_required:` for the UI.
#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("{0}")]
    Rpc(RpcError),
    #[error("{0}")]
    Unavailable(String),
    #[error("unknown session")]
    UnknownSession,
    #[error("session history could not be saved: {0}")]
    History(#[from] std::io::Error),
}

impl AgentError {
    pub fn ipc_message(&self) -> String {
        match self {
            Self::Rpc(err) if err.code == RpcError::AUTH_REQUIRED => {
                format!("auth_required:{}", err.message)
            }
            other => other.to_string(),
        }
    }
}

impl From<RpcError> for AgentError {
    fn from(err: RpcError) -> Self {
        Self::Rpc(err)
    }
}

type Result<T> = std::result::Result<T, AgentError>;

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(PoisonError::into_inner)
}

/// The adapter's child plus its kill-on-close job (pipes go to the transport).
struct ProcHandle {
    child: tokio::process::Child,
    job: Option<JobObject>,
}

/// A live adapter process.
struct Connection {
    agent: AgentId,
    peer: Arc<RpcPeer>,
    /// `initialize` result: `agentCapabilities`, `authMethods`, `agentInfo`.
    init: Value,
    process: Mutex<Option<ProcHandle>>,
    stderr: SharedStderrTail,
    entry: PathBuf,
    node: PathBuf,
}

impl Connection {
    fn capabilities(&self) -> Value {
        self.init
            .get("agentCapabilities")
            .cloned()
            .unwrap_or(json!({}))
    }

    fn auth_methods(&self) -> Value {
        self.init.get("authMethods").cloned().unwrap_or(json!([]))
    }

    fn supports(&self, pointer: &str) -> bool {
        self.capabilities()
            .pointer(pointer)
            .is_some_and(|v| !v.is_null() && v != &Value::Bool(false))
    }
}

struct Inner {
    events: EventSink,
    sessions: SessionRegistry,
    bridges: Bridges,
    broker: PermissionBroker,
    index: SessionIndex,
    conns: tokio::sync::Mutex<HashMap<AgentId, Arc<Connection>>>,
    statuses: Mutex<HashMap<AgentId, AgentStatus>>,
    /// Diffs seen on a tool call, recorded for review once the call completes.
    pending_diffs: Mutex<PendingDiffs>,
    agents_dir: Mutex<Option<PathBuf>>,
    shutting_down: AtomicBool,
}

/// Tauri state. Cheap to clone.
#[derive(Clone)]
pub struct AgentManager(Arc<Inner>);

impl Default for AgentManager {
    fn default() -> Self {
        let events = EventSink::default();
        let sessions = SessionRegistry::default();
        let bridges = Bridges::new(sessions.clone(), events.clone());
        Self(Arc::new(Inner {
            events,
            sessions,
            bridges,
            broker: PermissionBroker::default(),
            index: SessionIndex::default(),
            conns: tokio::sync::Mutex::new(HashMap::new()),
            statuses: Mutex::new(HashMap::new()),
            pending_diffs: Mutex::new(PendingDiffs::default()),
            agents_dir: Mutex::new(None),
            shutting_down: AtomicBool::new(false),
        }))
    }
}

impl AgentManager {
    /// Called once paths are known (app data dir).
    pub fn configure(&self, app_data: &Path) {
        let agents_dir = app_data.join("agents");
        self.0.index.set_path(agents_dir.join("sessions.json"));
        *lock(&self.0.agents_dir) = Some(agents_dir);
    }

    pub fn subscribe(&self, emit: impl Fn(AgentEvent) + Send + Sync + 'static) {
        self.0.events.set(emit);
    }

    fn agents_dir(&self) -> Result<PathBuf> {
        lock(&self.0.agents_dir)
            .clone()
            .ok_or_else(|| AgentError::Unavailable("agents folder not configured".into()))
    }

    fn set_status(&self, agent: AgentId, status: AgentStatus) {
        lock(&self.0.statuses).insert(agent, status.clone());
        self.0.events.emit(AgentEvent::AgentStatus {
            agent_id: agent,
            status,
        });
    }

    /// Static status for agents that are not running.
    fn idle_status(&self, spec: &AgentSpec, node: Option<&NodeRuntime>) -> AgentStatus {
        // An install in progress wins: the package is not on disk yet by definition.
        if let Some(status @ AgentStatus::Installing { .. }) = lock(&self.0.statuses).get(&spec.id)
        {
            return status.clone();
        }
        let dir = self.agents_dir().ok();
        match dir
            .as_deref()
            .and_then(|d| registry::missing_reason(spec, node, d))
        {
            Some(reason) => AgentStatus::NotInstalled {
                reason: reason.into(),
            },
            None => lock(&self.0.statuses)
                .get(&spec.id)
                .cloned()
                .unwrap_or(AgentStatus::Stopped),
        }
    }

    pub async fn list(&self) -> Vec<AgentInfo> {
        let node = tokio::task::spawn_blocking(registry::find_node)
            .await
            .ok()
            .flatten();
        let conns = self.0.conns.lock().await;
        registry::SPECS
            .iter()
            .map(|spec| {
                let status = if conns.contains_key(&spec.id) {
                    lock(&self.0.statuses)
                        .get(&spec.id)
                        .cloned()
                        .unwrap_or(AgentStatus::Starting)
                } else {
                    self.idle_status(spec, node.as_ref())
                };
                AgentInfo {
                    id: spec.id,
                    display_name: spec.display_name,
                    version: spec.version,
                    status,
                }
            })
            .collect()
    }

    /// Installs the pinned adapter in the background; progress via `agentStatus`.
    pub fn install(&self, agent: AgentId) -> Result<()> {
        let agents_dir = self.agents_dir()?;
        let this = self.clone();
        tauri::async_runtime::spawn(async move {
            let spec = registry::spec(agent);
            this.set_status(agent, AgentStatus::Installing { progress: None });
            let node = tokio::task::spawn_blocking(registry::find_node)
                .await
                .ok()
                .flatten();
            let result = match &node {
                Some(node) if node.major >= spec.min_node_major => {
                    super::install::install(spec, node, &agents_dir).await
                }
                _ => Err("node".into()),
            };
            lock(&this.0.statuses).remove(&agent);
            let status = match result {
                Ok(()) => AgentStatus::Stopped,
                Err(_) => this.idle_status(spec, node.as_ref()),
            };
            this.set_status(agent, status);
        });
        Ok(())
    }

    /// Returns the running connection, starting the adapter if needed.
    async fn connection(
        &self,
        agent: AgentId,
        cwd: &Path,
        prefs: LaunchPrefs,
    ) -> Result<Arc<Connection>> {
        let mut conns = self.0.conns.lock().await;
        if let Some(conn) = conns.get(&agent) {
            if !conn.peer.is_closed() {
                return Ok(Arc::clone(conn));
            }
            conns.remove(&agent);
        }
        let conn = self.start(agent, cwd, prefs).await?;
        conns.insert(agent, Arc::clone(&conn));
        Ok(conn)
    }

    async fn start(
        &self,
        agent: AgentId,
        cwd: &Path,
        prefs: LaunchPrefs,
    ) -> Result<Arc<Connection>> {
        let spec = registry::spec(agent);
        let agents_dir = self.agents_dir()?;
        let node = tokio::task::spawn_blocking(registry::find_node)
            .await
            .ok()
            .flatten();
        if let Some(reason) = registry::missing_reason(spec, node.as_ref(), &agents_dir) {
            self.set_status(
                agent,
                AgentStatus::NotInstalled {
                    reason: reason.into(),
                },
            );
            return Err(AgentError::Unavailable(reason.into()));
        }
        let (node, entry) = match (node, spec.entry(&agents_dir)) {
            (Some(node), Some(entry)) => (node, entry),
            _ => return Err(AgentError::Unavailable("package-missing".into())),
        };
        self.set_status(agent, AgentStatus::Starting);

        // The adapter is shared by every session of this agent, each of which names its own
        // folder. Starting it in the first session's folder would pin that folder (Windows
        // cannot delete a process's working directory), e.g. a worktree about to be removed.
        let process_dir = home_dir().unwrap_or_else(|| cwd.to_path_buf());
        let launch = launch_spec(spec, &node.exe, &entry, &process_dir, prefs, &agents_dir);
        let AgentProcess {
            child,
            job,
            stdin,
            stdout,
            stderr_tail: stderr,
        } = process::spawn(&launch).map_err(|err| {
            let message = format!("{} could not start: {err}", spec.display_name);
            // Never leave the UI on "connecting" after a failed start.
            self.set_status(
                agent,
                AgentStatus::Crashed {
                    code: None,
                    stderr_tail: vec![message.clone()],
                },
            );
            AgentError::Unavailable(message)
        })?;
        let mut proc = ProcHandle { child, job };

        let handler = Arc::new(ConnHandler {
            agent,
            manager: Arc::downgrade(&self.0),
        });
        let (peer, _reader) = transport::start(BufReader::new(stdout), stdin, handler);

        let init = peer.request("initialize", initialize_params()).await;
        let init = match init {
            Ok(init) => init,
            Err(err) => {
                let code = proc.child.try_wait().ok().flatten().and_then(|s| s.code());
                self.set_status(
                    agent,
                    AgentStatus::Crashed {
                        code,
                        stderr_tail: process::stderr_snapshot(&stderr),
                    },
                );
                return Err(err.into());
            }
        };
        let conn = Arc::new(Connection {
            agent,
            peer,
            init,
            process: Mutex::new(Some(proc)),
            stderr,
            entry,
            node: node.exe,
        });
        self.set_status(
            agent,
            AgentStatus::Ready {
                agent_info: conn.init.get("agentInfo").cloned().unwrap_or(Value::Null),
                capabilities: conn.capabilities(),
                auth_methods: conn.auth_methods(),
            },
        );
        Ok(conn)
    }

    async fn conn_for_session(&self, session_id: &str) -> Result<Arc<Connection>> {
        let agent = self
            .0
            .sessions
            .agent_of(session_id)
            .ok_or(AgentError::UnknownSession)?;
        self.0
            .conns
            .lock()
            .await
            .get(&agent)
            .cloned()
            .ok_or(AgentError::UnknownSession)
    }

    fn auth_required(&self, conn: &Connection, err: &RpcError) {
        if err.code == RpcError::AUTH_REQUIRED {
            self.set_status(
                conn.agent,
                AgentStatus::AuthRequired {
                    auth_methods: conn.auth_methods(),
                },
            );
        }
    }

    fn register(
        &self,
        conn: &Connection,
        cwd: &Path,
        result: &Value,
        session_id: String,
    ) -> SessionSetup {
        let setup = SessionSetup {
            session_id: session_id.clone(),
            agent_id: conn.agent,
            modes: result.get("modes").cloned().filter(|v| !v.is_null()),
            config_options: result
                .get("configOptions")
                .cloned()
                .filter(|v| !v.is_null()),
            models: result.get("models").cloned().filter(|v| !v.is_null()),
            agent_capabilities: conn.capabilities(),
        };
        self.0.sessions.insert(SessionState::new(
            conn.agent,
            cwd.to_path_buf(),
            setup.clone(),
        ));
        // The history index only learns about a session once a prompt is sent
        // (see `prompt`): warm, never-used sessions must not clutter the list.
        setup
    }

    pub async fn session_new(
        &self,
        agent: AgentId,
        cwd: PathBuf,
        prefs: LaunchPrefs,
    ) -> Result<SessionSetup> {
        let conn = self.connection(agent, &cwd, prefs).await?;
        let params = json!({ "cwd": cwd, "mcpServers": [] });
        let result = conn
            .peer
            .request("session/new", params)
            .await
            .inspect_err(|err| {
                self.auth_required(&conn, err);
            })?;
        let session_id = result
            .get("sessionId")
            .and_then(Value::as_str)
            .ok_or_else(|| RpcError::internal("agent returned no sessionId"))?
            .to_owned();
        Ok(self.register(&conn, &cwd, &result, session_id))
    }

    /// `session/load` (replays history as updates) or `session/resume`.
    pub async fn session_open(
        &self,
        agent: AgentId,
        session_id: String,
        cwd: PathBuf,
        resume: bool,
        prefs: LaunchPrefs,
    ) -> Result<SessionSetup> {
        let conn = self.connection(agent, &cwd, prefs).await?;
        let (method, capability) = if resume {
            ("session/resume", "/sessionCapabilities/resume")
        } else {
            ("session/load", "/loadSession")
        };
        if !conn.supports(capability) {
            return Err(RpcError::method_not_found(method).into());
        }
        // Register first: the replay may already need the workspace roots.
        let placeholder = SessionSetup {
            session_id: session_id.clone(),
            agent_id: agent,
            modes: None,
            config_options: None,
            models: None,
            agent_capabilities: conn.capabilities(),
        };
        self.0
            .sessions
            .insert(SessionState::new(agent, cwd.clone(), placeholder));
        let params = json!({ "sessionId": session_id, "cwd": cwd, "mcpServers": [] });
        let result = conn.peer.request(method, params).await.inspect_err(|err| {
            self.0.sessions.remove(&session_id);
            self.auth_required(&conn, err);
        })?;
        Ok(self.register(&conn, &cwd, &result, session_id))
    }

    pub async fn session_close(&self, session_id: &str) -> Result<()> {
        if let Ok(conn) = self.conn_for_session(session_id).await
            && conn.supports("/sessionCapabilities/close")
        {
            let _ = conn
                .peer
                .request("session/close", json!({ "sessionId": session_id }))
                .await;
        }
        self.cancel_permissions(session_id);
        lock(&self.0.pending_diffs).forget(session_id);
        self.0.bridges.session_closed(session_id).await;
        self.0.sessions.remove(session_id);
        Ok(())
    }

    /// Moves a conversation into or out of the archive (a local mark; agents have no archive).
    pub fn session_archive(
        &self,
        agent: AgentId,
        session_id: &str,
        cwd: &Path,
        archived: bool,
    ) -> Result<()> {
        self.0
            .index
            .mark(
                agent,
                session_id,
                &cwd.to_string_lossy(),
                Mark::Archived(archived),
            )
            .map_err(AgentError::from)
    }

    /// Records a user mark (pin, rename) on a conversation in the local index.
    pub fn session_mark(
        &self,
        agent: AgentId,
        session_id: &str,
        cwd: &Path,
        mark: Mark,
    ) -> Result<()> {
        self.0
            .index
            .mark(agent, session_id, &cwd.to_string_lossy(), mark)
            .map_err(AgentError::from)
    }

    /// Deletes a conversation: closes it if open, asks a running agent that supports
    /// `session/delete` to drop it too, and leaves a tombstone so it never lists again.
    pub async fn session_delete(&self, agent: AgentId, session_id: &str, cwd: &Path) -> Result<()> {
        if self.0.sessions.agent_of(session_id).is_some() {
            self.session_close(session_id).await?;
        }
        let conn = self.0.conns.lock().await.get(&agent).cloned();
        if let Some(conn) = conn.filter(|c| c.supports("/sessionCapabilities/delete")) {
            // The tombstone below hides it either way; an agent-side failure only means
            // its own history keeps a copy.
            let _ = conn
                .peer
                .request("session/delete", json!({ "sessionId": session_id }))
                .await;
        }
        self.0
            .index
            .mark(agent, session_id, &cwd.to_string_lossy(), Mark::Deleted)
            .map_err(AgentError::from)
    }

    pub async fn sessions_list(&self, agent: AgentId, cwd: PathBuf) -> Vec<SessionEntry> {
        let local = self.0.index.list(agent, &cwd.to_string_lossy());
        let conn = self.0.conns.lock().await.get(&agent).cloned();
        let mut remote = Vec::new();
        if let Some(conn) = conn.filter(|c| c.supports("/sessionCapabilities/list"))
            && let Ok(result) = conn
                .peer
                .request("session/list", json!({ "cwd": cwd }))
                .await
        {
            remote = parse_session_list(agent, &cwd, &result);
        }
        index::merge(remote, local)
    }

    pub async fn prompt(&self, session_id: String, blocks: Value) -> Result<()> {
        let conn = self.conn_for_session(&session_id).await?;
        self.0.bridges.turn_started(&session_id);
        self.0
            .sessions
            .update(&session_id, |s| s.turn_active = true);
        let this = self.clone();
        tauri::async_runtime::spawn(async move {
            let params = json!({ "sessionId": session_id, "prompt": blocks });
            let result = conn.peer.request("session/prompt", params).await;
            this.0
                .sessions
                .update(&session_id, |s| s.turn_active = false);
            match result {
                Ok(value) => {
                    let stop_reason = value
                        .get("stopReason")
                        .and_then(Value::as_str)
                        .unwrap_or("end_turn")
                        .to_owned();
                    if let Some(state) = this.0.sessions.get(&session_id) {
                        this.0.index.touch(
                            state.agent_id,
                            &session_id,
                            &state.cwd.to_string_lossy(),
                            None,
                        );
                    }
                    this.0.events.emit(AgentEvent::TurnEnded {
                        session_id,
                        stop_reason,
                    });
                }
                Err(err) => {
                    this.auth_required(&conn, &err);
                    this.0.events.emit(AgentEvent::TurnFailed {
                        session_id,
                        message: err.message,
                        code: Some(err.code),
                    });
                }
            }
        });
        Ok(())
    }

    fn cancel_permissions(&self, session_id: &str) {
        for request_id in self.0.broker.cancel_session(session_id) {
            self.0.events.emit(AgentEvent::PermissionResolved {
                request_id,
                option_id: None,
            });
        }
    }

    pub async fn cancel(&self, session_id: &str) -> Result<()> {
        self.cancel_permissions(session_id);
        let conn = self.conn_for_session(session_id).await?;
        conn.peer
            .notify("session/cancel", json!({ "sessionId": session_id }))?;
        Ok(())
    }

    pub async fn set_config_option(
        &self,
        session_id: &str,
        config_id: &str,
        value: Value,
    ) -> Result<Value> {
        let conn = self.conn_for_session(session_id).await?;
        let params = json!({ "sessionId": session_id, "configId": config_id, "value": value });
        let result = conn
            .peer
            .request("session/set_config_option", params)
            .await?;
        let options = result.get("configOptions").cloned().unwrap_or(json!([]));
        let stored = options.clone();
        self.0
            .sessions
            .update(session_id, |s| s.setup.config_options = Some(stored));
        Ok(options)
    }

    pub async fn set_mode(&self, session_id: &str, mode_id: &str) -> Result<()> {
        let conn = self.conn_for_session(session_id).await?;
        conn.peer
            .request(
                "session/set_mode",
                json!({ "sessionId": session_id, "modeId": mode_id }),
            )
            .await?;
        Ok(())
    }

    /// Legacy/unstable `session/set_model` (Gemini 0.65).
    pub async fn set_model(&self, session_id: &str, model_id: &str) -> Result<()> {
        let conn = self.conn_for_session(session_id).await?;
        conn.peer
            .request(
                "session/set_model",
                json!({ "sessionId": session_id, "modelId": model_id }),
            )
            .await?;
        Ok(())
    }

    pub fn permission_respond(&self, request_id: &str, option_id: Option<String>) {
        if self.0.broker.respond(request_id, option_id.clone()) {
            self.0.events.emit(AgentEvent::PermissionResolved {
                request_id: request_id.to_owned(),
                option_id,
            });
        }
    }

    pub async fn review_revert(
        &self,
        session_id: &str,
        path: &str,
    ) -> Result<super::acp::RevertOutcome> {
        Ok(self.0.bridges.review_revert(session_id, path).await?)
    }

    pub fn review_changes(&self, session_id: &str) -> Vec<super::review::ChangedFile> {
        self.0.bridges.changed_files(session_id)
    }

    pub fn review_accept(&self, session_id: &str, path: Option<&str>) {
        self.0.bridges.accept(session_id, path);
    }

    /// `authenticate` for agent-type methods (Codex `chat-gpt`, Gemini `oauth-personal`).
    pub async fn authenticate(
        &self,
        agent: AgentId,
        method_id: &str,
        cwd: PathBuf,
        prefs: LaunchPrefs,
    ) -> Result<()> {
        let conn = self.connection(agent, &cwd, prefs).await?;
        conn.peer
            .request("authenticate", json!({ "methodId": method_id }))
            .await?;
        self.set_status(
            agent,
            AgentStatus::Ready {
                agent_info: conn.init.get("agentInfo").cloned().unwrap_or(Value::Null),
                capabilities: conn.capabilities(),
                auth_methods: conn.auth_methods(),
            },
        );
        Ok(())
    }

    /// Terminal-type auth (Claude `claude-ai-login`): runs the adapter with the
    /// method's `args` in a visible console so the user can finish the login.
    pub async fn auth_terminal(
        &self,
        agent: AgentId,
        method_id: &str,
        cwd: PathBuf,
        prefs: LaunchPrefs,
    ) -> Result<()> {
        let conn = self.connection(agent, &cwd, prefs).await?;
        let methods = conn.auth_methods();
        let method = methods
            .as_array()
            .and_then(|list| {
                list.iter()
                    .find(|m| m.get("id").and_then(Value::as_str) == Some(method_id))
            })
            .ok_or_else(|| RpcError::invalid_params(format!("unknown auth method {method_id}")))?;
        let args: Vec<String> = method
            .get("args")
            .and_then(Value::as_array)
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(str::to_owned))
                    .collect()
            })
            .unwrap_or_default();
        let env: Vec<(String, String)> = method
            .get("env")
            .and_then(Value::as_object)
            .map(|o| {
                o.iter()
                    .filter_map(|(k, v)| v.as_str().map(|v| (k.clone(), v.to_owned())))
                    .collect()
            })
            .unwrap_or_default();
        open_console(&conn.node, &conn.entry, &args, &env, &cwd).map_err(|err| {
            AgentError::Unavailable(format!("could not open the sign-in window: {err}"))
        })
    }

    /// Close guard: cancel everything and kill every adapter tree.
    pub async fn shutdown(&self) {
        self.0.shutting_down.store(true, Ordering::Release);
        for request_id in self.0.broker.cancel_all() {
            self.0.events.emit(AgentEvent::PermissionResolved {
                request_id,
                option_id: None,
            });
        }
        self.0.bridges.terminals().release_all();
        let conns: Vec<Arc<Connection>> =
            self.0.conns.lock().await.drain().map(|(_, c)| c).collect();
        for conn in conns {
            if let Some(mut proc) = lock(&conn.process).take() {
                if let Some(job) = proc.job.take() {
                    job.terminate();
                }
                let _ = proc.child.start_kill();
            }
        }
    }

    /// Reader EOF: the adapter exited or crashed.
    fn on_connection_closed(&self, agent: AgentId) {
        let this = self.clone();
        tauri::async_runtime::spawn(async move {
            let conn = this.0.conns.lock().await.remove(&agent);
            let mut code = None;
            if let Some(conn) = &conn {
                let proc = lock(&conn.process).take();
                if let Some(mut proc) = proc {
                    let waited =
                        tokio::time::timeout(std::time::Duration::from_secs(2), proc.child.wait())
                            .await;
                    code = waited.ok().and_then(|r| r.ok()).and_then(|s| s.code());
                }
            }
            for session_id in this.0.sessions.ids_for(agent) {
                this.cancel_permissions(&session_id);
                let was_active = this
                    .0
                    .sessions
                    .get(&session_id)
                    .is_some_and(|s| s.turn_active);
                if was_active {
                    this.0.events.emit(AgentEvent::TurnFailed {
                        session_id: session_id.clone(),
                        message: "agent stopped".into(),
                        code: None,
                    });
                }
                lock(&this.0.pending_diffs).forget(&session_id);
                this.0.bridges.session_closed(&session_id).await;
                this.0.sessions.remove(&session_id);
            }
            let status = if this.0.shutting_down.load(Ordering::Acquire) {
                AgentStatus::Stopped
            } else {
                AgentStatus::Crashed {
                    code,
                    stderr_tail: conn
                        .as_ref()
                        .map(|c| process::stderr_snapshot(&c.stderr))
                        .unwrap_or_default(),
                }
            };
            this.set_status(agent, status);
        });
    }
}

/// Routes one adapter's incoming traffic.
struct ConnHandler {
    agent: AgentId,
    manager: Weak<Inner>,
}

impl ConnHandler {
    fn manager(&self) -> Option<AgentManager> {
        self.manager.upgrade().map(AgentManager)
    }
}

impl IncomingHandler for ConnHandler {
    fn on_notification(&self, method: &str, params: Value) {
        let Some(manager) = self.manager() else {
            return;
        };
        if method != "session/update" {
            return; // `_auth/status_update` and other extensions are ignored for now.
        }
        let Some(session_id) = params
            .get("sessionId")
            .and_then(Value::as_str)
            .map(str::to_owned)
        else {
            return;
        };
        let update = params.get("update").cloned().unwrap_or(Value::Null);
        observe_update(&manager, self.agent, &session_id, &update);
        manager
            .0
            .events
            .emit(AgentEvent::SessionUpdate { session_id, update });
    }

    fn on_request(&self, method: String, params: Value, responder: Responder) {
        let Some(manager) = self.manager() else {
            responder.respond(Err(RpcError::internal("client is shutting down")));
            return;
        };
        tauri::async_runtime::spawn(async move {
            let result = handle_request(&manager, &method, params).await;
            responder.respond(result);
        });
    }

    fn on_closed(&self) {
        if let Some(manager) = self.manager() {
            manager.on_connection_closed(self.agent);
        }
    }
}

/// Side effects of updates: session titles for the index, agent-side diffs for review.
fn observe_update(manager: &AgentManager, agent: AgentId, session_id: &str, update: &Value) {
    match update.get("sessionUpdate").and_then(Value::as_str) {
        Some("session_info_update") => {
            if let (Some(title), Some(state)) = (
                update.get("title").and_then(Value::as_str),
                manager.0.sessions.get(session_id),
            ) {
                manager.0.index.touch(
                    agent,
                    session_id,
                    &state.cwd.to_string_lossy(),
                    Some(title.to_owned()),
                );
            }
        }
        Some("tool_call" | "tool_call_update") => {
            let Some(call_id) = update.get("toolCallId").and_then(Value::as_str) else {
                return;
            };
            let diffs = diffs_in(update);
            let status = update.get("status").and_then(Value::as_str);
            let ready = lock(&manager.0.pending_diffs).observe(session_id, call_id, diffs, status);
            for diff in ready {
                manager.0.bridges.record_diff(
                    session_id,
                    &diff.path,
                    diff.old_text.as_deref(),
                    &diff.new_text,
                );
            }
        }
        _ => {}
    }
}

/// One ACP `diff` content item.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileDiff {
    pub path: String,
    pub old_text: Option<String>,
    pub new_text: String,
}

fn diffs_in(update: &Value) -> Vec<FileDiff> {
    update
        .get("content")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter(|item| item.get("type").and_then(Value::as_str) == Some("diff"))
        .filter_map(|item| {
            Some(FileDiff {
                path: item.get("path")?.as_str()?.to_owned(),
                old_text: item
                    .get("oldText")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
                new_text: item.get("newText")?.as_str()?.to_owned(),
            })
        })
        .collect()
}

/// Agents send a tool call's diff and its completion in different updates
/// (Claude: diff on `tool_call`, `completed` on a later content-less update).
#[derive(Debug, Default)]
pub struct PendingDiffs(HashMap<(String, String), Vec<FileDiff>>);

impl PendingDiffs {
    /// Remembers diffs and returns them once the call reports `completed`.
    /// A `failed` call drops its diffs: nothing was written.
    pub fn observe(
        &mut self,
        session_id: &str,
        call_id: &str,
        diffs: Vec<FileDiff>,
        status: Option<&str>,
    ) -> Vec<FileDiff> {
        let key = (session_id.to_owned(), call_id.to_owned());
        if !diffs.is_empty() {
            // Later updates replace the content list wholesale (ACP semantics).
            self.0.insert(key.clone(), diffs);
        }
        match status {
            Some("completed") => self.0.remove(&key).unwrap_or_default(),
            Some("failed") => {
                self.0.remove(&key);
                Vec::new()
            }
            _ => Vec::new(),
        }
    }

    pub fn forget(&mut self, session_id: &str) {
        self.0.retain(|(session, _), _| session != session_id);
    }
}

fn parse<T: serde::de::DeserializeOwned>(params: Value) -> std::result::Result<T, RpcError> {
    serde_json::from_value(params).map_err(|err| RpcError::invalid_params(err.to_string()))
}

fn to_value<T: Serialize>(value: T) -> std::result::Result<Value, RpcError> {
    serde_json::to_value(value).map_err(|err| RpcError::internal(err.to_string()))
}

async fn handle_request(
    manager: &AgentManager,
    method: &str,
    params: Value,
) -> std::result::Result<Value, RpcError> {
    let bridges = &manager.0.bridges;
    match method {
        "fs/read_text_file" => to_value(bridges.read_text_file(parse(params)?).await?),
        "fs/write_text_file" => to_value(bridges.write_text_file(parse(params)?).await?),
        "terminal/create" => to_value(bridges.terminal_create(parse(params)?).await?),
        "terminal/output" => to_value(bridges.terminal_output(parse(params)?).await?),
        "terminal/wait_for_exit" => to_value(bridges.terminal_wait_for_exit(parse(params)?).await?),
        "terminal/kill" => to_value(bridges.terminal_kill(parse(params)?).await?),
        "terminal/release" => to_value(bridges.terminal_release(parse(params)?).await?),
        "session/request_permission" => {
            let session_id = params
                .get("sessionId")
                .and_then(Value::as_str)
                .ok_or_else(|| RpcError::invalid_params("missing sessionId"))?
                .to_owned();
            let (request_id, rx) = manager.0.broker.open(&session_id);
            manager.0.events.emit(AgentEvent::PermissionRequested {
                request_id,
                session_id,
                tool_call: params.get("toolCall").cloned().unwrap_or(Value::Null),
                options: params.get("options").cloned().unwrap_or(json!([])),
            });
            let choice = rx.await.unwrap_or(None);
            Ok(outcome_json(choice.as_deref()))
        }
        other => Err(RpcError::method_not_found(other)),
    }
}

/// `initialize` params: Xora's client capabilities (design doc 2.2).
pub fn initialize_params() -> Value {
    json!({
        "protocolVersion": 1,
        "clientCapabilities": {
            "fs": { "readTextFile": true, "writeTextFile": true },
            "terminal": true,
            "auth": { "terminal": true }
        },
        "clientInfo": {
            "name": "xora-code",
            "title": "Xora Code",
            "version": env!("CARGO_PKG_VERSION")
        }
    })
}

/// How an adapter is started (design doc 1.2/1.4/3.8).
/// The user's home folder: a working directory no project removal can pull away.
fn home_dir() -> Option<PathBuf> {
    ["USERPROFILE", "HOME"]
        .into_iter()
        .filter_map(std::env::var_os)
        .map(PathBuf::from)
        .find(|p| p.is_dir())
}

pub fn launch_spec(
    spec: &AgentSpec,
    node: &Path,
    entry: &Path,
    cwd: &Path,
    prefs: LaunchPrefs,
    agents_dir: &Path,
) -> LaunchSpec {
    let mut args = vec![entry.as_os_str().to_owned()];
    args.extend(spec.args.iter().map(Into::into));
    let mut launch = LaunchSpec {
        program: node.to_path_buf(),
        args,
        cwd: Some(cwd.to_path_buf()),
        ..LaunchSpec::default()
    };
    if spec.id == AgentId::Claude {
        launch
            .env_set
            .push(("CLAUDE_AGENT_ACP_PROTOCOL".into(), "v1".into()));
        if prefs.claude_ignore_api_key {
            // The SDK always prefers an API key when present: bill the subscription instead.
            launch
                .env_remove
                .extend(["ANTHROPIC_API_KEY".into(), "ANTHROPIC_AUTH_TOKEN".into()]);
        }
    }
    if prefs.debug_logs {
        let logs = agents_dir.join("logs").to_string_lossy().into_owned();
        match spec.id {
            AgentId::Claude => launch.env_set.push(("CLAUDE_AGENT_LOGS".into(), logs)),
            AgentId::Codex => launch.env_set.push(("APP_SERVER_LOGS".into(), logs)),
            AgentId::Gemini => {}
        }
    }
    launch
}

fn parse_session_list(agent: AgentId, cwd: &Path, result: &Value) -> Vec<SessionEntry> {
    result
        .get("sessions")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|s| {
            Some(SessionEntry {
                agent_id: agent,
                session_id: s.get("sessionId")?.as_str()?.to_owned(),
                cwd: s
                    .get("cwd")
                    .and_then(Value::as_str)
                    .map_or_else(|| cwd.to_string_lossy().into_owned(), str::to_owned),
                title: s.get("title").and_then(Value::as_str).map(str::to_owned),
                updated_at: s
                    .get("updatedAt")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
                archived: false,
                deleted: false,
                pinned: false,
                custom_title: None,
            })
        })
        .collect()
}

/// Opens a visible console running `node <entry> <args>` (login flows).
fn open_console(
    node: &Path,
    entry: &Path,
    args: &[String],
    env: &[(String, String)],
    cwd: &Path,
) -> std::io::Result<()> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
        let mut cmd = std::process::Command::new(node);
        cmd.arg(entry)
            .args(args)
            .current_dir(cwd)
            .creation_flags(CREATE_NEW_CONSOLE);
        for (k, v) in env {
            cmd.env(k, v);
        }
        cmd.spawn().map(|_| ())
    }
    #[cfg(not(windows))]
    {
        let mut cmd = std::process::Command::new(node);
        cmd.arg(entry).args(args).current_dir(cwd);
        for (k, v) in env {
            cmd.env(k, v);
        }
        cmd.spawn().map(|_| ())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auth_required_errors_get_a_prefix() {
        let err = AgentError::Rpc(RpcError::new(RpcError::AUTH_REQUIRED, "login"));
        assert_eq!(err.ipc_message(), "auth_required:login");
        let other = AgentError::Rpc(RpcError::internal("boom"));
        assert_eq!(other.ipc_message(), "boom (-32603)");
    }

    #[test]
    fn claude_launch_strips_api_keys_and_pins_protocol() {
        let spec = registry::spec(AgentId::Claude);
        let prefs = LaunchPrefs {
            claude_ignore_api_key: true,
            debug_logs: false,
        };
        let launch = launch_spec(
            spec,
            Path::new("node"),
            Path::new("entry.js"),
            Path::new("."),
            prefs,
            Path::new("."),
        );
        assert!(launch.env_remove.contains(&"ANTHROPIC_API_KEY".to_owned()));
        assert!(
            launch
                .env_set
                .contains(&("CLAUDE_AGENT_ACP_PROTOCOL".into(), "v1".into()))
        );
        let gemini = launch_spec(
            registry::spec(AgentId::Gemini),
            Path::new("node"),
            Path::new("gemini.js"),
            Path::new("."),
            prefs,
            Path::new("."),
        );
        assert_eq!(
            gemini.args.last().map(|a| a.to_string_lossy().into_owned()),
            Some("--acp".into())
        );
        assert!(gemini.env_remove.is_empty());
    }

    #[test]
    fn initialize_declares_fs_terminal_and_terminal_auth() {
        let params = initialize_params();
        assert_eq!(params["protocolVersion"], 1);
        assert_eq!(params["clientCapabilities"]["fs"]["writeTextFile"], true);
        assert_eq!(params["clientCapabilities"]["auth"]["terminal"], true);
    }

    #[test]
    fn diffs_wait_for_completion_across_updates() {
        let mut pending = PendingDiffs::default();
        let call = json!({ "toolCallId": "t1", "status": "pending", "content": [
            { "type": "diff", "path": "C:/p/a.md", "oldText": null, "newText": "hi" },
            { "type": "content", "content": { "type": "text", "text": "x" } }
        ]});
        let ready = pending.observe("s", "t1", diffs_in(&call), Some("pending"));
        assert!(ready.is_empty());
        let done = pending.observe("s", "t1", Vec::new(), Some("completed"));
        assert_eq!(done.len(), 1);
        assert_eq!(done[0].new_text, "hi");
        assert_eq!(done[0].old_text, None);
        assert!(
            pending
                .observe("s", "t1", Vec::new(), Some("completed"))
                .is_empty()
        );
    }

    #[test]
    fn failed_calls_drop_their_diffs() {
        let mut pending = PendingDiffs::default();
        let diff = FileDiff {
            path: "a".into(),
            old_text: None,
            new_text: "b".into(),
        };
        pending.observe("s", "t", vec![diff], None);
        assert!(
            pending
                .observe("s", "t", Vec::new(), Some("failed"))
                .is_empty()
        );
        assert!(
            pending
                .observe("s", "t", Vec::new(), Some("completed"))
                .is_empty()
        );
    }

    #[test]
    fn parses_agent_session_lists() {
        let result = json!({ "sessions": [
            { "sessionId": "a", "cwd": "C:\\p", "title": "T", "updatedAt": "2026-01-01T00:00:00Z" },
            { "title": "missing id" }
        ]});
        let list = parse_session_list(AgentId::Claude, Path::new("C:\\p"), &result);
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].title.as_deref(), Some("T"));
    }
}
