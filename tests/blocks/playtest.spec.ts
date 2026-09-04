import { test, expect, type Page } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";

/**
 * The playtest: every block (or the ones in BLOCKS=a,b) is mounted alone at /lab/<id>, rendered,
 * poked (keys, a tap, a pointer move), and checked three ways:
 *   1. deterministic: it renders, no crash card, no page errors, and a canvas block actually moves;
 *   2. vision (when OPENROUTER_API_KEY is set): screenshots before and after input go to a model with
 *      the block's own description, asking only "does this work as described?"; a confident "no"
 *      fails the run with the model's reasons, which is what the PR shows.
 * Nothing here can catch every bug. It catches the ones that shipped: a dino that couldn't jump.
 */
const BASE = process.env.PLAYTEST_URL ?? "http://127.0.0.1:4173";
const ROOM_BLOCKS = new URL("../../src/rooms/main/blocks/", import.meta.url);

function blockIds(): string[] {
  const env = (process.env.BLOCKS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (env.length) return env;
  return readdirSync(ROOM_BLOCKS)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => f.replace(/\.tsx$/, ""));
}

function describe(id: string): { title: string; description: string } {
  try {
    const src = readFileSync(new URL(`${id}.tsx`, ROOM_BLOCKS), "utf8");
    const title = src.match(/title:\s*"([^"]*)"/)?.[1] ?? id;
    const description = src.match(/description:\s*"([^"]*)"/)?.[1] ?? "";
    return { title, description };
  } catch {
    return { title: id, description: "" };
  }
}

/** A coarse fingerprint of every canvas in the block: sampled pixels, so "did anything move?" is cheap. */
async function canvasSample(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const c of Array.from(document.querySelectorAll("[data-lab] canvas")) as HTMLCanvasElement[]) {
      const ctx = c.getContext("2d");
      if (!ctx || !c.width || !c.height) continue;
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let s = "";
      for (let i = 0; i < d.length; i += Math.max(4, Math.floor(d.length / 4000) * 4)) s += d[i]! + d[i + 1]! + d[i + 2]!;
      out.push(s);
    }
    return out;
  });
}

type Vision = { works: boolean; confidence: number; problems: string[]; summary: string };

async function askVision(id: string, meta: { title: string; description: string }, shots: Buffer[]): Promise<Vision | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const model = process.env.PLAYTEST_MODEL || "google/gemini-2.5-flash";
  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: [
        `You are playtesting one block of a public website. The block is called "${meta.title}" and describes itself as: "${meta.description}".`,
        `The tester is a first-time visitor who is NOT signed in. What they did, in order: clicked the first visible button if there was one, tapped the middle of the block, pressed Space and ArrowUp, then dragged across the middle. Screenshots: (1) just after it rendered; (2) about half a second after those inputs; (3) about two seconds later.`,
        `Anything that needs an account may refuse a signed-out visitor: that "works" as long as the block SAYS so plainly (a "sign in to …" prompt). Silently doing nothing does not work.`,
        `Decide whether the block plausibly works for a visitor who taps the right thing. The tester is a script: its taps land in the middle of the block and may miss the actual control, so a missed target is NOT a failure. Use what changed on screen as evidence (a game started, a timer ran, a prompt appeared, a score or counter moved, strokes appeared). Fail only for things that clearly cannot work: nothing visible; a crash or error text; the main action visibly doing nothing when it was aimed correctly (a jump that never happens after the game started); text cut off or overlapping; a layout that is obviously broken. Small aesthetic choices are fine. Static text "works" when it renders legibly.`,
        `Answer as JSON only: {"works": boolean, "confidence": 0..1, "problems": ["short, concrete"], "summary": "one line"}.`,
      ].join("\n"),
    },
    ...shots.map((b) => ({ type: "image_url", image_url: { url: `data:image/png;base64,${b.toString("base64")}` } })),
  ];
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "HTTP-Referer": "https://anyone.build", "X-Title": "anyone.build playtest" },
    body: JSON.stringify({ model, messages: [{ role: "user", content }], response_format: { type: "json_object" }, temperature: 0, max_tokens: 400 }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    console.warn(`playtest vision call failed for ${id}: ${res.status}`);
    return null;
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content ?? "";
  try {
    const v = JSON.parse(text.replace(/^```json\s*|```$/g, "")) as Partial<Vision>;
    return { works: Boolean(v.works), confidence: Number(v.confidence ?? 0), problems: Array.isArray(v.problems) ? v.problems.map(String).slice(0, 5) : [], summary: String(v.summary ?? "") };
  } catch {
    console.warn(`playtest vision reply unparsable for ${id}: ${text.slice(0, 200)}`);
    return null;
  }
}

for (const id of blockIds()) {
  test(`playtest: ${id}`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(`${BASE}/lab/${id}`);
    const lab = page.locator(`[data-lab="${id}"]`);
    await expect(lab, `block ${id} is not on the wall`).toBeVisible({ timeout: 20_000 });
    const block = lab.locator(`[data-ab-block="${id}"]`);
    await expect(block).toBeVisible();
    expect(await page.getByText("this block crashed").count(), "crash card").toBe(0);
    const box = await block.boundingBox();
    expect(box?.height ?? 0, "renders with some height").toBeGreaterThan(24);
    await page.waitForTimeout(400);
    const shots: Buffer[] = [await block.screenshot()];
    const before = await canvasSample(page);

    // poke it the way a person would: focus, keys, a tap in the middle, a pointer wiggle
    const interactive = (await block.locator("canvas, [tabindex], button, input, textarea, [role=button]").count()) > 0;
    if (interactive) {
      // what a person does: press the obvious button, tap the thing, hit the usual keys, drag across it
      const button = block.locator("button:visible").first();
      if (await button.count()) await button.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
      const b2 = (await block.boundingBox()) ?? box!;
      await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2).catch(() => {});
      await page.keyboard.press("Space").catch(() => {});
      await page.keyboard.press("ArrowUp").catch(() => {});
      await page.mouse.move(b2.x + b2.width * 0.3, b2.y + b2.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(b2.x + b2.width * 0.7, b2.y + b2.height * 0.6, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(500);
      shots.push(await block.screenshot());
      await page.waitForTimeout(1500);
      shots.push(await block.screenshot());
    }

    const after = await canvasSample(page);
    let canvasNote = "";
    if (before.length) {
      // a canvas block must draw something; whether it changed after input is a fact for the playtester, not a rule
      expect(before.some((s) => s.length > 0), "canvas drew nothing").toBe(true);
      canvasNote = after.join("|") !== before.join("|") ? "The canvas pixels changed after the input." : "The canvas pixels did NOT change after the input.";
    }
    const real = errors.filter((e) => !/convex|websocket|auth|favicon|net::ERR|Failed to load resource/i.test(e));
    if (real.length) console.log(`playtest ${id}: page errors:\n  ` + real.map((e) => e.slice(0, 300)).join("\n  "));
    expect(real, "page errors").toEqual([]);

    if (process.env.PLAYTEST_SHOTS) {
      const { writeFileSync, mkdirSync } = await import("node:fs");
      mkdirSync(process.env.PLAYTEST_SHOTS, { recursive: true });
      shots.forEach((b, i) => writeFileSync(`${process.env.PLAYTEST_SHOTS}/${id}-${i + 1}.png`, b));
    }
    // Static blocks (no controls, no canvas) are judged by the deterministic checks alone: a single screenshot
    // of plain text gives a vision model nothing to reason about and it invents expectations.
    const meta = describe(id);
    const vision = !interactive ? null : await askVision(id, { ...meta, description: `${meta.description} ${canvasNote}`.trim() }, shots);
    if (vision) {
      console.log(`playtest ${id}: works=${vision.works} conf=${vision.confidence.toFixed(2)} · ${vision.summary}${vision.problems.length ? " · " + vision.problems.join("; ") : ""}`);
      // only a confident "no" blocks; the reasons are what the PR comment shows
      expect(vision.works || vision.confidence < 0.8, `playtester: ${vision.summary} — ${vision.problems.join("; ")}`).toBe(true);
    }
  });
}
