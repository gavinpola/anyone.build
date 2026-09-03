/** A random per-tab id. Used for anonymous presence and cookieless analytics. Never an IP, never persisted beyond the tab. */
export function tabSessionId(): string {
  try {
    const k = "ab:tab";
    let v = sessionStorage.getItem(k);
    if (!v || !/^[a-f0-9]{32}$/.test(v)) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      v = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      sessionStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "0000000000000000deadbeefdeadbeef";
  }
}

/**
 * A stable per-browser guest id (localStorage). It is a bearer secret: it lets a browser claim
 * its earlier changes after signing in, so it is never displayed and never logged.
 */
export function guestId(): string {
  try {
    const k = "ab:guest";
    let v = localStorage.getItem(k);
    if (!v || !/^[a-f0-9]{32}$/.test(v)) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      v = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return tabSessionId();
  }
}
