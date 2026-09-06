// The same AST rules the sandbox and CI apply, runnable anywhere Node runs (Convex's pre-commit
// re-check included), so the floor is identical on every side of the wall: not text-only in Convex.
// Plain JS so the pipeline's Node actions can import it without a build step.
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { roomRules } from "./room-rules.js";
import { backendRules } from "./backend-rules.js";

/** The flat config the wall's agent-editable surface is held to: room rules for blocks and pages, backend rules for room functions. */
export function wallLintConfig() {
  return [
    {
      files: ["**/*.{ts,tsx,js,jsx}"],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
      },
      plugins: { "@typescript-eslint": tseslint.plugin },
    },
    { files: ["src/rooms/**/*.{ts,tsx}", "docs/examples/blocks/**/*.tsx", "docs/examples/pages/**/*.tsx"], rules: roomRules },
    { files: ["convex/rooms/**/*.ts"], rules: backendRules },
  ];
}

/**
 * Lint files by path and content. Only errors count; files no rule applies to pass.
 * @param {{ path: string; content: string }[]} files
 * @returns {Promise<{ ok: boolean; problems: string[] }>}
 */
export async function lintFiles(files) {
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: wallLintConfig(), ignore: false });
  const problems = [];
  for (const f of files) {
    if (!/\.(tsx?|jsx?)$/.test(f.path)) continue;
    const [res] = await eslint.lintText(f.content, { filePath: f.path });
    for (const m of res?.messages ?? []) {
      if (m.severity !== 2) continue;
      problems.push(`${f.path}:${m.line}:${m.column} ${m.message}${m.ruleId ? ` (${m.ruleId})` : ""}`);
    }
  }
  return { ok: problems.length === 0, problems };
}
