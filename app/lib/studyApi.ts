// 学習記録 受信API の共通処理。

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

/** x-api-key ヘッダーが環境変数 STUDY_API_KEY と一致するか */
export function checkApiKey(req: Request): boolean {
  const key = req.headers.get("x-api-key");
  const expected = process.env.STUDY_API_KEY;
  return Boolean(expected) && key === expected;
}

/** "184pt" や "8866" のような文字列から数値を取り出す。取れなければ null。 */
export function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}
