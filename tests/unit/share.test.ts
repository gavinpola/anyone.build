import { describe, expect, it } from "vitest";
import { escapeHtml, fetchShare, injectMeta, shareMeta, tidy, type ShareData } from "../../api/_share";

const live: ShareData = {
  id: "kh7abc",
  status: "live",
  ask: 'turn this into a countdown at midnight et - split the block into 2 halves <script>alert("x")</script>',
  by: { handle: "gavin-mill", avatarUrl: null, guest: false },
  primaryBlockId: "electric-message",
  summary: "Turned the electric block into a two-column midnight ET countdown.",
  votes: null,
  reverted: false,
};
const proposed: ShareData = { ...live, id: "kh7def", status: "proposed", summary: null, votes: 3 };

const HEAD = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>everyones.lol — the website anyone can change</title>
    <meta name="description" content="An experiment." />
    <meta property="og:title" content="everyones.lol" />
    <meta property="og:description" content="The website anyone can change." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://everyones.lol" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  </head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>`;

describe("share previews", () => {
  it("a live change unfurls with the ask, the summary, and who asked", () => {
    const m = shareMeta("c", live.id, live, "https://everyones.lol");
    expect(m.title).toMatch(/^“turn this into a countdown/);
    expect(m.title).toContain("made on everyones.lol");
    expect(m.description).toContain("two-column midnight ET countdown");
    expect(m.description).toContain("@gavin-mill");
    expect(m.url).toBe("https://everyones.lol/c/kh7abc");
    expect(m.image).toBe("https://everyones.lol/api/og?kind=c&id=kh7abc");
  });
  it("a proposal unfurls as a vote, with the count", () => {
    const m = shareMeta("p", proposed.id, proposed, "https://everyones.lol");
    expect(m.title).toMatch(/^Vote for: “/);
    expect(m.description).toMatch(/^3 votes so far/);
    expect(m.url).toBe("https://everyones.lol/p/kh7def");
  });
  it("a change link to a proposal still reads as a vote; a guest reads as a guest; nothing public reads generic", () => {
    expect(shareMeta("c", proposed.id, proposed, "https://x.test").title).toMatch(/^Vote for/);
    expect(shareMeta("c", live.id, { ...live, by: { handle: "guest-a3f9", avatarUrl: null, guest: true } }, "https://x.test").description).toContain("a guest");
    const g = shareMeta("c", "nope", null, "https://x.test");
    expect(g.title).toBe("everyones.lol");
    expect(g.image).toBe("https://x.test/api/og?kind=c&id=nope");
  });
  it("injects tags into the page head, replacing the static ones, with everything escaped", () => {
    const html = injectMeta(HEAD, shareMeta("c", live.id, live, "https://everyones.lol"));
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('<meta property="og:image" content="https://everyones.lol/api/og?kind=c&amp;id=kh7abc" />');
    expect(html).toContain('<script type="module" src="/src/main.tsx"></script>'); // the app still loads
    expect(html).toContain('<link rel="icon"');
  });
  it("tidy and escape do what they say", () => {
    expect(tidy("  a\n\nb\tc  ", 10)).toBe("a b c");
    expect(tidy("x".repeat(20), 10)).toBe("xxxxxxxxx…");
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
  it("fetchShare refuses bad ids without a network call and returns null on any failure", async () => {
    let calls = 0;
    const fake = (async () => {
      calls++;
      return new Response(JSON.stringify({ status: "success", value: live }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await fetchShare("https://x.convex.cloud", "../etc", fake)).toBeNull();
    expect(calls).toBe(0);
    expect((await fetchShare("https://x.convex.cloud", "kh7abcdefghij", fake))?.id).toBe("kh7abc");
    const broken = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    expect(await fetchShare("https://x.convex.cloud", "kh7abcdefghij", broken)).toBeNull();
    const throwing = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await fetchShare("https://x.convex.cloud", "kh7abcdefghij", throwing)).toBeNull();
  });
});
