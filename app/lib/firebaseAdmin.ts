// Firebase Admin SDK（サーバー側＝APIルート専用）。
// 受信APIが Firestore に安全に書き込むために使う。
// クライアント（ブラウザ）からは絶対に import しないこと。
//
// 環境変数 FIREBASE_SERVICE_ACCOUNT に、Firebaseの
// 「サービスアカウント秘密鍵JSON」を1行の文字列として設定する。

import { createSign } from "node:crypto";
import {
  initializeApp,
  getApps,
  getApp,
  cert,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function loadServiceAccount(): Record<string, string> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const json = JSON.parse(raw) as Record<string, string>;
    // 環境変数経由で \n がエスケープされている場合に復元
    if (json.private_key) {
      json.private_key = json.private_key.replace(/\\n/g, "\n");
    }
    return json;
  } catch {
    return null;
  }
}

let cached: App | null = null;

function getAdminApp(): App | null {
  if (cached) return cached;
  if (getApps().length) {
    cached = getApp();
    return cached;
  }
  const sa = loadServiceAccount();
  if (!sa) return null; // 未設定ならnull（APIは500で明示的に返す）
  cached = initializeApp({
    credential: cert(sa as Parameters<typeof cert>[0]),
  });
  return cached;
}

/** Admin用 Firestore。未設定なら null。 */
export function getAdminDb(): Firestore | null {
  const app = getAdminApp();
  return app ? getFirestore(app) : null;
}

/**
 * ログインの通行証（カスタムトークン）を作る。
 * firebase-admin/auth は、本番で「Failed to load external module」になり読み込めないことがあったため、
 * 使わずに、サービスアカウントの秘密鍵で署名したJWT（RS256）を自前で作る。Firebaseのカスタムトークンの正式な形式。
 * サービスアカウント未設定なら null。
 */
export function createCustomToken(uid: string, claims: Record<string, unknown>): string | null {
  const sa = loadServiceAccount();
  if (!sa?.private_key || !sa.client_email) return null;
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", typ: "JWT" });
  const body = b64({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid,
    claims,
  });
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(sa.private_key).toString("base64url");
  return `${head}.${body}.${sig}`;
}
