//! Facts about the machine Xora runs on, for display.

/// The computer's name ("MAVROM"), shown above the composer as the place the agent runs.
#[tauri::command]
pub fn system_hostname() -> String {
    hostname_from(|key| std::env::var(key).ok())
}

fn hostname_from(var: impl Fn(&str) -> Option<String>) -> String {
    ["COMPUTERNAME", "HOSTNAME"]
        .into_iter()
        .filter_map(&var)
        .map(|name| name.trim().to_string())
        .find(|name| !name.is_empty())
        .unwrap_or_else(|| "Bu bilgisayar".to_string())
}

#[cfg(test)]
mod tests {
    use super::hostname_from;

    #[test]
    fn prefers_windows_name_then_unix_then_fallback() {
        let both = |k: &str| Some(if k == "COMPUTERNAME" { "MAVROM" } else { "box" }.to_string());
        assert_eq!(hostname_from(both), "MAVROM");
        let unix = |k: &str| (k == "HOSTNAME").then(|| "box".to_string());
        assert_eq!(hostname_from(unix), "box");
        assert_eq!(hostname_from(|_| Some("  ".to_string())), "Bu bilgisayar");
    }
}
