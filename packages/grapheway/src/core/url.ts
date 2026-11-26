/**
 * Small URL helpers shared by the runtime, the probe and the compat layer.
 */

/**
 * Remove every trailing slash: `https://example.com///` -> `https://example.com`.
 *
 * A manual scan keeps this linear. The regex form (`/\/+$/`) backtracks on
 * long runs of slashes, which CodeQL reports as a polynomial ReDoS.
 */
export function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) end--;
  return value.slice(0, end);
}
