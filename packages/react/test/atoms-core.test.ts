import test from "node:test";
import assert from "node:assert/strict";
import { cleanCode, clearCodeBox, countdownParts, countdownProgress, countdownText, fillCode, initialOf, parseStepper, ratingKey, ratingText, ratingWord, stackPeople, stepNumber, watermarkTiles } from "../src/atoms-core.ts";

test("叠放头像：max 个之后收成 +k；只多一个时直接显示，不出现 +1", () => {
  const people = ["王", "杰", "华", "李", "陈"];
  assert.deepEqual(stackPeople(people, 3), { shown: ["王", "杰", "华"], rest: ["李", "陈"] });
  assert.deepEqual(stackPeople(people.slice(0, 4), 3), { shown: ["王", "杰", "华", "李"], rest: [] });
  assert.deepEqual(stackPeople([], 3), { shown: [], rest: [] });
  assert.equal(initialOf(" 王小明"), "王");
  assert.equal(initialOf("amy"), "A");
  assert.equal(initialOf("  "), "?");
});

test("评分键盘：左右加减、Home 清空、End 满、数字直接设；不处理的键返回 undefined", () => {
  assert.equal(ratingKey(3, "ArrowRight", 5), 4);
  assert.equal(ratingKey(5, "ArrowRight", 5), 5);
  assert.equal(ratingKey(1, "ArrowLeft", 5), null, "减到 0 = 清空");
  assert.equal(ratingKey(1, "ArrowLeft", 5, false), 1, "不允许清空时最少 1 星");
  assert.equal(ratingKey(null, "End", 5), 5);
  assert.equal(ratingKey(4, "Home", 5), null);
  assert.equal(ratingKey(null, "3", 5), 3);
  assert.equal(ratingKey(null, "7", 5), undefined);
  assert.equal(ratingKey(2, "a", 5), undefined);
  assert.equal(ratingText(4, 5), "4 星（满分 5）");
  assert.equal(ratingText(null, 5), "未评分");
});

test("分格密码：只收允许的字符、转大写、从当前格往后填、粘贴填满、不留空格", () => {
  assert.equal(cleanCode("7k-2 q", 4, "alnum"), "7K2Q");
  assert.equal(cleanCode("12a34", 4, "numeric"), "1234");
  assert.deepEqual(fillCode("", 0, "7", 4, "alnum"), { value: "7", focus: 1 });
  assert.deepEqual(fillCode("7K", 2, "2", 4, "alnum"), { value: "7K2", focus: 3 });
  assert.deepEqual(fillCode("", 0, "7k2q9", 4, "alnum"), { value: "7K2Q", focus: 3 }, "粘贴超长截断，焦点停最后一格");
  assert.deepEqual(fillCode("7K2Q", 1, "x", 4, "alnum"), { value: "7X2Q", focus: 2 }, "改中间一格");
  assert.deepEqual(fillCode("7K", 1, "!", 4, "alnum"), { value: "7K", focus: 1 }, "非法字符不动");
  assert.deepEqual(clearCodeBox("7K2Q", 2), { value: "7K", focus: 2 }, "剪切 / 输入法删掉中间一格：后面的一并清掉");
  assert.deepEqual(clearCodeBox("7K2Q", 0), { value: "", focus: 0 });
  assert.deepEqual(clearCodeBox("7K", 3), { value: "7K", focus: 3 });
});

test("步进器：按步长加减、夹在范围内、不出浮点尾巴；输入解析", () => {
  assert.equal(stepNumber(20, 1, 1, 1, 100), 21);
  assert.equal(stepNumber(100, 1, 1, 1, 100), 100);
  assert.equal(stepNumber(0.1, 0.2, 1), 0.3);
  assert.equal(stepNumber(null, 1, 1, 1, 100), 1, "空值从最小值开始");
  assert.equal(stepNumber(5, 1, -10, 1, 100), 1);
  assert.equal(parseStepper(" 1,200 ", 1, 1000), 1000);
  assert.equal(parseStepper("", 1, 10), null);
  assert.equal(parseStepper("abc"), undefined);
});

test("倒计时文字与进度", () => {
  assert.equal(countdownText(52_000), "52 秒");
  assert.equal(countdownText(51_001), "52 秒", "不足一秒向上取整");
  assert.equal(countdownText(299_000), "4:59");
  assert.equal(countdownText(2 * 3600_000 + 4 * 60_000 + 59_000), "2:04:59");
  assert.equal(countdownText(3 * 86400_000 + 4 * 3600_000), "3 天 4 小时");
  assert.equal(countdownText(52_000, "clock"), "0:52");
  assert.equal(countdownText(-5), "0 秒");
  assert.deepEqual(countdownParts(90_061_000), { total: 90061, days: 1, hours: 1, minutes: 1, seconds: 1 });
  assert.equal(countdownProgress(30_000, 60_000), 0.5);
  assert.equal(countdownProgress(90_000, 60_000), 1);
  assert.equal(countdownProgress(10, 0), 0);
});

test("水印格数：多铺一圈，有上限", () => {
  assert.deepEqual(watermarkTiles(1440, 900, 240, 150), { cols: 8, rows: 8 });
  assert.deepEqual(watermarkTiles(100000, 100000, 10, 10), { cols: 60, rows: 120 });
});

test("评分文字：labels[值 − 1]，空 =「未评」，没给 labels 不写", () => {
  const words = ["很低", "较低", "一般", "较高", "很高"];
  assert.equal(ratingWord(4, words), "较高");
  assert.equal(ratingWord(null, words), "未评");
  assert.equal(ratingWord(0, words), "未评");
  assert.equal(ratingWord(9, words), "很高", "超出取最后一个");
  assert.equal(ratingWord(3, undefined), "");
});
