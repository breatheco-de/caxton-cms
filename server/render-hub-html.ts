import fs from "fs";
import path from "path";
import type { ViteDevServer } from "vite";
import { resolveInitialData } from "./initial-data-middleware";
import { resolvePublicHtmlStatus } from "./public-html-status";
import { applyEntryModulePreload } from "./utils/html-transforms";
import { assembleSsrDocument, isMeaningfulSsrAppHtml } from "./utils/ssr-html";
import {
  buildHtmlCacheKey,
  getCachedHtml,
  setCachedHtml,
} from "./html-page-cache";
import type { SiteContext } from "./site-manager";
import { child as loggerChild } from "./logger";

const log = loggerChild({ module: "render-hub-html" });

let devViteRef: ViteDevServer | null = null;
let prodSsrRender: ((url: string, payload: unknown) => Promise<string>) | null = null;
let prodSsrLoaded = false;

export function registerDevViteForHubRender(vite: ViteDevServer | null): void {
  devViteRef = vite;
}

async function loadSsrRender(): Promise<
  ((url: string, payload: unknown) => Promise<string>) | null
> {
  if (devViteRef) {
    try {
      const entryServerAbs = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "src",
        "entry-server.tsx",
      );
      const mod = await devViteRef.ssrLoadModule(entryServerAbs);
      if (typeof mod.render === "function") return mod.render;
    } catch (err) {
      log.warn({ err }, "dev SSR module load failed for hub render");
    }
  }
  if (!prodSsrLoaded) {
    prodSsrLoaded = true;
    try {
      const ssrBundlePath = path.resolve(import.meta.dirname, "server", "entry-server.js");
      if (fs.existsSync(ssrBundlePath)) {
        const mod = await import(ssrBundlePath);
        prodSsrRender = mod.render;
      }
    } catch (err) {
      log.warn({ err }, "production SSR bundle load failed for hub render");
    }
  }
  return prodSsrRender;
}

function resolveIndexHtmlPath(): string | null {
  const distPath = path.resolve(import.meta.dirname, "public", "index.html");
  if (fs.existsSync(distPath)) return distPath;
  const devPath = path.resolve(import.meta.dirname, "..", "client", "index.html");
  if (fs.existsSync(devPath)) return devPath;
  return null;
}

export type RenderHubHtmlResult = {
  html: string;
  status: number;
  fromCache: boolean;
};

/**
 * Render a public hub page as anonymous live HTML. Uses HTML cache on hit;
 * on miss runs SSR and optionally populates the cache (same key as public traffic).
 */
export async function renderHubHtml(opts: {
  site: SiteContext;
  pathname: string;
  variantKey?: string;
  writeCache?: boolean;
}): Promise<RenderHubHtmlResult | null> {
  const clean = opts.pathname.split("?")[0].split("#")[0] || "/";
  if (clean.startsWith("/private/")) return null;

  const variantKey = opts.variantKey && opts.variantKey !== "default" ? opts.variantKey : "live";
  const siteId =
    opts.site.contentRootName || opts.site.contentRoot || opts.site.domain || "default";
  const cacheKey = buildHtmlCacheKey(siteId, clean, variantKey);

  const cached = getCachedHtml(cacheKey);
  if (cached) {
    return { html: cached.html, status: cached.status, fromCache: true };
  }

  const render = await loadSsrRender();
  const indexHtmlPath = resolveIndexHtmlPath();
  if (!render || !indexHtmlPath) return null;

  const url = clean;
  const initialDataPayload = await resolveInitialData(
    url,
    opts.site.contentIndex as Parameters<typeof resolveInitialData>[1],
    opts.site.database as Parameters<typeof resolveInitialData>[2],
    opts.site,
  ).catch(() => null);

  const status = resolvePublicHtmlStatus({
    url,
    httpStatus:
      initialDataPayload &&
      typeof (initialDataPayload as { httpStatus?: number }).httpStatus === "number"
        ? (initialDataPayload as { httpStatus: number }).httpStatus
        : undefined,
    contentIndex: opts.site.contentIndex as { isKnownUrl?(u: string): boolean },
  });

  if (status !== 200) {
    return { html: "", status, fromCache: false };
  }

  try {
    const indexHtml = await fs.promises.readFile(indexHtmlPath, "utf-8");
    let appHtml = await render(url, initialDataPayload);
    if (!isMeaningfulSsrAppHtml(appHtml)) {
      log.warn(
        { pathname: clean, appHtmlLength: appHtml?.length ?? 0 },
        "SSR returned empty body, retrying once",
      );
      appHtml = await render(url, initialDataPayload);
    }
    if (!isMeaningfulSsrAppHtml(appHtml)) {
      log.warn(
        { pathname: clean, appHtmlLength: appHtml?.length ?? 0 },
        "SSR returned empty body after retry — not caching empty #root",
      );
      return null;
    }

    let html = assembleSsrDocument({
      template: indexHtml,
      appHtml,
      payload: initialDataPayload,
      contentRoot: opts.site.contentRoot,
      url,
    });
    html = applyEntryModulePreload(html);

    if (opts.writeCache !== false) {
      setCachedHtml(cacheKey, html, status);
    }

    return { html, status, fromCache: false };
  } catch (err) {
    log.warn({ err, pathname: clean }, "renderHubHtml failed");
    return null;
  }
}
