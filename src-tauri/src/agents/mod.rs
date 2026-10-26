//! ACP agent core: spawning agent adapters, the JSON-RPC transport and the
//! event stream to the frontend (design doc `2026-10-25-phase2-acp-design.md`).

// Modules land before the manager that wires them; remove once commands use them.
#[allow(dead_code)]
pub mod acp;
#[allow(dead_code)]
pub mod events;
#[allow(dead_code)]
pub mod session;

// Package B: client-side bridges (fs sandbox, terminals, review/revert).
#[allow(dead_code)]
pub mod fs_bridge;
#[allow(dead_code)]
pub mod review;
#[allow(dead_code)]
pub mod terminal_bridge;

// TEMPORARY stub of package A's process helpers until A's process.rs lands.
#[allow(dead_code)]
pub mod process;
