// Mirrors packages/gatekeeper/src/constitution.ts into docs/CONSTITUTION.md (the TS file is the source of truth).
import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync(new URL("../packages/gatekeeper/src/constitution.ts", import.meta.url), "utf8");
const version = src.match(/CONSTITUTION_VERSION = "([^"]+)"/)?.[1] ?? "?";
const body = src.match(/CONSTITUTION = `\n([\s\S]*?)`\.trim\(\)/)?.[1] ?? "";
const md = `# The constitution (v${version})\n\nThese are the rules the judge enforces, verbatim. Edited only by humans, via PR.\n\n${body.trim().split("\n").map((l) => l.replace(/^(\d+)\. /, "$1. **").replace(/^(\d+\. \*\*[^.]+\.)/, "$1**")).join("\n\n")}\n`;
writeFileSync(new URL("../docs/CONSTITUTION.md", import.meta.url), md);
console.log("docs/CONSTITUTION.md updated (v" + version + ")");
