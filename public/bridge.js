// 支援教材 学習記録ブリッジ（ブックマークレット版）
//
// 拡張機能もTampermonkeyも使えない端末のために、ブックマークレットから
// 読み込んで動かす版。中身のやることは拡張機能版と同じ。
//
// 使い方:
//   javascript:(function(){var s=document.createElement('script');
//   s.src='https://support-material-manager.vercel.app/bridge.js?t='+Date.now();
//   document.body.appendChild(s);})();
//
// brain-program はSPA（画面が変わってもページは読み込み直されない）なので、
// ログイン後に1回押せば、そのタブを閉じるまで記録し続ける。
//
// APIキーはこの端末のブラウザ（localStorage）に保存する。
// 初回だけ入力してもらい、次からは入力不要。

(function () {
  "use strict";

  const VERSION = "1.4.0";

  // 二重に押されても、監視を二重に仕掛けない
  if (window.__smmBridge) {
    window.__smmBridge.showPopup();
    return;
  }

  // 拡張機能やユーザースクリプトが既に動いていたら、こちらは動かない。
  // 両方が同じ結果を送ると記録が重複するため（実際に同じ内容が3件並んだ）。
  // 実行環境が分かれていて window を共有しないので、DOM に置いた印で判断する。
  var SMM_OWNER_ATTR = "data-smm-bridge-owner";
  var smmOwner = document.documentElement.getAttribute(SMM_OWNER_ATTR);
  if (smmOwner) {
    var note = document.createElement("div");
    note.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#2563eb;" +
      "color:#fff;font:700 13px/1.6 sans-serif;padding:8px;text-align:center;";
    note.textContent = "既に " + smmOwner + " が記録しています（押す必要はありません）";
    (document.fullscreenElement || document.body).appendChild(note);
    setTimeout(function () {
      note.remove();
    }, 4000);
    return;
  }
  document.documentElement.setAttribute(SMM_OWNER_ATTR, "ブックマークレット");

  const CONFIG = {
    apiBase: "https://support-material-manager.vercel.app",
    // 結果画面と判定するURLパターン（どれかに一致すれば結果画面）
    resultUrlPattern: /V030002M|V030004E|V030000/i,
    // 問題（学習開始）画面と判定するURLパターン
    startUrlPattern: /V0305\d{2}/i,
    debug: true,
  };

  function log(...a) {
    if (CONFIG.debug) console.log("[学習記録ブリッジ]", ...a);
  }

  // ---- APIキー（この端末に保存。初回だけ入力してもらう） ----
  const KEY_STORE = "smm-api-key";

  function storedKey() {
    try {
      return localStorage.getItem(KEY_STORE) || "";
    } catch {
      return "";
    }
  }

  // キーの入力は prompt() を使わない。
  // Android のブラウザでは prompt が抑制されることがあり、そこで処理が
  // 止まると画面に何も出ないまま動かなくなるため、ポップアップ内の
  // 入力欄で受け取る
  function saveKey(k) {
    try {
      localStorage.setItem(KEY_STORE, k);
    } catch {
      // 保存できない設定のときは、このタブを閉じるまで有効
    }
  }

  let apiKey = storedKey();

  // ---- 送信（APIはCORSを許可しているので、ページから直接送れる） ----
  function post(path, data) {
    if (!apiKey) {
      log("APIキーが未設定のため送信しません");
      return Promise.resolve({ ok: false });
    }
    return fetch(CONFIG.apiBase + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(data),
    })
      .then((res) => {
        log("POST", path, res.status);
        return { ok: res.ok, status: res.status };
      })
      .catch((e) => {
        log("POST失敗", path, e);
        return { ok: false };
      });
  }

  // ---- 画面上部の「記録中」の帯 ----
  // 全画面表示の最中は、全画面になっている要素の中に入れないと画面に出てこない。
  // brain-program を全画面で使っていると、帯もポップアップも作られているのに
  // 何も見えない状態になる。
  function uiRoot() {
    return (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.body
    );
  }

  function ensureIndicator() {
    const root = uiRoot();
    if (!root) return null;
    let el = document.getElementById("smm-rec-indicator");
    if (!el) {
      el = document.createElement("div");
      el.id = "smm-rec-indicator";
      // 右下だとサイト側のボタンに隠れることがあるため、上部の帯にする
      el.style.cssText =
        "position:fixed;top:0;left:0;right:0;z-index:2147483647;" +
        "color:#fff;font:700 14px/2.2 sans-serif;text-align:center;" +
        "box-shadow:0 1px 6px rgba(0,0,0,.35);pointer-events:none;user-select:none;";
    }
    // 全画面の出入りで置き場所が変わるので、毎回いまの置き場所へ付け替える
    if (el.parentElement !== root) root.appendChild(el);
    if (!el.__t) {
      el.textContent = apiKey
        ? "📡 記録中 v" + VERSION
        : "⚠ APIキー未設定 － ここを押して入力";
      el.style.background = apiKey ? "rgba(16,185,129,.95)" : "rgba(217,119,6,.95)";
    }
    // キーが未設定のあいだは、帯そのものを入力欄への入口にする。
    // ポップアップを閉じてしまっても、画面に見えているものを押せば戻れる。
    el.style.pointerEvents = apiKey ? "none" : "auto";
    el.style.cursor = apiKey ? "" : "pointer";
    if (!el.__bound) {
      el.__bound = true;
      el.addEventListener("click", () => {
        if (!apiKey) showPopup();
      });
    }
    return el;
  }

  function flashIndicator(msg, ok) {
    const el = ensureIndicator();
    if (!el) return;
    el.textContent = msg;
    el.style.background = ok ? "rgba(37,99,235,.95)" : "rgba(220,38,38,.95)";
    clearTimeout(el.__t);
    el.__t = setTimeout(() => {
      el.__t = null;
      ensureIndicator();
    }, 2800);
  }

  // ---- 押したときに出す確認ポップアップ ----
  function showPopup() {
    const old = document.getElementById("smm-start-popup");
    if (old) old.remove();

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

    const ready = !!apiKey;
    const title = document.createElement("div");
    title.textContent = ready ? "📡 学習記録ブリッジ ON" : "⚠ APIキーが未設定です";
    title.style.cssText =
      "font-size:22px;font-weight:700;margin-bottom:12px;color:" +
      (ready ? "#059669" : "#d97706") + ";";

    const body = document.createElement("div");
    body.textContent = ready
      ? "このタブを閉じるまで、学習の開始と結果を自動で記録します。"
      : "このままでは記録されません。下のボタンからAPIキーを入力してください。";
    body.style.cssText = "font-size:16px;color:#3f3f46;margin-bottom:22px;";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "OK";
    // タブレットで押しやすいように大きめのボタンにする
    btn.style.cssText =
      "width:100%;padding:14px 20px;border:0;border-radius:12px;cursor:pointer;" +
      "background:" + (ready ? "#059669" : "#d97706") + ";color:#fff;font-size:18px;font-weight:700;";
    btn.addEventListener("click", () => overlay.remove());

    // APIキーの入力欄（キーが未設定のときは最初から開いておく）
    const keyBox = document.createElement("div");
    keyBox.style.cssText = "margin-top:10px;" + (ready ? "display:none;" : "");

    const keyInput = document.createElement("input");
    keyInput.type = "text";
    keyInput.value = apiKey;
    keyInput.placeholder = "APIキーを貼り付け";
    keyInput.autocapitalize = "off";
    keyInput.spellcheck = false;
    keyInput.style.cssText =
      "width:100%;padding:12px;border:1px solid #d4d4d8;border-radius:10px;" +
      "font-size:15px;color:#18181b;background:#fff;";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "APIキーを保存";
    saveBtn.style.cssText =
      "width:100%;margin-top:8px;padding:12px 20px;border:0;border-radius:10px;" +
      "cursor:pointer;background:#3f3f46;color:#fff;font-size:15px;font-weight:700;";
    saveBtn.addEventListener("click", () => {
      apiKey = keyInput.value.trim();
      saveKey(apiKey);
      overlay.remove();
      ensureIndicator();
      showPopup();
    });

    keyBox.appendChild(keyInput);
    keyBox.appendChild(saveBtn);

    const keyBtn = document.createElement("button");
    keyBtn.type = "button";
    keyBtn.textContent = "APIキーを変更する";
    keyBtn.style.cssText =
      "width:100%;margin-top:10px;padding:10px 20px;border:1px solid #d4d4d8;" +
      "border-radius:12px;cursor:pointer;background:#fff;color:#52525b;font-size:14px;" +
      (ready ? "" : "display:none;");
    keyBtn.addEventListener("click", () => {
      keyBox.style.display = "";
      keyBtn.style.display = "none";
    });

    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(btn);
    card.appendChild(keyBox);
    card.appendChild(keyBtn);
    overlay.appendChild(card);
    (uiRoot() || document.body).appendChild(overlay);
  }

  // ---- ページからの読み取り ----
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
    return [...document.querySelectorAll("label")].map(textOf).filter(Boolean);
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
    if (!title && params.categoryId) title = `カテゴリ${params.categoryId}-${params.trainingId}`;

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
    post("/api/study/start", payload).then((r) => {
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
    post("/api/study/finish", data).then((r) => {
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

  window.__smmBridge = { version: VERSION, showPopup };

  // 途中でエラーが出ると「押しても何も出ない」ことになり、原因が分からない。
  // 画面に赤い帯で出して、気づけるようにする
  function showError(msg) {
    try {
      const e = document.createElement("div");
      e.style.cssText =
        "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#dc2626;" +
        "color:#fff;font:700 13px/1.6 sans-serif;padding:8px;text-align:center;";
      e.textContent = "学習記録ブリッジのエラー: " + msg;
      document.body.appendChild(e);
    } catch {
      // ここで失敗したら打つ手がない
    }
  }

  // 押した直後に「動き始めた」ことを知らせる
  try {
    ensureIndicator();
    showPopup();
    setTimeout(handleAll, 500);
  } catch (e) {
    showError(String((e && e.message) || e));
  }

  log("起動しました v" + VERSION, location.href);
})();
