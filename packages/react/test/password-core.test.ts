import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PASSWORD_RULES,
  READABLE_ALPHABET,
  generatePassword,
  minLengthRule,
  passwordStrength,
  passwordsMatch,
  type PasswordRule,
} from "../src/password-core.ts";

test("passwordStrength: empty, levels and the checklist", () => {
  const empty = passwordStrength("");
  assert.equal(empty.level, 0);
  assert.equal(empty.label, "");
  assert.deepEqual(empty.checks.map((c) => c.ok), [false, false, false, false]);
  assert.equal(passwordStrength("abc").level, 1, "短：很弱");
  assert.equal(passwordStrength("abc").label, "太弱");
  const two = passwordStrength("linhome26");
  assert.deepEqual(two.checks.map((c) => c.key), ["length", "case", "digit", "symbol"]);
  assert.deepEqual(two.checks.map((c) => c.ok), [true, false, true, false]);
  assert.equal(two.level, 2);
  assert.equal(two.label, "一般");
  assert.equal(passwordStrength("Linhome26").level, 3);
  assert.equal(passwordStrength("Linhome26").label, "够用");
  const all = passwordStrength("Lin@2026home");
  assert.equal(all.level, 4);
  assert.equal(all.label, "很强");
  assert.equal(all.ok, true);
  assert.equal(all.passed, 4);
});

test("passwordStrength: short caps at 很弱, long passphrase counts as 强", () => {
  assert.equal(passwordStrength("Ab1!").level, 1, "四条里三条过但不够 8 位：很弱");
  assert.equal(passwordStrength("Ab1!").checks.filter((c) => c.ok).length, 3);
  assert.equal(passwordStrength("Correct horse 42").level, 4, "14 位以上且已经是「中」：强");
  assert.equal(passwordStrength("aaaaaaaaaaaaaaaa").level, 1);
});

test("passwordStrength: custom rules and minimum length", () => {
  const rules: PasswordRule[] = [minLengthRule(6), { key: "digit", label: "有数字", test: (pw) => /\d/.test(pw) }];
  assert.equal(rules[0]?.label, "至少 6 位");
  assert.equal(passwordStrength("abcdef", rules).level, 2);
  assert.equal(passwordStrength("abcde1", rules).level, 4);
  assert.equal(passwordStrength("abc1", rules).level, 1, "最短长度从 length 规则里读");
  assert.equal(passwordStrength("abc1", rules, { minLength: 3 }).level, 2);
  assert.equal(passwordStrength("whatever", []).level, 4, "没有规则：够长就强");
  assert.equal(DEFAULT_PASSWORD_RULES.length, 4);
  assert.equal(passwordStrength("密码密码密码密码").checks[0]?.ok, true, "按字符数算长度");
});

test("passwordsMatch: live compare", () => {
  assert.equal(passwordsMatch("linhome26", ""), "empty");
  assert.equal(passwordsMatch("linhome26", "linhome"), "partial", "还在打，不报错");
  assert.equal(passwordsMatch("linhome26", "linhome26"), "match");
  assert.equal(passwordsMatch("linhome26", "linhomx"), "mismatch");
  assert.equal(passwordsMatch("linhome26", "linhome266"), "mismatch");
  assert.equal(passwordsMatch("", "a"), "mismatch");
});

test("generatePassword: length, groups, alphabet, every class", () => {
  for (let i = 0; i < 50; i += 1) {
    const pw = generatePassword();
    assert.match(pw, /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
    const chars = pw.replaceAll("-", "");
    assert.ok([...chars].every((c) => READABLE_ALPHABET.includes(c)), "没有 0 O 1 l I");
    assert.ok(/[a-z]/.test(chars) && /[A-Z]/.test(chars) && /\d/.test(chars), `三类字符都有：${pw}`);
  }
  assert.equal(generatePassword(10, { separator: "" }).length, 10);
  assert.match(generatePassword(6, { groupSize: 3 }), /^\w{3}-\w{3}$/);
});

test("generatePassword: injected random source is used and stays unbiased", () => {
  let n = 0;
  const random = (buffer: Uint32Array) => {
    buffer[0] = n;
    n += 1;
    return buffer;
  };
  const pw = generatePassword(3, { alphabet: "aB3", separator: "", random });
  assert.equal(pw, "aB3");
  const reject = [0xffff_ffff, 1];
  const biased = (buffer: Uint32Array) => {
    buffer[0] = reject.shift() ?? 2;
    return buffer;
  };
  assert.equal(generatePassword(1, { alphabet: "abc", random: biased }), "b", "越界的值丢掉重抽");
  assert.throws(() => generatePassword(4, { alphabet: "" }));
});
