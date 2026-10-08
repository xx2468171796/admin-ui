# 主题与色卡

admin-ui 只有一种外观：中性导航、清晰层级、紧凑密度。能换的是**颜色**——一套色卡 = 一个主色系 + 三种点缀色（注意 / 异常 / 信息），全部由 CSS 变量驱动，换色卡、切深色都不用重新构建。

点下面的色卡试试：整个文档站和预览都会跟着换。

<!--swatches-->

## 规则

- **一个主色系 + 3 种点缀色**：注意（琥珀类）、异常（主色的互补色）、信息（安静的第三色，少用）。全站不出现第五种颜色。
- **「正常 / 成功」就用主色系**，没有单独的绿色。状态徽标、勾、进度、选中、链接、主按钮都是主色系。
- 中性色（画布、面板、线、正文）都带一点主色调，整页读起来是同一家族。
- **不画装饰色条**：面板、卡片、提示条不加左侧 / 顶部彩色竖条。状态用图标 + 文字 + 浅底，不只靠颜色。
- 业务代码不写死颜色，只用 `var(--aui-*)`；审计规则 `hard-colour` 会查出来。

## 用法

```tsx
<AdminProvider storageKey="my-app:admin" palette="ocean" mode="system">
  …
</AdminProvider>
```

| `AdminProvider` 属性 | 说明 |
|---|---|
| `palette` | 色卡 id（`forest` 默认、`ocean`、`celadon`、`graphite`、`clay`、`plum`）、完整的 `PaletteSpec`，或一个品牌色 `"#rrggbb"`（只换主色系，自动调深浅保证白字清晰） |
| `mode` | `light`（默认）/ `dark` / `system` |
| `density` | `compact`（默认，表格行 40px）/ `comfortable`（48px） |
| `defaultFontSize` | `small` / `medium` / `mediumLarge`（默认）/ `large` / `xlarge` |
| `storageKey` | 用户自己选的外观（明暗、色卡、字号）存在 localStorage 的前缀 |

顶栏放一个 `AppearanceButton`，用户就能自己切浅色 / 深色 / 跟随系统、换色卡、调字号、填自定义品牌色。代码里读当前颜色用 `useAdminTheme().palette`；纯函数 `createPalette`、`contrast`、`mix` 可以在服务端或测试里用。

主题只存在 Provider 内部，不改 html / body / `:root`——同一个页面可以有两个不同色卡的区域，弹层挂在各自的区域里。

## 深色模式

深色不是另一套色卡：`createPalette(spec, "dark")` 按同一套色卡生成深色 token，并保证文字对比度 ≥ 4.5:1（主色、点缀色在各自的浅底上同样达标）。每个组件页的预览右上角都有「深色」开关。

## 主要 token

| token | 用途 |
|---|---|
| `--aui-primary` / `--aui-ink` / `--aui-primary-mid` | 主操作、链接、选中 / 深一级（成功文字）/ 中间色 |
| `--aui-soft` / `--aui-soft-strong` / `--aui-wash` | 主色浅底、选中底、极浅底 |
| `--aui-warning*` / `--aui-danger*` / `--aui-info*` | 三种点缀色，各有 `-soft`（浅底）和 `-line`（描边） |
| `--aui-canvas` / `--aui-surface` / `--aui-surface-subtle` | 画布、面板、次级面 |
| `--aui-text` / `--aui-secondary` / `--aui-note` / `--aui-line` | 正文、次要文字、备注、分隔线 |
| `--aui-neutral-1` … `-4` | 不带色调的纯灰阶，只给长文阅读区（`.aui-neutral-text`） |
| `--aui-radius` / `--aui-radius-lg` / `--aui-radius-sm` | 8 / 12 / 6 |
| `--aui-control-height` | 控件高度 36（手机 40，公开页触屏 44） |

## 选项 10 色

标签、下拉选项、填色、视图色块用固定的 10 色：`green teal blue violet pink red orange yellow olive gray`，外加每色的实心版 `greenSolid` 等，一共 20 个名字。它们**从当前色卡算出来**：绿 = 主色、灰 = 备注色，其余取异常色的明度和彩度只转色相——所以换色卡、切深色时标签颜色一起跟着变，并且标签字对底色 ≥ 4.5:1。

- 选色用 `OptionSwatchPicker`；新选项的默认色用 `nextOptionTone` 轮着取。
- 实心色只给一个「最想被看见」的值（例如「赢单」）。
- 选项色只用在选项和标签上；状态（正常 / 注意 / 异常）仍用主色系和三种点缀色。

## 尺寸与字体

- 控件 36px / 小号 28px；圆角：卡片和面板 12、控件和弹层 8、28px 及以下的小控件 6。
- 字号 8 档，字重只有 400 / 500 / 600；图标用 Lucide，线宽按尺寸自动设好。
- 字体用系统字体栈，不加载远程字体。
