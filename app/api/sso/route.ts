// 送迎管理アプリの通行証を受け取り、この画面（Firebase）へのログインに引き換える。
// 通行証が正しければ、その職員用のログイン用トークン（カスタムトークン）を返す。
// データの保護は「ログインしていること」（Firestoreルール request.auth != null）なので、
// ここでログインさせられた人も、これまで通りのデータが読み書きできる。

import { getAdminAuth } from "@/app/lib/firebaseAdmin";
import { todayJST, verifySsoToken } from "@/app/lib/sso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const claims = token ? verifySsoToken(token) : null;
  if (!claims) {
    return Response.json({ ok: false, error: "通行証が正しくないか、期限が切れています" }, { status: 401 });
  }
  try {
    const auth = await getAdminAuth();
    if (!auth) {
      return Response.json({ ok: false, error: "server not configured (FIREBASE_SERVICE_ACCOUNT)" }, { status: 503 });
    }
    // day: ログインの有効な日。日付が変わったら、画面側（AuthProvider）がログアウトさせる
    const customToken = await auth.createCustomToken(`staff-${claims.staffId}`, {
      sso: true,
      day: todayJST(),
      name: claims.name,
    });
    return Response.json({ ok: true, customToken });
  } catch (e) {
    // 失敗しても画面は「メールアドレスでログイン」へ案内できるよう、理由をJSONで返す
    console.error("[sso] ログイン用トークンを作れませんでした", e);
    return Response.json({ ok: false, error: "ログイン用トークンを作れませんでした" }, { status: 500 });
  }
}
