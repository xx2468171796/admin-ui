import { test } from "node:test";
import assert from "node:assert/strict";
import { navBadgeText, railBadgeText, searchTabs, shellCrumbs, tabsToClose } from "../src/shell-core.ts";

const nav = [
  { id: "home", title: "工作台" },
  { id: "customers", title: "客户", group: "业务" },
  { id: "roles", title: "角色与权限", group: "本公司" },
];

test("面包屑：真实上一级（菜单分组），不再是「工作空间 /」；当前页在最后", () => {
  assert.deepEqual(shellCrumbs({ id: "customers", title: "客户" }, nav).map((c) => c.label), ["业务", "客户"]);
  assert.deepEqual(shellCrumbs({ id: "home", title: "工作台" }, nav).map((c) => c.label), ["工作台"]);
  assert.deepEqual(shellCrumbs({ id: "roles", title: "角色与权限" }, nav, "管理后台").map((c) => c.label), ["管理后台", "本公司", "角色与权限"]);
  const back = () => undefined;
  const own = shellCrumbs({ id: "rec", title: "赵静怡", crumbs: [{ label: "客户", onClick: back }] }, nav);
  assert.deepEqual(own.map((c) => c.label), ["客户", "赵静怡"], "标签自带的 crumbs 优先于菜单分组");
  assert.equal(own[0]?.onClick, back);
  assert.deepEqual(shellCrumbs(undefined, nav), []);
});

test("关闭其他 / 关闭右侧：跳过固定标签和不能关的标签，按标签条顺序", () => {
  const tabs = [{ id: "home", pinned: true }, { id: "a" }, { id: "b", closable: false }, { id: "c" }, { id: "d" }];
  assert.deepEqual(tabsToClose(tabs, "c", "others"), ["a", "d"]);
  assert.deepEqual(tabsToClose(tabs, "a", "right"), ["c", "d"]);
  assert.deepEqual(tabsToClose(tabs, "d", "right"), []);
  assert.deepEqual(tabsToClose(tabs, "nope", "others"), []);
});

test("已打开的页面搜索：包含即可，不分大小写，空查询返回全部", () => {
  const tabs = [{ title: "客户" }, { title: "API 令牌" }, { title: "安装手册 · 智能门锁" }];
  assert.deepEqual(searchTabs(tabs, "api").map((t) => t.title), ["API 令牌"]);
  assert.deepEqual(searchTabs(tabs, " 门锁 ").map((t) => t.title), ["安装手册 · 智能门锁"]);
  assert.equal(searchTabs(tabs, "").length, 3);
});

test("菜单数量：千分位、0 / 负数 / 空不显示，超过上限写 +；折叠后角标 99+", () => {
  assert.equal(navBadgeText(1284), "1,284");
  assert.equal(navBadgeText(0), null);
  assert.equal(navBadgeText(-2), null);
  assert.equal(navBadgeText(undefined), null);
  assert.equal(navBadgeText("  "), null);
  assert.equal(navBadgeText("新"), "新");
  assert.equal(navBadgeText(12000), "9,999+");
  assert.equal(railBadgeText(3), "3");
  assert.equal(railBadgeText(1284), "99+");
});
