// brain-program のページ内で動作し、学習の「開始」と「結果」を検知して
// バックグラウンド経由で自作アプリへ送信する。
//
// このサイトは SPA（画面遷移してもページ再読込されない）なので、
// URL変化と DOM変化の両方を監視する。
//
// ★ 実データに合わせて調整する箇所は下の CONFIG にまとめてあります。

const CONFIG = {
  // 結果画面と判定するURLパターン（どれかに一致すれば結果画面）
  resultUrlPattern: /V030002M|V030004E|V030000/i,
  // 問題（学習開始）画面と判定するURLパターン
  startUrlPattern: /V0305\d{2}/i,
  // デバッグログを出す
  debug: true,
};

function log(...a) {
  if (CONFIG.debug) console.log("[学習記録ブリッジ]", ...a);
}

// 画面すみの「記録中」表示（拡張が動いているか一目で分かるように）
// 全画面（フルスクリーン）中は、フルスクリーン要素の中に入れないと隠れるので、
// 表示先を fullscreenElement に切り替える。
function ensureIndicator() {
  const target =
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.body;
  if (!target) return null;
  let el = document.getElementById("smm-rec-indicator");
  if (!el) {
    el = document.createElement("div");
    el.id = "smm-rec-indicator";
    el.style.cssText =
      "position:fixed;bottom:8px;right:8px;z-index:2147483647;" +
      "background:rgba(16,185,129,.92);color:#fff;font:600 12px/1.4 sans-serif;" +
      "padding:4px 10px;border-radius:9999px;box-shadow:0 1px 4px rgba(0,0,0,.3);" +
      "pointer-events:none;user-select:none;";
    el.textContent = "📡 記録中";
  }
  if (el.parentElement !== target) target.appendChild(el);
  return el;
}

function flashIndicator(msg, ok) {
  const el = ensureIndicator();
  if (!el) return;
  el.textContent = msg;
  el.style.background = ok
    ? "rgba(37,99,235,.95)" // 青：送信
    : "rgba(220,38,38,.95)"; // 赤：失敗
  clearTimeout(el.__t);
  el.__t = setTimeout(() => {
    el.textContent = "📡 記録中";
    el.style.background = "rgba(16,185,129,.92)";
  }, 2800);
}

function getParams() {
  const p = new URLSearchParams(location.search);
  return {
    studentId: p.get("studentId") || "",
    roomId: p.get("roomId") || "",
    categoryId: p.get("categoryId") || "",
    trainingId: p.get("trainingId") || "",
  };
}

function textOf(el) {
  return (el.textContent || "").replace(/\s+/g, " ").trim();
}

function allLabelTexts() {
  return [...document.querySelectorAll("label")]
    .map(textOf)
    .filter(Boolean);
}

// ---- 結果画面からの抽出 ----
function extractResult() {
  const labels = allLabelTexts();
  const joined = labels.join(" | ");
  const params = getParams();

  // 点数（例：「181ポイント」）— 累計(8866)などと混同しないよう "○○ポイント" 単体を拾う
  let score = null;
  for (const t of labels) {
    const m = t.match(/^(\d+)\s*ポイント$/);
    if (m) {
      score = m[1];
      break;
    }
  }
  const pick = (re) => {
    for (const t of labels) {
      const m = t.match(re);
      if (m) return m[1];
    }
    return null;
  };
  const average = pick(/平均点\s*(\d+)/);
  const max = pick(/最高点\s*(\d+)/);

  // 累計：「累計」ラベルの近くにある数字
  let cumulative = null;
  const idx = labels.findIndex((t) => /累計/.test(t));
  if (idx >= 0) {
    for (let i = idx; i < labels.length && i < idx + 6; i++) {
      const m = labels[i].match(/^(\d{2,})$/);
      if (m) {
        cumulative = m[1];
        break;
      }
    }
  }

  // タイトル
  let title = null;
  const tEl = document.querySelector('[height="blackBoardTitle"] label');
  if (tEl) title = textOf(tEl);
  if (!title && params.categoryId)
    title = `カテゴリ${params.categoryId}-${params.trainingId}`;

  // 生徒名（「○○さん」）
  let studentName = labels.find((t) => /さん$/.test(t)) || null;
  if (studentName) studentName = studentName.replace(/さん$/, "").trim();

  // 実施日（「8 月 5 日」→「8月5日」）
  let date = null;
  const dm = joined.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (dm) date = `${dm[1]}月${dm[2]}日`;

  return {
    studentId: params.studentId,
    roomId: params.roomId,
    studentName,
    title,
    score,
    average,
    max,
    cumulative,
    date,
  };
}

let lastStartSig = "";
let lastFinishSig = "";

function handleStart() {
  if (!CONFIG.startUrlPattern.test(location.href)) return;
  const params = getParams();
  if (!params.studentId) return;
  const title = params.categoryId
    ? `カテゴリ${params.categoryId}-${params.trainingId}`
    : null;
  const sig = `${params.studentId}|${location.pathname}|${params.categoryId}|${params.trainingId}`;
  if (sig === lastStartSig) return;
  lastStartSig = sig;

  const payload = {
    studentId: params.studentId,
    roomId: params.roomId,
    title,
    startTime: new Date().toISOString(),
  };
  log("開始を送信", payload);
  chrome.runtime.sendMessage({ type: "study/start", payload }, (r) => {
    log("開始の応答", r);
    flashIndicator("▶ 開始を送信", r && r.ok);
  });
}

function handleFinish() {
  const isResult =
    CONFIG.resultUrlPattern.test(location.href) ||
    /(\d+)\s*ポイント/.test(document.body.innerText || "");
  if (!isResult) return;

  const data = extractResult();
  if (!data.score) return; // 得点がまだ描画されていない
  const sig = `${data.studentId}|${data.title}|${data.score}|${data.date}`;
  if (sig === lastFinishSig) return;
  lastFinishSig = sig;

  log("結果を送信", data);
  chrome.runtime.sendMessage({ type: "study/finish", payload: data }, (r) => {
    log("結果の応答", r);
    const label = `${data.title ?? "結果"} ${data.score ?? ""}点`;
    flashIndicator(r && r.ok ? `✓ 送信: ${label}` : "⚠ 送信失敗", r && r.ok);
  });
}

function handleAll() {
  handleStart();
  handleFinish();
}

// URL変化の監視（SPA対応）
let lastUrl = location.href;
setInterval(() => {
  ensureIndicator(); // 消えないように毎回確保
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    log("画面遷移:", location.href);
    // 遷移直後はデータ未描画のことがあるので、少し待って再判定
    setTimeout(handleAll, 300);
  }
}, 700);
window.addEventListener("popstate", () => setTimeout(handleAll, 300));

// DOM変化の監視（結果データは非同期に描画されるため）
let moTimer = null;
const mo = new MutationObserver(() => {
  if (moTimer) clearTimeout(moTimer);
  moTimer = setTimeout(handleAll, 400);
});
mo.observe(document.documentElement, { childList: true, subtree: true });

// 全画面の出入りに追従（表示先を切り替える）
document.addEventListener("fullscreenchange", ensureIndicator);
document.addEventListener("webkitfullscreenchange", ensureIndicator);

// 初回
ensureIndicator();
setTimeout(handleAll, 500);
log("起動しました。URL:", location.href);
