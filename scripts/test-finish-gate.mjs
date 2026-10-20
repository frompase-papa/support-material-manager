// 結果の検知が「1回の学習＝1件」になるかを、実際にスクリプトを動かして確かめる。
//
//   node scripts/test-finish-gate.mjs [検査するファイル]
//
// ここが狂うと、8問やったのに 7件 や 9件 になる。原因は毎回ちがった:
//   ・直前と同じ教材・同じ点数だと送信されない（7件になる）
//   ・結果画面の再描画で一瞬 isResult が false になり、同じ回が2件になる（9件）
//   ・点数の描画途中で読み、不完全な値と確定値で2件になる（9件）
// 画面の状態を切り替えながらタイマーを回し、送られた内容を数える。

import fs from "node:fs";
import vm from "node:vm";

const SRC = process.argv[2] || "public/support-material-bridge.user.js";
const code = fs.readFileSync(SRC, "utf8");

function makeEl(tag) {
  return {
    tagName: tag, id: "", textContent: "", style: { cssText: "" },
    children: [], parentElement: null, attrs: {},
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    removeAttribute(k) { delete this.attrs[k]; },
    appendChild(c) { c.parentElement = this; this.children.push(c); return c; },
    addEventListener() {}, remove() {},
  };
}

/** 結果画面を模したページ。score を null にすると「結果画面ではない」状態になる。 */
function makePage() {
  const state = { score: null, title: "算数", cumulative: 500, name: "テスト太郎" };
  const labels = () => {
    if (state.score === null) return [];
    const mk = (t) => ({ ...makeEl("label"), textContent: t });
    return [
      mk(state.name + "さん"),
      mk(state.score + "ポイント"),
      mk("平均点 50"),
      mk("最高点 80"),
      mk("累計"),
      mk(String(state.cumulative)),
      mk("10 月 20 日"),
    ];
  };
  return { state, labels };
}

function run() {
  const page = makePage();
  const byId = new Map();
  const body = makeEl("body");
  const html = makeEl("html");
  const sent = [];
  const timers = { interval: [], timeout: [], mutate: [] };
  const gm = { "smm-api-key": "k" };

  const doc = {
    body, documentElement: html, fullscreenElement: null, head: makeEl("head"),
    createElement: makeEl,
    getElementById: (id) => byId.get(id) || null,
    querySelector: () => null,
    querySelectorAll: (sel) => (sel === "label" ? page.labels() : []),
    addEventListener() {},
  };
  Object.defineProperty(body, "innerText", {
    get: () => page.labels().map((l) => l.textContent).join(" "),
  });

  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    document: doc,
    location: { hostname: "www.brain-program-001.com", hash: "", href: "https://x/V030004E", search: "" },
    window: { addEventListener() {} },
    setTimeout: (f) => { timers.timeout.push(f); return timers.timeout.length; },
    setInterval: (f) => { timers.interval.push(f); return timers.interval.length; },
    clearTimeout() {}, alert() {},
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    // 実際の判定は DOM変化の監視から呼ばれる。tick のたびに「画面が動いた」ことにする。
    MutationObserver: class {
      constructor(cb) { timers.mutate.push(cb); }
      observe() {}
    },
    URLSearchParams,
    GM_getValue: (k, d) => (k in gm ? gm[k] : d !== undefined ? d : ""),
    GM_setValue: (k, v) => { gm[k] = v; },
    GM_registerMenuCommand() {},
    GM_xmlhttpRequest: (o) => {
      if (/finish/.test(o.url)) sent.push(JSON.parse(o.data));
      o.onload && o.onload({ status: 200, responseText: "{}" });
    },
    // ブックマークレット版は fetch で送るので、そちらも拾う
    fetch: (url, opt) => {
      if (/finish/.test(url) && opt && opt.body) sent.push(JSON.parse(opt.body));
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    },
    localStorage: {
      getItem: (k) => (k in gm ? gm[k] : null),
      setItem: (k, v) => { gm[k] = v; },
      removeItem: (k) => { delete gm[k]; },
    },
  };
  sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const origAppend = body.appendChild.bind(body);
  body.appendChild = (c) => { if (c.id) byId.set(c.id, c); return origAppend(c); };

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  // 起動直後に積まれた処理を流す
  timers.timeout.splice(0).forEach((f) => { try { f(); } catch {} });

  /** 700ms ごとの監視を1回ぶん進める */
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) {
      timers.interval.forEach((f) => { try { f(); } catch {} });
      timers.mutate.forEach((f) => { try { f(); } catch {} });
      // 仕掛けられた遅延処理を流す（流す途中で積まれたぶんも含める）
      for (let k = 0; k < 5 && timers.timeout.length; k++) {
        timers.timeout.splice(0).forEach((f) => { try { f(); } catch {} });
      }
    }
  };
  return { page, sent, tick };
}

const out = [];
const check = (name, ok, detail = "") =>
  out.push(`${ok ? "PASS" : "**FAIL**"}  ${name}${detail ? "  … " + detail : ""}`);

// 1) 同じ結果画面を見続けても1件だけ
{
  const { page, sent, tick } = run();
  page.state.score = 100;
  tick(10);
  check("同じ結果画面を見続けても1件", sent.length === 1, `${sent.length}件`);
}

// 2) 点数が描画途中で変わっても1件（同じ回として扱う）
{
  const { page, sent, tick } = run();
  page.state.score = 0; // 描画途中の不完全な値
  tick(2);
  page.state.score = 181; // 確定値
  tick(5);
  const ids = new Set(sent.map((s) => s.eventId));
  check("描画途中で点数が変わっても1回分", ids.size === 1,
    `${sent.length}件送信 / 種類=${ids.size} / 点数=${sent.map((s) => s.score).join(",")}`);
}

// 3) 一瞬だけ結果画面でなくなっても、同じ回を二重に送らない
{
  const { page, sent, tick } = run();
  page.state.score = 100;
  tick(3);
  page.state.score = null; // 再描画で一瞬消える
  tick(1);
  page.state.score = 100; // すぐ戻る
  tick(5);
  const ids = new Set(sent.map((s) => s.eventId));
  check("一瞬の再描画で二重送信しない", ids.size === 1, `種類=${ids.size} / ${sent.length}件`);
}

// 4) 本当に次の回をやったら、同じ点数でも別件になる
{
  const { page, sent, tick } = run();
  page.state.score = 100;
  tick(3);
  page.state.score = null; // 問題を解いている間（結果画面ではない）
  tick(8);
  page.state.score = 100; // たまたま同じ点数
  page.state.cumulative = 600;
  tick(5);
  const ids = new Set(sent.map((s) => s.eventId));
  check("同じ点数でも次の回は別件として送る", ids.size === 2, `種類=${ids.size} / ${sent.length}件`);
}

// 5) 8回やったら8件
{
  const { page, sent, tick } = run();
  for (let i = 1; i <= 8; i++) {
    page.state.score = 100; // 毎回まったく同じ点数
    page.state.cumulative = 500; // 累計も取れていない想定で固定
    tick(3);
    page.state.score = null;
    tick(8);
  }
  const ids = new Set(sent.map((s) => s.eventId));
  check("8回やったら8件（点数が全部同じでも）", ids.size === 8, `種類=${ids.size} / ${sent.length}件`);
}

console.log(`検査対象: ${SRC}`);
console.log(out.join("\n"));
console.log(out.some((x) => x.includes("FAIL")) ? "\n=== 失敗あり ===" : "\n=== すべて成功 ===");
