// バックグラウンド（Service Worker）。
// content.js から受け取ったデータを、自作アプリの受信APIへPOSTする。
//
// 送信に失敗したデータは端末内（chrome.storage.local）に貯めておき、
// あとから自動で再送する。2026-09-15 に、キー不一致で丸一日ぶんの記録が
// 失われた事故があったため、取りこぼさない作りにしている。
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

/** 未送信データの保存キー */
const QUEUE_KEY = "smm_pending";
/** 貯めておく上限件数（古いものから捨てる） */
const MAX_QUEUE = 300;
/** これより古い未送信データは諦めて捨てる */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** 再送を試みる間隔 */
const RETRY_INTERVAL_MS = 20000;
/** 1回の再送処理で、連続何件失敗したら打ち切るか */
const MAX_CONSECUTIVE_FAIL = 3;

function log(...a) {
  console.log("[学習記録ブリッジ]", ...a);
}

/* ------------------------------------------------------------------ */
/* 未送信キュー                                                        */
/* ------------------------------------------------------------------ */

async function loadQueue() {
  try {
    const o = await chrome.storage.local.get(QUEUE_KEY);
    return Array.isArray(o[QUEUE_KEY]) ? o[QUEUE_KEY] : [];
  } catch (e) {
    console.warn("[学習記録ブリッジ] キューの読み込みに失敗", e);
    return [];
  }
}

async function saveQueue(q) {
  try {
    await chrome.storage.local.set({ [QUEUE_KEY]: q.slice(-MAX_QUEUE) });
  } catch (e) {
    console.warn("[学習記録ブリッジ] キューの保存に失敗", e);
  }
}

async function pendingCount() {
  return (await loadQueue()).length;
}

async function enqueue(path, data) {
  const q = await loadQueue();
  q.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    path,
    data,
    at: Date.now(),
    tries: 0,
  });
  await saveQueue(q);
  log("未送信として保存しました。未送信", Math.min(q.length, MAX_QUEUE), "件");
}

/**
 * 再送しても直らない失敗かどうか。
 * 400番台のうち「中身が悪い」ものは何度送っても同じなので捨てる。
 * 401/403 は鍵や設定を直せば通るようになるため、あえて残して再送する。
 */
function isPermanentFailure(status) {
  return status === 400 || status === 404 || status === 413 || status === 422;
}

/* ------------------------------------------------------------------ */
/* 送信                                                                */
/* ------------------------------------------------------------------ */

async function postOnce(path, data) {
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
    log("POST", path, res.status, json);
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    console.warn("[学習記録ブリッジ] POST失敗", path, e);
    return { ok: false, error: String(e) };
  }
}

let flushing = false;
let lastFlushAt = 0;

/** 溜まっている未送信データを順に送る */
async function flush(force) {
  const now = Date.now();
  if (flushing) return;
  if (!force && now - lastFlushAt < RETRY_INTERVAL_MS) return;
  flushing = true;
  lastFlushAt = now;
  try {
    const q = (await loadQueue()).filter((it) => now - it.at < MAX_AGE_MS);
    if (q.length === 0) {
      await saveQueue([]);
      return;
    }
    log("再送を試みます。未送信", q.length, "件");

    const keep = [];
    let consecutiveFail = 0;
    for (let i = 0; i < q.length; i++) {
      // 続けて失敗するなら今は繋がっていないと判断し、残りは次回に回す
      if (consecutiveFail >= MAX_CONSECUTIVE_FAIL) {
        keep.push(...q.slice(i));
        break;
      }
      const item = q[i];
      const r = await postOnce(item.path, item.data);
      if (r.ok) {
        consecutiveFail = 0;
        continue; // 成功したのでキューから外す
      }
      if (r.status && isPermanentFailure(r.status)) {
        console.warn("[学習記録ブリッジ] 再送しても直らないため破棄", item, r);
        consecutiveFail = 0;
        continue;
      }
      item.tries += 1;
      consecutiveFail += 1;
      keep.push(item);
    }
    await saveQueue(keep);
    if (keep.length === 0) log("未送信はすべて送信できました");
    else log("まだ未送信が", keep.length, "件あります");
  } finally {
    flushing = false;
  }
}

/** 送る。失敗したらキューに積む。 */
async function sendOrQueue(path, data) {
  const r = await postOnce(path, data);
  if (r.ok) {
    // 送れる状態なら、溜まっていたぶんもこの機会に流す
    flush(true);
    return { ...r, pending: await pendingCount() };
  }
  if (r.status && isPermanentFailure(r.status)) {
    console.warn("[学習記録ブリッジ] 内容の問題のため再送しません", data, r);
    return { ...r, dropped: true, pending: await pendingCount() };
  }
  await enqueue(path, data);
  return { ...r, queued: true, pending: await pendingCount() };
}

/* ------------------------------------------------------------------ */
/* content.js とのやりとり                                             */
/* ------------------------------------------------------------------ */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "study/start") {
    sendOrQueue("/api/study/start", msg.payload).then(sendResponse);
    return true; // 非同期レスポンス
  }
  if (msg && msg.type === "study/finish") {
    sendOrQueue("/api/study/finish", msg.payload).then(sendResponse);
    return true;
  }
  // 画面のバッジ用。問い合わせのついでに再送も試みる（定期実行の代わり）
  if (msg && msg.type === "study/status") {
    flush();
    pendingCount().then((pending) => sendResponse({ pending }));
    return true;
  }
});

// Service Worker が起きたタイミングでも再送を試みる
flush(true);
