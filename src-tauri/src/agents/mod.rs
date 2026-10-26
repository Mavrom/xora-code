//! ACP agent core: spawning agent adapters, the JSON-RPC transport, the
//! client-side bridges and the event stream to the frontend
//! (design doc `2026-10-25-phase2-acp-design.md`).

pub mod acp;
pub mod bridge;
pub mod commands;
pub mod events;
pub mod fs_bridge;
pub mod index;
pub mod install;
pub mod manager;
pub mod permissions;
pub mod process;
pub mod registry;
pub mod review;
pub mod session;
pub mod terminal_bridge;
pub mod transport;

pub use manager::AgentManager;
