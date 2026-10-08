// 数字框 / 金额 / 电话 / 百分比 / 滑块的纯规则。
import test from "node:test";
import assert from "node:assert/strict";
import {
  approxMoney,
  formatLocalPhone,
  formatPhoneDisplay,
  formatThousands,
  minorToMoneyText,
  moneyTextToMinor,
  numberDisplayText,
  parseNumberText,
  parsePhone,
  percentText,
  phoneCountryLabel,
  rangeMessage,
  sliderKey,
  sliderMarks,
  sliderRatio,
  sliderValueAt,
  stepKeyTimes,
  stepValue,
  toE164,
  validatePhone,
} from "../src/number-input-core.ts";

test("数字：打字解析（千分位、全角、单位），空 = null，不是数字 = undefined", () => {
  assert.equal(parseNumberText("1,200"), 1200);
  assert.equal(parseNumberText("１２．５"), 12.5);
  assert.equal(parseNumberText(" 60% "), 60);
  assert.equal(parseNumberText("－3"), -3);
  assert.equal(parseNumberText(""), null);
  assert.equal(parseNumberText("-"), null);
  assert.equal(parseNumberText("abc"), undefined);
  assert.equal(parseNumberText("1.2.3"), undefined);
  assert.equal(parseNumberText("3.14159", 2), 3.14);
});

test("数字：↑ ↓ 步进（Shift ×10）、夹在上下限、没有浮点噪声", () => {
  assert.equal(stepKeyTimes("ArrowUp", false), 1);
  assert.equal(stepKeyTimes("ArrowDown", true), -10);
  assert.equal(stepKeyTimes("PageUp", false), 10);
  assert.equal(stepKeyTimes("a", false), 0);
  assert.equal(stepValue(0.1, 0.2, 1), 0.3);
  assert.equal(stepValue(95, 1, 10, 0, 100), 100);
  assert.equal(stepValue(null, 1, 1, 3, 30), 3, "空值从下限开始");
  assert.equal(stepValue(null, 1, 1), 0);
  assert.equal(rangeMessage(120, 0, 100, "%"), "要在 0–100% 之间");
  assert.equal(rangeMessage(0, 1), "不能小于 1");
  assert.equal(rangeMessage(50, 0, 100), null);
});

test("数字：离开时显示（千分位 / 小数位）", () => {
  assert.equal(formatThousands(86000), "86,000");
  assert.equal(formatThousands(-1234.5, 2), "-1,234.50");
  assert.equal(formatThousands(999), "999");
  assert.equal(numberDisplayText(8.5, { precision: 1 }), "8.5");
  assert.equal(numberDisplayText(1234567, { thousands: true }), "1,234,567");
  assert.equal(numberDisplayText(null), "");
});

test("金额：存最小单位（1/100），按小数位四舍五入，字符串运算不出 28.999", () => {
  assert.equal(moneyTextToMinor("86,000", 0), 8600000);
  assert.equal(moneyTextToMinor("0.29"), 29);
  assert.equal(moneyTextToMinor("1.005"), 101);
  assert.equal(moneyTextToMinor("8.5", 0), 900, "整数币种四舍五入");
  assert.equal(moneyTextToMinor("US$ 1,200", 0), 120000, "前面带币种也行");
  assert.equal(moneyTextToMinor("-20"), -2000);
  assert.equal(moneyTextToMinor(""), null);
  assert.equal(moneyTextToMinor("abc"), undefined);
  assert.equal(minorToMoneyText(8600000, 0), "86000");
  assert.equal(minorToMoneyText(8600000, 0, true), "86,000");
  assert.equal(minorToMoneyText(12345, 2, true), "123.45");
  assert.equal(minorToMoneyText(null), "");
});

test("金额：一万以上「约 ¥ 8.6 万」、一亿以上「亿」，以下不提示", () => {
  assert.equal(approxMoney(86000, "¥"), "约 ¥ 8.6 万");
  assert.equal(approxMoney(100000, "¥"), "约 ¥ 10 万");
  assert.equal(approxMoney(240000, "¥"), "约 ¥ 24 万");
  assert.equal(approxMoney(123000000, "CN¥"), "约 CN¥ 1.2 亿");
  assert.equal(approxMoney(9999, "¥"), null);
  assert.equal(approxMoney(null, "¥"), null);
});

test("电话：区号 + 本地号码 → E.164（台湾去掉开头 0，美国去掉 1）", () => {
  assert.equal(toE164("+886", "0912 345 678"), "+886912345678");
  assert.equal(toE164("+886", "912345678"), "+886912345678");
  assert.equal(toE164("+86", "138-1234-5678"), "+8613812345678");
  assert.equal(toE164("+1", "1 201 555 0123"), "+12015550123");
  assert.equal(toE164("+852", "5123 4567"), "+85251234567");
  assert.equal(toE164("+886", "+86 138 1234 5678"), "+8613812345678", "打了 + 就按国际号码");
  assert.equal(toE164("+886", "0086 13812345678"), "+8613812345678");
  assert.equal(toE164("+886", "  "), null);
});

test("电话：E.164 / 旧格式「+886 0912345678」→ 区号 + 本地号码（补回 0）", () => {
  assert.deepEqual(parsePhone("+886912345678"), { country: "+886", local: "0912345678", national: "912345678" });
  assert.deepEqual(parsePhone("+886 0912345678"), { country: "+886", local: "0912345678", national: "912345678" });
  assert.deepEqual(parsePhone("+8613812345678"), { country: "+86", local: "13812345678", national: "13812345678" });
  assert.deepEqual(parsePhone("+85251234567")?.country, "+852");
  assert.deepEqual(parsePhone("+12015550123"), { country: "+1", local: "2015550123", national: "2015550123" });
  assert.equal(parsePhone("0912345678"), null);
  assert.equal(parsePhone(null), null);
  assert.equal(phoneCountryLabel("+886"), "+886 · 台湾");
});

test("电话显示：本国号码按当地写法，外国号码国际写法、不带开头的 0（7.15 修）", () => {
  // 台湾
  assert.equal(formatPhoneDisplay("+886912345678", { home: "+886" }), "0912 345 678");
  assert.equal(formatPhoneDisplay("+886912345678", { home: "+86" }), "+886 912 345 678");
  assert.equal(formatPhoneDisplay("+886912345678"), "+886 912 345 678", "没给本国 = 国际写法");
  assert.equal(formatPhoneDisplay("+886 0912345678"), "+886 912 345 678", "旧的「+886 0912…」也不带 0");
  assert.equal(formatPhoneDisplay("+886223456789"), "+886 2 2345 6789", "座机");
  // 中国大陆（没有长途前缀）
  assert.equal(formatPhoneDisplay("+8613800138000", { home: "+886" }), "+86 138 0013 8000");
  assert.equal(formatPhoneDisplay("+8613800138000", { home: "+86" }), "138 0013 8000");
  // 美国（长途前缀 1 本来就不写）
  assert.equal(formatPhoneDisplay("+14155550132", { home: "+886" }), "+1 415 555 0132");
  assert.equal(formatPhoneDisplay("+14155550132", { home: "+1" }), "415 555 0132");
  // 香港
  assert.equal(formatPhoneDisplay("+85251234567", { home: "+886" }), "+852 5123 4567");
  assert.equal(formatPhoneDisplay("+85251234567", { home: "+852" }), "5123 4567");
  // 没有区号
  assert.equal(formatPhoneDisplay("0912345678"), "0912345678", "没有区号、没给本国：原样");
  assert.equal(formatPhoneDisplay("0912345678", { home: "+886" }), "0912 345 678", "纯数字按本国分组");
  assert.equal(formatPhoneDisplay("分机 123"), "分机 123");
  assert.equal(formatPhoneDisplay(""), "");
  assert.equal(formatPhoneDisplay(null), "");
  for (const value of ["+886912345678", "+8613800138000", "+14155550132", "+85251234567", "+819012345678", "+447700900123"])
    assert.doesNotMatch(formatPhoneDisplay(value, { home: "+65" }), /^\+\d+ 0/, `${value} 国际写法不带 0`);
});

test("电话：按当地习惯分组", () => {
  assert.equal(formatLocalPhone("+886", "0912345678"), "0912 345 678");
  assert.equal(formatLocalPhone("+886", "0223456789"), "02 2345 6789", "座机");
  assert.equal(formatLocalPhone("+86", "13812345678"), "138 1234 5678");
  assert.equal(formatLocalPhone("+852", "51234567"), "5123 4567");
  assert.equal(formatLocalPhone("+1", "2015550123"), "201 555 0123");
  assert.equal(formatLocalPhone("+81", "09012345678"), "090 1234 5678");
  assert.equal(formatLocalPhone("+999", "123456789"), "123 456 789", "不认识的区号 3–4 位一组");
  assert.equal(formatLocalPhone("+999", "1234567890"), "123 456 7890");
  assert.equal(formatLocalPhone("+886", "0912"), "0912");
  assert.equal(formatLocalPhone("+886", ""), "");
});

test("电话：离开才校验；手机模式按当地规则说清楚怎么改", () => {
  assert.equal(validatePhone("+886", "0912345678", { mobile: true }), null);
  assert.equal(validatePhone("+886", "0912", { mobile: true }), "位数不对：台湾手机是 09 开头 10 位");
  assert.equal(validatePhone("+886", "0812345678", { mobile: true }), "号码不对：台湾手机是 09 开头 10 位");
  assert.equal(validatePhone("+86", "13812345678", { mobile: true }), null);
  assert.equal(validatePhone("+86", "1381234567", { mobile: true }), "位数不对：中国大陆手机是 1 开头 11 位");
  assert.equal(validatePhone("+886", "0223456789"), null, "不限手机时座机也行");
  assert.equal(validatePhone("+886", "12"), "位数不对：台湾号码是 9–10 位");
  assert.equal(validatePhone("+886", "09a2"), "号码只能有数字");
  assert.equal(validatePhone("+886", ""), null, "空不报错（必填由表单管）");
  assert.equal(validatePhone("+886", "+8613812345678", { mobile: true }), null, "打了别的区号按那个区号判");
});

test("滑块：位置 ↔ 数值（按步长吸附）、键盘、刻度", () => {
  assert.equal(sliderRatio(60, 0, 100), 0.6);
  assert.equal(sliderRatio(150, 0, 100), 1);
  assert.equal(sliderValueAt(0.63, 0, 100, 10), 60);
  assert.equal(sliderValueAt(0.66, 0, 100, 10), 70);
  assert.equal(sliderValueAt(-1, 0, 100, 1), 0);
  assert.equal(sliderValueAt(0.333, 0, 1, 0.1), 0.3);
  const o = { min: 0, max: 100, step: 10 };
  assert.equal(sliderKey(60, "ArrowRight", o), 70);
  assert.equal(sliderKey(60, "ArrowDown", o), 50);
  assert.equal(sliderKey(60, "PageUp", o), 100);
  assert.equal(sliderKey(60, "Home", o), 0);
  assert.equal(sliderKey(60, "End", o), 100);
  assert.equal(sliderKey(5, "ArrowRight", { min: 0, max: 100, step: 1, shiftKey: true }), 15);
  assert.equal(sliderKey(60, "Enter", o), undefined);
  assert.deepEqual(sliderMarks(true, 0, 100, 10), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  assert.deepEqual(sliderMarks(true, 0, 100, 1), [], "太密不画刻度");
  assert.deepEqual(sliderMarks([0, 50, 100, 120], 0, 100, 1), [0, 50, 100]);
  assert.deepEqual(sliderMarks(false, 0, 100, 10), []);
});

test("百分比文字", () => {
  assert.equal(percentText(60), "60%");
  assert.equal(percentText(33.333, 1), "33.3%");
  assert.equal(percentText(null), "");
});
