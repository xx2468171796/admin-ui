# admin-ui 官网：调研与选型

2026-10-08。目标：给准备开源的 `@adminui/react` 做官方文档站，中文先行、预留英文；组件介绍用「左边模块清单、右边可操作预览、桌面 / 手机 390 / 深色切换」的形式，一个模块一个模块看。

## 1. 调研了谁

| 站点 | 技术 | 值得学的 | 来源 |
|---|---|---|---|
| shadcn/ui | Next.js + fumadocs | 首页一句话定位（"not a component library"）；Blocks 页：预览 / 代码切换、iframe 加载独立路由、可拖宽度、在新标签打开；每页「复制给 LLM」 | https://ui.shadcn.com/docs 、https://ui.shadcn.com/blocks 、https://github.com/shadcn-ui/ui/pull/3786 |
| Ant Design | dumi 2（SSR） | 组件页固定顺序：何时使用 → 示例 → API → 语义 DOM → Token → FAQ；示例能单独打开（`/~demos/...`）；示例标「自 x.y 起」；旧大版本放子域名 | https://ant.design/components/button 、https://github.com/ant-design/ant-design/blob/master/.dumirc.ts |
| Pro Components | dumi | 后台增强组件（ProTable / ProForm / ProLayout）独立成站，`/en-US/` 路径前缀 | https://procomponents.ant.design/en-US/components/table/ |
| Mantine | Next.js + MDX | configurator 示例：右侧调属性、左侧实时预览并生成代码；Documentation / Props / Styles API 三个标签；Ctrl+K 搜索 | https://mantine.dev/core/button/ |
| MUI | Next.js | 示例可就地编辑、StackBlitz 打开；Versions 页列出所有大版本文档 | https://mui.com/material-ui/react-button/ 、https://mui.com/material-ui/getting-started/versions/ |
| Radix Themes | Next.js | Playground：一页放全部组件 + 主题面板（强调色、灰色、明暗、圆角、缩放） | https://www.radix-ui.com/themes/playground |
| Chakra UI v3 | Next.js + Velite | Usage / Examples / Customization / Props；⌘K 搜索；旧版本子域名 | https://chakra-ui.com/docs/components/button |
| Storybook | — | Controls（按 props 自动生成控件）、Viewport（改 iframe 尺寸）、Autodocs 页面顺序 | https://storybook.js.org/docs/essentials/controls 、https://storybook.js.org/docs/essentials/viewport |
| Fluent UI v9 | Storybook | 文档就是 stories；稳定版必须写 do / don't | https://github.com/microsoft/fluentui/blob/master/docs/react-v9/contributing/component-implementation-guide.md |
| Semi Design | Gatsby | `zh-CN` / `en-US` 路径前缀；D2C 作为差异化卖点；踩过「相对链接 404」「共用 JSON 导致英文站显示中文」的坑 | https://semi.design/code/en-US 、https://github.com/DouyinFE/semi-design/issues/3341 |
| Arco Design | 自研（未核实） | 框架 / 语言 / 路径的 URL 结构；主题平台 | https://arco.design/react/en-US/docs/theme |
| TDesign | Web Components 站点框架 | 多框架分区（/vue、/react） | https://github.com/Tencent/tdesign |
| Refine | Docusaurus | 正式的对比页（表格对比多家），对手也发了结论相反的对比——对比要克制、可验证 | https://refine.dev/core/docs/further-readings/comparison/ 、https://marmelab.com/blog/2023/07/04/react-admin-vs-refine.html |
| dumi | — | 示例 `iframe: true` 完全隔离；移动端示例一律 iframe，默认宽 375 | https://d.umijs.org/guide/write-demo 、https://d.umijs.org/theme/mobile |
| Pagefind | — | 纯静态全文搜索，构建后生成分块索引，按 `<html lang>` 分语言 | https://pagefind.app/docs/api/ |

## 2. 共同结构（我们照着做的）

- **顶层页面**：首页 → 为什么 / 对比 → 技术栈 → 安装 → 主题 → 组件 → 页面模板 → 给 AI 用 → 迁移 → 更新日志。
- **组件页**：标题 + 导出名 + 一句话 + 导入语句 → 示例切换 → 预览（工具条：桌面 / 手机 390 / 深色 / 色卡 / 新窗口）→ 调试属性（有的话）→ 标签：演示（什么时候用、结构、状态、推荐 / 避免）/ 代码 / 属性 / 无障碍 → 上一篇 / 下一篇。
- **推荐 / 避免**：审阅稿里的「现在的问题」改写成「避免」，「提案」改写成「推荐 / 结构 / 状态」（Fluent 要求的 do / don't）。

## 3. 我们的选择

| 问题 | 选择 | 理由 |
|---|---|---|
| 站点技术 | **Vite + React 19，多页静态输出**（每个路由一个 `xxx.html`，同一个应用读文件名决定页面） | 和组件库同一套工具链，直接用仓里的源码（`resolve.conditions: ["source"]`），**不新增任何依赖**；任何静态主机、iframe、相对路径都能用。Next.js / dumi 太重且绑框架；Astro + React islands 会把 Provider、弹层 portal、主题拆散到各个岛里，而我们的预览本来就要走 iframe。 |
| 手机预览 | **iframe**（`preview.html`），宽 390 | 媒体查询只认视口宽度，容器改宽度不会触发组件的手机布局；shadcn Blocks、Storybook Viewport、dumi 移动主题都用 iframe。 |
| 主题 / 属性同步 | 首次用 URL hash，之后 `postMessage`（只收同源） | 改属性时演示里的状态不丢；「在新窗口打开」就是同一个 URL。 |
| 代码标签 | 显示**演示源文件本身**（Vite `?raw`） | 代码和预览不会对不上；调试属性另外生成一行 JSX。 |
| 属性表 | 深页面手写（对照 TS 类型），其余页先列导出名 | TS 7 暂无稳定的编译器 API 给 react-docgen 用；后续可从 d.ts 生成。 |
| 搜索 | 本站自带：页面标题走组件库自己的 `CommandPalette`（Ctrl / ⌘ K），正文全文搜索是一个本地 provider | 不依赖外部服务；页面量小（≈ 100 页）不需要 Pagefind 的分块索引。页面多了再换 Pagefind。 |
| 多语言 | 中文先行；界面文字已经走字典（`src/i18n.ts`，中 / 英两份），英文正文以后放 `/en/` 下同名文件 | 路径前缀方便分语言索引和 hreflang；站内链接用 `SiteLink` 统一生成，避开 Semi 踩过的相对链接坑。 |
| 多版本 | 主站永远是最新大版本；旧大版本冻结成静态构建放 `/v7/` 子路径或子域名；小版本在页面上标「自 x.y 起」 | Ant Design、Chakra、Mantine 的做法；本站是纯静态，冻结很便宜。 |
| 给 AI | 构建时生成 `llms.txt`；「给 AI 用」页直接展示包里的能力清单 | shadcn、Chakra、Mantine、Ant Design 都在做。 |
| 两种构建 | 正式版（`npm run build` → `build/`）：ES 模块、资源从 `/` 开始的绝对路径、带内容哈希、页面 / 首页演示 / 示例按需分块，带 `404.html`，放在站点根目录（adminui.zygskins.cn）。沙箱版（`npm run build:sandbox` → `build-sandbox/`）：经典脚本包 + 相对路径，演示框用 `srcdoc` 加载演示包 | 正式站要缓存友好（哈希文件一年不变）、首屏小（公共代码只下一次）。审阅工具、部分文档托管会给页面加 `sandbox`（无同源、无 localStorage）和 `frame-ancestors 'self'`：模块脚本和动态 import 需要 CORS、嵌套的 preview.html 会被拦，所以另出一份经典脚本版。`npm run serve:sandbox` 按同样的响应头本地复现。 |
| 首屏预算 | 首页首屏（不滚动、不交互、浏览器还没空闲时实际请求的 JS + CSS，gzip）≤ 250 KB，`npm run check` 在浏览器里量，超了失败 | 首页可操作的 CRM 等演示是「岛」：首屏的 CRM 在页面加载完、浏览器空闲时（或读者指向它时）才加载，其余的滚到附近才加载。 |
| 自己也守规矩 | 站点外壳也用组件库自己的组件（CommandPalette、Tabs、DataTable、ChoiceTiles、MoreMenu…），`admin-ui-audit` 对整个站点零错误 | 文档站就是最好的示例。 |

## 4. 还没做、以后做

- 每页「复制为 Markdown」、示例「在 StackBlitz 打开」。
- 属性表从 d.ts 自动生成。
- 英文正文（`/en/`）。
- 真正的 SSR 预渲染（目前每页 HTML 只预填标题和描述，正文由脚本渲染）。
- 人员选择器 OrgPicker 等 8.1.0 发布后，把设计稿预览换成真组件（`src/content/business.ts` 里有 TODO）。

## 5. 怎么跑

```sh
# 仓库根目录先 npm install
cd sites/docs
npm run dev          # http://127.0.0.1:5410
npm run check        # 类型检查 + admin-ui-audit + 正式版构建与检查（含首屏预算、浏览器冒烟）+ 沙箱版构建与检查
npm run test:demos   # （开发服务器开着时）每个演示在 1440 / 390 下加载一遍，查报错和横向溢出
npm run shots        # 截图：桌面 / 手机 / 深色
npm run build        # 正式版 → build/（上线用：tar 打包 build/ 发布）
npm run build:sandbox # 沙箱版 → build-sandbox/
npm run serve:sandbox # 用沙箱响应头（sandbox + frame-ancestors 'self'）托管 build-sandbox/，验证它在审阅工具里能用
```

正式版 `build/` 要放在站点根目录（资源路径从 `/` 开始）；主机最好按 `$uri.html` 补全干净地址（`/button` → `button.html`），404 用包里的 `404.html`。沙箱版 `build-sandbox/` 全是相对路径，可以放在任何静态主机的任何子目录下。
