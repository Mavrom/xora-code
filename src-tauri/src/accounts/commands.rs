use super::{Env, Provider, ProviderStatus};
use crate::error::AppResult;
use tauri::{AppHandle, Manager};

fn env(app: &AppHandle) -> Env {
    Env::current(app.path().home_dir().ok())
}

/// Detects every provider in parallel (each `--version` may take up to the
/// timeout), keeping the order of [`Provider::ALL`].
#[tauri::command]
pub async fn accounts_detect(app: AppHandle) -> AppResult<Vec<ProviderStatus>> {
    let env = env(&app);
    tauri::async_runtime::spawn_blocking(move || {
        let env = &env;
        std::thread::scope(|scope| {
            let handles: Vec<_> = Provider::ALL
                .iter()
                .map(|&p| scope.spawn(move || env.detect(p)))
                .collect();
            handles
                .into_iter()
                .zip(Provider::ALL)
                .map(|(handle, provider)| {
                    handle.join().unwrap_or(ProviderStatus {
                        provider,
                        path: None,
                        version: None,
                        sign_in: super::SignIn::Unknown,
                    })
                })
                .collect()
        })
    })
    .await
    .map_err(Into::into)
}

/// Opens the provider's sign-in flow in a new terminal window.
#[tauri::command]
pub async fn accounts_login(app: AppHandle, provider: Provider) -> AppResult<()> {
    let env = env(&app);
    let exe = env.locate(provider).ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("{} not found; install it first.", provider.title()),
        )
    })?;
    super::open_login(&exe, provider)?;
    Ok(())
}
