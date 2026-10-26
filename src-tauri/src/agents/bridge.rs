//! The real `ClientHandlers`: workspace-sandboxed fs, pipe terminals and the
//! per-turn review store, all keyed by the session's registered roots.

use super::acp::{BoxFuture, ClientHandlers, RevertOutcome, RpcError};
use super::events::{AgentEvent, EventSink};
use super::fs_bridge::{self, FsBridgeError};
use super::review::{ReviewError, ReviewStore};
use super::session::SessionRegistry;
use super::terminal_bridge::TerminalBridge;
use agent_client_protocol_schema::v1::{
    CreateTerminalRequest, CreateTerminalResponse, KillTerminalRequest, KillTerminalResponse,
    ReadTextFileRequest, ReadTextFileResponse, ReleaseTerminalRequest, ReleaseTerminalResponse,
    TerminalId, TerminalOutputRequest, TerminalOutputResponse, WaitForTerminalExitRequest,
    WaitForTerminalExitResponse, WriteTextFileRequest, WriteTextFileResponse,
};
use std::path::{Path, PathBuf};
use std::sync::Arc;

#[derive(Clone)]
pub struct Bridges {
    sessions: SessionRegistry,
    review: Arc<ReviewStore>,
    terminals: TerminalBridge,
    events: EventSink,
}

impl Bridges {
    pub fn new(sessions: SessionRegistry, events: EventSink) -> Self {
        Self {
            sessions,
            review: Arc::new(ReviewStore::default()),
            terminals: TerminalBridge::new(events.clone()),
            events,
        }
    }

    pub fn terminals(&self) -> &TerminalBridge {
        &self.terminals
    }

    /// Agents that write files themselves (Codex) report the change as ACP
    /// `diff` content; record it so "Geri al" works for them too.
    pub fn record_diff(&self, session_id: &str, path: &str, old_text: Option<&str>, new_text: &str) {
        self.review.record_diff(session_id, Path::new(path), old_text, new_text);
    }

    /// The session's canonical roots, or an error the agent understands.
    fn roots(&self, session_id: &str) -> Result<Vec<PathBuf>, RpcError> {
        let roots = self
            .sessions
            .roots(session_id)
            .ok_or_else(|| RpcError::invalid_params("unknown session"))?;
        let canonical = fs_bridge::canonical_roots(&roots);
        if canonical.is_empty() {
            return Err(RpcError::invalid_params("session workspace is not available"));
        }
        Ok(canonical)
    }
}

fn fs_error(err: FsBridgeError) -> RpcError {
    RpcError::new(err.rpc_code(), err.to_string())
}

impl ClientHandlers for Bridges {
    fn read_text_file(
        &self,
        req: ReadTextFileRequest,
    ) -> BoxFuture<'_, Result<ReadTextFileResponse, RpcError>> {
        Box::pin(async move {
            let roots = self.roots(&req.session_id.0)?;
            let path = req.path.clone();
            let text = tokio::task::spawn_blocking(move || {
                let resolved = fs_bridge::resolve_in_roots(&path, &roots)?;
                fs_bridge::read_text(&resolved, req.line, req.limit)
            })
            .await
            .map_err(|err| RpcError::internal(err.to_string()))?
            .map_err(fs_error)?;
            Ok(ReadTextFileResponse::new(text))
        })
    }

    fn write_text_file(
        &self,
        req: WriteTextFileRequest,
    ) -> BoxFuture<'_, Result<WriteTextFileResponse, RpcError>> {
        Box::pin(async move {
            let session_id = req.session_id.0.to_string();
            let roots = self.roots(&session_id)?;
            let review = Arc::clone(&self.review);
            let sid = session_id.clone();
            let written = tokio::task::spawn_blocking(move || {
                let resolved = fs_bridge::resolve_in_roots(&req.path, &roots)?;
                let original = match fs_bridge::read_capped(&resolved) {
                    Ok(bytes) => Some(bytes),
                    Err(FsBridgeError::NotFound) => None,
                    Err(err) => return Err(err),
                };
                fs_bridge::write_text_atomic(&resolved, &req.content, &roots)?;
                review.record_write(&sid, &resolved, original, &req.content);
                Ok(resolved)
            })
            .await
            .map_err(|err| RpcError::internal(err.to_string()))?
            .map_err(fs_error)?;
            self.events.emit(AgentEvent::FileWritten {
                session_id,
                path: written.to_string_lossy().into_owned(),
            });
            Ok(WriteTextFileResponse::new())
        })
    }

    fn terminal_create(
        &self,
        req: CreateTerminalRequest,
    ) -> BoxFuture<'_, Result<CreateTerminalResponse, RpcError>> {
        Box::pin(async move {
            let session_id = req.session_id.0.to_string();
            let roots = self.roots(&session_id)?;
            let env: Vec<(String, String)> =
                req.env.iter().map(|v| (v.name.clone(), v.value.clone())).collect();
            let id = self.terminals.create(
                &session_id,
                &req.command,
                &req.args,
                &env,
                req.cwd.as_deref(),
                req.output_byte_limit,
                &roots,
            )?;
            Ok(CreateTerminalResponse::new(TerminalId::new(id)))
        })
    }

    fn terminal_output(
        &self,
        req: TerminalOutputRequest,
    ) -> BoxFuture<'_, Result<TerminalOutputResponse, RpcError>> {
        Box::pin(async move {
            let (text, truncated, exit) =
                self.terminals.output(&req.session_id.0, &req.terminal_id.0)?;
            Ok(TerminalOutputResponse::new(text, truncated).exit_status(exit))
        })
    }

    fn terminal_wait_for_exit(
        &self,
        req: WaitForTerminalExitRequest,
    ) -> BoxFuture<'_, Result<WaitForTerminalExitResponse, RpcError>> {
        Box::pin(async move {
            let status = self
                .terminals
                .wait_for_exit(&req.session_id.0, &req.terminal_id.0)
                .await?;
            Ok(WaitForTerminalExitResponse::new(status))
        })
    }

    fn terminal_kill(
        &self,
        req: KillTerminalRequest,
    ) -> BoxFuture<'_, Result<KillTerminalResponse, RpcError>> {
        Box::pin(async move {
            self.terminals.kill(&req.session_id.0, &req.terminal_id.0)?;
            Ok(KillTerminalResponse::new())
        })
    }

    fn terminal_release(
        &self,
        req: ReleaseTerminalRequest,
    ) -> BoxFuture<'_, Result<ReleaseTerminalResponse, RpcError>> {
        Box::pin(async move {
            self.terminals.release(&req.session_id.0, &req.terminal_id.0)?;
            Ok(ReleaseTerminalResponse::new())
        })
    }

    fn turn_started(&self, session_id: &str) {
        self.review.begin_turn(session_id);
    }

    fn session_closed(&self, session_id: &str) -> BoxFuture<'_, ()> {
        let id = session_id.to_owned();
        Box::pin(async move {
            self.terminals.release_session(&id);
            self.review.close_session(&id);
        })
    }

    fn review_revert(
        &self,
        session_id: &str,
        path: &str,
    ) -> BoxFuture<'_, Result<RevertOutcome, RpcError>> {
        let session_id = session_id.to_owned();
        let path = PathBuf::from(path);
        Box::pin(async move {
            let roots = self.roots(&session_id)?;
            let review = Arc::clone(&self.review);
            tokio::task::spawn_blocking(move || review.revert(&session_id, Path::new(&path), &roots))
                .await
                .map_err(|err| RpcError::internal(err.to_string()))?
                .map_err(|err| match err {
                    ReviewError::NotTracked => RpcError::not_found(err.to_string()),
                    ReviewError::Sandbox(_) => RpcError::invalid_params(err.to_string()),
                    ReviewError::Io(_) => RpcError::internal(err.to_string()),
                })
        })
    }
}
