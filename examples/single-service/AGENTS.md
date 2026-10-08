# 给接入 AI 的入口

这是 Go/Rust + SQLite 的 AdminUI 单服务参考项目，后端二选一。

1. 先读本目录 README.md，以及 `web/node_modules/@adminui/react/INTEGRATION.md`、`AI-RULES.md`、`src/catalog.ts`。
2. 页面从 `web/src/main.tsx` 改，HTTP 接线从 `web/src/api.ts` 改；复用 AdminShell、DataTable、QueryBar、FormDialog 和 AppearanceButton，不复制 SDK CSS（样式跟着组件自动带上，入口只 import 一次 styles.css）。
3. 业务规则和 SQL 只进所选 Go/Rust 后端；增改响应字段同时更新 adapter 的运行时校验。登录和权限接宿主真实方案，本例本机保护不是账号系统。
4. 先构建 web，再嵌入后端；数据库路径由 DB_PATH 指向可写持久目录。不要把 SQLite 放进 dist 或二进制。
5. 完成必须真实启动二进制，验证搜索/排序/分页、新增成功/重复失败保留输入、重启持久化、缺失静态资源/API 的404；浏览器测360px、390px、1440px，手机菜单与弹窗可操作，页面无横向溢出。真机检查软键盘。
