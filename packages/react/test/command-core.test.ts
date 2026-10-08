import assert from "node:assert/strict";
import test from "node:test";
import {
  commandMatches,
  highlightRanges,
  limitGroups,
  navCommands,
  pushRecent,
  queryWords,
  rankItems,
  runProviders,
  scoreItem,
  searchReady,
  shortcutApplies,
  shortcutOf,
} from "../src/command-core.ts";

test("命令搜索：空格拆词、每个词都要出现、不分大小写不分先后", () => {
  const cmd = { label: "停用用户", keywords: "Account 封禁", group: "用户与权限" };
  assert.equal(commandMatches(cmd, ""), true, "空输入全部匹配");
  assert.equal(commandMatches(cmd, "   "), true);
  assert.equal(commandMatches(cmd, "用户 停用"), true, "词序无关");
  assert.equal(commandMatches(cmd, "account"), true, "不分大小写");
  assert.equal(commandMatches(cmd, "  封禁   权限 "), true, "多空格、关键词与分组都可搜");
  assert.equal(commandMatches(cmd, "用户 删除"), false, "有一个词不出现就不匹配");
  assert.equal(commandMatches({ label: "资产管理" }, "资产 管理"), true, "旧的整串子串搜索仍然匹配");
  assert.deepEqual(queryWords(" A  b "), ["a", "b"]);
});

test("navCommands：菜单变命令，分组进关键词与 group，额外命令追加在后", () => {
  const opened: string[] = [];
  const extra = { id: "change-password", label: "改密码", run: () => {} };
  const commands = navCommands(
    [
      { id: "home", title: "首页" },
      { id: "users", title: "用户管理", group: "用户与权限", keywords: "成员 账号" },
    ],
    (id) => opened.push(id),
    [extra],
  );
  assert.deepEqual(
    commands.map(({ id, label, keywords, group }) => ({ id, label, keywords, group })),
    [
      { id: "nav:home", label: "首页", keywords: undefined, group: undefined },
      { id: "nav:users", label: "用户管理", keywords: "用户与权限 成员 账号", group: "用户与权限" },
      { id: "change-password", label: "改密码", keywords: undefined, group: undefined },
    ],
  );
  void commands[1]!.run();
  assert.deepEqual(opened, ["users"]);
  assert.equal(commands[2], extra, "额外命令原样追加");
  assert.ok(commandMatches(commands[1]!, "权限 用户管理"));
  assert.ok(commandMatches(commands[1]!, "账号"));
  assert.deepEqual(navCommands([], () => {}), []);
});

test("searchReady：中文 1 个字就查，拉丁至少 2 个字符，首尾空白不算", () => {
  assert.equal(searchReady("林"), true);
  assert.equal(searchReady("  林 "), true);
  assert.equal(searchReady("a"), false);
  assert.equal(searchReady(" a "), false);
  assert.equal(searchReady("ab"), true);
  assert.equal(searchReady("09"), true);
  assert.equal(searchReady("   "), false);
  assert.equal(searchReady("カ"), true, "日文假名也算");
});

test("rankItems：每个词都要命中；标题开头 > 词首 > 标题中间 > 副标题 / 关键词；同分保持原顺序", () => {
  const items = [
    { id: "a", title: "郭依林", subtitle: "首通 · 上海" },
    { id: "b", title: "南京 林荫门市" },
    { id: "c", title: "林静怡", subtitle: "需求确认" },
    { id: "d", title: "孙佳宁", keywords: "林 老客户" },
    { id: "e", title: "林志豪" },
    { id: "f", title: "陈冠宇" },
  ];
  assert.deepEqual(rankItems(items, "林").map((x) => x.id), ["c", "e", "b", "a", "d"]);
  assert.deepEqual(rankItems(items, "林 需求").map((x) => x.id), ["c"], "多个词都要出现");
  assert.deepEqual(rankItems(items, "").map((x) => x.id), ["a", "b", "c", "d", "e", "f"], "空输入全部保留原顺序");
  assert.equal(scoreItem({ title: "Quote" }, "quo"), 1, "不分大小写，开头满分");
  assert.equal(scoreItem({ title: "Quote" }, "zz"), -1);
  const blended = rankItems(
    [
      { id: "x", title: "报价单 A", score: 0 },
      { id: "y", title: "报价单 B", score: 1 },
    ],
    "报价",
  );
  assert.deepEqual(blended.map((x) => x.id), ["y", "x"], "提供者给的分数参与排序");
  const server = [{ id: "p", title: "王淑芬", score: 0.9 }, { id: "q", title: "林静怡" }];
  assert.deepEqual(rankItems(server, "1391").map((x) => x.id), [], "默认只留本地命中的");
  assert.deepEqual(rankItems(server, "林", { keepUnmatched: true }).map((x) => x.id), ["q", "p"], "服务端按隐藏字段命中的保留、排在本地命中之后");
});

test("highlightRanges：命中位置合并、不分大小写", () => {
  assert.deepEqual(highlightRanges("林静怡", "林"), [[0, 1]]);
  assert.deepEqual(highlightRanges("桂林七星门市 · 林", "林"), [[1, 2], [9, 10]]);
  assert.deepEqual(highlightRanges("Smart Home", "sma art"), [[0, 5]], "重叠合并");
  assert.deepEqual(highlightRanges("abcabc", "ab bc"), [[0, 6]], "相邻也合并");
  assert.deepEqual(highlightRanges("a-b-a", "a"), [[0, 1], [4, 5]]);
  assert.deepEqual(highlightRanges("林静怡", ""), []);
});

test("limitGroups：每组最多 5 条、总数最多 30 条，按顺序截", () => {
  const groups = Array.from({ length: 8 }, (_, g) => ({ id: `g${g}`, items: Array.from({ length: 7 }, (_, i) => i) }));
  const limited = limitGroups(groups);
  assert.deepEqual(limited.map((g) => g.items.length), [5, 5, 5, 5, 5, 5, 0, 0]);
  assert.equal(limited[0]?.id, "g0", "组本身保留");
  assert.deepEqual(limitGroups(groups, { perGroup: 2, total: 5 }).map((g) => g.items.length), [2, 2, 1, 0, 0, 0, 0, 0]);
});

test("pushRecent：最新的在前、按 id 去重、最多 8 条", () => {
  let list: { id: string }[] = [];
  for (let i = 0; i < 10; i++) list = pushRecent(list, { id: `r${i}` });
  assert.equal(list.length, 8);
  assert.equal(list[0]?.id, "r9");
  list = pushRecent(list, { id: "r5" });
  assert.deepEqual(list.slice(0, 2).map((x) => x.id), ["r5", "r9"]);
  assert.equal(list.filter((x) => x.id === "r5").length, 1);
  assert.equal(pushRecent([{ id: "a" }, { id: "b" }], { id: "c" }, 2).length, 2);
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const delayed = <T>(ms: number, value: T, signal: AbortSignal) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => resolve(value), ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    });
  });

test("runProviders：快的先回、慢的先标「较慢」再补上、出错的不影响别人", async () => {
  const updates: string[] = [];
  const asked: number[] = [];
  const final = await runProviders(
    [
      { id: "customers", label: "客户", search: (q, { limit }) => (asked.push(limit), [{ id: "c1", title: `${q}静怡` }]) },
      { id: "records", label: "记录", search: (_q, { signal }) => delayed(120, [{ id: "r1", title: "桂林门市" }], signal) },
      { id: "docs", label: "文档", search: () => Promise.reject(new Error("知识库挂了")) },
    ],
    " 林 ",
    {
      timeoutMs: 40,
      onUpdate: (groups) => updates.push(groups.map((g) => `${g.id}:${g.status}`).join(",")),
    },
  );
  assert.deepEqual(asked, [5], "默认每组要 5 条");
  assert.ok(updates.includes("customers:done,records:slow,docs:error"), `慢的先标 slow：${updates.join(" | ")}`);
  assert.equal(updates.at(-1), "customers:done,records:done,docs:error", "慢的回来后补成 done");
  assert.deepEqual(final.map((g) => g.status), ["done", "done", "error"]);
  assert.equal(final[0]?.items[0]?.title, "林静怡", "查询去掉首尾空白");
  assert.equal(final[2]?.error, "知识库挂了");
});

test("runProviders：新查询中止旧查询，旧的不再回调；minLength 不够的提供者跳过", async () => {
  const ctrl = new AbortController();
  let aborted = false;
  let after = 0;
  const run = runProviders(
    [
      {
        id: "slow",
        label: "记录",
        search: (_q, { signal }) => {
          signal.addEventListener("abort", () => (aborted = true));
          return delayed(200, [{ id: "x", title: "x" }], signal);
        },
      },
      { id: "long", label: "长词", minLength: 3, search: () => [] },
    ],
    "林",
    { signal: ctrl.signal, timeoutMs: 1000, onUpdate: () => (after += 1) },
  );
  await wait(20);
  ctrl.abort();
  const states = await run;
  assert.equal(aborted, true, "提供者收到中止信号");
  assert.deepEqual(states.map((g) => `${g.id}:${g.status}`), ["slow:loading"], "minLength 不够的不问");
  await wait(220);
  assert.equal(after, 0, "中止后不再回调");
  assert.deepEqual(await runProviders([], "林"), []);
});

test("runProviders：时间可注入（测试不用真等）", async () => {
  const timers: (() => void)[] = [];
  let release: (v: { id: string; title: string }[]) => void = () => {};
  const seen: string[] = [];
  const run = runProviders([{ id: "p", label: "P", search: () => new Promise<{ id: string; title: string }[]>((r) => (release = r)) }], "林", {
    timers: { set: (fn) => timers.push(fn), clear: () => {} },
    onUpdate: (g) => seen.push(g[0]?.status ?? ""),
  });
  timers.forEach((fn) => fn());
  await wait(0);
  release([{ id: "1", title: "林" }]);
  await run;
  assert.deepEqual(seen, ["slow", "done"]);
});

test("快捷键：默认只认 Provider 里的按键；globalShortcut 刚打开的页面（焦点在 body）也认，打字时只认带修饰键的", () => {
  const key = (over: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; repeat: boolean; isComposing: boolean; defaultPrevented: boolean }> = {}) => ({ defaultPrevented: false, isComposing: false, repeat: false, ctrlKey: false, metaKey: false, altKey: false, ...over });
  const el = (matches: string[]) => ({ closest: (selector: string) => (matches.some((m) => selector.includes(m)) ? {} : null) });
  const body = el([]);
  const input = el(["input"]);
  const editable = el(['[contenteditable="true"]']);
  const dialog = el(['[role="dialog"]']);
  assert.equal(shortcutOf({ ctrlKey: true, metaKey: false, key: "K" }), "mod+k");
  assert.equal(shortcutOf({ ctrlKey: false, metaKey: false, key: "g" }), "g");
  // scoped (the default): body is outside the Provider root
  assert.equal(shortcutApplies(key({ ctrlKey: true }), body, false, false), false, "默认：焦点在 body 上不认");
  assert.equal(shortcutApplies(key({ ctrlKey: true }), body, true, false), true);
  assert.equal(shortcutApplies(key({ ctrlKey: true }), input, true, false), false, "默认：输入框里不认");
  // global
  assert.equal(shortcutApplies(key({ ctrlKey: true }), body, false, true), true, "全局：body 上认 Ctrl+K");
  assert.equal(shortcutApplies(key({ metaKey: true }), input, false, true), true, "全局：输入框里 ⌘K 也认");
  assert.equal(shortcutApplies(key(), input, false, true), false, "全局：输入框里单键不认");
  assert.equal(shortcutApplies(key(), editable, false, true), false, "全局：可编辑区域里单键不认");
  assert.equal(shortcutApplies(key(), body, false, true), true, "全局：没在打字时单键认");
  assert.equal(shortcutApplies(key({ ctrlKey: true }), dialog, false, true), false, "弹框里的按键留给弹框");
  assert.equal(shortcutApplies(key({ ctrlKey: true, altKey: true }), body, false, true), false);
  assert.equal(shortcutApplies(key({ ctrlKey: true, repeat: true }), body, false, true), false);
  assert.equal(shortcutApplies(key({ ctrlKey: true, isComposing: true }), body, false, true), false, "输入法组字中不认");
  assert.equal(shortcutApplies(key({ ctrlKey: true, defaultPrevented: true }), body, false, true), false);
});
