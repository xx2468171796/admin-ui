import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { DataTable, InlineAlert, StatusBadge, Tabs, type Column } from "@adminui/react";
import { COMPONENT_DOCS } from "../content/index";
import { GROUPS, type ComponentDoc, type PropRow } from "../content/types";
import { loadSource } from "../demos/sources";
import { CodeBlock } from "./code-block";
import { DemoStage, defaultsOf, propsSnippet, type PropValues } from "./demo-stage";
import { SiteLink, useSite } from "./site-context";

function List({ items }: { items: readonly string[] | undefined }) {
  if (!items?.length) return null;
  return (
    <ul className="site-list">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}

function UsageTab({ doc }: { doc: ComponentDoc }) {
  const { t } = useSite();
  return (
    <div className="site-usage">
      <section>
        <h3>{t.when}</h3>
        <List items={doc.when} />
        {doc.whenNot?.length ? (
          <>
            <h4>{t.whenNot}</h4>
            <List items={doc.whenNot} />
          </>
        ) : null}
      </section>
      {(doc.anatomy?.length || doc.states?.length) && (
        <section className="site-two">
          {doc.anatomy?.length ? (
            <div>
              <h3>{t.anatomy}</h3>
              <List items={doc.anatomy} />
            </div>
          ) : null}
          {doc.states?.length ? (
            <div>
              <h3>{t.states}</h3>
              <List items={doc.states} />
            </div>
          ) : null}
        </section>
      )}
      <section className="site-two">
        <div className="site-do">
          <h3>
            <Check aria-hidden="true" />
            {t.dos}
          </h3>
          <List items={doc.dos} />
        </div>
        <div className="site-dont">
          <h3>
            <X aria-hidden="true" />
            {t.donts}
          </h3>
          <List items={doc.donts} />
        </div>
      </section>
    </div>
  );
}

const PROP_COLUMNS: Column<PropRow>[] = [
  { key: "name", title: "属性", width: 160, render: (r) => <code>{r.name}</code>, mobile: "primary" },
  { key: "type", title: "类型", width: 240, render: (r) => <code className="site-type">{r.type}</code> },
  { key: "default", title: "默认", width: 110, render: (r) => (r.default ? <code>{r.default}</code> : "—") },
  { key: "description", title: "说明", render: (r) => r.description },
];

function PropsTab({ doc }: { doc: ComponentDoc }) {
  const { t } = useSite();
  if (!doc.props?.length)
    return (
      <div className="site-usage">
        <p className="site-note">{t.noProps}</p>
        <div className="site-exports">
          {doc.subtitle.split(" · ").map((name) => (
            <code key={name}>{name}</code>
          ))}
        </div>
      </div>
    );
  return (
    <div className="site-usage">
      {doc.props.map((p) => (
        <section key={p.component}>
          <h3>
            <code>{p.component}</code>
          </h3>
          <DataTable
            caption={`${p.component} 的属性`}
            columns={PROP_COLUMNS}
            rows={p.rows}
            rowKey={(r) => r.name}
            rowHeight="auto"
            mobile="cards"
            pagination={{ mode: "all" }}
          />
        </section>
      ))}
    </div>
  );
}

export function ComponentPage({ doc }: { doc: ComponentDoc }) {
  const { t } = useSite();
  const [demoIndex, setDemoIndex] = useState(0);
  const demo = doc.demos[demoIndex] ?? doc.demos[0];
  const [values, setValues] = useState<PropValues>(() => defaultsOf(demo?.controls));
  const [tab, setTab] = useState("usage");
  const [source, setSource] = useState("");
  useEffect(() => {
    setDemoIndex(0);
    setTab("usage");
  }, [doc.slug]);
  useEffect(() => setValues(defaultsOf(demo?.controls)), [demo?.id, demo?.controls]);
  useEffect(() => {
    let live = true;
    if (demo) void loadSource(demo.id).then((s) => live && setSource(s));
    return () => {
      live = false;
    };
  }, [demo?.id]);

  const index = COMPONENT_DOCS.findIndex((d) => d.slug === doc.slug);
  const prev = COMPONENT_DOCS[index - 1];
  const next = COMPONENT_DOCS[index + 1];
  const group = GROUPS.find((g) => g.id === doc.group)?.title;
  const mainName = doc.subtitle.split(" · ")[0] ?? doc.title;
  const tabs = useMemo(
    () => [
      { value: "usage", label: t.tabDemo },
      { value: "code", label: t.tabCode },
      { value: "props", label: t.tabProps },
      { value: "a11y", label: t.tabA11y },
    ],
    [t],
  );

  return (
    <article className="site-doc">
      <header className="site-doc-head">
        <p className="site-crumb">{group}</p>
        <h1>
          {doc.title}
          {doc.status === "preview" && <StatusBadge tone="warning">{t.preview}</StatusBadge>}
        </h1>
        <p className="site-subtitle">{doc.subtitle}</p>
        <p className="site-lead">{doc.summary}</p>
        <CodeBlock code={`import { ${mainName} } from "${doc.importFrom}";`} title={t.importFrom} />
      </header>
      {doc.status === "preview" && <InlineAlert tone="warning" title={t.previewNote} />}
      {doc.demos.length > 1 && (
        <div className="site-chips">
          <Tabs
            size="sm"
            label={t.examples}
            value={String(demoIndex)}
            onValueChange={(v) => setDemoIndex(Number(v))}
            items={doc.demos.map((d, i) => ({ value: String(i), label: d.title }))}
          />
        </div>
      )}
      {demo && (
        <>
          {demo.description && <p className="site-note">{demo.description}</p>}
          <DemoStage demo={demo} values={values} onValues={setValues} />
        </>
      )}
      <div className="site-tabs">
        <Tabs value={tab} onValueChange={setTab} items={tabs} label={doc.title}>
          {tab === "usage" && <UsageTab doc={doc} />}
          {tab === "code" && (
            <div className="site-usage">
              {demo?.controls?.length ? <CodeBlock code={propsSnippet(mainName, values, demo.controls)} title={t.currentProps} /> : null}
              <CodeBlock code={source} title={`${t.source} · ${demo?.id ?? ""}.tsx`} />
            </div>
          )}
          {tab === "props" && <PropsTab doc={doc} />}
          {tab === "a11y" && (
            <div className="site-usage">
              <List items={doc.a11y} />
            </div>
          )}
        </Tabs>
      </div>
      <nav className="site-pager" aria-label="上一篇 / 下一篇">
        {prev ? (
          <SiteLink to={prev.slug}>
            <ArrowLeft aria-hidden="true" />
            <span>
              <small>{t.prev}</small>
              {prev.title}
            </span>
          </SiteLink>
        ) : (
          <span />
        )}
        {next && (
          <SiteLink to={next.slug} className="site-pager-next">
            <span>
              <small>{t.next}</small>
              {next.title}
            </span>
            <ArrowRight aria-hidden="true" />
          </SiteLink>
        )}
      </nav>
    </article>
  );
}
