// バックグラウンド（Service Worker）。
// content.js から受け取ったデータを、自作アプリの受信APIへPOSTする。
//
// ▼▼▼ 設定は config.js に分離（git管理外。ひな型は config.example.js） ▼▼▼
try {
  importScripts("config.js");
} catch (e) {
  console.error(
    "[学習記録ブリッジ] config.js を読み込めませんでした。" +
      "config.example.js をコピーして config.js を作ってください。",
    e
  );
}
const API_BASE = (self.SMM_CONFIG && self.SMM_CONFIG.API_BASE) || "";
const API_KEY = (self.SMM_CONFIG && self.SMM_CONFIG.API_KEY) || "";
// ▲▲▲ 設定ここまで ▲▲▲

async function post(path, data) {
  if (!API_BASE || !API_KEY) {
    console.error("[学習記録ブリッジ] 設定が未完了です（config.js を確認）");
    return { ok: false, error: "not configured" };
  }
  try {
    const res = await fetch(API_BASE + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    console.log("[学習記録ブリッジ] POST", path, res.status, json);
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    console.warn("[学習記録ブリッジ] POST失敗", path, e);
    return { ok: false, error: String(e) };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "study/start") {
    post("/api/study/start", msg.payload).then(sendResponse);
    return true; // 非同期レスポンス
  }
  if (msg && msg.type === "study/finish") {
    post("/api/study/finish", msg.payload).then(sendResponse);
    return true;
  }
});
