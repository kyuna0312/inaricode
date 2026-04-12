use crate::paths;
use anyhow::{Context, Result};
use serde_json::{json, Value};
use similar::{ChangeTag, TextDiff};
use std::fs;
use std::path::Path;

pub fn write_file(workspace: &Path, payload: &Value) -> Result<Value> {
    let path = payload
        .get("path")
        .and_then(|p| p.as_str())
        .ok_or_else(|| anyhow::anyhow!("missing path"))?;
    let content = payload
        .get("content")
        .and_then(|p| p.as_str())
        .ok_or_else(|| anyhow::anyhow!("missing content"))?;
    let abs = paths::resolve_for_write(workspace, path)?;
    fs::write(&abs, content.as_bytes()).context("write file")?;
    Ok(json!({ "path": path, "bytes_written": content.len() }))
}

pub fn read_file(workspace: &Path, payload: &Value) -> Result<Value> {
    let path = payload
        .get("path")
        .and_then(|p| p.as_str())
        .ok_or_else(|| anyhow::anyhow!("missing path"))?;
    let start_line = payload.get("start_line").and_then(|v| v.as_u64()).map(|n| n as usize);
    let end_line = payload.get("end_line").and_then(|v| v.as_u64()).map(|n| n as usize);

    let abs = paths::resolve_existing(workspace, path)?;
    let meta = fs::metadata(&abs).context("metadata")?;
    if !meta.is_file() {
        anyhow::bail!("not a file");
    }
    const MAX_BYTES: u64 = 2 * 1024 * 1024;
    if meta.len() > MAX_BYTES {
        anyhow::bail!("file too large (max {} bytes)", MAX_BYTES);
    }
    let content = fs::read_to_string(&abs).context("read file")?;
    let lines: Vec<&str> = content.lines().collect();
    let total = lines.len();
    let (body, range_label) = match (start_line, end_line) {
        (Some(s), Some(e)) if s >= 1 && e >= s => {
            let s0 = s - 1;
            let e0 = e.min(lines.len());
            let slice = lines[s0..e0].join("\n");
            (slice, format!("lines {}-{} of {}", s, e0, total))
        }
        (Some(s), None) if s >= 1 => {
            let s0 = s - 1;
            let slice = lines[s0..].join("\n");
            (slice, format!("lines {}-end of {}", s, total))
        }
        (None, Some(e)) if e >= 1 => {
            let e0 = e.min(lines.len());
            let slice = lines[..e0].join("\n");
            (slice, format!("lines 1-{} of {}", e0, total))
        }
        _ => (content, format!("{} lines", total)),
    };

    Ok(json!({
        "path": path,
        "content": body,
        "total_lines": total,
        "range": range_label,
    }))
}

pub fn list_dir(workspace: &Path, payload: &Value) -> Result<Value> {
    let path = payload
        .get("path")
        .and_then(|p| p.as_str())
        .unwrap_or(".");
    let max_entries = payload
        .get("max_entries")
        .and_then(|v| v.as_u64())
        .unwrap_or(500) as usize;

    let abs = paths::resolve_existing(workspace, path)?;
    if !abs.is_dir() {
        anyhow::bail!("not a directory");
    }
    let mut entries: Vec<Value> = Vec::new();
    for (i, ent) in fs::read_dir(&abs).context("read_dir")?.enumerate() {
        if i >= max_entries {
            break;
        }
        let ent = ent.context("dir entry")?;
        let meta = ent.metadata().context("metadata")?;
        let name = ent.file_name().to_string_lossy().to_string();
        entries.push(json!({
            "name": name,
            "is_dir": meta.is_dir(),
        }));
    }
    entries.sort_by(|a, b| {
        let na = a["name"].as_str().unwrap_or("");
        let nb = b["name"].as_str().unwrap_or("");
        na.cmp(nb)
    });
    Ok(json!({ "path": path, "entries": entries, "truncated": entries.len() >= max_entries }))
}

pub fn search_replace(workspace: &Path, payload: &Value) -> Result<Value> {
    let path = payload
        .get("path")
        .and_then(|p| p.as_str())
        .ok_or_else(|| anyhow::anyhow!("missing path"))?;
    let old_string = payload
        .get("old_string")
        .and_then(|p| p.as_str())
        .ok_or_else(|| anyhow::anyhow!("missing old_string"))?;
    let new_string = payload
        .get("new_string")
        .and_then(|p| p.as_str())
        .ok_or_else(|| anyhow::anyhow!("missing new_string"))?;
    let replace_all = payload.get("replace_all").and_then(|v| v.as_bool()).unwrap_or(false);

    if old_string.is_empty() {
        anyhow::bail!("old_string must not be empty");
    }

    let abs = paths::resolve_for_write(workspace, path)?;
    if !abs.exists() {
        anyhow::bail!("file does not exist");
    }
    if !abs.is_file() {
        anyhow::bail!("not a file");
    }
    let original = fs::read_to_string(&abs).context("read file")?;
    let count = original.matches(old_string).count();
    let new_content = if replace_all {
        if count == 0 {
            anyhow::bail!("old_string not found");
        }
        original.replace(old_string, new_string)
    } else {
        if count == 0 {
            anyhow::bail!("old_string not found");
        }
        if count > 1 {
            anyhow::bail!("old_string matched {} times; require unique match or replace_all", count);
        }
        original.replacen(old_string, new_string, 1)
    };

    let diff = TextDiff::from_lines(&original, &new_content);
    let mut unified = String::new();
    unified.push_str(&format!("--- a/{path}\n+++ b/{path}\n", path = path));
    for op in diff.ops() {
        for change in diff.iter_changes(op) {
            let sign = match change.tag() {
                ChangeTag::Delete => '-',
                ChangeTag::Insert => '+',
                ChangeTag::Equal => ' ',
            };
            for line in change.value().lines() {
                unified.push(sign);
                unified.push_str(line);
                unified.push('\n');
            }
        }
    }

    fs::write(&abs, new_content.as_bytes()).context("write file")?;

    Ok(json!({
        "path": path,
        "replacements": if replace_all { count } else { 1 },
        "unified_diff": unified,
    }))
}

pub fn apply_patch(workspace: &Path, payload: &Value) -> Result<Value> {
    let path = payload
        .get("path")
        .and_then(|p| p.as_str())
        .ok_or_else(|| anyhow::anyhow!("missing path"))?;
    let unified_diff = payload
        .get("unified_diff")
        .and_then(|p| p.as_str())
        .ok_or_else(|| anyhow::anyhow!("missing unified_diff"))?;
    const MAX_PATCH_BYTES: usize = 512 * 1024;
    if unified_diff.len() > MAX_PATCH_BYTES {
        anyhow::bail!("unified_diff too large (max {} bytes)", MAX_PATCH_BYTES);
    }

    let abs = paths::resolve_for_write(workspace, path)?;
    if !abs.exists() {
        anyhow::bail!("file does not exist; apply_patch requires an existing file");
    }
    let original = fs::read_to_string(&abs).context("read file")?;
    let patch = diffy::Patch::from_str(unified_diff.trim()).context("parse unified diff")?;
    let new_content = diffy::apply(&original, &patch).context("apply patch failed (hunk mismatch?)")?;
    fs::write(&abs, new_content.as_bytes()).context("write file")?;
    Ok(json!({
        "path": path,
        "applied": true,
        "bytes_written": new_content.len(),
    }))
}
