//! ACP agent core: spawning agent adapters, the JSON-RPC transport, the
//! client-side bridges and the event stream to the frontend. See the
//! `agents` section of `docs/architecture.md` for how the files fit together.

pub mod acp;
pub mod bridge;
pub mod commands;
pub mod events;
pub mod fork;
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
