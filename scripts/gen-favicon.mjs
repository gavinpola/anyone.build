// Renders the PNG fallbacks (Safari tabs, the home screen) from public/favicon.svg, the source of truth.
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
const svg = readFileSync(new URL("../public/favicon.svg", import.meta.url), "utf8");
for (const [name, size] of [["favicon-32.png", 32], ["favicon-16.png", 16], ["apple-touch-icon.png", 180], ["icon-512.png", 512]]) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(new URL(`../public/${name}`, import.meta.url), png);
  console.log(name, size + "px", Math.round(png.length / 1024 * 10) / 10 + " KB");
}
