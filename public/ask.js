/* everyones.lol · ask.js
   Point at anything on your site and say what should change.

   <script src="https://everyones.lol/ask.js" data-site="site_…" defer></script>

   Optional: data-api (where notes go), data-color (accent). No dependencies, no cookies,
   nothing tracked. Styles live in a shadow root so they can't touch your page. */
(() => {
  "use strict";
  const script = document.currentScript;
  if (!script || window.__anyoneBuildAsk) return;
  const key = script.getAttribute("data-site");
  if (!key) {
    console.warn("[everyones.lol] ask.js needs data-site");
    return;
  }
  window.__anyoneBuildAsk = true;
  const api = script.getAttribute("data-api") || new URL("/api/ask/note", script.src).toString();
  const accent = (script.getAttribute("data-color") || "#111111").replace(/[^#a-zA-Z0-9(),.% ]/g, "");
  const coarse = matchMedia("(pointer: coarse)").matches;

  const host = document.createElement("div");
  host.setAttribute("data-ab-ask", "");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    :host{all:initial}
    *{box-sizing:border-box;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;margin:0}
    .box{position:fixed;pointer-events:none;border:2px solid ${accent};border-radius:6px;background:color-mix(in srgb, ${accent} 10%, transparent);z-index:2147483645;transition:top .06s,left .06s,width .06s,height .06s}
    .tag{position:absolute;top:-24px;left:-2px;background:${accent};color:#fff;font-size:11px;line-height:1;padding:5px 7px;border-radius:4px;white-space:nowrap}
    .pop{position:fixed;z-index:2147483646;width:min(320px,calc(100vw - 24px));background:#fff;border:1px solid #e3e3e3;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.14);padding:14px}
    .pop h3{font-size:15px;font-weight:600;margin:0 0 4px}
    .ctx{font-size:12px;color:#666;margin:0 0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    textarea{display:block;width:100%;min-height:76px;resize:vertical;border:1px solid #d9d9d9;border-radius:8px;padding:8px 10px;outline:none;background:#fff}
    textarea:focus{border-color:${accent}}
    .row{display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:10px}
    button{cursor:pointer;border-radius:8px;padding:7px 12px;border:1px solid #d9d9d9;background:#fff;font-weight:500}
    button.send{background:${accent};border-color:${accent};color:#fff;font-weight:600}
    button:disabled{opacity:.5;cursor:default}
    .msg{font-size:12px;color:#666;margin-top:8px;min-height:16px}
    .msg.bad{color:#b42318}
    .by{font-size:11px;color:#999;margin-top:8px}
    .by a{color:#666;text-decoration:none}
    .pill{position:fixed;right:16px;bottom:16px;z-index:2147483646;border-radius:999px;padding:10px 16px;background:${accent};color:#fff;border:0;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.18)}
    .pill.on{box-shadow:0 0 0 4px color-mix(in srgb, ${accent} 30%, transparent)}
    .hint{position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:2147483646;background:#111;color:#fff;font-size:12px;padding:6px 10px;border-radius:999px;white-space:nowrap}
    [hidden]{display:none!important}
  </style>
  <div class="box" hidden><span class="tag">Ask about this</span></div>
  <div class="hint" hidden>Tap what should change</div>
  <button class="pill" hidden type="button" aria-label="Ask for a change">Ask</button>
  <div class="pop" role="dialog" aria-label="Ask for a change" hidden>
    <h3>What should change here?</h3>
    <p class="ctx"></p>
    <textarea placeholder="Say it plainly. One thing at a time." maxlength="1000" aria-label="What should change"></textarea>
    <div class="row"><button type="button" class="cancel">Cancel</button><button type="button" class="send">Send</button></div>
    <p class="msg" aria-live="polite"></p>
    <p class="by">Powered by <a href="https://everyones.lol/for-your-site" target="_blank" rel="noopener noreferrer">everyones.lol</a></p>
  </div>`;

  const $ = (s) => root.querySelector(s);
  const box = $(".box");
  const pop = $(".pop");
  const pill = $(".pill");
  const hint = $(".hint");
  const ta = $("textarea");
  const msg = $(".msg");
  const ctx = $(".ctx");
  const sendBtn = $(".send");

  let armed = false;
  let locked = false; // pill mode: stays armed until a pick or Escape
  let target = null;
  let picked = null;

  const ours = (node) => node === host || (node && node.getRootNode && node.getRootNode() === root);

  function cssPath(el) {
    const parts = [];
    let e = el;
    while (e && e.nodeType === 1 && parts.length < 6) {
      if (e.id && /^[A-Za-z][\w-]*$/.test(e.id)) {
        parts.unshift("#" + e.id);
        break;
      }
      let s = e.tagName.toLowerCase();
      const p = e.parentElement;
      if (p) {
        const same = Array.from(p.children).filter((c) => c.tagName === e.tagName);
        if (same.length > 1) s += ":nth-of-type(" + (same.indexOf(e) + 1) + ")";
      }
      parts.unshift(s);
      e = p;
    }
    return parts.join(" > ").slice(0, 400);
  }

  function place(el) {
    const r = el.getBoundingClientRect();
    box.style.top = r.top - 3 + "px";
    box.style.left = r.left - 3 + "px";
    box.style.width = r.width + 6 + "px";
    box.style.height = r.height + 6 + "px";
    box.hidden = false;
  }

  function setArmed(v) {
    armed = v;
    document.documentElement.style.cursor = v ? "crosshair" : "";
    if (!v) {
      box.hidden = true;
      target = null;
    }
  }

  function disarm() {
    setArmed(false);
    locked = false;
    pill.classList.remove("on");
    hint.hidden = true;
  }

  function under(x, y) {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      if (ours(el)) continue;
      if (el === document.documentElement) return document.body;
      return el;
    }
    return null;
  }

  function textOf(el, max) {
    const t = (el.innerText || el.getAttribute("alt") || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
    return (t || el.tagName.toLowerCase()).slice(0, max);
  }

  function openPop(el) {
    picked = el;
    disarm();
    ctx.textContent = textOf(el, 120);
    ta.value = "";
    msg.textContent = "";
    msg.classList.remove("bad");
    sendBtn.disabled = false;
    pop.hidden = false;
    const r = el.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    let top = r.bottom + 8;
    if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 8);
    const left = Math.min(Math.max(8, r.left), Math.max(8, innerWidth - w - 8));
    pop.style.top = top + "px";
    pop.style.left = left + "px";
    place(el);
    ta.focus();
  }

  function closePop() {
    pop.hidden = true;
    box.hidden = true;
    picked = null;
  }

  async function send() {
    const note = ta.value.trim();
    if (note.length < 2) {
      ta.focus();
      return;
    }
    const el = picked;
    if (!el) return;
    sendBtn.disabled = true;
    msg.textContent = "Sending…";
    msg.classList.remove("bad");
    const body = {
      key,
      url: location.href,
      title: document.title.slice(0, 200),
      selector: cssPath(el),
      elementText: textOf(el, 300),
      html: el.outerHTML.slice(0, 2000),
      note,
      viewport: innerWidth + "x" + innerHeight,
    };
    try {
      const res = await fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "error " + res.status);
      msg.textContent = "Sent. Thank you.";
      setTimeout(closePop, 1400);
    } catch (e) {
      msg.textContent = "Couldn't send: " + (e && e.message ? e.message : "network");
      msg.classList.add("bad");
      sendBtn.disabled = false;
    }
  }

  const chord = (e) => e.shiftKey && (e.metaKey || e.ctrlKey);

  addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") {
        if (!pop.hidden) closePop();
        else if (armed) disarm();
        return;
      }
      if (pop.hidden && !armed && chord(e)) setArmed(true);
    },
    true,
  );
  addEventListener("keyup", (e) => {
    if (armed && !locked && !chord(e)) setArmed(false);
  }, true);
  addEventListener("blur", () => {
    if (!locked) setArmed(false);
  });
  addEventListener(
    "mousemove",
    (e) => {
      if (!armed) return;
      const el = under(e.clientX, e.clientY);
      if (el && el !== target) {
        target = el;
        place(el);
      }
    },
    true,
  );
  addEventListener(
    "click",
    (e) => {
      if (ours(e.composedPath()[0])) return;
      if (!armed) {
        if (!pop.hidden) closePop();
        return;
      }
      const el = under(e.clientX, e.clientY);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      openPop(el);
    },
    true,
  );

  $(".cancel").addEventListener("click", closePop);
  sendBtn.addEventListener("click", send);
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
  });
  pill.addEventListener("click", () => {
    if (armed) {
      disarm();
      return;
    }
    closePop();
    locked = true;
    setArmed(true);
    pill.classList.add("on");
    hint.hidden = false;
  });
  if (coarse) pill.hidden = false;

  const mount = () => document.body.appendChild(host);
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount, { once: true });
})();
