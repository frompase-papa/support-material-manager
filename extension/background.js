// バックグラウンド（Service Worker）。
// content.js から受け取ったデータを、自作アプリの受信APIへPOSTする。
//
// ▼▼▼ 設定：ここを自分の環境に合わせて編集してください ▼▼▼
const API_BASE = "https://support-material-manager.vercel.app";
const API_KEY = "CHANGE_ME_SHARED_KEY"; // Vercelの環境変数 STUDY_API_KEY と同じ値にする
// ▲▲▲ 設定ここまで ▲▲▲

async function post(path, data) {
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
