// ユーザースクリプトのメタデータブロックを検査する。
//
// メタデータブロックには「// @項目 値」の行しか書けない。
// ここに説明文を混ぜると Tampermonkey が壊れた設定として読み込み、
// 対象ページの判定が働かなくなる。実際、説明文の1行が「// @match は〜」と
// 読まれてしまい、brain-program でスクリプトが動かなくなった。
//
//   node scripts/check-userscript.mjs

import { readFileSync } from "node:fs";

const FILE = "public/support-material-bridge.user.js";
const src = readFileSync(FILE, "utf8");
const lines = src.split(/\r?\n/);

const start = lines.findIndex((l) => l.trim() === "// ==UserScript==");
const end = lines.findIndex((l) => l.trim() === "// ==/UserScript==");

const errors = [];
if (start < 0 || end < 0 || end <= start) {
  errors.push("メタデータブロック（==UserScript== 〜 ==/UserScript==）が見つかりません");
} else {
  // 1) ブロック内は「// @項目 値」だけ
  for (let i = start + 1; i < end; i++) {
    const line = lines[i];
    if (/^\/\/\s*@[A-Za-z][\w-]*\s+\S/.test(line)) continue;
    errors.push(
      `${i + 1}行目: メタデータブロック内に「// @項目 値」以外の行があります → ${line.trim()}`
    );
  }

  // 2) @match / @include の値が説明文になっていないか
  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(/^\/\/\s*@(match|include|connect)\s+(.+)$/);
    if (!m) continue;
    const value = m[2].trim();
    if (/[ぁ-んァ-ヶ一-龠]/.test(value) || /\s/.test(value)) {
      errors.push(`${i + 1}行目: @${m[1]} の値が不正です → ${value}`);
    }
  }

  // 3) 必須項目
  const block = lines.slice(start, end + 1).join("\n");
  for (const key of ["name", "namespace", "version", "grant", "updateURL", "downloadURL"]) {
    if (!new RegExp(`^//\\s*@${key}\\s+\\S`, "m").test(block)) {
      errors.push(`@${key} がありません`);
    }
  }
  if (!/^\/\/\s*@(match|include)\s+\S/m.test(block)) {
    errors.push("@match / @include がどちらもありません");
  }
}

// 4) @version と、画面に出す VERSION を揃える
//    （揃っていないと「画面には新しい番号が出るのに更新が配られない」ことになる）
const metaVersion = src.match(/^\/\/\s*@version\s+(\S+)/m)?.[1];
const codeVersion = src.match(/const VERSION = "([^"]+)"/)?.[1];
if (metaVersion !== codeVersion) {
  errors.push(`@version(${metaVersion}) と const VERSION(${codeVersion}) が一致しません`);
}

if (errors.length) {
  console.error("✖ ユーザースクリプトの検査に失敗しました\n");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`✓ ユーザースクリプトの検査に合格しました（v${metaVersion}）`);
