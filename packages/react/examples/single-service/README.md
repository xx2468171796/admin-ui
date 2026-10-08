# Go / Rust + SQLite：可运行的 AdminUI 单服务案例

角色与独立日志页面的最新 UI 契约见 [ACCESS.md](../../ACCESS.md)。本例仍由原 Go/Rust 服务负责生产认证、权限与审计；不要为了接页面而额外部署 Node。

两套后端共用 `web/` 的真实 React 页面和 HTTP adapter。都提供工具清单、新增、搜索、排序、分页；写入 SQLite，重启不会丢数据。页面使用 SDK 组件，无自建按钮/表格/弹窗样式，图表和 Markdown 未安装。最终二进制内嵌前端，只启动一个进程。

| 文件 | 后续 AI 改哪里 |
|---|---|
| `web/src/main.tsx` | 菜单、页面、表格列、弹窗字段 |
| `web/src/api.ts` | HTTP 参数与响应校验、业务字段映射 |
| `go/main.go` | Go 路由、SQLite 查询与服务端校验 |
| `rust/src/main.rs` | Rust 路由、SQLite 查询与服务端校验 |
| `go/go.mod` / `rust/Cargo.toml` | 二选一的后端依赖 |
| `AGENTS.md` | 复制到业务项目时交给 AI 的任务入口 |

## 从本仓运行

前置：Node ≥26/npm；Go ≥1.24，或 Rust stable + C 编译器（rusqlite bundled 构建 SQLite）。Go 使用纯 Go SQLite 驱动，不要求 CGO。

在 **SDK 仓库根目录**执行：

```sh
npm install
npm run prepare:single-service -w @adminui/react
```

prepare 自动打包当前 SDK、安装到独立 `web/node_modules`、做类型检查和 Vite 构建，并把新产物复制到 Go 的 embed 路径。Rust 直接嵌入同一份 `web/dist`。前端安装需要联网下载 npm 依赖。每次改前端都重新执行 prepare，然后重建后端。

**Go 版**：

```sh
cd packages/react/examples/single-service/go
go build -o tool .
./tool
```

Windows PowerShell 使用 `go build -o tool.exe .`，然后 `./tool.exe`。

**Rust 版**（与 Go 版分开运行，默认端口相同）：

```sh
cd packages/react/examples/single-service/rust
cargo build --release --locked
./target/release/adminui-tool
```

Windows 运行 `./target/release/adminui-tool.exe`；MSVC 工具链需要 Visual C++ Build Tools，GNU 工具链需要 MinGW C 编译器。

打开 **http://127.0.0.1:8080/admin/**，点击「新增记录」。停止后用同一工作目录重启，记录仍然存在。`/admin` 会跳转；缺失资源/API 返回 404，没有吞错的 SPA fallback。当前页面的工作标签不使用 history 深链。

二进制可以单独复制到一个空目录运行：不需要 Node、dist、Redis 或独立数据库服务。默认数据库是**当前工作目录**下的 `data/tool.sqlite`；部署时用 `DB_PATH` 设置持久化绝对路径。备份用 SQLite 在线备份或停服后完整复制，不能运行中只拷主文件而丢 WAL。

## 从安装包交给另一个 AI

按包根 `INTEGRATION.md` 安装固定版本 SDK。安装包自带本目录、两个后端源码/锁文件以及 `skills/admin-ui/SKILL.md`，不需要 AI 再找本仓。

1. 在安装的 SDK 包根运行 `npm run prepare:single-service`（例如 `npm --prefix node_modules/@adminui/react run prepare:single-service`）。脚本从自身位置定位，不依赖当前目录。
2. 把准备完成的 `examples/single-service/` **整体复制**到新工具项目，包含生成的 `web/adminui-sdk.tgz`；保留其中一套后端即可。此后在 `web/` 执行 `npm install`、`npm run build`。
3. Go 项目每次构建前把 `web/dist` 复制到 `go/web/dist`（先清理旧产物）；Rust 保持 `rust/` 与 `web/` 同级。复制前端源码不等于刷新嵌入的页面。
4. 复制项目后 `prepare.mjs` 的 `../..` 不再指向 SDK 包，**不要继续调用这个准备脚本**；它只用于从完整 SDK 包生成第一份可运行示例。后续 SDK 升级按接入手册替换 tarball/固定 tag 依赖并重建前端。
5. 将本目录 `AGENTS.md` 的入口合并进宿主约定，将 `gitignore.example` 合并到宿主 `.gitignore`（生成目录、数据库不提交）；选择 Go 或 Rust，修改业务字段、SQL 和 adapter，运行后面的验收。独立项目可提交固定 SDK tarball，或改为接入手册中的固定 tag 依赖。

## HTTP 合同（两套后端一致）

| 请求 | 响应 |
|---|---|
| `GET /api/admin/items?page=1&pageSize=10&search=&sort=id&direction=desc` | `200 {"rows":[{"id":"1","name":"备份工具"}],"total":1}` |
| `POST /api/admin/items`，JSON `{"name":"备份工具"}` | `201 {"id":"1","name":"备份工具"}` |
| 名称空白/超过80字符、非法页大小/排序 | `400 {"message":"…"}` |
| 重复名称 | `409 {"message":"名称已存在"}` |
| 未知路径、错误方法 | `404` / `405` |

POST 必须带 `Content-Type: application/json`、`X-AdminUI-Request: 1`。浏览器 Origin 存在时必须匹配服务地址；两套服务只绑定 127.0.0.1 并校验 Host，禁止 DNS rebinding。默认无账户系统，适合本机运行学习接线；部署到网络前接宿主身份/权限/session/CSRF，不能把这个本地保护当成登录鉴权。

页码从1开始，pageSize=1–100，page≤1000000，排序只允许 id/name 与 asc/desc。search 是 SQLite `instr` 子串匹配（大小写敏感）；名称去首尾空白，1–80 Unicode 字符，唯一。SQL 绑定参数，COUNT 与列表在同一读事务中执行；id 作为字符串，避免大整数精度丢失。服务端不把 SQLite 异常细节返回页面。

`PORT` 与 `DB_PATH` 为两套服务共用环境变量。需要同时试两个后端时分别设置 PORT 和 DB_PATH。

开发前端先构建并启动后端，再在 `web/` 执行 `npm run dev`；Vite proxy 仅转发 /api，并在这个本机开发代理中将 Host/Origin 映射到后端地址，所以开发页也可以新增。修改后端端口时同步修改 vite.config.ts 的 target。最终验收仍使用二进制提供的 `/admin/` 页面。

## 自动验收

在 SDK 仓库根，用上述命令先构建两个二进制，然后运行：

```sh
npm run test:single-service -w @adminui/react
npm run test:packed -w @adminui/react
```

测试自建临时 SQLite 和端口；检查两套真实二进制的 API、无 dist 单文件运行、重复/非法输入、同源保护、数据库重启持久化，以及 360/390/1440px 页面、新增失败保留输入、手机菜单和整页无横向溢出。测试不连接生产数据。可用 `ADMINUI_GO_BIN` / `ADMINUI_RUST_BIN` 指定已构建二进制的绝对路径，`CHROMIUM_PATH` 指定浏览器。真机软键盘仍需宿主验收。
