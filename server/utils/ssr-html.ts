import {
  injectSsrMetaTags,
  resolvePreloadHints,
  type InitialDataPayload,
  type PreloadHint,
} from "../initial-data-middleware";
import { injectSsrSchemaHtml } from "../ssr-schema";
import { buildInitialDataScriptTag, insertBefore, replaceLiteral } from "./html-inject";

/**
 * True when SSR produced real body markup (not Suspense-null / whitespace-only).
 * Empty appHtml must not be injected into #root or HTML-cached as a successful page.
 */
export function isMeaningfulSsrAppHtml(appHtml: string | null | undefined): boolean {
  if (typeof appHtml !== "string") return false;
  const trimmed = appHtml.replace(/<!--[\s\S]*?-->/g, "").trim();
  if (!trimmed) return false;
  // Require at least one HTML tag (section wrappers, headings, etc.)
  return /<[a-zA-Z]/.test(trimmed);
}

export function buildPreloadTags(hints: PreloadHint[]): string {
  if (hints.length === 0) return "";
  // Only the first (true LCP) candidate gets fetchpriority=high; siblings stay
  // as plain preloads so they don't contend for bandwidth with the hero.
  return hints
    .map((hint, index) => {
      const href = `href="${hint.src.replace(/"/g, "&quot;")}"`;
      const priority =
        index === 0 || hint.highPriority
          ? ` fetchpriority="high"`
          : "";
      if (hint.srcset) {
        const imagesrcset = `imagesrcset="${hint.srcset.replace(/"/g, "&quot;")}"`;
        const imagesizes = `imagesizes="${(hint.sizes ?? "100vw").replace(/"/g, "&quot;")}"`;
        return `<link rel="preload" as="image"${priority} ${href} ${imagesrcset} ${imagesizes}>`;
      }
      return `<link rel="preload" as="image"${priority} ${href}>`;
    })
    .join("\n");
}

export function injectPreloadTags(html: string, preloadTags: string): string {
  if (!preloadTags) return html;
  return insertBefore(html, "</head>", preloadTags + "\n");
}

/**
 * Build the SSR document from the index.html shell: #root body, image preloads,
 * meta tags, optional schema head fragment, and `__INITIAL_DATA__`.
 * Every injection inserts content literally — CMS copy may contain `$&`, `$1`, etc.
 */
export function assembleSsrDocument(opts: {
  template: string;
  appHtml: string | null;
  payload: InitialDataPayload | null;
  contentRoot?: string;
  url: string;
  ssrSchemaHtml?: string;
}): string {
  let html = opts.appHtml
    ? replaceLiteral(opts.template, '<div id="root"></div>', `<div id="root">${opts.appHtml}</div>`)
    : opts.template;

  html = injectPreloadTags(html, buildPreloadTags(resolvePreloadHints(opts.payload)));
  html = injectSsrMetaTags(html, opts.payload, opts.contentRoot, opts.url);

  if (opts.ssrSchemaHtml) {
    html = injectSsrSchemaHtml(html, opts.ssrSchemaHtml);
  }

  if (opts.payload) {
    html = insertBefore(html, "</body>", buildInitialDataScriptTag(opts.payload));
  }

  return html;
}
