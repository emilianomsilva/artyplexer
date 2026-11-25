//! artyplexer-media: Artyplexer media backend (temp store with 7-day retention).
//!
//! Speaks newline-delimited JSON on stdin/stdout:
//!   {"id":1,"op":"stage","filename":"..","service":"..","mime":"..","ext_hint":".mp4"}
//!   {"id":2,"op":"complete","dir":"<uuid32>","filename":".."}
//!   {"id":3,"op":"list"}
//!   {"id":4,"op":"open","dir":"<uuid32>"}
//!   {"id":5,"op":"save","dir":"<uuid32>","target":"/path/optional"}
//!   {"id":6,"op":"prune"}
//!   {"id":7,"op":"shutdown"}
//! Responses echo the request id: {"id":1,"ok":true,...} or {"id":1,"ok":false,"error":"..."}.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const RETENTION_SECS: u64 = 7 * 24 * 3600;

#[derive(Debug, Deserialize)]
struct Request {
    id: u64,
    op: String,
    #[serde(default)]
    filename: String,
    #[serde(default)]
    service: String,
    #[serde(default)]
    mime: String,
    #[serde(default)]
    ext_hint: String,
    #[serde(default)]
    dir: String,
    #[serde(default)]
    target: String,
    #[serde(default)]
    overwrite: bool,
}

#[derive(Debug, Serialize, Clone)]
struct Entry {
    directory: String,
    filename: String,
    service_name: String,
    completed_at: i64,
    expires_at: i64,
    mime_type: String,
    is_video: bool,
    size: u64,
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn data_dir() -> PathBuf {
    if let Ok(d) = std::env::var("ARTYPLEXER_DATA_DIR") {
        return PathBuf::from(d);
    }
    let base = std::env::var("XDG_DATA_HOME").unwrap_or_else(|_| {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
        format!("{home}/.local/share")
    });
    PathBuf::from(base).join("artyplexer").join("data")
}

fn store_root() -> PathBuf {
    data_dir().join("media-downloads")
}

fn sanitize_filename(name: &str) -> String {
    let base = name.rsplit(['/', '\\']).next().unwrap_or(name);
    let clean: String = base
        .chars()
        .map(|c| {
            if matches!(c, '<' | '>' | ':' | '"' | '|' | '?' | '*' | '\0'..='\x1f') {
                '_'
            } else {
                c
            }
        })
        .collect();
    let clean = clean.trim_matches(|c| c == ' ' || c == '.').to_string();
    if clean.is_empty() {
        "download".to_string()
    } else {
        clean
    }
}

fn guess_mime(filename: &str) -> String {
    let ext = Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    match ext.as_str() {
        "mp4" | "m4v" | "mov" => "video/mp4",
        "webm" => "video/webm",
        "ogv" | "ogg" => "video/ogg",
        "mkv" => "video/x-matroska",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    }
    .to_string()
}

fn is_video(mime: &str) -> bool {
    mime.split(';').next().unwrap_or("").trim().to_lowercase().starts_with("video/")
}

fn new_id() -> Result<String, String> {
    let mut b = [0u8; 16];
    getrandom::fill(&mut b).map_err(|error| format!("cannot generate download ID: {error}"))?;
    Ok(b.iter().map(|x| format!("{:02x}", x)).collect())
}

fn entry_from_dir(dir: &Path) -> Option<Entry> {
    let meta_raw = std::fs::read_to_string(dir.join("download.json")).ok()?;
    let meta: HashMap<String, String> = serde_json::from_str(&meta_raw).ok()?;
    let filename = meta.get("filename")?;
    if &sanitize_filename(filename) != filename {
        return None;
    }
    let completed_at: i64 = meta.get("completed_at")?.parse().ok()?;
    if completed_at + RETENTION_SECS as i64 <= now_secs() {
        return None;
    }
    let file = dir.join("file").join(filename);
    let st = std::fs::metadata(&file).ok()?;
    if !st.is_file() {
        return None;
    }
    let mime = meta.get("mime").cloned().unwrap_or_default();
    Some(Entry {
        directory: dir.file_name()?.to_string_lossy().into_owned(),
        filename: filename.clone(),
        service_name: meta.get("service_name").cloned().unwrap_or_default(),
        completed_at,
        expires_at: completed_at + RETENTION_SECS as i64,
        mime_type: mime.clone(),
        is_video: is_video(&mime),
        size: st.len(),
    })
}

/// Restore live entries, deleting expired/partial ones. Returns map dir->Entry.
fn restore(root: &Path) -> HashMap<String, Entry> {
    let mut out = HashMap::new();
    let Ok(rd) = std::fs::read_dir(root) else {
        return out;
    };
    for ent in rd.flatten() {
        let dir = ent.path();
        let name = ent.file_name().to_string_lossy().into_owned();
        if !ent.file_type().map(|t| t.is_dir()).unwrap_or(false)
            || name.len() != 32
            || !name.chars().all(|c| c.is_ascii_hexdigit())
        {
            continue;
        }
        match entry_from_dir(&dir) {
            Some(e) => {
                out.insert(name, e);
            }
            None => {
                let _ = std::fs::remove_dir_all(&dir);
            }
        }
    }
    out
}

fn unique_target(target: &Path) -> PathBuf {
    if !target.exists() && target.symlink_metadata().is_err() {
        return target.to_path_buf();
    }
    let stem = target.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
    let ext = target.extension().and_then(|e| e.to_str()).unwrap_or("");
    let parent = target.parent().unwrap_or_else(|| Path::new("."));
    let mut i = 1u32;
    loop {
        let cand = if ext.is_empty() {
            parent.join(format!("{} ({})", stem, i))
        } else {
            parent.join(format!("{} ({}).{}", stem, i, ext))
        };
        if cand.symlink_metadata().is_err() {
            return cand;
        }
        i += 1;
    }
}

fn open_native(path: &str) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    let prog = "xdg-open";
    #[cfg(target_os = "macos")]
    let prog = "open";
    #[cfg(target_os = "windows")]
    let prog = "rundll32";
    #[cfg(target_os = "windows")]
    let args: Vec<&str> = vec!["url.dll,FileProtocolHandler", path];
    #[cfg(not(target_os = "windows"))]
    let args: Vec<&str> = vec![path];
    std::process::Command::new(prog)
        .args(&args)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn default_download_dir() -> PathBuf {
    if let Ok(d) = std::env::var("XDG_DOWNLOAD_DIR") {
        if !d.is_empty() {
            return PathBuf::from(d);
        }
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join("Downloads")
}

struct Backend {
    root: PathBuf,
    entries: HashMap<String, Entry>,
}

impl Backend {
    fn new() -> Self {
        let root = store_root();
        let _ = std::fs::create_dir_all(&root);
        let entries = restore(&root);
        Backend { root, entries }
    }

    fn stage(&mut self, filename: &str, service: &str, mime: &str) -> Result<Value, String> {
        let mut name = sanitize_filename(filename);
        if name == "download" {
            name = if mime.starts_with("image/") {
                "download.png".into()
            } else {
                "download.mp4".into()
            };
        }
        let id = new_id()?;
        let dir = self.root.join(&id);
        std::fs::create_dir_all(dir.join("file")).map_err(|e| e.to_string())?;
        Ok(json!({"dir": id, "path": dir.join("file").join(&name).to_string_lossy()}))
    }

    fn complete(&mut self, dir: &str, filename: &str, service: &str, mime: &str) -> Result<Entry, String> {
        let name = sanitize_filename(filename);
        let d = self.root.join(dir);
        if !d.is_dir() {
            return Err("unknown staging dir".into());
        }
        // Chromium may have saved under a different name; find the single file.
        let actual = std::fs::read_dir(d.join("file"))
            .map_err(|e| e.to_string())?
            .flatten()
            .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
            .next()
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .ok_or("empty download")?;
        let mut mime = mime.to_string();
        if mime.is_empty() || mime == "application/octet-stream" {
            mime = guess_mime(&actual);
        }
        let from = d.join("file").join(&actual);
        let to = d.join("file").join(&name);
        if actual != name {
            std::fs::rename(&from, &to).map_err(|e| e.to_string())?;
        }
        let meta = serde_json::json!({
            "filename": name,
            "service_name": service,
            "completed_at": now_secs().to_string(),
            "mime": mime,
        });
        std::fs::write(d.join("download.json"), serde_json::to_string(&meta).unwrap())
            .map_err(|e| e.to_string())?;
        match entry_from_dir(&d) {
            Some(e) => {
                self.entries.insert(dir.to_string(), e.clone());
                Ok(e)
            }
            None => Err("complete failed".into()),
        }
    }

    fn list(&self) -> Vec<Entry> {
        let mut v: Vec<Entry> = self.entries.values().cloned().collect();
        v.sort_by(|a, b| b.completed_at.cmp(&a.completed_at));
        v
    }

    fn save(&self, dir: &str, target: &str, overwrite: bool) -> Result<String, String> {
        let e = self.entries.get(dir).ok_or("expired")?;
        let src = self.root.join(dir).join("file").join(&e.filename);
        let dst = if target.is_empty() {
            let base = std::env::var("ARTYPLEXER_DOWNLOAD_DIR").unwrap_or_else(|_| {
                default_download_dir().to_string_lossy().into_owned()
            });
            unique_target(&PathBuf::from(base).join(&e.filename))
        } else {
            let t = PathBuf::from(target);
            if t.exists() || t.symlink_metadata().is_ok() {
                if !overwrite {
                    return Err(format!("already exists: {}", target));
                }
                if t.is_dir() {
                    return Err(format!("is a directory: {}", target));
                }
                std::fs::remove_file(&t).map_err(|e| e.to_string())?;
            }
            if let Some(p) = t.parent() {
                std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
            }
            t
        };
        // Prefer hardlink, fall back to copy.
        if std::fs::hard_link(&src, &dst).is_err() {
            std::fs::copy(&src, &dst).map_err(|e| e.to_string())?;
        }
        Ok(dst.to_string_lossy().into_owned())
    }
}

fn main() {    let backend = std::sync::Mutex::new(Backend::new());
    let stdin = std::io::stdin();
    let out = std::io::stdout();
    for line in BufReader::new(stdin.lock()).lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        if line.trim().is_empty() {
            continue;
        }
        let req: Request = match serde_json::from_str(&line) {
            Ok(r) => r,
            Err(e) => {
                let _ = writeln_json(&out, json!({"id": 0, "ok": false, "error": format!("bad request: {e}")}));
                continue;
            }
        };
        if req.op == "shutdown" {
            let _ = writeln_json(&out, json!({"id": req.id, "ok": true}));
            break;
        }
        let resp = {
            let mut b = backend.lock().unwrap();
            match req.op.as_str() {
                "stage" => b
                    .stage(&req.filename, &req.service, &req.mime)
                    .map(|mut v| {
                        v["id"] = json!(req.id);
                        v["ok"] = json!(true);
                        v
                    }),
                "complete" => b
                    .complete(&req.dir, &req.filename, &req.service, &req.mime)
                    .map(|e| json!({"id": req.id, "ok": true, "entry": e}))
                    .map_err(|e| e),
                "list" => Ok(json!({"id": req.id, "ok": true, "entries": b.list()})),
                "open" => b
                    .entries
                    .get(&req.dir)
                    .ok_or("expired".to_string())
                    .and_then(|e| {
                        let p = b.root.join(&req.dir).join("file").join(&e.filename);
                        open_native(&p.to_string_lossy()).map(|_| json!({"id": req.id, "ok": true}))
                    }),
                "save" => b.save(&req.dir, &req.target, req.overwrite).map(|p| json!({"id": req.id, "ok": true, "path": p})),
                "prune" => {
                    b.entries = restore(&b.root);
                    Ok(json!({"id": req.id, "ok": true, "entries": b.list()}))
                }
                _ => Err(format!("unknown op: {}", req.op)),
            }
        };
        let out_val = match resp {
            Ok(v) => v,
            Err(e) => json!({"id": req.id, "ok": false, "error": e}),
        };
        if writeln_json(&out, out_val).is_err() {
            break;
        }
    }
}

fn writeln_json(out: &std::io::Stdout, v: Value) -> std::io::Result<()> {
    let mut h = out.lock();
    serde_json::to_writer(&mut h, &v)?;
    h.write_all(b"\n")?;
    h.flush()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_download_names() {
        assert_eq!(sanitize_filename("vídeo.mp4"), "vídeo.mp4");
        assert_eq!(sanitize_filename("a/b\\c:d.mp4"), "c_d.mp4");
        assert_eq!(sanitize_filename("  . . "), "download");
        assert_eq!(sanitize_filename(""), "download");
    }

    #[test]
    fn mime_guess_and_is_video() {
        assert_eq!(guess_mime("clip.mp4"), "video/mp4");
        assert_eq!(guess_mime("anim.WEBM"), "video/webm");
        assert_eq!(guess_mime("foto.png"), "image/png");
        assert_eq!(guess_mime("doc.pdf"), "application/octet-stream");
        assert!(is_video("video/mp4"));
        assert!(is_video("video/webm; codecs=vp9"));
        assert!(!is_video("image/png"));
        assert!(!is_video("application/octet-stream"));
    }

    #[test]
    fn restore_prunes_expired_and_partial() {
        let root = std::env::temp_dir().join(format!("iron-test-{}", now_secs()));
        let _ = std::fs::remove_dir_all(&root);
        let mut s = Backend { root: root.clone(), entries: std::collections::HashMap::new() };
        std::fs::create_dir_all(&root).unwrap();
        // recent entry
        let e = s.stage("foto.png", "WA", "image/png").unwrap();
        let dir = e["dir"].as_str().unwrap().to_string();
        let p: std::path::PathBuf = e["path"].as_str().unwrap().into();
        std::fs::write(&p, b"photo").unwrap();
        // complete by hand: write metadata via complete()
        let mut b = Backend { root: root.clone(), entries: std::collections::HashMap::new() };
        let done = b.complete(&dir, "foto.png", "WA", "image/png").unwrap();
        assert_eq!(done.filename, "foto.png");
        // partial dir without metadata
        std::fs::create_dir_all(root.join("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").join("file")).unwrap();
        let live = restore(&root);
        assert!(live.contains_key(&dir));
        assert_eq!(live.len(), 1);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn save_copy_unique_then_overwrite() {
        let root = std::env::temp_dir().join(format!("iron-test-save-{}", now_secs()));
        let _ = std::fs::remove_dir_all(&root);
        let mut b = Backend { root: root.clone(), entries: std::collections::HashMap::new() };
        std::fs::create_dir_all(&root).unwrap();
        let st = b.stage("rel.mp4", "WA", "video/mp4").unwrap();
        let dir = st["dir"].as_str().unwrap();
        std::fs::write(st["path"].as_str().unwrap(), b"bytes").unwrap();
        b.complete(dir, "rel.mp4", "WA", "video/mp4").unwrap();
        let dest_dir = root.join("out");
        let t1 = b.save(dir, dest_dir.join("rel.mp4").to_str().unwrap(), false).unwrap();
        // explicit target without overwrite must refuse (mirrors always-ask flow)
        assert!(b.save(dir, dest_dir.join("rel.mp4").to_str().unwrap(), false).is_err());
        // overwrite replaces in place
        let t3 = b
            .save(dir, dest_dir.join("rel.mp4").to_str().unwrap(), true)
            .unwrap();
        assert_eq!(t3, t1);
        // empty target auto-uniquifies (mirrors direct-save flow)
        unsafe { std::env::set_var("ARTYPLEXER_DOWNLOAD_DIR", dest_dir.to_str().unwrap()) };
        let u1 = b.save(dir, "", false).unwrap();
        let u2 = b.save(dir, "", false).unwrap();
        unsafe { std::env::remove_var("ARTYPLEXER_DOWNLOAD_DIR") };
        assert_ne!(u1, u2);
        assert!(u1.ends_with("rel (1).mp4"), "u1={u1}");
        assert!(u2.ends_with("rel (2).mp4"), "u2={u2}");
        let _ = std::fs::remove_dir_all(&root);
    }
}
