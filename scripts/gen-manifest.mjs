// Generates public/rooms/<room>/manifest.json from the block files so the judge (server-side)
// knows what hangs on the wall without needing the code. Runs before dev/build.
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const roomsDir = path.join(root, "src", "rooms");

for (const room of readdirSync(roomsDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const blocksDir = path.join(roomsDir, room.name, "blocks");
  const blocks = [];
  for (const f of readdirSync(blocksDir).filter((f) => f.endsWith(".tsx")).sort()) {
    const src = readFileSync(path.join(blocksDir, f), "utf8");
    const m = src.match(/export const block[^=]*=\s*\{([\s\S]*?)\};/);
    const body = m?.[1] ?? "";
    const pick = (k) => body.match(new RegExp(`${k}\\s*:\\s*"([^"]*)"`))?.[1] ?? "";
    const order = Number(body.match(/order\s*:\s*(\d+)/)?.[1] ?? 0);
    blocks.push({ id: pick("id") || f.replace(/\.tsx$/, ""), title: pick("title"), description: pick("description"), size: pick("size"), order, path: `src/rooms/${room.name}/blocks/${f}` });
  }
  blocks.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const pagesDir = path.join(roomsDir, room.name, "pages");
  const pages = [];
  if (existsSync(pagesDir)) {
    for (const f of readdirSync(pagesDir).filter((f) => f.endsWith(".tsx")).sort()) {
      const src = readFileSync(path.join(pagesDir, f), "utf8");
      const m = src.match(/export const page[^=]*=\s*\{([\s\S]*?)\};/);
      const body = m?.[1] ?? "";
      const pick = (k) => body.match(new RegExp(`${k}\\s*:\\s*"([^"]*)"`))?.[1] ?? "";
      pages.push({ slug: pick("slug") || f.replace(/\.tsx$/, ""), title: pick("title"), description: pick("description"), path: `src/rooms/${room.name}/pages/${f}` });
    }
  }
  const out = path.join(root, "public", "rooms", room.name);
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "manifest.json"), JSON.stringify({ room: room.name, generatedAt: new Date().toISOString(), blocks, pages }, null, 2));
  console.log(`manifest: ${room.name} (${blocks.length} blocks, ${pages.length} pages)`);
}
