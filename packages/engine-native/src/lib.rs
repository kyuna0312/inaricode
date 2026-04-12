#![deny(clippy::all)]

use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::Path;

#[derive(Debug, Deserialize)]
struct Envelope {
    id: String,
    cmd: String,
    workspace: String,
    payload: Value,
}

/// Same JSON line protocol as `inaricode-engine ipc` stdin/stdout, but synchronous from JS.
#[napi]
pub fn ipc_request(line: String) -> Result<String> {
    let env: Envelope = serde_json::from_str(&line)
        .map_err(|e| Error::from_reason(format!("invalid envelope: {}", e)))?;
    let rt = tokio::runtime::Runtime::new()
        .map_err(|e| Error::from_reason(format!("tokio runtime: {}", e)))?;
    let workspace = Path::new(&env.workspace);
    let result = rt.block_on(inaricode_engine::dispatch(
        workspace,
        &env.cmd,
        &env.payload,
    ));
    let reply = match result {
        Ok(value) => json!({ "id": env.id, "ok": true, "result": value }),
        Err(e) => json!({ "id": env.id, "ok": false, "error": e.to_string() }),
    };
    serde_json::to_string(&reply).map_err(|e| Error::from_reason(e.to_string()))
}
