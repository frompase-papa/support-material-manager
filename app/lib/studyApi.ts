// 学習記録 受信API の共通処理。

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

/**
 * x-api-key ヘッダーが環境変数 STUDY_API_KEY と一致するか。
 *
 * STUDY_API_KEY は **カンマ区切りで複数**指定できる（例: "旧キー,新キー"）。
 * キーを更新するとき、一時的に旧・新の両方を有効にしておけば、
 * タブレット側の拡張機能を入れ替えるまで記録が止まらない。
 * 入れ替え完了後に旧キーを消せば失効する。
 */
export function checkApiKey(req: Request): boolean {
  const key = req.headers.get("x-api-key");
  if (!key) return false;
  const allowed = (process.env.STUDY_API_KEY ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return allowed.includes(key);
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
