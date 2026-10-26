//! Newline-delimited JSON-RPC 2.0 over a child's stdio (design doc 3.1/3.3).
//!
//! One reader task routes responses to their waiting request, hands
//! notifications to the handler *inline and in order*, and gives requests a
//! `Responder` so the handler can answer from another task. One writer task
//! owns the write half, so concurrent senders never interleave bytes.

use super::acp::RpcError;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, PoisonError};
use tokio::io::{AsyncBufRead, AsyncBufReadExt, AsyncWrite, AsyncWriteExt};
use tokio::sync::{mpsc, oneshot};
use tokio::task::JoinHandle;

/// Lines longer than this are dropped (a runaway agent must not exhaust memory).
/// Generous because `session/load` replays and file reads can be large.
pub const MAX_LINE_BYTES: usize = 64 * 1024 * 1024;

/// Incoming traffic that is not a response to one of our requests.
pub trait IncomingHandler: Send + Sync + 'static {
    /// Called on the reader task, in arrival order. Must not block.
    fn on_notification(&self, method: &str, params: Value);
    /// Called on the reader task; spawn for anything that awaits, then answer
    /// through `responder` (exactly once; dropping it answers `-32603`).
    fn on_request(&self, method: String, params: Value, responder: Responder);
    /// The stream ended (EOF or read error). All pending requests have failed.
    fn on_closed(&self);
}

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, RpcError>>>>>;

/// Sending half of a connection. Cheap to share behind an `Arc`.
pub struct RpcPeer {
    out: mpsc::UnboundedSender<String>,
    pending: Pending,
    next_id: AtomicU64,
    closed: Arc<AtomicBool>,
}

pub fn closed_error() -> RpcError {
    RpcError::internal("agent connection closed")
}

impl RpcPeer {
    fn send_line(&self, msg: &Value) -> Result<(), RpcError> {
        if self.closed.load(Ordering::Acquire) {
            return Err(closed_error());
        }
        self.out.send(msg.to_string()).map_err(|_| closed_error())
    }

    /// Sends a request and returns its id plus a receiver for the result, so
    /// the caller can `$/cancel_request` it while waiting.
    pub fn start_request(
        &self,
        method: &str,
        params: Value,
    ) -> (u64, oneshot::Receiver<Result<Value, RpcError>>) {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        lock(&self.pending).insert(id, tx);
        let msg = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
        if let Err(err) = self.send_line(&msg) {
            if let Some(tx) = lock(&self.pending).remove(&id) {
                let _ = tx.send(Err(err));
            }
        }
        (id, rx)
    }

    /// Sends a request and waits for its result (raw JSON).
    pub async fn request(&self, method: &str, params: Value) -> Result<Value, RpcError> {
        let (_, rx) = self.start_request(method, params);
        rx.await.unwrap_or_else(|_| Err(closed_error()))
    }

    pub fn notify(&self, method: &str, params: Value) -> Result<(), RpcError> {
        self.send_line(&json!({ "jsonrpc": "2.0", "method": method, "params": params }))
    }

    /// Asks the agent to abandon request `id` (ACP `$/cancel_request`).
    pub fn cancel_request(&self, id: u64) {
        let _ = self.notify("$/cancel_request", json!({ "requestId": id }));
    }

    pub fn is_closed(&self) -> bool {
        self.closed.load(Ordering::Acquire)
    }
}

/// Answers one incoming request. Dropping it unanswered replies `-32603`.
pub struct Responder {
    id: Option<Value>,
    out: mpsc::UnboundedSender<String>,
}

impl Responder {
    pub fn respond(mut self, result: Result<Value, RpcError>) {
        if let Some(id) = self.id.take() {
            let _ = self.out.send(response_line(id, result));
        }
    }
}

impl Drop for Responder {
    fn drop(&mut self) {
        if let Some(id) = self.id.take() {
            let err = RpcError::internal("request dropped by client");
            let _ = self.out.send(response_line(id, Err(err)));
        }
    }
}

fn response_line(id: Value, result: Result<Value, RpcError>) -> String {
    let msg = match result {
        Ok(result) => json!({ "jsonrpc": "2.0", "id": id, "result": result }),
        Err(err) => json!({
            "jsonrpc": "2.0", "id": id,
            "error": { "code": err.code, "message": err.message }
        }),
    };
    msg.to_string()
}

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Starts the reader and writer tasks. The returned handle is the reader;
/// it finishes after `on_closed` has run.
pub fn start<R, W>(
    reader: R,
    writer: W,
    handler: Arc<dyn IncomingHandler>,
) -> (Arc<RpcPeer>, JoinHandle<()>)
where
    R: AsyncBufRead + Unpin + Send + 'static,
    W: AsyncWrite + Unpin + Send + 'static,
{
    let (out_tx, out_rx) = mpsc::unbounded_channel::<String>();
    let pending: Pending = Arc::default();
    let closed = Arc::new(AtomicBool::new(false));
    let peer = Arc::new(RpcPeer {
        out: out_tx.clone(),
        pending: Arc::clone(&pending),
        next_id: AtomicU64::new(1),
        closed: Arc::clone(&closed),
    });
    tokio::spawn(write_loop(writer, out_rx));
    let reader_task = tokio::spawn(read_loop(reader, out_tx, pending, closed, handler));
    (peer, reader_task)
}

async fn write_loop<W: AsyncWrite + Unpin>(mut writer: W, mut rx: mpsc::UnboundedReceiver<String>) {
    while let Some(mut line) = rx.recv().await {
        line.push('\n');
        if writer.write_all(line.as_bytes()).await.is_err() || writer.flush().await.is_err() {
            break;
        }
    }
    // All senders gone (or the pipe broke): closing stdin tells the agent to exit.
    let _ = writer.shutdown().await;
}

async fn read_loop<R: AsyncBufRead + Unpin>(
    mut reader: R,
    out: mpsc::UnboundedSender<String>,
    pending: Pending,
    closed: Arc<AtomicBool>,
    handler: Arc<dyn IncomingHandler>,
) {
    let mut buf = Vec::new();
    loop {
        match read_line_bounded(&mut reader, &mut buf, MAX_LINE_BYTES).await {
            Ok(LineRead::Line) => route(&buf, &out, &pending, handler.as_ref()),
            Ok(LineRead::TooLong) => continue,
            Ok(LineRead::Eof) | Err(_) => break,
        }
    }
    closed.store(true, Ordering::Release);
    let waiting: Vec<_> = lock(&pending).drain().map(|(_, tx)| tx).collect();
    for tx in waiting {
        let _ = tx.send(Err(closed_error()));
    }
    handler.on_closed();
}

/// Classifies one line and dispatches it. Malformed lines are ignored:
/// adapters occasionally print stray text on stdout.
fn route(line: &[u8], out: &mpsc::UnboundedSender<String>, pending: &Pending, handler: &dyn IncomingHandler) {
    let Ok(Value::Object(mut msg)) = serde_json::from_slice::<Value>(line) else {
        return;
    };
    let method = match msg.remove("method") {
        Some(Value::String(m)) => Some(m),
        _ => None,
    };
    let id = msg.remove("id").filter(|id| !id.is_null());
    let params = msg.remove("params").unwrap_or(Value::Null);
    match (method, id) {
        (Some(method), Some(id)) => {
            handler.on_request(method, params, Responder { id: Some(id), out: out.clone() });
        }
        (Some(method), None) => handler.on_notification(&method, params),
        (None, Some(id)) => {
            let Some(id) = id_as_u64(&id) else { return };
            let Some(tx) = lock(pending).remove(&id) else { return };
            let result = match msg.remove("error") {
                Some(err) => Err(parse_error(&err)),
                None => Ok(msg.remove("result").unwrap_or(Value::Null)),
            };
            let _ = tx.send(result);
        }
        (None, None) => {}
    }
}

fn id_as_u64(id: &Value) -> Option<u64> {
    match id {
        Value::Number(n) => n.as_u64(),
        Value::String(s) => s.parse().ok(),
        _ => None,
    }
}

fn parse_error(err: &Value) -> RpcError {
    let code = err.get("code").and_then(Value::as_i64).unwrap_or(-32603);
    let message = err.get("message").and_then(Value::as_str).unwrap_or("unknown error");
    RpcError::new(i32::try_from(code).unwrap_or(-32603), message)
}

#[derive(Debug, PartialEq, Eq)]
pub enum LineRead {
    /// `buf` holds one line without the trailing `\n` / `\r\n`.
    Line,
    /// The line exceeded the limit and was skipped up to its newline.
    TooLong,
    Eof,
}

/// Reads one `\n`-terminated line into `buf` without ever buffering more than
/// `max` bytes. A final unterminated line before EOF counts as a line.
pub async fn read_line_bounded<R: AsyncBufRead + Unpin>(
    reader: &mut R,
    buf: &mut Vec<u8>,
    max: usize,
) -> std::io::Result<LineRead> {
    buf.clear();
    let mut overflow = false;
    loop {
        let chunk = reader.fill_buf().await?;
        if chunk.is_empty() {
            return Ok(if overflow {
                LineRead::TooLong
            } else if buf.is_empty() {
                LineRead::Eof
            } else {
                trim_cr(buf);
                LineRead::Line
            });
        }
        let (take, done) = match chunk.iter().position(|&b| b == b'\n') {
            Some(i) => (i + 1, true),
            None => (chunk.len(), false),
        };
        if !overflow {
            if buf.len() + take > max + 1 {
                overflow = true;
                buf.clear();
            } else {
                buf.extend_from_slice(&chunk[..take]);
            }
        }
        reader.consume(take);
        if done {
            if overflow {
                return Ok(LineRead::TooLong);
            }
            buf.pop(); // '\n'
            trim_cr(buf);
            return Ok(LineRead::Line);
        }
    }
}

fn trim_cr(buf: &mut Vec<u8>) {
    if buf.last() == Some(&b'\r') {
        buf.pop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncBufReadExt, BufReader, duplex};

    #[tokio::test]
    async fn bounded_reader_splits_lines_and_tolerates_crlf() {
        let data: &[u8] = b"{\"a\":1}\r\n{\"b\":2}\n\ntail";
        let mut reader = BufReader::with_capacity(4, data);
        let mut buf = Vec::new();
        let mut lines = Vec::new();
        loop {
            match read_line_bounded(&mut reader, &mut buf, 1024).await.unwrap() {
                LineRead::Line => lines.push(String::from_utf8(buf.clone()).unwrap()),
                LineRead::TooLong => lines.push("<too long>".into()),
                LineRead::Eof => break,
            }
        }
        assert_eq!(lines, vec!["{\"a\":1}", "{\"b\":2}", "", "tail"]);
    }

    #[tokio::test]
    async fn bounded_reader_skips_oversized_line_and_recovers() {
        let mut data = vec![b'x'; 100];
        data.extend_from_slice(b"\nok\n");
        let mut reader = BufReader::with_capacity(8, data.as_slice());
        let mut buf = Vec::new();
        assert_eq!(read_line_bounded(&mut reader, &mut buf, 10).await.unwrap(), LineRead::TooLong);
        assert_eq!(read_line_bounded(&mut reader, &mut buf, 10).await.unwrap(), LineRead::Line);
        assert_eq!(buf, b"ok");
        assert_eq!(read_line_bounded(&mut reader, &mut buf, 10).await.unwrap(), LineRead::Eof);
    }

    #[tokio::test]
    async fn line_exactly_at_limit_is_accepted() {
        let mut reader = BufReader::new(&b"12345\n"[..]);
        let mut buf = Vec::new();
        assert_eq!(read_line_bounded(&mut reader, &mut buf, 5).await.unwrap(), LineRead::Line);
        assert_eq!(buf, b"12345");
    }

    #[derive(Default)]
    struct Recorder {
        notes: Mutex<Vec<(String, Value)>>,
        closed: AtomicBool,
    }

    impl IncomingHandler for Recorder {
        fn on_notification(&self, method: &str, params: Value) {
            lock(&self.notes).push((method.to_string(), params));
        }
        fn on_request(&self, method: String, params: Value, responder: Responder) {
            if method == "echo" {
                responder.respond(Ok(params));
            } else {
                responder.respond(Err(RpcError::method_not_found(&method)));
            }
        }
        fn on_closed(&self) {
            self.closed.store(true, Ordering::SeqCst);
        }
    }

    /// Wires a peer to an in-memory "agent" whose stdin/stdout we drive by hand.
    fn harness() -> (
        Arc<RpcPeer>,
        Arc<Recorder>,
        JoinHandle<()>,
        tokio::io::Lines<BufReader<tokio::io::DuplexStream>>,
        tokio::io::DuplexStream,
    ) {
        let (client_out, agent_in) = duplex(1 << 16);
        let (agent_out, client_in) = duplex(1 << 16);
        let rec = Arc::new(Recorder::default());
        let (peer, reader) = start(BufReader::new(client_in), client_out, rec.clone());
        (peer, rec, reader, BufReader::new(agent_in).lines(), agent_out)
    }

    async fn agent_send(out: &mut tokio::io::DuplexStream, msg: Value) {
        out.write_all(format!("{msg}\r\n").as_bytes()).await.unwrap();
    }

    #[tokio::test]
    async fn responses_match_ids_out_of_order() {
        let (peer, _rec, _reader, mut agent_in, mut agent_out) = harness();
        let p1 = Arc::clone(&peer);
        let first = tokio::spawn(async move { p1.request("a", json!({"n": 1})).await });
        let p2 = Arc::clone(&peer);
        let second = tokio::spawn(async move { p2.request("b", json!({"n": 2})).await });

        let mut ids = HashMap::new();
        for _ in 0..2 {
            let line: Value = serde_json::from_str(&agent_in.next_line().await.unwrap().unwrap()).unwrap();
            assert_eq!(line["jsonrpc"], "2.0");
            ids.insert(line["method"].as_str().unwrap().to_string(), line["id"].clone());
        }
        // Answer "b" first, as a string id, and "a" with an error.
        agent_send(&mut agent_out, json!({"jsonrpc":"2.0","id": ids["b"].to_string(),"result":{"ok":"b"}})).await;
        agent_send(&mut agent_out, json!({"jsonrpc":"2.0","id": ids["a"],"error":{"code":-32000,"message":"auth"}})).await;

        assert_eq!(second.await.unwrap().unwrap(), json!({"ok":"b"}));
        assert_eq!(first.await.unwrap().unwrap_err(), RpcError::new(-32000, "auth"));
    }

    #[tokio::test]
    async fn notifications_keep_order_and_requests_get_answers() {
        let (_peer, rec, _reader, mut agent_in, mut agent_out) = harness();
        for i in 0..20 {
            agent_send(&mut agent_out, json!({"jsonrpc":"2.0","method":"session/update","params":{"i":i}})).await;
        }
        agent_send(&mut agent_out, json!({"jsonrpc":"2.0","id":"r1","method":"echo","params":{"x":1}})).await;
        agent_send(&mut agent_out, json!({"jsonrpc":"2.0","id":7,"method":"nope","params":{}})).await;
        agent_out.write_all(b"not json at all\n").await.unwrap();

        let r1: Value = serde_json::from_str(&agent_in.next_line().await.unwrap().unwrap()).unwrap();
        assert_eq!(r1, json!({"jsonrpc":"2.0","id":"r1","result":{"x":1}}));
        let r2: Value = serde_json::from_str(&agent_in.next_line().await.unwrap().unwrap()).unwrap();
        assert_eq!(r2["id"], 7);
        assert_eq!(r2["error"]["code"], -32601);

        let notes = lock(&rec.notes);
        let order: Vec<i64> = notes.iter().map(|(_, p)| p["i"].as_i64().unwrap()).collect();
        assert_eq!(order, (0..20).collect::<Vec<_>>());
    }

    #[tokio::test]
    async fn eof_fails_pending_requests_and_reports_close() {
        let (peer, rec, reader, mut agent_in, agent_out) = harness();
        let p = Arc::clone(&peer);
        let waiting = tokio::spawn(async move { p.request("slow", Value::Null).await });
        agent_in.next_line().await.unwrap().unwrap();
        drop(agent_out); // agent dies
        reader.await.unwrap();
        assert_eq!(waiting.await.unwrap().unwrap_err(), closed_error());
        assert!(rec.closed.load(Ordering::SeqCst));
        assert!(peer.is_closed());
        assert_eq!(peer.request("late", Value::Null).await.unwrap_err(), closed_error());
    }

    #[tokio::test]
    async fn dropped_responder_answers_internal_error() {
        let (out, mut rx) = mpsc::unbounded_channel();
        drop(Responder { id: Some(json!(5)), out });
        let line: Value = serde_json::from_str(&rx.recv().await.unwrap()).unwrap();
        assert_eq!(line["id"], 5);
        assert_eq!(line["error"]["code"], -32603);
    }
}
