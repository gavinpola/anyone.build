/**
 * Pure helpers for the share pages (api/share.ts, api/og.tsx). No runtime imports so they can be unit
 * tested and bundled for the Edge runtime alike. Files starting with "_" are not deployed as functions.
 */
export type ShareData = {
  id: string;
  status: string;
  ask: string;
  by: { handle: string; avatarUrl: string | null; guest: boolean };
  primaryBlockId: string | null;
  summary: string | null;
  votes: number | null;
  reverted: boolean;
};

export type ShareMeta = { title: string; description: string; url: string; image: string; kind: "c" | "p" };

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** One line, no control characters, capped: what goes into a title or description. */
export function tidy(s: string, max: number): string {
  const one = Array.from(s, (ch) => (ch.charCodeAt(0) < 32 ? " " : ch)).join("").replace(/\s+/g, " ").trim();
  return one.length > max ? one.slice(0, max - 1).trimEnd() + "…" : one;
}

export function byLine(d: ShareData): string {
  return d.by.guest ? "a guest" : "@" + d.by.handle;
}

export function shareMeta(kind: "c" | "p", id: string, d: ShareData | null, origin: string): ShareMeta {
  const url = `${origin}/${kind}/${id}`;
  const image = `${origin}/api/og?kind=${kind}&id=${encodeURIComponent(id)}`;
  if (!d) {
    return { kind, title: "anyone.build", description: "The website anyone can change. Point at something, say what should change, watch it ship.", url, image };
  }
  const ask = tidy(d.ask, 90);
  if (kind === "p" || d.status === "proposed") {
    const votes = d.votes ?? 0;
    return {
      kind: "p",
      title: `Vote for: “${ask}”`,
      description: `${votes} ${votes === 1 ? "vote" : "votes"} so far. Asked by ${byLine(d)} on anyone.build, the website anyone can change. Sign in to vote; the most-wanted one gets built.`,
      url,
      image,
    };
  }
  const live = d.status === "live";
  return {
    kind: "c",
    title: `“${ask}” · made on anyone.build`,
    description: live
      ? `${d.summary ? tidy(d.summary, 120) + " " : ""}Asked by ${byLine(d)}${d.reverted ? " (since replaced)" : ""}. anyone.build is the website anyone can change.`
      : `Being built right now, asked by ${byLine(d)}. anyone.build is the website anyone can change: point at something, say what should change, watch it ship.`,
    url,
    image,
  };
}

/** Replace the page's title and preview tags with this share's. Leaves everything else untouched. */
export function injectMeta(html: string, m: ShareMeta): string {
  const stripped = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, "");
  const tags = [
    `<title>${escapeHtml(m.title)}</title>`,
    `<meta name="description" content="${escapeHtml(m.description)}" />`,
    `<meta property="og:title" content="${escapeHtml(m.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(m.description)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:url" content="${escapeHtml(m.url)}" />`,
    `<meta property="og:image" content="${escapeHtml(m.image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:site_name" content="anyone.build" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(m.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(m.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(m.image)}" />`,
  ].join("\n    ");
  if (/<\/head>/i.test(stripped)) return stripped.replace(/<\/head>/i, `    ${tags}\n  </head>`);
  return `${tags}\n${stripped}`;
}

/** Read one public share record through Convex's HTTP query endpoint. Null on any problem. */
export async function fetchShare(convexUrl: string, id: string, fetchImpl: typeof fetch = fetch): Promise<ShareData | null> {
  if (!/^[a-z0-9]{10,64}$/i.test(id)) return null;
  try {
    const res = await fetchImpl(`${convexUrl.replace(/\/$/, "")}/api/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "share:request", args: { id }, format: "json" }),
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { status?: string; value?: ShareData | null };
    return json.status === "success" && json.value ? json.value : null;
  } catch {
    return null;
  }
}
