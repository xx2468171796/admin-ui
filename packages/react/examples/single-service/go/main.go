// Local-only integration example. Add the host project's authentication before network deployment.
package main

import (
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	_ "modernc.org/sqlite"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

//go:embed all:web/dist
var assets embed.FS

type Item struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func reply(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func fail(w http.ResponseWriter, status int, message string) {
	reply(w, status, map[string]string{"message": message})
}
func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	number, err := strconv.Atoi(port)
	if err != nil || number < 1 || number > 65535 {
		log.Fatal("invalid PORT")
	}
	address := fmt.Sprintf("127.0.0.1:%d", number)
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "data/tool.sqlite"
	}
	if err := os.MkdirAll(filepath.Dir(dbPath), 0700); err != nil {
		log.Fatal(err)
	}
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if _, err = db.Exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);`); err != nil {
		log.Fatal(err)
	}
	root, err := fs.Sub(assets, "web/dist")
	if err != nil {
		log.Fatal(err)
	}
	static := http.StripPrefix("/admin/", http.FileServer(http.FS(root)))
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-cache")
		// Reject DNS rebinding and browser cross-origin writes; this is not an account system.
		if r.Host != address {
			fail(w, 403, "请使用启动日志中的本机地址")
			return
		}
		if r.URL.Path == "/admin" && r.Method == "GET" {
			http.Redirect(w, r, "/admin/", 308)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/admin/") && (r.Method == "GET" || r.Method == "HEAD") {
			name := strings.TrimPrefix(r.URL.Path, "/admin/")
			if name == "" {
				name = "index.html"
			}
			info, err := fs.Stat(root, name)
			if err != nil || info.IsDir() {
				http.NotFound(w, r)
				return
			}
			if strings.HasPrefix(name, "assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			static.ServeHTTP(w, r)
			return
		}
		if r.URL.Path != "/api/admin/items" {
			fail(w, 404, "接口不存在")
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		switch r.Method {
		case "GET":
			q := r.URL.Query()
			parse := func(key string, fallback, maximum int) (int, bool) {
				value := q.Get(key)
				if value == "" {
					return fallback, true
				}
				n, e := strconv.Atoi(value)
				return n, e == nil && n >= 1 && n <= maximum
			}
			page, a := parse("page", 1, 1000000)
			size, b := parse("pageSize", 10, 100)
			sort := q.Get("sort")
			if sort == "" {
				sort = "id"
			}
			direction := q.Get("direction")
			if direction == "" {
				direction = "desc"
			}
			if !a || !b || (sort != "id" && sort != "name") || (direction != "asc" && direction != "desc") || utf8.RuneCountInString(q.Get("search")) > 80 {
				fail(w, 400, "查询参数不正确")
				return
			}
			tx, err := db.BeginTx(r.Context(), &sql.TxOptions{ReadOnly: true})
			if err != nil {
				fail(w, 500, "读取失败")
				return
			}
			defer tx.Rollback()
			var total int
			if err = tx.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM items WHERE instr(name, ?) > 0", q.Get("search")).Scan(&total); err != nil {
				fail(w, 500, "读取失败")
				return
			}
			rows, err := tx.QueryContext(r.Context(), "SELECT id,name FROM items WHERE instr(name, ?) > 0 ORDER BY "+sort+" "+direction+", id "+direction+" LIMIT ? OFFSET ?", q.Get("search"), size, (page-1)*size)
			if err != nil {
				fail(w, 500, "读取失败")
				return
			}
			items := []Item{}
			for rows.Next() {
				var id int64
				var name string
				if err = rows.Scan(&id, &name); err != nil {
					rows.Close()
					fail(w, 500, "读取失败")
					return
				}
				items = append(items, Item{strconv.FormatInt(id, 10), name})
			}
			err = rows.Err()
			rows.Close()
			if err != nil {
				fail(w, 500, "读取失败")
				return
			}
			if err = tx.Commit(); err != nil {
				fail(w, 500, "读取失败")
				return
			}
			reply(w, 200, map[string]any{"rows": items, "total": total})
		case "POST":
			if r.Header.Get("X-AdminUI-Request") != "1" || (r.Header.Get("Origin") != "" && r.Header.Get("Origin") != "http://"+address) {
				fail(w, 403, "请求来源不允许")
				return
			}
			if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
				fail(w, 415, "需要 JSON 请求")
				return
			}
			var body struct {
				Name string `json:"name"`
			}
			decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&body); err != nil {
				fail(w, 400, "请求格式不正确")
				return
			}
			if err := decoder.Decode(new(any)); err != io.EOF {
				fail(w, 400, "请求格式不正确")
				return
			}
			body.Name = strings.TrimSpace(body.Name)
			if n := utf8.RuneCountInString(body.Name); n < 1 || n > 80 {
				fail(w, 400, "名称须为 1–80 个字符")
				return
			}
			result, err := db.ExecContext(r.Context(), "INSERT INTO items(name) VALUES (?) ON CONFLICT(name) DO NOTHING", body.Name)
			if err != nil {
				fail(w, 500, "保存失败")
				return
			}
			changed, err := result.RowsAffected()
			if err != nil {
				fail(w, 500, "保存失败")
				return
			}
			if changed == 0 {
				fail(w, 409, "名称已存在")
				return
			}
			id, err := result.LastInsertId()
			if err != nil {
				fail(w, 500, "保存失败")
				return
			}
			reply(w, 201, Item{strconv.FormatInt(id, 10), body.Name})
		default:
			w.Header().Set("Allow", "GET, POST")
			fail(w, 405, "方法不允许")
		}
	})
	log.Printf("AdminUI: http://%s/admin/ (SQLite: %s)", address, dbPath)
	server := &http.Server{Addr: address, Handler: handler, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second}
	log.Fatal(server.ListenAndServe())
}
