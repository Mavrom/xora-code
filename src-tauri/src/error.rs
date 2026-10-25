use serde::{Serialize, Serializer};

/// Error type returned by every Tauri command. Serialized as its message so
/// the frontend receives a plain string in the rejected promise.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
    #[error(transparent)]
    Notes(#[from] crate::notes::NotesError),
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_as_message_string() {
        let err = AppError::from(std::io::Error::new(std::io::ErrorKind::NotFound, "missing"));
        assert_eq!(serde_json::to_string(&err).unwrap(), r#""missing""#);
    }

    #[test]
    fn tauri_error_serializes_as_message_string() {
        let err = AppError::from(tauri::Error::UnknownPath);
        assert_eq!(serde_json::to_string(&err).unwrap(), r#""unknown path""#);
    }

    #[test]
    fn notes_error_serializes_as_message_string() {
        let io = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "denied");
        let err = AppError::from(crate::notes::NotesError::from(io));
        assert_eq!(serde_json::to_string(&err).unwrap(), r#""denied""#);
    }
}
