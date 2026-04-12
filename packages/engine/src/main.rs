use anyhow::Result;
use clap::{Parser, Subcommand};
use inaricode_engine::dispatch;
use serde::Deserialize;
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::path::Path;

#[derive(Parser)]
#[command(name = "inaricode-engine", version, about = "InariCode native engine")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Read JSON requests from stdin, one per line; write JSON responses to stdout
    Ipc,
}

#[derive(Debug, Deserialize)]
struct Envelope {
    id: String,
    cmd: String,
    workspace: String,
    payload: Value,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Ipc => ipc_loop().await,
    }
}

async fn ipc_loop() -> Result<()> {
    let stdin = std::io::stdin();
    let reader = BufReader::new(stdin.lock());
    let mut stdout = std::io::stdout().lock();
    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let env: Envelope = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                let err = json!({
                    "id": "",
                    "ok": false,
                    "error": format!("invalid envelope: {}", e),
                });
                writeln!(stdout, "{}", err)?;
                stdout.flush()?;
                continue;
            }
        };
        let workspace = Path::new(&env.workspace);
        let result = dispatch(workspace, &env.cmd, &env.payload).await;
        let reply = match result {
            Ok(value) => json!({ "id": env.id, "ok": true, "result": value }),
            Err(e) => json!({ "id": env.id, "ok": false, "error": e.to_string() }),
        };
        writeln!(stdout, "{}", reply)?;
        stdout.flush()?;
    }
    Ok(())
}
