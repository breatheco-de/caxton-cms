import { describe, expect, it, beforeEach } from "vitest";
import {
  buildHtmlCacheKey,
  collectParamPlaceholderNames,
  getCachedHtml,
  htmlLooksPersonalized,
  requestBakesQueryParamTemplate,
  resetHtmlPageCacheForTests,
  setCachedHtml,
  setHtmlBuildIdForTests,
  shouldBypassHtmlCache,
  singleflight,
} from "./html-page-cache";

describe("shouldBypassHtmlCache", () => {
  const emptyHeaders = { cookie: undefined as string | undefined };

  it("bypasses for ?cache=false (anonymous preferred)", () => {
    expect(
      shouldBypassHtmlCache({
        method: "GET",
        headers: emptyHeaders,
        originalUrl: "/en/blog/post?cache=false",
      }),
    ).toBe(true);
    expect(
      shouldBypassHtmlCache({
        method: "GET",
        headers: emptyHeaders,
        originalUrl: "/es/page?foo=1&cache=false#section",
      }),
    ).toBe(true);
  });

  it("does not treat unrelated cache= values as bypass", () => {
    expect(
      shouldBypassHtmlCache({
        method: "GET",
        headers: emptyHeaders,
        originalUrl: "/en/blog/post?cache=true",
      }),
    ).toBe(false);
    expect(
      shouldBypassHtmlCache({
        method: "GET",
        headers: emptyHeaders,
        originalUrl: "/en/blog/post?cache=falsehood",
      }),
    ).toBe(false);
  });

  it("still bypasses edit=1 / edit_mode / __site", () => {
    expect(
      shouldBypassHtmlCache({
        method: "GET",
        headers: emptyHeaders,
        originalUrl: "/en/x?edit=1",
      }),
    ).toBe(true);
    expect(
      shouldBypassHtmlCache({
        method: "GET",
        headers: emptyHeaders,
        originalUrl: "/en/x?edit_mode=true",
      }),
    ).toBe(true);
    expect(
      shouldBypassHtmlCache({
        method: "GET",
        headers: emptyHeaders,
        originalUrl: "/en/x?__site=example.com",
      }),
    ).toBe(true);
  });

  it("does not bypass plain anonymous GET", () => {
    expect(
      shouldBypassHtmlCache({
        method: "GET",
        headers: emptyHeaders,
        originalUrl: "/en/blog/post",
      }),
    ).toBe(false);
  });
});

describe("buildHtmlCacheKey", () => {
  beforeEach(() => {
    setHtmlBuildIdForTests("testbuild");
  });

  it("strips query from pathname and includes the build id", () => {
    expect(buildHtmlCacheKey("site", "/blog/post?cache=false")).toBe(
      "testbuild::site::/blog/post::live",
    );
  });
});

describe("query param cache", () => {
  it("misses only when the url fills a param the page uses", () => {
    const source = { title: "Cursos en {{ param.ciudad }}", plan: "ignored" };
    expect(collectParamPlaceholderNames(source)).toEqual(["ciudad"]);
    expect(requestBakesQueryParamTemplate("/en/cursos?ciudad=miami", source)).toBe(true);
    expect(requestBakesQueryParamTemplate("/en/cursos?utm_source=google", source)).toBe(false);
    expect(requestBakesQueryParamTemplate("/en/cursos?plan=pro", source)).toBe(false);
    expect(requestBakesQueryParamTemplate("/en/cursos?edit=1", source)).toBe(false);
  });
});

describe("html page store", () => {
  beforeEach(() => {
    setHtmlBuildIdForTests("testbuild");
    resetHtmlPageCacheForTests();
  });

  it("stores a page and refuses markup that looks per-visitor", () => {
    const key = buildHtmlCacheKey("site", "/en/home");
    setCachedHtml(key, "<html><body>Hello</body></html>", 200);
    expect(getCachedHtml(key)?.html).toContain("Hello");
    expect(htmlLooksPersonalized(`<html><meta name="csrf-token" content="abc">`)).toBe(true);
    setCachedHtml(key, `<html><body>4g_user_id=abc</body></html>`, 200);
    expect(getCachedHtml(key)?.html).toContain("Hello");
  });

  it("reads html from a disk copy that has no decoded string", () => {
    setHtmlBuildIdForTests("testbuild");
    const key = buildHtmlCacheKey("site", "/en/blog");
    setCachedHtml(key, "<html><body>From disk</body></html>", 200);
    resetHtmlPageCacheForTests();
    setHtmlBuildIdForTests("testbuild");
    expect(getCachedHtml(key)?.html).toContain("From disk");
    expect(getCachedHtml(key)?.html).toContain("From disk");
  });

  it("singleflight shares one in-flight render", async () => {
    let runs = 0;
    const key = "k";
    const [a, b] = await Promise.all([
      singleflight(key, async () => {
        runs += 1;
        await new Promise((r) => setTimeout(r, 20));
        return "page";
      }),
      singleflight(key, async () => {
        runs += 1;
        return "other";
      }),
    ]);
    expect(runs).toBe(1);
    expect(a).toBe("page");
    expect(b).toBe("page");
  });
});
