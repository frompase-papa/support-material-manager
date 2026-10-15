// 学習開始の受信API：拡張機能から { studentId, startTime, title, ... } を受け取る。

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/app/lib/firebaseAdmin";
import {
  CORS_HEADERS,
  checkApiKey,
  dedupeDocId,
  strOrNull,
  todayKey,
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

  // 結果と同じく、ブリッジが付けた eventId があればそれで判定する。
  // 無い場合（古いブリッジ）は、開始には点数が無く送り直しと2回目を見分けられないので、
  // 診断用と割り切って1日1件にまとめる。
  const eventId = strOrNull(body.eventId);
  const id = eventId
    ? dedupeDocId("start", [studentId, eventId])
    : dedupeDocId("start", [studentId, title, todayKey()]);

  await db.collection("studyEvents").doc(id).set(
    {
      type: "start",
      studentId,
      studentName: strOrNull(body.studentName),
      title,
      roomId: strOrNull(body.roomId),
      startTime: strOrNull(body.startTime),
      eventId, // 1回の検知ごとの固有番号
      receivedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return Response.json({ ok: true }, { headers: CORS_HEADERS });
}
