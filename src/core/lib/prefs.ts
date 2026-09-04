/** Small per-browser preferences in localStorage under the `ab:` prefix. Never identity, never secrets; a missing value is fine. */
export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(`ab:${key}`);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(`ab:${key}`, value);
  } catch {
    /* private mode, blocked storage: the preference just doesn't stick */
  }
}
