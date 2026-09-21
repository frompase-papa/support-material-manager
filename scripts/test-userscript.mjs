import fs from "node:fs";
import vm from "node:vm";
const SRC = process.argv[2] || "public/support-material-bridge.user.js";
const code = fs.readFileSync(SRC, "utf8");

function makeEl(tag) {
  return {
    tagName: tag, id: "", textContent: "", style: { cssText: "" },
    children: [], parentElement: null,
    appendChild(c) { c.parentElement = this; this.children.push(c); return c; },
    addEventListener() {}, remove() {},
  };
}
function run({ hostname, hash }) {
  const byId = new Map();
  const body = makeEl("body");
  const timers = [];
  const doc = {
    body, documentElement: makeEl("html"), fullscreenElement: null,
    createElement: makeEl,
    getElementById: (id) => byId.get(id) || null,
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {},
  };
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    document: doc,
    location: { hostname, hash, href: `https://${hostname}/${hash}`, search: "" },
    window: { addEventListener() {}, __smm: 1 },
    setTimeout: (f) => { timers.push(f); return timers.length; },
    setInterval: (f) => timers.push(f),
    clearTimeout() {}, alert() {},
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    MutationObserver: class { observe() {} },
    URLSearchParams: URLSearchParams,
    GM_getValue: () => "", GM_setValue() {}, GM_registerMenuCommand() {},
    GM_xmlhttpRequest() {},
  };
  sandbox.self = sandbox; sandbox.globalThis = sandbox;
  // appendChild で id を登録できるようにする
  const origAppend = body.appendChild.bind(body);
  body.appendChild = (c) => { if (c.id) byId.set(c.id, c); return origAppend(c); };
  vm.createContext(sandbox);
  let error = null;
  try { vm.runInContext(code, sandbox); for (const f of timers.slice(0, 50)) { try { f(); } catch {} } } catch (e) { error = e; }
  return { error, byId, body };
}

const out = [];
const check = (n, ok, x = "") => out.push(`${ok ? "PASS" : "**FAIL**"}  ${n}${x ? "  … " + x : ""}`);

// 1) 診断モード：無関係なサイトでも帯が出る／エラーにならない
{
  const r = run({ hostname: "example.com", hash: "#smmtest" });
  check("診断モードが例外を投げない", !r.error, r.error ? String(r.error.message) : "");
  const d = r.byId.get("smm-diag");
  check("診断の帯が作られる", !!d, d ? d.textContent : "作られなかった");
  if (d) {
    check("バージョンが表示される", /v1\.4\.8/.test(d.textContent), d.textContent);
    check("hostが表示される", /example\.com/.test(d.textContent));
    check("記録対象=いいえ と出る", /記録対象=いいえ/.test(d.textContent));
  }
}
// 2) 通常時：無関係なサイトでは何も作らない
{
  const r = run({ hostname: "example.com", hash: "" });
  check("無関係なサイトでは何も描かない", !r.error && r.byId.size === 0, `要素数=${r.byId.size}`);
}
// 3) brain-program では通常動作（帯が出る）
{
  const r = run({ hostname: "www.brain-program-001.com", hash: "" });
  check("brain-programでは例外を投げない", !r.error, r.error ? String(r.error.message) : "");
  const el = r.byId.get("smm-rec-indicator");
  check("記録用の帯が作られる", !!el, el ? el.textContent : "作られなかった");
  if (el) check("キー未設定の案内が出る", /APIキー未設定/.test(el.textContent), el.textContent);
}
// 4) brain-program + 診断モード：記録対象=はい
{
  const r = run({ hostname: "www.brain-program-001.com", hash: "#smmtest" });
  const d = r.byId.get("smm-diag");
  check("brain-programでは 記録対象=はい と出る", !!d && /記録対象=はい/.test(d.textContent), d ? d.textContent : "帯なし");
}

console.log(out.join("\n"));
console.log(out.some((x) => x.includes("FAIL")) ? "\n=== 失敗あり ===" : "\n=== すべて成功 ===");
