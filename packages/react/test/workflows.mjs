import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
const root = fileURLToPath(new URL("../examples/starter", import.meta.url));
const server = await createServer({
  root,
  configFile: false,
  plugins: [react()],
  server: { host: "127.0.0.1", port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null },
});
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(),
});
const output = await mkdtemp(join(tmpdir(), "adminui-workflows-"));
try {
  await server.listen();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const open = async () => {
    await page.goto(server.resolvedUrls.local[0]);
    await page
      .getByRole("navigation", { name: "主导航" })
      .getByRole("button", { name: "后台工作流", exact: true })
      .click();
    await page.getByLabel("工作流搜索").waitFor();
  };
  await open();
  const table = page.getByRole("region", { name: "演示用户，宽表可横向滚动" });
  await table.getByRole("button", { name: "U001", exact: true }).waitFor();
  await table.getByRole("checkbox", { name: "选择当前页" }).check();
  await page.getByRole("button", { name: "批量停用", exact: true }).click();
  await page.getByRole("button", { name: "确认执行", exact: true }).click();
  await page.getByText("成功 9 条，失败 1 条", { exact: false }).waitFor();
  await page.getByRole("button", { name: "仅重试失败项" }).click();
  await page.getByRole("button", { name: "确认执行", exact: true }).click();
  await page.getByText("成功 1 条，失败 0 条", { exact: false }).waitFor();
  await page.getByRole("button", { name: "清除选择", exact: true }).click();
  await table.getByRole("checkbox", { name: "选择 U001", exact: true }).check();
  await page.getByRole("button", { name: "选择筛选全部", exact: true }).click();
  await page.getByText("当前筛选全部 24 条", { exact: true }).waitFor();
  await page.getByRole("button", { name: "批量停用", exact: true }).click();
  await page.getByRole("button", { name: "确认执行", exact: true }).click();
  await page.getByText("成功 24 条，失败 0 条", { exact: false }).waitFor();
  await page.getByRole("button", { name: "清除选择", exact: true }).click();
  await page.getByRole("button", { name: "表格设置", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "状态", exact: true }).uncheck();
  await dialog.getByRole("button", { name: "上移 name", exact: true }).click();
  await page.keyboard.press("Escape");
  assert.equal(
    // after the selection and expand-record utility columns
    await table.getByRole("columnheader").nth(2).innerText(),
    "姓名",
  );
  assert.equal(
    await table
      .getByRole("columnheader", { name: "状态", exact: true })
      .count(),
    0,
  );
  await page.getByRole("button", { name: "保存视图", exact: true }).click();
  await page.getByLabel("视图名称").fill("我的运营视图");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByLabel("草稿标题").fill("待恢复草稿");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await page.getByRole("button", { name: "恢复草稿", exact: true }).waitFor();
  await open();
  assert.equal(
    await table
      .getByRole("columnheader", { name: "状态", exact: true })
      .count(),
    0,
  );
  await page.getByRole("button", { name: "恢复草稿", exact: true }).click();
  assert.equal(await page.getByLabel("草稿标题").inputValue(), "待恢复草稿");
  await page.getByRole("button", { name: "模拟刷新失败", exact: true }).click();
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await page
    .getByRole("alert").filter({ hasText: "刷新失败，当前数据可能已过期" })
    .waitFor();
  assert.equal(await table.locator("tbody tr").count(), 10);
  await page.getByRole("button", { name: "恢复服务", exact: true }).click();
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await page.getByRole("button", { name: "模拟实时更新", exact: true }).click();
  await page
    .getByRole("button", { name: "有新数据，刷新", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "创建演示任务", exact: true }).click();
  await page.getByRole("button", { name: "任务 (1)", exact: true }).click();
  await dialog.getByRole("button", { name: "取消任务", exact: true }).click();
  await dialog.getByText("已取消", { exact: true }).waitFor();
  await dialog.getByRole("button", { name: "重试任务", exact: true }).click();
  await dialog.getByText("已完成", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await table.getByRole("button", { name: "U001", exact: true }).click();
  await page.getByRole("button", { name: "模拟编辑冲突", exact: true }).click();
  await dialog.getByRole("radiogroup", { name: "名称" }).getByRole("radio", { name: /用我的/ }).click();
  await dialog.getByText("用我的 1 项", { exact: false }).waitFor();
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByText("名称不能为空", { exact: false }).waitFor();
  await page.getByLabel("步骤名称").fill("完整工作流");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("button", { name: "确认提交", exact: true }).click();
  await page.getByText("已提交", { exact: true }).waitFor();
  await page
    .getByLabel("选择导入文件")
    .setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("name\n导入一\n导入二"),
    });
  await page.getByRole("button", { name: "校验全部数据", exact: true }).click();
  await page.getByText("校验通过，可确认导入", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "确认导入 2 行", exact: true })
    .click();
  await page.getByText("导入成功 2 行", { exact: true }).waitFor();
  await page
    .getByLabel("选择导入文件")
    .setInputFiles(
      fileURLToPath(new URL("fixtures/import.xlsx", import.meta.url)),
    );
  await page.getByRole("button", { name: "校验全部数据", exact: true }).click();
  await page.getByText("校验通过，可确认导入", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "确认导入 1 行", exact: true })
    .click();
  await page.getByText("导入成功 1 行", { exact: true }).waitFor();
  await page
    .getByRole("checkbox", { name: "拥有审计权限", exact: true })
    .uncheck();
  await page.getByText("你没有执行此操作的权限", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("审计页面已注册", { exact: true }).count(),
    0,
  );
  // The starter top bar has its own palette (menu search); this one belongs to the workflow page.
  await page.locator("#aui-page-workflows").getByRole("button", { name: /^搜索与命令/ }).click();
  await dialog.getByRole("combobox", { name: "搜索与命令" }).fill("刷新列表");
  await dialog.getByRole("option", { name: /^刷新列表/ }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByLabel("明暗模式", { exact: true }).click();
  await page.getByRole("option", { name: "深色", exact: true }).click();
  // Dark mode comes from the palette: the panel paints the dark --aui-surface (森林绿 dark = #172425).
  assert.equal(
    await page
      .locator("[data-aui-mode=dark] .aui-panel")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(23, 36, 37)",
  );
  await page.getByLabel("草稿标题").fill("自动保存的新标题");
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("demo-a:draft") || "{}").value?.title ===
      "自动保存的新标题",
  );
  for (const width of [360, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `page overflow ${width}`,
    );
    await page.getByRole("button", { name: "表格设置", exact: true }).click();
    await dialog.waitFor();
    assert.ok(
      await dialog.evaluate(
        (el) => el.getBoundingClientRect().right <= innerWidth,
      ),
      `dialog overflow ${width}`,
    );
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: join(output, `workflows-${width}.png`),
      fullPage: true,
    });
  }
  await page.getByLabel("当前工作区", { exact: true }).click();
  await page.getByRole("option", { name: "演示项目 B", exact: true }).click();
  await dialog.getByRole("button", { name: "确认切换", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await page.getByLabel("草稿标题").inputValue(), "");
  await table
    .getByRole("columnheader", { name: "状态", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "任务 (0)", exact: true }).click();
  await dialog.getByText("暂无任务", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  assert.deepEqual(errors, []);
  console.log(
    `PASS workflow browser: batch partial retry, preferences/view persistence, drafts, stale refresh, realtime, tasks, conflict, wizard, import, permissions, palette, responsive (${output})`,
  );
  const hooksServer = await createServer({
    root: fileURLToPath(new URL("..", import.meta.url)),
    configFile: false,
    plugins: [react()],
    server: { host: "127.0.0.1", port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null },
  });
  try {
    await hooksServer.listen();
    await page.goto(
      hooksServer.resolvedUrls.local[0] + "test/workflow-hooks.html",
    );
    await page.getByRole("button", { name: "切换到 B", exact: true }).click();
    await page.getByTestId("resource").filter({ hasText: "B" }).waitFor();
    await page.waitForFunction(
      () => document.documentElement.dataset.doneA === "true",
    );
    assert.equal(
      await page.getByTestId("resource").innerText(),
      "B",
      "late A must not replace B",
    );
    await page
      .getByRole("button", { name: "连续保存偏好", exact: true })
      .click();
    await page.waitForFunction(
      () => document.documentElement.dataset.saved === "2",
    );
    assert.equal(await page.getByTestId("registry").innerText(), "public");
    await page.getByText("默认关闭", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS hooks: stale-response suppression, serialized preference saves, permission-filtered registry, default-off flags",
    );
  } finally {
    await hooksServer.close();
  }
} finally {
  await browser.close();
  await server.close();
}
