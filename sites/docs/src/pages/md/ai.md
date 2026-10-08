# 给 AI 用

越来越多的后台页面是 AI 写的。admin-ui 从第一版起就把「AI 照着写也不会走样」当成目标：文档写成规则，能力清单做成数据，规范做成能跑在 CI 里的审计命令。

## 三件东西

| | 是什么 | 怎么用 |
|---|---|---|
| **AI-RULES.md** | 写后台页面的规则：先按项目规模起步、先选页面模板、只用套件组件和色卡颜色、视觉与交互硬约束、任务提示词（新建页面 / 优化现有后台 / 数据表格 / 权限审计 / 看板）、给你项目 AGENTS.md 的片段 | 放进 AI 的上下文，或在项目的 AGENTS.md / CLAUDE.md 里链过去 |
| **能力清单 catalog** | `@adminui/react/catalog`：每一组能力的入口、全部导出名、规则摘要；还有页面模板清单 `PAGE_TEMPLATES` 和设计常量 `DESIGN_RULES`。纯数据，零依赖 | AI 不确定「有没有、从哪导入」时直接查，而不是 grep 文档 |
| **admin-ui-audit** | 界面漂移审计：扫 `.tsx / .ts / .css`，按「文件:行 + 规则 + 中文改法」报告 | 放进 verify / CI；老项目先 `--write-baseline` 登记存量，之后只许减少 |

## 给 AI 的一段话（可以直接复制）

```text
这个项目的后台界面用 @adminui/react。写页面前：
1. 读 node_modules/@adminui/react/AI-RULES.md，按里面的套件清单选组件；
2. 先从 PAGE-TEMPLATES.md 选一个页面模板，布局不改、只换内容；
3. 不确定有没有某个组件、从哪导入时，查 import { CAPABILITIES } from "@adminui/react/catalog"；
4. 不手写按钮、表格、弹框、徽标的样式，不写死颜色，不覆盖 .aui-* 类；
5. 写完运行 npx admin-ui-audit src，清零再交付。
```

## 审计规则一览

| 规则 | 查什么 |
|---|---|
| `raw-control` | 手写原生 button / table / dialog / select / input / textarea |
| `hard-colour` | 写死的颜色（应该用 `var(--aui-*)`） |
| `colour-bar` | 装饰色条（左侧 / 顶部彩色边框） |
| `sdk-override` | 在项目里覆盖 `.aui-*` 样式 |
| `row-actions` | 操作列手摆按钮（应该用 RowActionBar：放得下就露、最多 3 个，其余进「⋯」） |
| `intro-paragraph` | 页面里的介绍段落（介绍收进页面头的「?」） |
| `page-title` | 外壳里的页面又显示一个大标题（侧栏、标签、面包屑已经写了页名） |
| `native-date` | 原生日期 / 时间输入框（提醒） |
| `no-template` | 页面没用页面模板的骨架块（提醒） |
| `removed-api` · `removed-prop` · `removed-class` · `removed-css-var` · `legacy-tone` | 已删除的旧写法（升级时用） |
| `deep-import` | 引了包里 `src/` / `dist/` 的深路径 |

需要例外时写忽略注释并说明原因：`// admin-ui-audit-ignore raw-control: 原因`。没写原因也会报错。

## 本站也照这套做

- 每个组件页的 **代码** 标签显示的就是那个演示的源码文件，不是另写的示例。
- 站点根目录有 [`llms.txt`](llms.txt)：所有页面和组件的一行摘要，方便 AI 工具抓取。

<!--catalog-->
