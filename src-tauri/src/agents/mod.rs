//! ACP agent core: spawning agent adapters, the JSON-RPC transport and the
//! event stream to the frontend (design doc `2026-10-25-phase2-acp-design.md`).

// The contract lands before its producers; remove once the manager emits events.
#[allow(dead_code)]
pub mod events;
