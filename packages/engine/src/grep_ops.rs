use anyhow::{Context, Result};
use ignore::WalkBuilder;
use regex::Regex;
use serde_json::{json, Value};
use std::fs;
use std::path::Path;

const MAX_FILE_BYTES: u64 = 512 * 1024;
const DEFAULT_MAX_MATCHES: usize = 200;

pub fn grep(workspace: &Path, payload: &Value) -> Result<Value> {
    let pattern = payload
        .get("pattern")
        .and_then(|p| p.as_str())
        .ok_or_else(|| anyhow::anyhow!("missing pattern"))?;
    let max_matches = payload
        .get("max_matches")
        .and_then(|v| v.as_u64())
        .unwrap_or(DEFAULT_MAX_MATCHES as u64) as usize;
    let path_prefix = payload
        .get("path_prefix")
        .and_then(|p| p.as_str())
        .unwrap_or("");

    let re = Regex::new(pattern).context("invalid regex")?;
    let root = workspace.canonicalize().context("workspace")?;
    let mut matches: Vec<Value> = Vec::new();

    let mut builder = WalkBuilder::new(&root);
    builder.hidden(false);
    builder.git_ignore(true);
    builder.ignore(false);
    builder.add_custom_ignore_filename(".inariignore");

    for result in builder.build() {
        let entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };
        if !entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            continue;
        }
        let path = entry.path();
        let rel = path.strip_prefix(&root).unwrap_or(path);
        let rel_s = rel.to_string_lossy();
        if !path_prefix.is_empty() && !rel_s.starts_with(path_prefix.trim_start_matches(['/', '\\'])) {
            continue;
        }
        let meta = match fs::metadata(path) {
            Ok(m) => m,
            Err(_) => continue,
        };
        if !meta.is_file() || meta.len() > MAX_FILE_BYTES {
            continue;
        }
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        for (idx, line) in content.lines().enumerate() {
            if matches.len() >= max_matches {
                break;
            }
            if re.is_match(line) {
                matches.push(json!({
                    "path": rel_s.as_ref(),
                    "line": idx + 1,
                    "text": line,
                }));
            }
        }
        if matches.len() >= max_matches {
            break;
        }
    }

    Ok(json!({
        "pattern": pattern,
        "matches": matches,
        "truncated": matches.len() >= max_matches,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::tempdir;

    #[test]
    fn grep_honors_inariignore() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join(".inariignore"), "secret.txt\n").unwrap();
        std::fs::write(root.join("secret.txt"), "findme\n").unwrap();
        std::fs::write(root.join("ok.txt"), "findme\n").unwrap();
        let payload = json!({ "pattern": "findme" });
        let v = grep(root, &payload).unwrap();
        let matches = v["matches"].as_array().unwrap();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0]["path"], "ok.txt");
    }
}
