/**
 * Stamps every host JSX element (div, button, …) inside agent-editable files
 * with `data-ab="<relative file>:<line>"` so the picker can map any DOM node
 * back to the exact source location the coding agent should edit.
 *
 * Only files matching `include` are touched (by default src/rooms/**).
 * Component elements (<Card>) get the prop too; kit components forward it to their root.
 */
import path from "node:path";
import { parse } from "@babel/parser";
import MagicString from "magic-string";
import type { Plugin } from "vite";

type Node = { type: string; [k: string]: unknown };

function walk(node: unknown, visit: (n: Node) => void) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  const n = node as Node;
  if (typeof n.type === "string") visit(n);
  for (const key of Object.keys(n)) {
    if (key === "loc" || key === "start" || key === "end" || key === "type") continue;
    walk(n[key], visit);
  }
}

export function stampSource(opts: { root: string; include?: RegExp }): Plugin {
  // src/rooms is the real surface; docs/examples/blocks only ever mounts in dev (VITE_E2E_BLOCKS).
  const include = opts.include ?? /[\\/](src[\\/]rooms|docs[\\/]examples[\\/]blocks)[\\/].*\.tsx$/;
  return {
    name: "anyone:stamp-source",
    enforce: "pre",
    transform(code, id) {
      const file = id.split("?")[0] ?? id;
      if (file.includes("node_modules") || !include.test(file)) return null;
      const rel = path.relative(opts.root, file).replaceAll("\\", "/");
      const ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
        errorRecovery: true,
      });
      const s = new MagicString(code);
      let stamped = 0;
      walk(ast.program, (n) => {
        if (n.type !== "JSXOpeningElement") return;
        const name = n.name as Node & { type: string; name?: string; end?: number };
        if (name.type !== "JSXIdentifier" || !name.name) return;
        if (name.name === "Fragment") return;
        const loc = n.loc as { start: { line: number } } | null;
        if (!loc || typeof name.end !== "number") return;
        s.appendLeft(name.end, ` data-ab="${rel}:${loc.start.line}"`);
        stamped++;
      });
      if (stamped === 0) return null;
      return { code: s.toString(), map: s.generateMap({ hires: true }) };
    },
  };
}
