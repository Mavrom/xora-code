//! ACP client side: the `ClientHandlers` boundary that package B implements
//! (design doc 3.4). The connection itself is added below this boundary.

use agent_client_protocol_schema::v1::{
    CreateTerminalRequest, CreateTerminalResponse, KillTerminalRequest, KillTerminalResponse,
    ReadTextFileRequest, ReadTextFileResponse, ReleaseTerminalRequest, ReleaseTerminalResponse,
    TerminalOutputRequest, TerminalOutputResponse, WaitForTerminalExitRequest,
    WaitForTerminalExitResponse, WriteTextFileRequest, WriteTextFileResponse,
};
use serde::Serialize;
use std::future::Future;
use std::pin::Pin;

/// Boxed `Send` future; keeps `ClientHandlers` dyn-compatible without `async-trait`.
pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

/// JSON-RPC error returned by a client handler; written back to the agent as-is.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RpcError {
    pub code: i32,
    pub message: String,
}

impl RpcError {
    pub const METHOD_NOT_FOUND: i32 = -32601;
    pub const INVALID_PARAMS: i32 = -32602;
    pub const INTERNAL: i32 = -32603;
    pub const AUTH_REQUIRED: i32 = -32000;
    pub const NOT_FOUND: i32 = -32002;

    pub fn new(code: i32, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
    pub fn method_not_found(method: &str) -> Self {
        Self::new(
            Self::METHOD_NOT_FOUND,
            format!("method not found: {method}"),
        )
    }
    pub fn invalid_params(message: impl Into<String>) -> Self {
        Self::new(Self::INVALID_PARAMS, message)
    }
    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(Self::NOT_FOUND, message)
    }
    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(Self::INTERNAL, message)
    }
}

impl std::fmt::Display for RpcError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} ({})", self.message, self.code)
    }
}

impl std::error::Error for RpcError {}

/// Result of `agent_review_revert`; serialized as `"reverted"` / `"conflict"`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RevertOutcome {
    Reverted,
    Conflict,
}

/// Client-side ACP methods (fs + terminal) plus the lifecycle hooks the core
/// calls so the bridges can keep review snapshots and terminals per session.
///
/// Every request carries its `session_id`; look up the workspace roots with
/// `SessionRegistry::roots`. Handlers run on their own task and may await.
pub trait ClientHandlers: Send + Sync + 'static {
    fn read_text_file(
        &self,
        req: ReadTextFileRequest,
    ) -> BoxFuture<'_, Result<ReadTextFileResponse, RpcError>>;
    fn write_text_file(
        &self,
        req: WriteTextFileRequest,
    ) -> BoxFuture<'_, Result<WriteTextFileResponse, RpcError>>;
    fn terminal_create(
        &self,
        req: CreateTerminalRequest,
    ) -> BoxFuture<'_, Result<CreateTerminalResponse, RpcError>>;
    fn terminal_output(
        &self,
        req: TerminalOutputRequest,
    ) -> BoxFuture<'_, Result<TerminalOutputResponse, RpcError>>;
    fn terminal_wait_for_exit(
        &self,
        req: WaitForTerminalExitRequest,
    ) -> BoxFuture<'_, Result<WaitForTerminalExitResponse, RpcError>>;
    fn terminal_kill(
        &self,
        req: KillTerminalRequest,
    ) -> BoxFuture<'_, Result<KillTerminalResponse, RpcError>>;
    fn terminal_release(
        &self,
        req: ReleaseTerminalRequest,
    ) -> BoxFuture<'_, Result<ReleaseTerminalResponse, RpcError>>;

    /// Called right before `session/prompt` is sent: a new review turn begins.
    fn turn_started(&self, _session_id: &str) {}

    /// Called when a session is closed, crashes or the app shuts down:
    /// kill and release that session's terminals.
    fn session_closed(&self, _session_id: &str) -> BoxFuture<'_, ()> {
        Box::pin(async {})
    }

    /// Backs `agent_review_revert(sessionId, path)`.
    fn review_revert(
        &self,
        _session_id: &str,
        _path: &str,
    ) -> BoxFuture<'_, Result<RevertOutcome, RpcError>> {
        Box::pin(async { Err(RpcError::method_not_found("review/revert")) })
    }
}
