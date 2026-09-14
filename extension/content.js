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
function ensureIndicator() {
  if (!document.body) return null;
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
    document.body.appendChild(el);
  }
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

// ---- ログイン後の最初の画面（生徒選択画面）で出す確認ポップアップ ----
// 右下の小さな「📡 記録中」だけでは気づきにくいため、記録が動いていることを
// 画面の真ん中で大きく知らせる。タブごとに1回だけ出し、OKを押すまで消えない。
const POPUP_SHOWN_KEY = "smm-start-popup-shown";

// ログイン画面かどうか（パスワード入力欄があるうちはログイン画面とみなす）。
// ログイン画面ではポップアップを出さず、次の画面に移ってから出す
function isLoginScreen() {
  return !!document.querySelector('input[type="password"]');
}

function showStartPopup() {
  if (document.getElementById("smm-start-popup")) return;

  const overlay = document.createElement("div");
  overlay.id = "smm-start-popup";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;display:flex;" +
    "align-items:center;justify-content:center;padding:16px;" +
    "background:rgba(0,0,0,.45);font:400 16px/1.6 sans-serif;";

  const card = document.createElement("div");
  card.style.cssText =
    "background:#fff;border-radius:16px;padding:28px 24px;max-width:420px;width:100%;" +
    "box-shadow:0 8px 32px rgba(0,0,0,.35);text-align:center;color:#18181b;";

  const title = document.createElement("div");
  title.textContent = "📡 学習記録ブリッジ ON";
  title.style.cssText = "font-size:22px;font-weight:700;color:#059669;margin-bottom:12px;";

  const body = document.createElement("div");
  body.textContent = "学習の開始と結果は、支援教材管理アプリへ自動で記録されます。";
  body.style.cssText = "font-size:16px;color:#3f3f46;margin-bottom:22px;";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "OK";
  // タブレットで押しやすいように大きめのボタンにする
  btn.style.cssText =
    "width:100%;padding:14px 20px;border:0;border-radius:12px;cursor:pointer;" +
    "background:#059669;color:#fff;font-size:18px;font-weight:700;";
  btn.addEventListener("click", () => overlay.remove());

  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(btn);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  log("開始ポップアップを表示しました");
}

function maybeShowStartPopup() {
  if (!document.body) return;
  try {
    if (sessionStorage.getItem(POPUP_SHOWN_KEY)) return;
  } catch {
    // sessionStorageが使えない環境では毎回の表示を避けるため何もしない
    return;
  }
  if (isLoginScreen()) return;
  try {
    sessionStorage.setItem(POPUP_SHOWN_KEY, "1");
  } catch {
    return;
  }
  showStartPopup();
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
    // ログイン画面から生徒選択画面に移るのもこのタイミング
    setTimeout(maybeShowStartPopup, 400);
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

// 初回
ensureIndicator();
setTimeout(handleAll, 500);
// ログインでページごと読み込み直される作りでも出るように、初回も確認する。
// 読み込み途中だとログイン欄がまだ無く、ログイン画面で誤って出てしまうため、
// 少し待ってから2回続けて「ログイン画面ではない」ことを確かめる
setTimeout(() => {
  if (isLoginScreen()) return;
  setTimeout(() => {
    if (!isLoginScreen()) maybeShowStartPopup();
  }, 1200);
}, 1500);
log("起動しました。URL:", location.href);
