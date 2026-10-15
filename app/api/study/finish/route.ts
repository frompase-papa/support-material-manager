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
  const average = numOrNull(body.average);
  const max = numOrNull(body.max);
  const cumulative = numOrNull(body.cumulative);
  const studyDate = strOrNull(body.date);

  // 重複をまとめるためのID。
  //
  // ブリッジが1回の検知ごとに付ける eventId があれば、それを使う。
  // 送信に失敗して送り直したときは同じ eventId なので1件にまとまり、
  // 本当にもう一度やった回は別の eventId なので別件として残る。
  //
  // 内容だけで判定していたときは、同じ教材で同じ点数が出た回が
  // 1件に潰れて「8問やったのに7問」になっていた。
  // eventId を送らない古いブリッジのために、内容での判定も残してある。
  const eventId = strOrNull(body.eventId);
  const id = eventId
    ? dedupeDocId("finish", [studentId, eventId])
    : dedupeDocId("finish", [
        studentId,
        title,
        score,
        cumulative,
        average,
        max,
        studyDate,
      ]);

  await db.collection("studyEvents").doc(id).set(
    {
      type: "finish",
      studentId,
      studentName: strOrNull(body.studentName),
      title,
      score,
      average,
      max,
      cumulative,
      studyDate, // 実施日（サイト表記そのまま）
      roomId: strOrNull(body.roomId),
      eventId, // 1回の検知ごとの固有番号
      seq: numOrNull(body.seq), // その端末のその日の通し番号（診断用）
      receivedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return Response.json({ ok: true }, { headers: CORS_HEADERS });
}
