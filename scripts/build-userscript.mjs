// ユーザースクリプトを「古いブラウザでも読める書き方」に変換して配信用ファイルを作る。
//
// タブレットの Mises に載っている Chromium が古く、`??`（Null合体）や
// 引数なしの `catch` を解釈できない。Tampermonkey は構文エラーを画面に出さないため、
// 「注入されているのに何も起きない」状態になり、原因の特定に非常に時間がかかった。
//
//   node scripts/build-userscript.mjs
//
// 出力: public/support-material-bridge.es5.user.js
// メタデータの @updateURL / @downloadURL は出力ファイル自身を指すよう書き換える。

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";

const SRC = "public/support-material-bridge.user.js";
const OUT = "public/support-material-bridge.es5.user.js";
const TMP = "public/.userscript-body.tmp.js";

const src = readFileSync(SRC, "utf8");
const begin = "// ==UserScript==";
const end = "// ==/UserScript==";
const i = src.indexOf(begin);
const j = src.indexOf(end);
if (i < 0 || j < 0) throw new Error("メタデータブロックが見つかりません");

let meta = src.slice(i, j + end.length);
// 配信先を出力ファイル自身に向ける（自動更新がこのファイルを見に行くように）
meta = meta.replaceAll(
  "support-material-bridge.user.js",
  "support-material-bridge.es5.user.js"
);
// 元と区別できるように名前を変える（両方入れてしまう事故を防ぐ）
meta = meta.replace(
  /^(\/\/ @name\s+.*)$/m,
  "$1（旧ブラウザ対応版）"
);
// メタデータは改行を含むため、コマンドラインの --banner では渡せない
// （改行でコマンドが分断される）。変換だけ esbuild に任せ、結合はここで行う。
try {
  execFileSync(
    "npx",
    ["--yes", "esbuild", SRC, "--target=es2015", `--outfile=${TMP}`],
    { stdio: "inherit", shell: true }
  );
  const body = readFileSync(TMP, "utf8");
  writeFileSync(OUT, meta + "\n\n" + body, "utf8");
} finally {
  try {
    unlinkSync(TMP);
  } catch {
    /* 消せなくても問題ない */
  }
}

// --- 検査 ---
const out = readFileSync(OUT, "utf8");
const errors = [];

if (!out.startsWith(begin)) errors.push("メタデータブロックが先頭にありません");
if (!out.includes(end)) errors.push("メタデータブロックが閉じていません");

const body = out.slice(out.indexOf(end) + end.length);
for (const [name, re] of [
  ["?? (Null合体)", /\?\?/],
  ["?. (オプショナルチェーン)", /\?\./],
  ["引数なし catch", /catch\s*\{/],
]) {
  if (re.test(body)) errors.push(`変換後に ${name} が残っています`);
}

const metaVersion = out.match(/^\/\/\s*@version\s+(\S+)/m)?.[1];
const codeVersion = out.match(/VERSION\s*=\s*"([^"]+)"/)?.[1];
if (metaVersion !== codeVersion) {
  errors.push(`@version(${metaVersion}) と VERSION(${codeVersion}) が不一致`);
}
if (!out.includes("support-material-bridge.es5.user.js")) {
  errors.push("@updateURL が出力ファイルを指していません");
}

if (errors.length) {
  console.error("\n✖ 変換後の検査に失敗しました");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`\n✓ ${OUT} を作成しました（v${metaVersion}）`);
