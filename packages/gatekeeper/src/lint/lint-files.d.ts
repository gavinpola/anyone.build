export function wallLintConfig(): unknown[];
export function lintFiles(files: { path: string; content: string }[]): Promise<{ ok: boolean; problems: string[] }>;
