// ==UserScript==
// @name         支援教材 学習記録ブリッジ
// @namespace    support-material-manager
// @version      1.4.8
// @description  brain-program の学習開始・結果を支援教材管理アプリへ自動送信します（拡張機能版と同じ動き）。
// @author       支援教材管理アプリ
// @match        *://*/*
// @include      *
// @connect      support-material-manager.vercel.app
// @updateURL    https://support-material-manager.vercel.app/support-material-bridge.user.js
// @downloadURL  https://support-material-manager.vercel.app/support-material-bridge.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

// ★ 上のメタデータブロック（==UserScript== 〜 ==/UserScript==）の中には、
//    「// @項目 値」の行だけを書くこと。説明文を混ぜてはいけない。
//    特に「// @match は〜」のように書くと、Tampermonkey が壊れた @match として
//    読み込み、対象ページの判定が働かなくなる（実際にそれで動かなくなった）。
//    説明は必ずこの位置（ブロックの外）に書く。
//
// 対象は全サイトにしてあるが、実際に動くのは brain-program のページだけで、
// それ以外のサイトでは最初の1行で何もせず終了する。
// @match は Chrome 由来の書式で、ホスト名の部分にポート番号を持てない。
// brain-program は :3000 で動いているため @match だけでは取りこぼす。
// @include はポートを含めて素直に一致するので、両方を並べている。
//
// 拡張機能版（extension/）を1ファイルにまとめたもの。
// Chrome拡張が入れられない端末（Misesなど）で、Tampermonkeyから同じことをする。
//
// このファイルは公開URLに置くため、APIキーは書き込んでいない。
// 初回に1回だけ入力してもらい、Tampermonkeyの中に保存する。
// （キーを書いたまま公開すると、誰でもアプリにデータを送れてしまうため）

(function () {
  "use strict";

  // ここと @version は必ず揃える。Tampermonkey は @version を見て自動更新するため、
  // 揃っていないと「画面には新しい番号が出るのに更新が配られない」状態になる。
  const VERSION = "1.4.8";

  // ---- 動作確認モード ----
  // URLの末尾に #smmtest を付けて開くと、どのサイトでも青い帯を出す。
  // 「Tampermonkeyがスクリプトを注入できているか」だけを、全画面表示や
  // サイト側の作りに邪魔されない普通のページで確かめるためのもの。
  // 例: https://example.com/#smmtest
  const DIAG = /smmtest/i.test(location.hash);
  const IS_TARGET = /brain-program/i.test(location.hostname);

  // brain-program 以外のサイトでは何もしない（全サイト対象にしているため）
  if (!IS_TARGET && !DIAG) return;

  if (DIAG) showDiagBanner();
  if (!IS_TARGET) return;

  function showDiagBanner() {
    const draw = () => {
      const root = document.fullscreenElement || document.body;
      if (!root) return setTimeout(draw, 300);
      let d = document.getElementById("smm-diag");
      if (!d) {
        d = document.createElement("div");
        d.id = "smm-diag";
        d.style.cssText =
          "position:fixed;top:0;left:0;right:0;z-index:2147483647;" +
          "background:#2563eb;color:#fff;font:700 13px/1.6 sans-serif;" +
          "padding:8px;text-align:center;";
      }
      if (d.parentElement !== root) root.appendChild(d);
      d.textContent =
        "✅ 動作確認 v" +
        VERSION +
        " ／ host=" +
        location.hostname +
        " ／ 記録対象=" +
        (IS_TARGET ? "はい" : "いいえ");
    };
    draw();
    setInterval(draw, 1000);
  }

  const CONFIG = {
    // 送信先（支援教材管理アプリ）
    apiBase: "https://support-material-manager.vercel.app",
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

  // ---- APIキー（初回だけ入力してもらい、以後は保存したものを使う） ----
  const KEY_STORE = "smm-api-key";

  function storedKey() {
    try {
      return GM_getValue(KEY_STORE, "") || "";
    } catch {
      return "";
    }
  }

  // キーの入力に prompt() は使わない。
  // Android のブラウザでは prompt が抑制されることがあり、そこで処理が
  // 止まると画面に何も出ないまま動かなくなるため、ポップアップ内の入力欄で受け取る
  function saveKey(k) {
    try {
      GM_setValue(KEY_STORE, k);
    } catch {
      // 保存できない環境では、この画面を開いている間だけ有効
    }
  }

  let apiKey = storedKey();

  // あとからキーを入れ直したいときのために、メニューからもポップアップを開けるようにする
  try {
    GM_registerMenuCommand("APIキーを入力・変更する", () => {
      try {
        sessionStorage.removeItem(POPUP_SHOWN_KEY);
      } catch {
        // 消せなくてもポップアップは開く
      }
      showStartPopup();
    });
  } catch {
    // メニューに登録できない環境では何もしない
  }

  // ---- 送信 ----
  // GM_xmlhttpRequest があればそちらを使う（サイト側のCSPに邪魔されないため）。
  // 無ければ通常の fetch で送る（APIはCORSを許可している）
  function post(path, data) {
    if (!apiKey) {
      log("APIキーが未設定のため送信しません");
      return Promise.resolve({ ok: false });
    }
    const url = CONFIG.apiBase + path;
    const body = JSON.stringify(data);
    const headers = { "Content-Type": "application/json", "x-api-key": apiKey };

    if (typeof GM_xmlhttpRequest === "function") {
      return new Promise((resolve) => {
        GM_xmlhttpRequest({
          method: "POST",
          url,
          headers,
          data: body,
          onload: (res) => {
            log("POST", path, res.status, res.responseText);
            resolve({ ok: res.status >= 200 && res.status < 300, status: res.status });
          },
          onerror: (e) => {
            log("POST失敗", path, e);
            resolve({ ok: false });
          },
        });
      });
    }

    return fetch(url, { method: "POST", headers, body })
      .then((res) => {
        log("POST", path, res.status);
        return { ok: res.ok, status: res.status };
      })
      .catch((e) => {
        log("POST失敗", path, e);
        return { ok: false };
      });
  }

  // ---- 画面すみの「記録中」表示（動いているか一目で分かるように） ----
  // 全画面表示の最中は、全画面になっている要素の中に入れないと画面に出てこない。
  // brain-program を全画面で使っていると、帯もポップアップも作られているのに
  // 何も見えない状態になる（実際にそれで動いていないように見えていた）。
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
      // 画面上部の帯にする。右下だと、サイト側のボタンやナビに隠れて
      // 「動いていない」のか「見えていないだけ」なのか分からなかったため
      el.style.cssText =
        "position:fixed;top:0;left:0;right:0;z-index:2147483647;" +
        "background:rgba(16,185,129,.95);color:#fff;font:700 14px/2.2 sans-serif;" +
        "text-align:center;box-shadow:0 1px 6px rgba(0,0,0,.35);" +
        "pointer-events:none;user-select:none;";
      el.textContent = "📡 記録中 v" + VERSION;
    }
    // 全画面の出入りで置き場所が変わるので、毎回いまの置き場所へ付け替える
    if (el.parentElement !== root) root.appendChild(el);
    // キーが未設定のあいだは、記録できないことを示すだけでなく、
    // 帯そのものを入力欄への入口にする。
    // ポップアップやTampermonkeyのメニューに頼ると、出ない・見つからないときに
    // 入力する手段が無くなって詰んでしまうため（実際に起きた）。
    if (!apiKey && !el.__t) {
      el.textContent = "⚠ APIキー未設定 － ここを押して入力";
      el.style.background = "rgba(217,119,6,.95)";
    }
    el.style.pointerEvents = apiKey ? "none" : "auto";
    el.style.cursor = apiKey ? "" : "pointer";
    if (!el.__bound) {
      el.__bound = true;
      el.addEventListener("click", () => {
        if (!apiKey) showStartPopup();
      });
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
      el.__t = null;
      el.textContent = apiKey ? "📡 記録中 v" + VERSION : "⚠ APIキー未設定";
      el.style.background = apiKey ? "rgba(16,185,129,.95)" : "rgba(217,119,6,.95)";
    }, 2800);
  }

  // ---- ログイン後の最初の画面（生徒選択画面）で出す確認ポップアップ ----
  // 右下の小さな「📡 記録中」だけでは気づきにくいため、記録が動いていることを
  // 画面の真ん中で大きく知らせる。タブごとに1回だけ出し、OKを押すまで消えない。
  const POPUP_SHOWN_KEY = "smm-start-popup-shown";

  // ログイン画面かどうか（パスワード入力欄があるうちはログイン画面とみなす）
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
    const ready = !!apiKey;
    title.textContent = ready ? "📡 学習記録ブリッジ ON" : "⚠ APIキーが未設定です";
    title.style.cssText =
      "font-size:22px;font-weight:700;margin-bottom:12px;color:" +
      (ready ? "#059669" : "#d97706") +
      ";";

    const body = document.createElement("div");
    body.textContent = ready
      ? "学習の開始と結果は、支援教材管理アプリへ自動で記録されます。"
      : "このままでは記録されません。下の欄にAPIキーを貼り付けて保存してください。";
    body.style.cssText = "font-size:16px;color:#3f3f46;margin-bottom:22px;";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "OK";
    // タブレットで押しやすいように大きめのボタンにする
    btn.style.cssText =
      "width:100%;padding:14px 20px;border:0;border-radius:12px;cursor:pointer;" +
      "background:" + (ready ? "#059669" : "#d97706") + ";color:#fff;font-size:18px;font-weight:700;";
    btn.addEventListener("click", () => overlay.remove());

    // APIキーの入力欄（未設定のときは最初から開いておく）
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
      showStartPopup();
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
    log("開始ポップアップを表示しました");
  }

  function maybeShowStartPopup() {
    if (!document.body) return;

    // APIキーが未設定のうちは、条件を一切かけずに必ず出す。
    // 「一度出した」印（sessionStorage）で止めると、印だけ付いて本体が出なかった
    // 場合に、タブを更新しても二度と出てこなくなる（印はリロードで消えない）。
    if (!apiKey) {
      showStartPopup();
      return;
    }

    // ここから下は「動いています」のお知らせなので、1タブにつき1回でよい
    try {
      if (sessionStorage.getItem(POPUP_SHOWN_KEY)) return;
      sessionStorage.setItem(POPUP_SHOWN_KEY, "1");
    } catch {
      // sessionStorageが使えない環境では毎回の表示を避けるため出さない
      return;
    }
    if (isLoginScreen()) return;
    showStartPopup();
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
      // 遷移直後はデータ未描画のことがあるので、少し待って再判定
      setTimeout(handleAll, 300);
      // ログイン画面から生徒選択画面に移るのもこのタイミング
      setTimeout(maybeShowStartPopup, 400);
    }
  }, 700);
  window.addEventListener("popstate", () => setTimeout(handleAll, 300));

  // 全画面の出入りに追従して、帯とポップアップを今の置き場所へ移す
  ["fullscreenchange", "webkitfullscreenchange"].forEach((ev) =>
    document.addEventListener(ev, () => {
      ensureIndicator();
      const popup = document.getElementById("smm-start-popup");
      const root = uiRoot();
      if (popup && root && popup.parentElement !== root) root.appendChild(popup);
    })
  );

  // DOM変化の監視（結果データは非同期に描画されるため）
  let moTimer = null;
  const mo = new MutationObserver(() => {
    if (moTimer) clearTimeout(moTimer);
    moTimer = setTimeout(handleAll, 400);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // 帯はこの後 700ms ごとにも描き直すが、待たずにすぐ出す
  ensureIndicator();

  // キーが未設定のうちは、1回だけブラウザ標準のダイアログでも知らせる。
  // 全画面表示中はページ内に描いたものが一切見えないため、動いているのに
  // 「何も出ない＝動いていない」と誤解される。ダイアログは全画面でも出る。
  // キーを入れてしまえば二度と出ない。
  let noticeShown = false;
  function notifyUnconfigured() {
    if (noticeShown || apiKey) return;
    noticeShown = true;
    try {
      alert(
        "学習記録ブリッジ v" +
          VERSION +
          " は動いています。\n\n" +
          "画面上部の帯を押して、APIキーを入力してください。\n" +
          "帯が見当たらないときは、全画面表示を一度解除してください。"
      );
    } catch {
      // ダイアログが抑制される環境では何もしない
    }
  }
  setTimeout(notifyUnconfigured, 2500);

  // 初回。出すかどうかの判断は maybeShowStartPopup に任せる。
  // ここで isLoginScreen() を見て打ち切ると、APIキーが未設定のときに
  // 「キーを入力する場所」へたどり着けなくなる（実際そうなっていた）。
  // キー設定済みのときだけ、ログイン画面で邪魔しないよう見送る。
  setTimeout(() => {
    if (apiKey && isLoginScreen()) return;
    setTimeout(() => {
      if (apiKey && isLoginScreen()) return;
      maybeShowStartPopup();
    }, 1200);
  }, 1500);

  log("起動しました。URL:", location.href);
})();
