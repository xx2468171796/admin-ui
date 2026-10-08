import { ChoiceTiles, PALETTES, isPaletteId } from "@adminui/react";
import source from "./md/theming.md?raw";
import { DemoStage } from "../shell/demo-stage";
import { Prose } from "../shell/prose";
import { useSite } from "../shell/site-context";

const SAMPLER = { id: "home/theme-sampler", title: "色卡取样", height: 300 };

export function Theming() {
  const { palette, setPalette } = useSite();
  const [intro = "", rest = ""] = source.split("<!--swatches-->");
  return (
    <article className="site-doc">
      <Prose source={intro} />
      <ChoiceTiles
        label="选择色卡"
        columns={3}
        value={isPaletteId(palette) ? palette : "forest"}
        onValueChange={setPalette}
        options={PALETTES.map((p) => ({
          value: p.id,
          label: `${p.name} · ${p.id}`,
          icon: <span className="site-swatch-dot" style={{ background: p.primary }} aria-hidden="true" />,
          hint: (
            <>
              <span className="site-swatch-dots" aria-hidden="true">
                {[p.primary, p.attention, p.danger, p.info].map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
              主色 {p.primary}
            </>
          ),
        }))}
      />
      <DemoStage demo={SAMPLER} values={{}} onValues={() => undefined} />
      <Prose source={rest} />
    </article>
  );
}
