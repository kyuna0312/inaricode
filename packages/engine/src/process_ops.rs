use crate::paths;
use anyhow::{Context, Result};
use serde_json::{json, Value};
use std::path::Path;
use std::time::Duration;
use tokio::io::{AsyncReadExt, BufReader};
use tokio::process::Command;
use tokio::time::timeout;

const DEFAULT_TIMEOUT_MS: u64 = 120_000;
const DEFAULT_MAX_OUTPUT: usize = 256 * 1024;

pub async fn run_cmd(workspace: &Path, payload: &Value) -> Result<Value> {
    let command = payload
        .get("command")
        .and_then(|p| p.as_str())
        .ok_or_else(|| anyhow::anyhow!("missing command"))?;
    let cwd_rel = payload.get("cwd").and_then(|p| p.as_str()).unwrap_or(".");
    let timeout_ms = payload
        .get("timeout_ms")
        .and_then(|v| v.as_u64())
        .unwrap_or(DEFAULT_TIMEOUT_MS);
    let max_output = payload
        .get("max_output_bytes")
        .and_then(|v| v.as_u64())
        .unwrap_or(DEFAULT_MAX_OUTPUT as u64) as usize;

    let w = workspace.canonicalize().context("workspace")?;
    let cwd = paths::resolve_existing(workspace, cwd_rel)?;
    if !cwd.is_dir() {
        anyhow::bail!("cwd is not a directory");
    }

    let mut cmd = if cfg!(windows) {
        let mut c = Command::new("cmd");
        c.args(["/C", command]);
        c
    } else {
        let mut c = Command::new("sh");
        c.args(["-c", command]);
        c
    };
    cmd.current_dir(&cwd);
    cmd.kill_on_drop(true);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().context("spawn")?;
    let stdout = child.stdout.take().context("stdout")?;
    let stderr = child.stderr.take().context("stderr")?;

    let read_out = async {
        let mut reader = BufReader::new(stdout);
        let mut buf = Vec::new();
        let mut chunk = [0u8; 8192];
        loop {
            let n = reader.read(&mut chunk).await?;
            if n == 0 {
                break;
            }
            if buf.len() + n > max_output {
                let take = max_output.saturating_sub(buf.len());
                if take > 0 {
                    buf.extend_from_slice(&chunk[..take]);
                }
                break;
            }
            buf.extend_from_slice(&chunk[..n]);
        }
        Ok::<Vec<u8>, std::io::Error>(buf)
    };
    let read_err = async {
        let mut reader = BufReader::new(stderr);
        let mut buf = Vec::new();
        let mut chunk = [0u8; 8192];
        loop {
            let n = reader.read(&mut chunk).await?;
            if n == 0 {
                break;
            }
            if buf.len() + n > max_output {
                let take = max_output.saturating_sub(buf.len());
                if take > 0 {
                    buf.extend_from_slice(&chunk[..take]);
                }
                break;
            }
            buf.extend_from_slice(&chunk[..n]);
        }
        Ok::<Vec<u8>, std::io::Error>(buf)
    };

    let run = async {
        let (out, err) = tokio::join!(read_out, read_err);
        let out = String::from_utf8_lossy(&out?).to_string();
        let err = String::from_utf8_lossy(&err?).to_string();
        let status = child.wait().await?;
        Ok::<_, anyhow::Error>((out, err, status))
    };

    let result = timeout(Duration::from_millis(timeout_ms), run).await;

    match result {
        Ok(Ok((stdout, stderr, status))) => {
            let truncated = stdout.len() + stderr.len() >= max_output;
            Ok(json!({
                "cwd": cwd.strip_prefix(&w).ok().map(|p| p.to_string_lossy().to_string()).unwrap_or_default(),
                "command": command,
                "exit_code": status.code(),
                "stdout": stdout,
                "stderr": stderr,
                "truncated": truncated,
            }))
        }
        Ok(Err(e)) => Err(e),
        Err(_) => anyhow::bail!("command timed out after {} ms", timeout_ms),
    }
}
