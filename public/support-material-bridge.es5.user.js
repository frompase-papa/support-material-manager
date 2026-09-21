// ==UserScript==
// @name         支援教材 学習記録ブリッジ（旧ブラウザ対応版）
// @namespace    support-material-manager
// @version      1.5.0
// @description  brain-program の学習開始・結果を支援教材管理アプリへ自動送信します（拡張機能版と同じ動き）。
// @author       支援教材管理アプリ
// @match        *://*/*
// @include      *
// @connect      support-material-manager.vercel.app
// @updateURL    https://support-material-manager.vercel.app/support-material-bridge.es5.user.js
// @downloadURL  https://support-material-manager.vercel.app/support-material-bridge.es5.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

"use strict";
(function() {
  "use strict";
  const VERSION = "1.5.0";
  const DIAG = /smmtest/i.test(location.hash);
  const IS_TARGET = /brain-program/i.test(location.hostname);
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
        d.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#2563eb;color:#fff;font:700 13px/1.6 sans-serif;padding:8px;text-align:center;";
      }
      if (d.parentElement !== root) root.appendChild(d);
      d.textContent = "\u2705 \u52D5\u4F5C\u78BA\u8A8D v" + VERSION + " \uFF0F host=" + location.hostname + " \uFF0F \u8A18\u9332\u5BFE\u8C61=" + (IS_TARGET ? "\u306F\u3044" : "\u3044\u3044\u3048");
    };
    draw();
    setInterval(draw, 1e3);
  }
  const CONFIG = {
    // 送信先（支援教材管理アプリ）
    apiBase: "https://support-material-manager.vercel.app",
    // 結果画面と判定するURLパターン（どれかに一致すれば結果画面）
    resultUrlPattern: /V030002M|V030004E|V030000/i,
    // 問題（学習開始）画面と判定するURLパターン
    startUrlPattern: /V0305\d{2}/i,
    // デバッグログを出す
    debug: true
  };
  function log(...a) {
    if (CONFIG.debug) console.log("[\u5B66\u7FD2\u8A18\u9332\u30D6\u30EA\u30C3\u30B8]", ...a);
  }
  const KEY_STORE = "smm-api-key";
  function storedKey() {
    try {
      return GM_getValue(KEY_STORE, "") || "";
    } catch (e) {
      return "";
    }
  }
  function saveKey(k) {
    try {
      GM_setValue(KEY_STORE, k);
    } catch (e) {
    }
  }
  let apiKey = storedKey();
  try {
    GM_registerMenuCommand("API\u30AD\u30FC\u3092\u5165\u529B\u30FB\u5909\u66F4\u3059\u308B", () => {
      try {
        sessionStorage.removeItem(POPUP_SHOWN_KEY);
      } catch (e) {
      }
      showStartPopup();
    });
  } catch (e) {
  }
  function post(path, data) {
    if (!apiKey) {
      log("API\u30AD\u30FC\u304C\u672A\u8A2D\u5B9A\u306E\u305F\u3081\u9001\u4FE1\u3057\u307E\u305B\u3093");
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
            log("POST\u5931\u6557", path, e);
            resolve({ ok: false });
          }
        });
      });
    }
    return fetch(url, { method: "POST", headers, body }).then((res) => {
      log("POST", path, res.status);
      return { ok: res.ok, status: res.status };
    }).catch((e) => {
      log("POST\u5931\u6557", path, e);
      return { ok: false };
    });
  }
  function uiRoot() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.body;
  }
  function ensureIndicator() {
    const root = uiRoot();
    if (!root) return null;
    let el = document.getElementById("smm-rec-indicator");
    if (!el) {
      el = document.createElement("div");
      el.id = "smm-rec-indicator";
      el.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:rgba(16,185,129,.95);color:#fff;font:700 14px/2.2 sans-serif;text-align:center;box-shadow:0 1px 6px rgba(0,0,0,.35);pointer-events:none;user-select:none;";
      el.textContent = "\u{1F4E1} \u8A18\u9332\u4E2D v" + VERSION;
    }
    if (el.parentElement !== root) root.appendChild(el);
    if (!apiKey && !el.__t) {
      el.textContent = "\u26A0 API\u30AD\u30FC\u672A\u8A2D\u5B9A \uFF0D \u3053\u3053\u3092\u62BC\u3057\u3066\u5165\u529B";
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
    el.style.background = ok ? "rgba(37,99,235,.95)" : "rgba(220,38,38,.95)";
    clearTimeout(el.__t);
    el.__t = setTimeout(() => {
      el.__t = null;
      el.textContent = apiKey ? "\u{1F4E1} \u8A18\u9332\u4E2D v" + VERSION : "\u26A0 API\u30AD\u30FC\u672A\u8A2D\u5B9A";
      el.style.background = apiKey ? "rgba(16,185,129,.95)" : "rgba(217,119,6,.95)";
    }, 2800);
  }
  const POPUP_SHOWN_KEY = "smm-start-popup-shown";
  function isLoginScreen() {
    return !!document.querySelector('input[type="password"]');
  }
  function showStartPopup() {
    if (document.getElementById("smm-start-popup")) return;
    const overlay = document.createElement("div");
    overlay.id = "smm-start-popup";
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.45);font:400 16px/1.6 sans-serif;";
    const card = document.createElement("div");
    card.style.cssText = "background:#fff;border-radius:16px;padding:28px 24px;max-width:420px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.35);text-align:center;color:#18181b;";
    const title = document.createElement("div");
    const ready = !!apiKey;
    title.textContent = ready ? "\u{1F4E1} \u5B66\u7FD2\u8A18\u9332\u30D6\u30EA\u30C3\u30B8 ON" : "\u26A0 API\u30AD\u30FC\u304C\u672A\u8A2D\u5B9A\u3067\u3059";
    title.style.cssText = "font-size:22px;font-weight:700;margin-bottom:12px;color:" + (ready ? "#059669" : "#d97706") + ";";
    const body = document.createElement("div");
    body.textContent = ready ? "\u5B66\u7FD2\u306E\u958B\u59CB\u3068\u7D50\u679C\u306F\u3001\u652F\u63F4\u6559\u6750\u7BA1\u7406\u30A2\u30D7\u30EA\u3078\u81EA\u52D5\u3067\u8A18\u9332\u3055\u308C\u307E\u3059\u3002" : "\u3053\u306E\u307E\u307E\u3067\u306F\u8A18\u9332\u3055\u308C\u307E\u305B\u3093\u3002\u4E0B\u306E\u6B04\u306BAPI\u30AD\u30FC\u3092\u8CBC\u308A\u4ED8\u3051\u3066\u4FDD\u5B58\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
    body.style.cssText = "font-size:16px;color:#3f3f46;margin-bottom:22px;";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "OK";
    btn.style.cssText = "width:100%;padding:14px 20px;border:0;border-radius:12px;cursor:pointer;background:" + (ready ? "#059669" : "#d97706") + ";color:#fff;font-size:18px;font-weight:700;";
    btn.addEventListener("click", () => overlay.remove());
    const keyBox = document.createElement("div");
    keyBox.style.cssText = "margin-top:10px;" + (ready ? "display:none;" : "");
    const keyInput = document.createElement("input");
    keyInput.type = "text";
    keyInput.value = apiKey;
    keyInput.placeholder = "API\u30AD\u30FC\u3092\u8CBC\u308A\u4ED8\u3051";
    keyInput.autocapitalize = "off";
    keyInput.spellcheck = false;
    keyInput.style.cssText = "width:100%;padding:12px;border:1px solid #d4d4d8;border-radius:10px;font-size:15px;color:#18181b;background:#fff;";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "API\u30AD\u30FC\u3092\u4FDD\u5B58";
    saveBtn.style.cssText = "width:100%;margin-top:8px;padding:12px 20px;border:0;border-radius:10px;cursor:pointer;background:#3f3f46;color:#fff;font-size:15px;font-weight:700;";
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
    keyBtn.textContent = "API\u30AD\u30FC\u3092\u5909\u66F4\u3059\u308B";
    keyBtn.style.cssText = "width:100%;margin-top:10px;padding:10px 20px;border:1px solid #d4d4d8;border-radius:12px;cursor:pointer;background:#fff;color:#52525b;font-size:14px;" + (ready ? "" : "display:none;");
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
    log("\u958B\u59CB\u30DD\u30C3\u30D7\u30A2\u30C3\u30D7\u3092\u8868\u793A\u3057\u307E\u3057\u305F");
  }
  function maybeShowStartPopup() {
    if (!document.body) return;
    if (!apiKey) {
      showStartPopup();
      return;
    }
    try {
      if (sessionStorage.getItem(POPUP_SHOWN_KEY)) return;
      sessionStorage.setItem(POPUP_SHOWN_KEY, "1");
    } catch (e) {
      return;
    }
    if (isLoginScreen()) return;
    showStartPopup();
  }
  function getParams() {
    const p = new URLSearchParams(location.search);
    return {
      studentId: p.get("studentId") || "",
      roomId: p.get("roomId") || "",
      categoryId: p.get("categoryId") || "",
      trainingId: p.get("trainingId") || ""
    };
  }
  function textOf(el) {
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }
  function allLabelTexts() {
    return [...document.querySelectorAll("label")].map(textOf).filter(Boolean);
  }
  function extractResult() {
    const labels = allLabelTexts();
    const joined = labels.join(" | ");
    const params = getParams();
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
    let title = null;
    const tEl = document.querySelector('[height="blackBoardTitle"] label');
    if (tEl) title = textOf(tEl);
    if (!title && params.categoryId) title = `\u30AB\u30C6\u30B4\u30EA${params.categoryId}-${params.trainingId}`;
    let studentName = labels.find((t) => /さん$/.test(t)) || null;
    if (studentName) studentName = studentName.replace(/さん$/, "").trim();
    let date = null;
    const dm = joined.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (dm) date = `${dm[1]}\u6708${dm[2]}\u65E5`;
    return {
      studentId: params.studentId,
      roomId: params.roomId,
      studentName,
      title,
      score,
      average,
      max,
      cumulative,
      date
    };
  }
  let lastStartSig = "";
  let lastFinishSig = "";
  function handleStart() {
    if (!CONFIG.startUrlPattern.test(location.href)) return;
    const params = getParams();
    if (!params.studentId) return;
    const title = params.categoryId ? `\u30AB\u30C6\u30B4\u30EA${params.categoryId}-${params.trainingId}` : null;
    const sig = `${params.studentId}|${location.pathname}|${params.categoryId}|${params.trainingId}`;
    if (sig === lastStartSig) return;
    lastStartSig = sig;
    const payload = {
      studentId: params.studentId,
      roomId: params.roomId,
      title,
      startTime: (/* @__PURE__ */ new Date()).toISOString()
    };
    log("\u958B\u59CB\u3092\u9001\u4FE1", payload);
    post("/api/study/start", payload).then((r) => {
      flashIndicator("\u25B6 \u958B\u59CB\u3092\u9001\u4FE1", r && r.ok);
    });
  }
  function handleFinish() {
    const isResult = CONFIG.resultUrlPattern.test(location.href) || /(\d+)\s*ポイント/.test(document.body.innerText || "");
    if (!isResult) return;
    const data = extractResult();
    if (!data.score) return;
    const sig = `${data.studentId}|${data.title}|${data.score}|${data.date}`;
    if (sig === lastFinishSig) return;
    lastFinishSig = sig;
    log("\u7D50\u679C\u3092\u9001\u4FE1", data);
    post("/api/study/finish", data).then((r) => {
      var _a, _b;
      const label = `${(_a = data.title) != null ? _a : "\u7D50\u679C"} ${(_b = data.score) != null ? _b : ""}\u70B9`;
      flashIndicator(r && r.ok ? `\u2713 \u9001\u4FE1: ${label}` : "\u26A0 \u9001\u4FE1\u5931\u6557", r && r.ok);
    });
  }
  function handleAll() {
    handleStart();
    handleFinish();
  }
  let lastUrl = location.href;
  setInterval(() => {
    ensureIndicator();
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      log("\u753B\u9762\u9077\u79FB:", location.href);
      setTimeout(handleAll, 300);
      setTimeout(maybeShowStartPopup, 400);
    }
  }, 700);
  window.addEventListener("popstate", () => setTimeout(handleAll, 300));
  ["fullscreenchange", "webkitfullscreenchange"].forEach(
    (ev) => document.addEventListener(ev, () => {
      ensureIndicator();
      const popup = document.getElementById("smm-start-popup");
      const root = uiRoot();
      if (popup && root && popup.parentElement !== root) root.appendChild(popup);
    })
  );
  let moTimer = null;
  const mo = new MutationObserver(() => {
    if (moTimer) clearTimeout(moTimer);
    moTimer = setTimeout(handleAll, 400);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  ensureIndicator();
  let noticeShown = false;
  function notifyUnconfigured() {
    if (noticeShown || apiKey) return;
    noticeShown = true;
    try {
      alert(
        "\u5B66\u7FD2\u8A18\u9332\u30D6\u30EA\u30C3\u30B8 v" + VERSION + " \u306F\u52D5\u3044\u3066\u3044\u307E\u3059\u3002\n\n\u753B\u9762\u4E0A\u90E8\u306E\u5E2F\u3092\u62BC\u3057\u3066\u3001API\u30AD\u30FC\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002\n\u5E2F\u304C\u898B\u5F53\u305F\u3089\u306A\u3044\u3068\u304D\u306F\u3001\u5168\u753B\u9762\u8868\u793A\u3092\u4E00\u5EA6\u89E3\u9664\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
      );
    } catch (e) {
    }
  }
  setTimeout(notifyUnconfigured, 2500);
  setTimeout(() => {
    if (apiKey && isLoginScreen()) return;
    setTimeout(() => {
      if (apiKey && isLoginScreen()) return;
      maybeShowStartPopup();
    }, 1200);
  }, 1500);
  log("\u8D77\u52D5\u3057\u307E\u3057\u305F\u3002URL:", location.href);
})();
