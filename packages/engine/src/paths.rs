use anyhow::{Context, Result};
use std::path::{Path, PathBuf};

fn clean_rel(rel: &str) -> Result<&str> {
    let rel = rel.trim();
    if rel.is_empty() {
        anyhow::bail!("path is empty");
    }
    if rel.contains('\0') {
        anyhow::bail!("invalid path");
    }
    let rel = rel.trim_start_matches(['/', '\\']);
    if rel.split(['/', '\\']).any(|p| p == "..") {
        anyhow::bail!("path must not contain '..'");
    }
    Ok(rel)
}

pub fn resolve_existing(workspace: &Path, rel: &str) -> Result<PathBuf> {
    let w = workspace.canonicalize().context("canonicalize workspace")?;
    let rel = clean_rel(rel)?;
    let p = w.join(rel);
    let p = p.canonicalize().context("canonicalize path")?;
    if !p.starts_with(&w) {
        anyhow::bail!("path outside workspace");
    }
    Ok(p)
}

pub fn resolve_for_write(workspace: &Path, rel: &str) -> Result<PathBuf> {
    let w = workspace.canonicalize().context("canonicalize workspace")?;
    let rel = clean_rel(rel)?;
    let p = w.join(rel);
    let parent = p
        .parent()
        .ok_or_else(|| anyhow::anyhow!("path has no parent"))?;
    std::fs::create_dir_all(parent).ok();
    let parent_canon = parent.canonicalize().context("canonicalize parent")?;
    if !parent_canon.starts_with(&w) {
        anyhow::bail!("path outside workspace");
    }
    Ok(p)
}
