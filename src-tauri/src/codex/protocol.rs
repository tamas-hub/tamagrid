use serde::Serialize;
use serde_json::Value;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectionResult {
    pub executable_path: String,
    pub version: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionInfo {
    pub generation: u64,
    pub executable_path: String,
    pub version: String,
    pub account: Value,
    pub models: Vec<Value>,
    pub rate_limits: Option<Value>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppServerEvent {
    pub generation: u64,
    pub sequence: u64,
    pub event_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exit_code: Option<i32>,
}

impl AppServerEvent {
    pub fn message(generation: u64, sequence: u64, message: Value) -> Self {
        Self {
            generation,
            sequence,
            event_type: "message".into(),
            message: Some(message),
            detail: None,
            exit_code: None,
        }
    }

    pub fn diagnostic(generation: u64, sequence: u64, event_type: &str, detail: String) -> Self {
        Self {
            generation,
            sequence,
            event_type: event_type.into(),
            message: None,
            detail: Some(detail),
            exit_code: None,
        }
    }

    pub fn exited(generation: u64, sequence: u64, exit_code: Option<i32>) -> Self {
        Self {
            generation,
            sequence,
            event_type: "exited".into(),
            message: None,
            detail: None,
            exit_code,
        }
    }
}
