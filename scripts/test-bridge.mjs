import fs from "node:fs";
import vm from "node:vm";
const code = fs.readFileSync(process.argv[2], "utf8");

function makeEl(tag) {
  return { tagName: tag, id: "", textContent: "", value: "", type: "", style: { cssText: "" },
    children: [], parentElement: null,
    attrs: {},
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    removeAttribute(k) { delete this.attrs[k]; },
    appendChild(c){ c.parentElement = this; this.children.push(c); return c; },
    addEventListener(){}, remove(){}, };
}
const byId = new Map();
const body = makeEl("body");
const origAppend = body.appendChild.bind(body);
body.appendChild = (c) => { if (c.id) byId.set(c.id, c); return origAppend(c); };
const timers = [];
const store = {};
const sandbox = {
  console: { log(){}, warn(){}, error(){} },
  document: {
    body, documentElement: makeEl("html"), fullscreenElement: null,
    createElement: makeEl, getElementById: (id) => byId.get(id) || null,
    querySelector: () => null, querySelectorAll: () => [], addEventListener(){},
  },
  location: { hostname: "www.brain-program-001.com", hash: "", href: "https://www.brain-program-001.com:3000/", search: "" },
  window: { addEventListener(){} },
  localStorage: { getItem: (k) => store[k] ?? null, setItem(k,v){ store[k]=v; }, removeItem(k){ delete store[k]; } },
  setTimeout: (f) => { timers.push(f); return timers.length; },
  setInterval: (f) => { timers.push(f); return timers.length; },
  clearTimeout(){}, alert(){}, fetch: async () => ({ ok:true, status:200, json: async()=>({}) }),
  MutationObserver: class { observe(){} },
  URLSearchParams,
};
sandbox.self = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);

let error = null;
try {
  vm.runInContext(code, sandbox);
  for (const f of timers.slice(0, 50)) { try { f(); } catch {} }
} catch (e) { error = e; }

const out = [];
const check = (n, ok, x = "") => out.push(`${ok ? "PASS" : "**FAIL**"}  ${n}${x ? "  … " + x : ""}`);

check("例外を投げずに起動する", !error, error ? String(error.message) : "");
const band = byId.get("smm-rec-indicator");
check("上部の帯が作られる", !!band, band ? `「${band.textContent}」` : "作られなかった");
if (band) check("キー未設定の案内が出ている", /APIキー未設定/.test(band.textContent), `「${band.textContent}」`);
const popup = byId.get("smm-start-popup");
check("キー入力のポップアップが出る", !!popup);
check("グローバルに登録される（2回押し対策）", !!sandbox.window.__smmBridge || !!sandbox.__smmBridge);
const err = [...byId.values()].some((e) => /エラー/.test(e.textContent || ""));
check("エラー帯が出ていない", !err);

console.log(out.join("\n"));
console.log(out.some((x) => x.includes("FAIL")) ? "\n=== 失敗あり ===" : "\n=== すべて成功 ===");
