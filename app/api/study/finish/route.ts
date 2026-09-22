// 学習終了・結果の受信API：拡張機能が結果画面から抽出した得点等を受け取る。

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/app/lib/firebaseAdmin";
import {
  CORS_HEADERS,
  checkApiKey,
  dedupeDocId,
  numOrNull,
  strOrNull,
} from "@/app/lib/studyApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  if (!checkApiKey(req)) {
    return Response.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: CORS_HEADERS }
    );
  }
  const db = getAdminDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "server not configured (FIREBASE_SERVICE_ACCOUNT)" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { ok: false, error: "invalid json" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const studentId = strOrNull(body.studentId);
  if (!studentId) {
    return Response.json(
      { ok: false, error: "studentId required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const title = strOrNull(body.title);
  const score = numOrNull(body.score);
  const studyDate = strOrNull(body.date);

  // 同じ内容が複数のブリッジから届いても1件にまとめる（IDを内容から決める）
  const id = dedupeDocId("finish", [studentId, title, score, studyDate]);

  await db.collection("studyEvents").doc(id).set(
    {
      type: "finish",
      studentId,
      studentName: strOrNull(body.studentName),
      title,
      score,
      average: numOrNull(body.average),
      max: numOrNull(body.max),
      cumulative: numOrNull(body.cumulative),
      studyDate, // 実施日（サイト表記そのまま）
      roomId: strOrNull(body.roomId),
      receivedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return Response.json({ ok: true }, { headers: CORS_HEADERS });
}
