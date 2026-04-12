pub mod fs_ops;
pub mod grep_ops;
pub mod paths;
pub mod process_ops;

use anyhow::Result;
use serde_json::{json, Value};
use std::path::Path;

pub async fn dispatch(workspace: &Path, cmd: &str, payload: &Value) -> Result<Value> {
    match cmd {
        "echo" => Ok(json!({ "pong": true, "payload": payload })),
        "read_file" => fs_ops::read_file(workspace, payload),
        "list_dir" => fs_ops::list_dir(workspace, payload),
        "write_file" => fs_ops::write_file(workspace, payload),
        "search_replace" => fs_ops::search_replace(workspace, payload),
        "apply_patch" => fs_ops::apply_patch(workspace, payload),
        "grep" => grep_ops::grep(workspace, payload),
        "run_cmd" => process_ops::run_cmd(workspace, payload).await,
        _ => anyhow::bail!("unknown cmd {:?}", cmd),
    }
}

#[cfg(test)]
mod tests {
    use super::paths;

    #[test]
    fn rejects_dotdot_segments() {
        let tmp = tempfile::tempdir().unwrap();
        let r = paths::resolve_existing(tmp.path(), "foo/../bar");
        assert!(r.is_err());
    }
}
