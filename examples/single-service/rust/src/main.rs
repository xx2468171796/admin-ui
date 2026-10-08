// Local-only integration example; the consuming project supplies network authentication.
use include_dir::{include_dir, Dir};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{collections::HashMap, env, fs, io::Read, path::Path, time::Duration};
use tiny_http::{Header, Request, Response, Server, StatusCode};

static WEB: Dir = include_dir!("$CARGO_MANIFEST_DIR/../web/dist");
#[derive(Serialize)]
struct Item { id: String, name: String }
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct NewItem { name: String }
fn header<'a>(request: &'a Request, name: &str) -> &'a str {
    request.headers().iter().find(|h| h.field.as_str().as_str().eq_ignore_ascii_case(name))
        .map(|h| h.value.as_str()).unwrap_or("")
}
fn send(request: Request, code: u16, data: Vec<u8>, mime: &str, cache: &str, location: Option<&str>) {
    let mut response = Response::from_data(data).with_status_code(StatusCode(code));
    for (name, value) in [("Content-Type", mime), ("Cache-Control", cache), ("X-Content-Type-Options", "nosniff")] {
        response.add_header(Header::from_bytes(name, value).unwrap());
    }
    if let Some(value) = location { response.add_header(Header::from_bytes("Location", value).unwrap()); }
    if code == 405 { response.add_header(Header::from_bytes("Allow", "GET, POST").unwrap()); }
    let _ = request.respond(response);
}
fn reply(request: Request, code: u16, value: serde_json::Value) {
    send(request, code, serde_json::to_vec(&value).unwrap(), "application/json; charset=utf-8", "no-store", None);
}
fn fail(request: Request, code: u16, message: &str) { reply(request, code, json!({"message": message})); }
fn listing(db: &mut Connection, query: &HashMap<String, String>) -> Result<serde_json::Value, &'static str> {
    let get = |key: &str, default: &str| query.get(key).filter(|s| !s.is_empty()).cloned().unwrap_or(default.to_owned());
    let page = get("page", "1").parse::<u32>().map_err(|_| "query")?;
    let size = get("pageSize", "10").parse::<u32>().map_err(|_| "query")?;
    let sort = get("sort", "id"); let direction = get("direction", "desc"); let search = get("search", "");
    if page == 0 || page > 1_000_000 || size == 0 || size > 100 || !["id", "name"].contains(&sort.as_str()) || !["asc", "desc"].contains(&direction.as_str()) || search.chars().count() > 80 { return Err("query"); }
    let tx = db.transaction().map_err(|_| "db")?;
    let total: i64 = tx.query_row("SELECT COUNT(*) FROM items WHERE instr(name, ?) > 0", [&search], |r| r.get(0)).map_err(|_| "db")?;
    let items = {
        let mut statement = tx.prepare(&format!("SELECT id,name FROM items WHERE instr(name, ?) > 0 ORDER BY {sort} {direction}, id {direction} LIMIT ? OFFSET ?")).map_err(|_| "db")?;
        let rows = statement.query_map(params![search, size, (page - 1) * size], |row| Ok(Item { id: row.get::<_, i64>(0)?.to_string(), name: row.get(1)? })).map_err(|_| "db")?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|_| "db")?
    };
    tx.commit().map_err(|_| "db")?;
    Ok(json!({"rows": items, "total": total}))
}
fn handle(mut request: Request, db: &mut Connection, address: &str) {
    if header(&request, "Host") != address { fail(request, 403, "请使用启动日志中的本机地址"); return; }
    let url = request.url().to_owned();
    let (path, query) = url.split_once('?').unwrap_or((&url, ""));
    let method = request.method().as_str().to_owned();
    if path == "/admin" && method == "GET" { send(request, 308, vec![], "text/plain", "no-cache", Some("/admin/")); return; }
    if let Some(name) = path.strip_prefix("/admin/") {
        if method == "GET" || method == "HEAD" {
            let name = if name.is_empty() { "index.html" } else { name };
            if name.split('/').any(|part| part == ".." || part == ".") { fail(request, 404, "资源不存在"); return; }
            if let Some(file) = WEB.get_file(name) {
                let mime = mime_guess::from_path(name).first_or_octet_stream();
                let cache = if name.starts_with("assets/") { "public, max-age=31536000, immutable" } else { "no-cache" };
                send(request, 200, file.contents().to_vec(), mime.as_ref(), cache, None); return;
            }
            fail(request, 404, "资源不存在"); return;
        }
    }
    if path != "/api/admin/items" { fail(request, 404, "接口不存在"); return; }
    match method.as_str() {
        "GET" => {
            let params = form_urlencoded::parse(query.as_bytes()).into_owned().collect();
            match listing(db, &params) { Ok(value) => reply(request, 200, value), Err("query") => fail(request,400,"查询参数不正确"), _ => fail(request,500,"读取失败") }
        }
        "POST" => {
            let origin = header(&request, "Origin");
            if header(&request, "X-AdminUI-Request") != "1" || (!origin.is_empty() && origin != format!("http://{address}")) { fail(request,403,"请求来源不允许"); return; }
            if header(&request, "Content-Type").split(';').next() != Some("application/json") { fail(request,415,"需要 JSON 请求"); return; }
            let mut bytes = vec![];
            if request.as_reader().take(4097).read_to_end(&mut bytes).is_err() || bytes.len() > 4096 { fail(request,400,"请求格式不正确"); return; }
            let Ok(body) = serde_json::from_slice::<NewItem>(&bytes) else { fail(request,400,"请求格式不正确"); return; };
            let name = body.name.trim();
            if name.is_empty() || name.chars().count() > 80 { fail(request,400,"名称须为 1–80 个字符"); return; }
            match db.execute("INSERT INTO items(name) VALUES (?) ON CONFLICT(name) DO NOTHING", [name]) {
                Ok(0) => fail(request,409,"名称已存在"),
                Ok(_) => reply(request,201,json!(Item { id: db.last_insert_rowid().to_string(), name: name.to_owned() })),
                Err(_) => fail(request,500,"保存失败"),
            }
        }
        _ => fail(request,405,"方法不允许"),
    }
}
fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let port = env::var("PORT").unwrap_or("8080".into()).parse::<u16>()?;
    if port == 0 { return Err("invalid PORT".into()); }
    let address = format!("127.0.0.1:{port}");
    let db_path = env::var("DB_PATH").unwrap_or("data/tool.sqlite".into());
    if let Some(parent) = Path::new(&db_path).parent().filter(|p| !p.as_os_str().is_empty()) { fs::create_dir_all(parent)?; }
    let mut db = Connection::open(&db_path)?;
    db.busy_timeout(Duration::from_secs(5))?;
    db.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);")?;
    let server = Server::http(&address)?;
    eprintln!("AdminUI: http://{address}/admin/ (SQLite: {db_path})");
    for request in server.incoming_requests() { handle(request, &mut db, &address); }
    Ok(())
}
