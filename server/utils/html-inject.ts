/**
 * Literal-safe HTML string injection.
 *
 * `String.prototype.replace` with a *string* replacement expands `$1`, `$&`,
 * `` $` ``, `$'` and `$$`. CMS copy (prices like "$135K", regex samples in
 * how-to articles) must never be passed that way — always use a replacer
 * function, whose return value is inserted verbatim.
 */

/** Replace the first match of `search` with `value`, inserted literally. */
export function replaceLiteral(html: string, search: string | RegExp, value: string): string {
  return html.replace(search, () => value);
}

/** Insert `fragment` immediately before the first occurrence of `marker`. */
export function insertBefore(html: string, marker: string, fragment: string): string {
  return html.replace(marker, () => fragment + marker);
}

/** `<script id="__INITIAL_DATA__">` with `<` escaped so content can never close the tag. */
export function buildInitialDataScriptTag(payload: unknown): string {
  return `<script id="__INITIAL_DATA__" type="application/json">${JSON.stringify(payload).replace(/</g, "\\u003c")}</script>`;
}
