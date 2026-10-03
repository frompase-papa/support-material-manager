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
 * 同じ内容を送る。複数入っていたり、再ログイン後に押し直したり、送信失敗を
 * 再送したりすると、同じ結果が何件も記録される。
 *
 * ★ 時間では区切らないこと。
 *   以前は「10分の時間帯」を混ぜていたが、
 *   - 区切りの境目をまたぐと、数秒差の同じ内容が別件として残る（回数が増える）
 *   - 区切りの中では、本当にもう一度やった分が1件に潰れる（回数が減る）
 *   という両方の不具合が出た（8回のはずが9回・7回になる、として報告された）。
 *
 * 代わりに、やり直すと必ず変わる値（累計点・平均点・最高点）をキーに含める。
 * 同じ検知を送り直したときは全項目が同じなので1件にまとまり、
 * 本当に2回やったときは累計点が増えているので別件として残る。
 */
export function dedupeDocId(
  type: "start" | "finish",
  parts: (string | number | null)[]
): string {
  const key = [type, ...parts.map((p) => (p === null ? "" : String(p)))].join("|");
  // Firestore のIDに使える文字だけにする
  return (
    type +
    "_" +
    Buffer.from(key, "utf8").toString("base64url").slice(0, 120)
  );
}

/** その日かどうかだけを表す文字列（開始イベントのキーに使う） */
export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}
