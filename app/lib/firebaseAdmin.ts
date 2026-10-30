// Firebase Admin SDK（サーバー側＝APIルート専用）。
// 受信APIが Firestore に安全に書き込むために使う。
// クライアント（ブラウザ）からは絶対に import しないこと。
//
// 環境変数 FIREBASE_SERVICE_ACCOUNT に、Firebaseの
// 「サービスアカウント秘密鍵JSON」を1行の文字列として設定する。

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
 * Admin用 Auth（ログインの通行証＝カスタムトークンを作るのに使う）。未設定なら null。
 * firebase-admin/auth は、ここで先頭から読み込むと、この部品を使う他のAPI（出欠の受け口など）まで
 * 巻き込んで止めてしまったことがあるため、使うときだけ読み込む。
 */
export async function getAdminAuth() {
  const app = getAdminApp();
  if (!app) return null;
  const { getAuth } = await import("firebase-admin/auth");
  return getAuth(app);
}
