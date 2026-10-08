import test from "node:test";
import assert from "node:assert/strict";
import {
  legacyTone,
  OPTION_HUES,
  OPTION_TONES,
  OPTION_TONE_LABELS,
  colorTone,
  isOptionToneName,
  isSolidTone,
  optionTone,
  resolveOptionTone,
  toneHue,
  withSolid,
} from "../src/option-tone.ts";
import { hexToOklch, oklchToHex, optionHueColors } from "../src/option-palette.ts";
import { PALETTES, contrast, createPalette } from "../src/palette.ts";

test("10 色 + 10 个实心，每个有中文名", () => {
  assert.deepEqual([...OPTION_HUES], ["green", "teal", "blue", "violet", "pink", "red", "orange", "yellow", "olive", "gray"]);
  assert.equal(OPTION_TONES.length, 20);
  for (const tone of OPTION_TONES) assert.ok(OPTION_TONE_LABELS[tone], tone);
  assert.equal(OPTION_TONE_LABELS.green, "绿");
  assert.equal(OPTION_TONE_LABELS.greenSolid, "绿 · 实心");
});

test("存量数据里的旧 7 色名由 legacyTone 一一读成新色（数据，不是 API）", () => {
  const old = { brand: "green", brandMid: "teal", info: "blue", warning: "yellow", danger: "red", neutral: "gray", solid: "greenSolid" } as const;
  // one to one: seven old names → seven different new tones
  assert.equal(new Set(Object.values(old)).size, Object.keys(old).length);
  for (const [name, tone] of Object.entries(old)) {
    assert.equal(legacyTone(name), tone, name);
    assert.equal(optionTone(name), tone, name);
    assert.equal(resolveOptionTone({ tone: name }), tone, name);
    assert.equal(isOptionToneName(name), false, `${name} 不再是公开色名（8.0）`);
  }
  assert.equal(legacyTone("green"), undefined, "新色名不是旧名");
  assert.equal(legacyTone(undefined), undefined);
  assert.equal(optionTone("brandmid"), "teal", "大小写不敏感");
  assert.equal(optionTone("success"), "green", "success 是 brand 的旧名");
  assert.equal(toneHue("yellow"), "yellow");
  assert.equal(isSolidTone("greenSolid"), true);
});

test("optionTone：新色名原样返回，颜色名对到最近的色，任意颜色忽略", () => {
  for (const tone of OPTION_TONES) assert.equal(optionTone(tone), tone);
  assert.equal(optionTone("Blue"), "blue");
  assert.equal(optionTone("orange"), "orange");
  assert.equal(optionTone("purple"), "violet");
  assert.equal(optionTone("pink"), "pink");
  assert.equal(optionTone("红色"), "red");
  assert.equal(optionTone("grey"), "gray");
  assert.equal(optionTone("dark"), "greenSolid");
  assert.equal(optionTone("#ff00aa"), undefined);
  assert.equal(optionTone("rgb(1,2,3)"), undefined);
  assert.equal(optionTone(""), undefined);
  assert.equal(optionTone(undefined), undefined);
  assert.equal(isOptionToneName("purple"), false, "颜色名不是色名");
});

test("resolveOptionTone：tone 优先，其次旧 color 名，否则灰", () => {
  assert.equal(resolveOptionTone({ tone: "red", color: "blue" }), "red");
  assert.equal(resolveOptionTone({ tone: "danger", color: "blue" }), "red");
  assert.equal(resolveOptionTone({ color: "orange" }), "orange");
  assert.equal(resolveOptionTone({ color: "#123456" }), "gray");
  assert.equal(resolveOptionTone(undefined), "gray");
});

test("实心：withSolid / toneHue / isSolidTone", () => {
  assert.equal(withSolid("violet", true), "violetSolid");
  assert.equal(withSolid("violet", false), "violet");
  assert.equal(toneHue("violetSolid"), "violet");
  assert.equal(isSolidTone("violetSolid"), true);
  assert.equal(isSolidTone("violet"), false);
});

test("colorTone：十六进制按色相对到最近的色，灰的给灰", () => {
  assert.equal(colorTone("#db2777"), "pink");
  assert.equal(colorTone("#dc2626"), "red");
  assert.equal(colorTone("#f97316"), "orange");
  assert.equal(colorTone("#eab308"), "yellow");
  assert.equal(colorTone("#16a34a"), "green");
  assert.equal(colorTone("#0d9488"), "teal");
  assert.equal(colorTone("#2563eb"), "blue");
  assert.equal(colorTone("#7c3aed"), "violet");
  assert.equal(colorTone("#6b7280"), "gray");
  assert.equal(colorTone("#888"), "gray");
  assert.equal(colorTone("teal"), "teal");
  assert.equal(colorTone("not a colour"), undefined);
});

test("OKLCH 换算来回不走样", () => {
  for (const hex of ["#357450", "#b4492f", "#3f6283", "#a8691b", "#ffffff", "#000000"]) {
    const [l, c, h] = hexToOklch(hex);
    assert.equal(oklchToHex(l, c, h), hex, hex);
  }
  // out of gamut: keeps lightness and hue, loses chroma
  const loud = oklchToHex(0.7, 0.4, 145);
  assert.match(loud, /^#[0-9a-f]{6}$/);
  assert.ok(Math.abs(hexToOklch(loud)[0] - 0.7) < 0.01);
});

test("10 色从色卡算：绿 = 主色、灰 = 备注色，其余跟异常色同明度、彼此分得开", () => {
  for (const spec of PALETTES)
    for (const mode of ["light", "dark"] as const) {
      const p = createPalette(spec, mode);
      assert.equal(p.options.green.color, p.primary, `${spec.id} ${mode} 绿 = 主色`);
      assert.equal(p.options.gray.color, p.vars.note, `${spec.id} ${mode} 灰 = 备注色`);
      const [dangerL] = hexToOklch(p.danger.color);
      for (const hue of ["teal", "blue", "violet", "pink", "red", "olive"] as const)
        assert.ok(Math.abs(hexToOklch(p.options[hue].color)[0] - dangerL) < 0.02, `${spec.id} ${mode} ${hue} 明度跟异常色`);
      const hues = new Set(Object.values(p.options).map((c) => c.color));
      assert.equal(hues.size, 10, `${spec.id} ${mode} 10 色不重样`);
      for (const hue of OPTION_HUES) {
        const c = p.options[hue];
        assert.ok(contrast(c.text, c.soft) >= 4.5, `${spec.id} ${mode} ${hue} 标签字 ${contrast(c.text, c.soft).toFixed(2)}`);
        assert.ok(contrast("#ffffff", c.solid) >= 4.5, `${spec.id} ${mode} ${hue} 实心白字 ${contrast("#ffffff", c.solid).toFixed(2)}`);
        for (const key of ["", "-soft", "-text", "-solid"]) assert.match(p.vars[`option-${hue}${key}`] ?? "", /^#[0-9a-f]{6}$/);
      }
    }
});

test("optionHueColors 是纯函数：同样的输入同样的输出", () => {
  const input = { danger: "#b4492f", primary: "#357450", note: "#677579", surface: "#ffffff", text: "#1e2e2e", dark: false };
  assert.deepEqual(optionHueColors(input), optionHueColors(input));
});
