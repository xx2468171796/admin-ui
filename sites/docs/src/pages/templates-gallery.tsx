import source from "./md/templates-gallery.md?raw";
import { COMPONENT_DOCS } from "../content/index";
import { Prose } from "../shell/prose";
import { SiteLink } from "../shell/site-context";

export function TemplatesGallery() {
  const [intro = "", rest = ""] = source.split("<!--cards-->");
  const pages = COMPONENT_DOCS.filter((d) => d.group === "templates");
  return (
    <article className="site-doc">
      <Prose source={intro} />
      {pages.length > 0 && (
        <div className="site-cards">
          {pages.map((d) => (
            <SiteLink key={d.slug} to={d.slug} className="site-card">
              <h3>{d.title}</h3>
              <p>{d.summary}</p>
            </SiteLink>
          ))}
        </div>
      )}
      <Prose source={rest} />
    </article>
  );
}
