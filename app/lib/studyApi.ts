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

/**
 * 同じ内容の記録を1件にまとめるためのドキュメントID。
 *
 * 拡張機能・ユーザースクリプト・ブックマークレットは、どれも同じ画面を見て
 * 同じ内容を送る。タブレットに複数入っていると同じ結果が2件3件と記録される
 * （実際に「同じ内容が3回連続」で起きた）。送信の失敗を再送したときも同様。
 *
 * 内容と「10分の時間帯」から決まるIDを使い、同じものは上書きにする。
 * 時間帯を混ぜてあるので、同じ教材を時間をおいてもう一度やった場合は
 * 別の記録として残る。
 */
export function dedupeDocId(
  type: "start" | "finish",
  parts: (string | number | null)[]
): string {
  const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
  const key = [type, ...parts.map((p) => (p === null ? "" : String(p))), bucket]
    .join("|");
  // Firestore のIDに使える文字だけにする
  return (
    type +
    "_" +
    Buffer.from(key, "utf8").toString("base64url").slice(0, 120)
  );
}

export function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}
