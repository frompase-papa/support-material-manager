// 重複判定（dedupeDocId）の検証。
//
//   node --experimental-strip-types scripts/test-dedupe.ts
//
// 「8回のはずが9回・7回になる」という報告を受けて作った。
// 時間を区切って判定していたため、区切りの境目では重複が残り、
// 区切りの中では正当な2回分が1件に潰れていた。

import { dedupeDocId } from "../app/lib/studyApi.ts";

const out: string[] = [];
const check = (name: string, ok: boolean, detail = "") =>
  out.push(`${ok ? "PASS" : "**FAIL**"}  ${name}${detail ? "  … " + detail : ""}`);

const realNow = Date.now;
const at = (ms: number) => {
  Date.now = () => ms;
};
const TEN = 10 * 60 * 1000;
const base = Math.floor(realNow() / TEN) * TEN; // 10分の区切りちょうど

// 同じ検知を送り直した場合（押し直し・再送）＝1件にまとまってほしい
{
  at(base + 1000);
  const a = dedupeDocId("finish", ["s1", "算数", 100, 500, 50, 80, "10月3日"]);
  at(base + 3000);
  const b = dedupeDocId("finish", ["s1", "算数", 100, 500, 50, 80, "10月3日"]);
  check("同じ結果を送り直しても1件にまとまる", a === b);
}

// 時間が大きく離れた送り直し＝以前は区切りをまたぐと重複が残っていた（9回になる原因）
{
  at(base - 20 * 60 * 1000);
  const a = dedupeDocId("finish", ["s1", "算数", 100, 500, 50, 80, "10月3日"]);
  at(base + 1000);
  const b = dedupeDocId("finish", ["s1", "算数", 100, 500, 50, 80, "10月3日"]);
  check("時間が離れていても、同じ結果なら1件にまとまる", a === b,
    a === b ? "" : "別IDになってしまう");
}

// 本当に2回やった場合＝累計点が違うので別件として残ってほしい（7回になる原因）
{
  at(base + 60_000);
  const a = dedupeDocId("finish", ["s1", "算数", 100, 500, 50, 80, "10月3日"]);
  at(base + 300_000);
  // 同じ教材・同じ点数でも、累計点は増えている
  const b = dedupeDocId("finish", ["s1", "算数", 100, 600, 52, 80, "10月3日"]);
  check("同じ点数でも2回目は別件として残る（累計点で区別）", a !== b,
    a === b ? "1件に潰れてしまう" : "");
}

// 回数が変わらないこと＝内容が同じなら何度送っても1件
{
  at(base + 10_000);
  const ids = new Set(
    [0, 1, 2, 3, 4].map(() =>
      dedupeDocId("finish", ["s2", "国語", 80, 300, 40, 90, "10月3日"])
    )
  );
  check("5回送っても1件", ids.size === 1, `種類=${ids.size}`);
}

// 別の生徒・別の教材・別の点数は当然別件
{
  at(base);
  const a = dedupeDocId("finish", ["s1", "算数", 100, 500, 50, 80, "10月3日"]);
  check("生徒が違えば別件",
    a !== dedupeDocId("finish", ["s9", "算数", 100, 500, 50, 80, "10月3日"]));
  check("教材が違えば別件",
    a !== dedupeDocId("finish", ["s1", "国語", 100, 500, 50, 80, "10月3日"]));
  check("点数が違えば別件",
    a !== dedupeDocId("finish", ["s1", "算数", 90, 500, 50, 80, "10月3日"]));
}

Date.now = realNow;
console.log(out.join("\n"));
console.log(
  out.some((x) => x.includes("FAIL")) ? "\n=== 失敗あり ===" : "\n=== すべて成功 ==="
);
