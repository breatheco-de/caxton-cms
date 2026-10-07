import path from "path";
import { Job } from "sidequest";
import { ContentIndex } from "../../content-index";
import { DatabaseManager } from "../../database";
import { MediaGallery } from "../../media-gallery";
import { renderHubHtml } from "../../render-hub-html";
import { buildHtmlCacheKey, getHtmlBuildId, notifyHtmlCacheAdopted } from "../../html-page-cache";
import type { SiteContext } from "../../site-manager";
import { child } from "../../logger";
import { markJobFinished, markJobStarted } from "../heartbeat";

const log = child({ module: "job:html-page-rebuild" });

export type HtmlPageRebuildPayload = {
  siteId: string;
  contentRoot: string;
  pathname: string;
  variantKey?: string;
  generation: number;
  buildId: string;
};

export class HtmlPageRebuildJob extends Job {
  async run(payload: HtmlPageRebuildPayload): Promise<{ ok: boolean; reason?: string }> {
    markJobStarted("html_page_rebuild");
    try {
      if (!payload?.pathname || !payload.contentRoot || !payload.siteId) {
        return { ok: false, reason: "invalid_payload" };
      }
      if (payload.buildId && payload.buildId !== getHtmlBuildId()) {
        return { ok: true, reason: "stale_build" };
      }
      const contentRoot = path.resolve(payload.contentRoot);
      const contentRootName =
        path.relative(process.cwd(), contentRoot) || path.basename(contentRoot);
      const mg = new MediaGallery(contentRootName);
      const database = new DatabaseManager(contentRoot, mg);
      const ci = new ContentIndex(contentRoot, database);
      ci.scanFast();
      const site = {
        contentRoot,
        contentRootName: payload.siteId || contentRootName,
        domain: contentRootName,
        contentIndex: ci,
        database,
      } as SiteContext;
      const rendered = await renderHubHtml({
        site,
        pathname: payload.pathname,
        variantKey: payload.variantKey || "live",
        writeCache: true,
        generation: payload.generation,
      });
      if (!rendered || rendered.status !== 200) {
        log.warn({ pathname: payload.pathname, status: rendered?.status }, "html rebuild missed");
        return { ok: false, reason: "render_failed" };
      }
      await notifyHtmlCacheAdopted([
        buildHtmlCacheKey(payload.siteId, payload.pathname, payload.variantKey || "live"),
      ]);
      log.info(
        { pathname: payload.pathname, generation: payload.generation, fromCache: rendered.fromCache },
        "html rebuild wrote",
      );
      return { ok: true };
    } finally {
      markJobFinished("html_page_rebuild");
    }
  }
}
