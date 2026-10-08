/**
 * Site theme `<style>` for HTML that shows the site's pages (public pages,
 * page preview, section demos). Admin-only screens never get it.
 */
import { getDefaultContentRoot } from "./site-config";
import { loadSiteTheme } from "./theme-config";
import { insertBefore } from "./utils/html-inject";
import {
  buildThemeBackgroundCss,
  buildThemeColorVarsCss,
  THEME_OVERRIDES_STYLE_ID,
} from "@shared/theme-palette";

export function buildThemeCssOverrides(contentRoot = getDefaultContentRoot()): string {
  try {
    const theme = loadSiteTheme(contentRoot);
    if (!theme) return "";
    const css = buildThemeColorVarsCss(theme.colors) + buildThemeBackgroundCss(theme);
    return css ? `<style id="${THEME_OVERRIDES_STYLE_ID}">\n${css}</style>` : "";
  } catch {
    return "";
  }
}

/** Adds the site theme `<style>` before `</head>` once (no-op when absent or already present). */
export function injectThemeOverrides(html: string, contentRoot: string): string {
  if (html.includes(`id="${THEME_OVERRIDES_STYLE_ID}"`)) return html;
  const themeStyle = buildThemeCssOverrides(contentRoot);
  return themeStyle ? insertBefore(html, "</head>", themeStyle) : html;
}
