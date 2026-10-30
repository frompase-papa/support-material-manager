// 送迎管理アプリ（shift-manager）からの「この職員はログイン済み」の通行証を確かめる。
//
// 通行証は署名付きの短い文字列で、有効なのは1分だけ。作る側は送迎アプリの src/lib/sso.ts。
// 署名の鍵は、出欠の連携で両方がすでに持っている合言葉から作る
// （こちらの SHIFT_ATTENDANCE_API_KEY ＝ 送迎アプリの ATTENDANCE_API_KEY）。
// 新しい環境変数を足さなくても動かすため。作りは送迎アプリ側と同じにすること。

import { createHmac, timingSafeEqual } from "node:crypto";

export type SsoClaims = { staffId: string; name: string };

export function verifySsoToken(token: string): SsoClaims | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;

  // 合言葉はカンマ区切りで複数持てる（連携の受け口と同じ）。どれかで署名が合えばよい
  const keys = (process.env.SHIFT_ATTENDANCE_API_KEY ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const given = Buffer.from(mac);
  const signedOk = keys.some((k) => {
    const expected = Buffer.from(createHmac("sha256", `sso:${k}`).update(body).digest("base64url"));
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
  if (!signedOk) return null;

  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as { a?: string; s?: string; n?: string; e?: number };
    if (p.a !== "support" || !p.s || typeof p.e !== "number") return null;
    if (p.e < Math.floor(Date.now() / 1000)) return null; // 1分を過ぎた通行証は使えない
    return { staffId: p.s, name: p.n ?? "" };
  } catch {
    return null;
  }
}

// 日本時間の今日。ログインをその日の夜12時までにするため、通行証にこの日付を入れる
export function todayJST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
}
