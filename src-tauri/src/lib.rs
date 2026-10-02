use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, io::{Read, Write}, path::PathBuf, sync::Mutex};
use tauri::{Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

struct Session {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[derive(Default)]
struct AppState {
    terminal: Mutex<Option<Session>>,
    saving: Mutex<()>,
}

#[derive(Serialize)]
struct ProjectInfo {
    directory: String,
    image: String,
    document: String,
}

fn project_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("project");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    // Terminalis käivitatud agent näeb juhiseid ja saab muuta joonistust käsufailide kaudu.
    // Olemasolevaid (sh kasutaja muudetud) juhiseid ei kirjutata üle.
    for (name, guide) in [("CLAUDE.md", include_str!("../runtime-CLAUDE.md")), ("AGENT-API.md", include_str!("../AGENT-API.md"))] {
        match fs::OpenOptions::new().write(true).create_new(true).open(path.join(name)) {
            Ok(mut file) => file.write_all(guide.as_bytes()).map_err(|e| e.to_string())?,
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {},
            Err(e) => return Err(e.to_string()),
        }
    }
    fs::create_dir_all(path.join("agent-inbox")).map_err(|e| e.to_string())?;
    fs::create_dir_all(path.join("agent-results")).map_err(|e| e.to_string())?;
    Ok(path)
}

#[tauri::command]
fn project_info(app: tauri::AppHandle) -> Result<ProjectInfo, String> {
    let dir = project_dir(&app)?;
    Ok(ProjectInfo {
        directory: dir.display().to_string(),
        image: dir.join("canvas.png").display().to_string(),
        document: dir.join("canvas.json").display().to_string(),
    })
}

#[tauri::command]
fn load_canvas(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = project_dir(&app)?.join("canvas.json");
    if !path.exists() { return Ok(None); }
    fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_canvas(app: tauri::AppHandle, state: tauri::State<AppState>, document: String, image: String) -> Result<(), String> {
    let _guard = state.saving.lock().map_err(|e| e.to_string())?;
    if document.len() > 10_000_000 || image.len() > 25_000_000 { return Err("Lõuend on liiga suur".into()); }
    serde_json::from_str::<serde_json::Value>(&document).map_err(|e| e.to_string())?;
    let png = image.strip_prefix("data:image/png;base64,").ok_or("Oodati PNG-pilti")?;
    let bytes = base64::engine::general_purpose::STANDARD.decode(png).map_err(|e| e.to_string())?;
    if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") { return Err("Vigane PNG".into()); }
    let dir = project_dir(&app)?;
    fs::write(dir.join("canvas.json"), document).map_err(|e| e.to_string())?;
    fs::write(dir.join("canvas.png"), bytes).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageRecord {
    id: String,
    title: String,
    parent_id: Option<String>,
    strokes: serde_json::Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PagesDocument {
    pages: Vec<PageRecord>,
    active_id: String,
}

#[derive(Deserialize)]
struct PageImage {
    id: String,
    image: String,
}

#[derive(Serialize)]
struct AgentCommand {
    name: String,
    content: String,
}

fn agent_name_valid(name: &str) -> bool {
    name.len() > 5 && name.len() <= 70 && name.ends_with(".json") &&
        name[..name.len() - 5].bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-')
}

#[tauri::command]
fn read_agent_commands(app: tauri::AppHandle) -> Result<Vec<AgentCommand>, String> {
    let inbox = project_dir(&app)?.join("agent-inbox");
    fs::create_dir_all(&inbox).map_err(|e| e.to_string())?;
    let mut paths: Vec<_> = fs::read_dir(inbox).map_err(|e| e.to_string())?
        .filter_map(Result::ok).map(|entry| entry.path())
        .filter(|path| path.file_name().and_then(|s| s.to_str()).is_some_and(agent_name_valid))
        .collect();
    paths.sort();
    paths.into_iter().take(20).map(|path| {
        let name = path.file_name().and_then(|s| s.to_str()).ok_or("Vigane failinimi")?.to_string();
        let size = fs::metadata(&path).map_err(|e| e.to_string())?.len();
        let content = if size > 1_000_000 { "{\"error\":\"Käsk on liiga suur\"}".to_string() }
            else { fs::read_to_string(path).map_err(|e| e.to_string())? };
        Ok(AgentCommand { name, content })
    }).collect()
}

fn encode_clipboard_png(width: u32, height: u32, rgba: &[u8]) -> Result<Vec<u8>, String> {
    let pixels = u64::from(width) * u64::from(height);
    if pixels == 0 || pixels > 40_000_000 || rgba.len() as u64 != pixels * 4 {
        return Err("Lõikelaua pilt on vigane või liiga suur (max 40 miljonit pikslit)".into());
    }
    let mut bytes = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut bytes, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
        writer.write_image_data(rgba).map_err(|e| e.to_string())?;
    }
    if bytes.len() > 8_000_000 { return Err("Lõikelaua PNG on liiga suur (max 8 MB)".into()); }
    Ok(bytes)
}

#[tauri::command]
async fn save_clipboard_image(app: tauri::AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let image = match app.clipboard().read_image() {
            Ok(image) => image,
            Err(_) => return Ok(None), // Teksti lõikelaud: jätka tavalise kleepimisega.
        };
        let bytes = encode_clipboard_png(image.width(), image.height(), image.rgba())?;
        let directory = project_dir(&app)?.join("attachments");
        fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
        let path = directory.join(format!("clipboard-{}.png", stamp));
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&path).map_err(|e| e.to_string())?;
        file.write_all(&bytes).map_err(|e| e.to_string())?;
        Ok(Some(path.display().to_string()))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn import_image_file(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let input = PathBuf::from(path);
    let source = if input.is_absolute() { input } else { project_dir(&app)?.join(input) };
    let file = fs::File::open(source).map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    file.take(8_000_001).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if bytes.len() > 8_000_000 { return Err("Pilt peab olema kuni 8 MB".into()); }
    let mime = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") { "png" }
        else if bytes.starts_with(&[0xff, 0xd8, 0xff]) { "jpeg" }
        else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") { "webp" }
        else { return Err("Toetatud on PNG, JPG ja WebP".into()); };
    Ok(format!("data:image/{};base64,{}", mime, base64::engine::general_purpose::STANDARD.encode(bytes)))
}

#[tauri::command]
fn finish_agent_command(app: tauri::AppHandle, name: String, result: String) -> Result<(), String> {
    if !agent_name_valid(&name) || result.len() > 4000 || serde_json::from_str::<serde_json::Value>(&result).is_err() {
        return Err("Vigane käsu tulemus".into());
    }
    let dir = project_dir(&app)?;
    let results = dir.join("agent-results");
    fs::create_dir_all(&results).map_err(|e| e.to_string())?;
    fs::write(results.join(&name), result).map_err(|e| e.to_string())?;
    let request = dir.join("agent-inbox").join(name);
    if request.exists() { fs::remove_file(request).map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
fn load_pages(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = project_dir(&app)?.join("project.json");
    if !path.exists() { return Ok(None); }
    fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_pages(app: tauri::AppHandle, state: tauri::State<AppState>, document: String, images: Vec<PageImage>) -> Result<(), String> {
    let _guard = state.saving.lock().map_err(|e| e.to_string())?;
    if document.len() > 20_000_000 { return Err("Projekt on liiga suur".into()); }
    let parsed: PagesDocument = serde_json::from_str(&document).map_err(|e| e.to_string())?;
    if parsed.pages.is_empty() || parsed.pages.len() > 200 { return Err("Lehtede arv peab olema 1 kuni 200".into()); }
    let mut ids = HashSet::new();
    for page in &parsed.pages {
        if page.id.is_empty() || page.id.len() > 64 || !page.id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-') ||
            page.title.trim().is_empty() || page.title.len() > 200 || !page.strokes.is_array() || !ids.insert(page.id.as_str()) {
            return Err("Vigane leht".into());
        }
    }
    if !ids.contains(parsed.active_id.as_str()) || parsed.pages.iter().any(|p| p.parent_id.as_ref().is_some_and(|id| !ids.contains(id.as_str()))) {
        return Err("Vigane lehe seos".into());
    }
    let dir = project_dir(&app)?;
    let pages_dir = dir.join("pages");
    fs::create_dir_all(&pages_dir).map_err(|e| e.to_string())?;
    let mut active_image = None;
    for entry in images {
        if !ids.contains(entry.id.as_str()) || entry.image.len() > 25_000_000 { return Err("Vigane lehe pilt".into()); }
        let encoded = entry.image.strip_prefix("data:image/png;base64,").ok_or("Oodati PNG-pilti")?;
        let bytes = base64::engine::general_purpose::STANDARD.decode(encoded).map_err(|e| e.to_string())?;
        if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") { return Err("Vigane PNG".into()); }
        if entry.id == parsed.active_id { active_image = Some(bytes.clone()); }
        fs::write(pages_dir.join(format!("{}.png", entry.id)), bytes).map_err(|e| e.to_string())?;
        let page = parsed.pages.iter().find(|p| p.id == entry.id).ok_or("Leht puudub")?;
        fs::write(pages_dir.join(format!("{}.json", entry.id)), page.strokes.to_string()).map_err(|e| e.to_string())?;
    }
    // Ühilduvad failid terminalis näitavad alati aktiivset lehte.
    let image = active_image.ok_or("Aktiivse lehe pilt puudub")?;
    let active = parsed.pages.iter().find(|p| p.id == parsed.active_id).ok_or("Leht puudub")?;
    fs::write(dir.join("canvas.png"), image).map_err(|e| e.to_string())?;
    fs::write(dir.join("canvas.json"), active.strokes.to_string()).map_err(|e| e.to_string())?;
    fs::write(dir.join("project.json"), document).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(&pages_dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if let (Some(stem), Some(ext)) = (path.file_stem().and_then(|s| s.to_str()), path.extension().and_then(|s| s.to_str())) {
            if (ext == "png" || ext == "json") && !ids.contains(stem) { fs::remove_file(path).map_err(|e| e.to_string())?; }
        }
    }
    Ok(())
}

#[tauri::command]
fn start_terminal(app: tauri::AppHandle, state: tauri::State<AppState>, cols: u16, rows: u16) -> Result<(), String> {
    let mut slot = state.terminal.lock().map_err(|e| e.to_string())?;
    if slot.is_some() { return Ok(()); }
    let pty = native_pty_system().openpty(PtySize { rows: rows.max(2), cols: cols.max(2), pixel_width: 0, pixel_height: 0 }).map_err(|e| e.to_string())?;
    let mut command = CommandBuilder::new(if cfg!(windows) { "powershell.exe" } else { "/bin/sh" });
    command.cwd(project_dir(&app)?);
    if cfg!(windows) { command.arg("-NoLogo"); }
    let child = pty.slave.spawn_command(command).map_err(|e| e.to_string())?;
    drop(pty.slave);
    let mut reader = pty.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pty.master.take_writer().map_err(|e| e.to_string())?;
    *slot = Some(Session { master: pty.master, writer, child });
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => { let _ = app.emit("terminal-output", String::from_utf8_lossy(&buf[..n]).to_string()); }
            }
        }
        let _ = app.emit("terminal-exit", ());
    });
    Ok(())
}

#[tauri::command]
fn terminal_write(state: tauri::State<AppState>, data: String) -> Result<(), String> {
    let mut slot = state.terminal.lock().map_err(|e| e.to_string())?;
    let session = slot.as_mut().ok_or("Terminal pole käivitatud")?;
    session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    session.writer.flush().map_err(|e| e.to_string())
}

#[tauri::command]
fn terminal_resize(state: tauri::State<AppState>, cols: u16, rows: u16) -> Result<(), String> {
    let slot = state.terminal.lock().map_err(|e| e.to_string())?;
    if let Some(session) = slot.as_ref() {
        session.master.resize(PtySize { rows: rows.max(2), cols: cols.max(2), pixel_width: 0, pixel_height: 0 }).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn stop_terminal(state: tauri::State<AppState>) -> Result<(), String> {
    let mut slot = state.terminal.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = slot.take() { session.child.kill().map_err(|e| e.to_string())?; }
    Ok(())
}

#[cfg(test)]
mod clipboard_tests {
    use super::encode_clipboard_png;
    #[test]
    fn clipboard_image_encodes_as_png() {
        let bytes = encode_clipboard_png(1, 1, &[255, 0, 0, 255]).unwrap();
        assert!(bytes.starts_with(b"\x89PNG\r\n\x1a\n"));
        assert_eq!(u32::from_be_bytes(bytes[16..20].try_into().unwrap()), 1);
        assert_eq!(u32::from_be_bytes(bytes[20..24].try_into().unwrap()), 1);
    }
    #[test]
    fn invalid_clipboard_image_is_rejected() {
        assert!(encode_clipboard_png(0, 1, &[]).is_err());
        assert!(encode_clipboard_png(1, 1, &[0]).is_err());
        assert!(encode_clipboard_png(10000, 10000, &[]).is_err());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![project_info, load_canvas, save_canvas, load_pages, save_pages, read_agent_commands, finish_agent_command, import_image_file, save_clipboard_image, start_terminal, terminal_write, terminal_resize, stop_terminal])
        .run(tauri::generate_context!())
        .expect("Rakenduse käivitamine ebaõnnestus");
}
