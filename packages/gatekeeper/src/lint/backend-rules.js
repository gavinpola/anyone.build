// @ts-check
/**
 * ESLint rules for agent-written backend files (convex/rooms/**). Mirrors validate/backend.js so CI
 * rejects the same things the validator does. Applied by eslint.config.js.
 */
export const backendRules = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          regex: "^(?!(\\.\\./\\.\\./kit/room|convex/values|\\./[a-z0-9-]+)$).*$",
          message: "Room functions may only import from ../../kit/room, convex/values, and sibling files (./name).",
        },
      ],
    },
  ],
  "no-restricted-globals": ["error", "process", "fetch", "globalThis", "self", "window", "Reflect", "Function", "eval", "require", "setTimeout", "setInterval"],
  "no-restricted-syntax": [
    "error",
    { selector: "ImportExpression", message: "dynamic import() is banned in room functions." },
    { selector: "MetaProperty", message: "import.meta is banned in room functions." },
    { selector: "WhileStatement[test.value=true]", message: "unbounded loops are banned in room functions." },
    { selector: "ForStatement[test=null]", message: "unbounded loops are banned in room functions." },
    { selector: "MemberExpression[property.name='constructor']", message: "constructor access is banned in room functions." },
    { selector: "MemberExpression[property.name='__proto__']", message: "__proto__ is banned in room functions." },
    { selector: "MemberExpression[property.name='prototype']", message: "prototype access is banned in room functions." },
    { selector: "ExportDefaultDeclaration", message: "Room functions export only `export const x = roomQuery|roomMutation(...)`." },
    { selector: "ExportNamedDeclaration > FunctionDeclaration", message: "Room functions export only `export const x = roomQuery|roomMutation(...)`." },
    { selector: "ExportNamedDeclaration > ClassDeclaration", message: "Room functions export only `export const x = roomQuery|roomMutation(...)`." },
    { selector: "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[init.callee.name!=/^(roomQuery|roomMutation)$/]", message: "Room functions export only `export const x = roomQuery|roomMutation(...)`." },
    { selector: "Literal[value='use node']", message: "Room functions run in the default runtime only." },
    { selector: "Identifier[name='internal']", message: "internal function references are banned in room functions." },
    { selector: "Identifier[name='scheduler']", message: "scheduling is banned in room functions." },
  ],
};
