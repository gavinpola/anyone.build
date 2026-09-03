"use node";
/**
 * Read-only access to the wall's source for the judge: the block manifest (generated at build,
 * served by the site) and a snippet around the target line (public repo, raw GitHub).
 * Both are best-effort; the judge works without them.
 */
export type ManifestEntry = { id: string; title: string; description: string; path: string };

export type PageEntry = { slug: string; title: string; description: string; path: string };

export async function fetchManifest(roomId: string): Promise<{ blocks: ManifestEntry[]; pages: PageEntry[] }> {
  const site = process.env.SITE_URL;
  const empty = { blocks: [], pages: [] };
  if (!site) return empty;
  try {
    const res = await fetch(`${site.replace(/\/$/, "")}/rooms/${roomId}/manifest.json`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return empty;
    const json = (await res.json()) as { blocks?: ManifestEntry[]; pages?: PageEntry[] };
    return { blocks: json.blocks ?? [], pages: json.pages ?? [] };
  } catch {
    return empty;
  }
}

export async function fetchSource(path: string, ref = "main"): Promise<string | null> {
  const repo = process.env.GITHUB_REPO;
  if (!repo) return null;
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${repo}/${ref}/${path}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function fetchSnippet(path: string, line: number, radius = 40): Promise<string | null> {
  const src = await fetchSource(path);
  if (!src) return null;
  const lines = src.split("\n");
  const from = Math.max(0, line - 1 - radius);
  const to = Math.min(lines.length, line - 1 + radius);
  return lines
    .slice(from, to)
    .map((l, i) => `${String(from + i + 1).padStart(4, " ")}${from + i + 1 === line ? " ▶" : "  "} ${l}`)
    .join("\n");
}
