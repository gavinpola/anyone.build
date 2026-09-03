// ESLint rules applied ONLY to src/rooms/** (the agent-editable surface).
// Plain JS so eslint.config.js can import it without a build step.
// Anything that could exfiltrate data, load remote code, phish, or track visitors is banned.
// The same list is mirrored by packages/gatekeeper/src/validate/forbidden.ts for the
// text-level pre-check that runs before lint.

const bannedGlobals = [
  "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "navigator", "localStorage",
  "sessionStorage", "indexedDB", "caches", "eval", "Function", "importScripts", "open",
  "postMessage", "crypto", "Worker", "SharedWorker", "ServiceWorker",
  // browser globals as a whole: refs are enough for a block
  "window", "document", "location", "top", "parent", "opener", "frames", "history", "globalThis", "self", "screen", "frameElement",
  "setTimeout", "setInterval", "requestAnimationFrame", "queueMicrotask", "URL", "URLSearchParams",
];

export const roomRules = {
  "no-restricted-globals": ["error", ...bannedGlobals.map((name) => ({
    name,
    message: `"${name}" is not allowed in rooms. Use the kit (useStore, useViewer, SafeLink) instead.`,
  }))],
  // Allowlist, not denylist: anything that isn't react, @/kit, motion/react, lucide-react, or a
  // sibling `./name` is rejected (that includes `@/kit/../core` and every `..` path).
  "no-restricted-imports": ["error", {
    patterns: [
      { group: ["*", "**", "!react", "!react/jsx-runtime", "!@/kit", "!motion/react", "!lucide-react", "!./*"],
        message: "Rooms may only import from react, @/kit, motion/react, lucide-react, and sibling files (./name)." },
      { group: ["./*/*", "./*/**", "../*", "../**", "**/../**", "**/.."], message: "Only sibling files (./name) may be imported." },
    ],
  }],
  "no-restricted-syntax": ["error",
    { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "dangerouslySetInnerHTML is banned in rooms." },
    { selector: "JSXOpeningElement[name.name='script']", message: "<script> is banned in rooms." },
    { selector: "JSXOpeningElement[name.name='iframe']", message: "<iframe> is banned in rooms." },
    { selector: "JSXOpeningElement[name.name='object']", message: "<object> is banned in rooms." },
    { selector: "JSXOpeningElement[name.name='embed']", message: "<embed> is banned in rooms." },
    { selector: "JSXOpeningElement[name.name='link']", message: "<link> is banned in rooms." },
    { selector: "JSXOpeningElement[name.name='meta']", message: "<meta> is banned in rooms." },
    { selector: "JSXOpeningElement[name.name='base']", message: "<base> is banned in rooms." },
    { selector: "JSXOpeningElement[name.name='form'] JSXAttribute[name.name='action']", message: "<form action> is banned; handle submit in React." },
    { selector: "JSXOpeningElement[name.name='a']", message: "Raw <a> is banned in rooms. Use <SafeLink> from @/kit (allowlisted domains only)." },
    { selector: "JSXOpeningElement[name.name='img']", message: "<img> is banned in rooms for now (no external images). Draw with CSS/SVG or use kit assets." },
    { selector: "JSXOpeningElement[name.name='video']", message: "<video> is banned in rooms." },
    { selector: "JSXOpeningElement[name.name='audio']", message: "<audio> is banned in rooms." },
    { selector: "JSXOpeningElement[name.name='source']", message: "<source> is banned in rooms." },
    { selector: "JSXOpeningElement[name.name='input'] JSXAttribute[name.name='type'][value.value='file']", message: "File inputs are banned in rooms." },
    { selector: "JSXOpeningElement[name.name='input'] JSXAttribute[name.name='type'][value.value='password']", message: "Password fields are banned in rooms." },
    { selector: "ImportExpression", message: "Dynamic import() is banned in rooms." },
    { selector: "MemberExpression[object.name='document'][property.name='cookie']", message: "document.cookie is banned in rooms." },
    { selector: "MemberExpression[object.name='window'][property.name=/^(location|open|fetch|localStorage|sessionStorage|indexedDB|navigator|postMessage|crypto|Worker)$/]", message: "That window API is banned in rooms." },
    { selector: "MemberExpression[property.name=/^(innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|srcdoc|outerText)$/]", message: "HTML injection sinks are banned in rooms." },
    { selector: "MemberExpression[computed=true][object.name=/^(window|document|globalThis|self|top|parent)$/]", message: "Computed access to browser globals is banned in rooms." },
    { selector: "TemplateLiteral > TemplateElement[value.raw=/https?:\\/\\//]", message: "URLs in template literals are banned in rooms. Use <SafeLink>." },
    { selector: "Literal[value=/^https?:\\/\\//]", message: "URL literals are banned in rooms. Use <SafeLink> with an allowlisted domain." },
    { selector: "JSXAttribute[name.name='style'] Literal[value=/url\\(/]", message: "CSS url() is banned in rooms." },
    { selector: "JSXAttribute[name.name='src']", message: "src attributes are banned in rooms." },
    { selector: "JSXAttribute[name.name='href']", message: "href attributes are banned in rooms. Use <SafeLink>." },
    { selector: "JSXAttribute[name.name='formAction']", message: "formAction is banned in rooms." },
    { selector: "JSXAttribute[name.name=/^on[A-Z]/] > Literal", message: "String event handlers are banned in rooms." },
  ],
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
  "no-script-url": "error",
};
