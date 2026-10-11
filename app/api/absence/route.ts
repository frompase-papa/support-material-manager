// 送迎管理アプリから「その日お休みになった児童」を受け取って保存するAPI。
//
// 送迎アプリで送迎表を取り込む／ボードでお休みにすると、ここが呼ばれる。
// 出欠は送迎アプリを正とするので、こちらの画面ではその子を出席から外す。
//
// 保存先は workspace ドキュメントの transportAbsences（dateKey -> 児童名[]）。
// 月のカレンダー取込（presentByDate）とは別の欄にしてある。同じ欄に書くと
// 月を取り込み直したときに消えてしまい、送迎アプリの休みが保てないため。
//
// 認証: ヘッダー x-api-key が SHIFT_ATTENDANCE_API_KEY と一致すること
// （送迎アプリから出欠を読むときと同じ合言葉を使う）。

import { getAdminDb } from "@/app/lib/firebaseAdmin";
import { normalizeName } from "@/app/lib/nameMatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORKSPACE_ID = "default";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function checkApiKey(req: Request): boolean {
  const key = req.headers.get("x-api-key");
  if (!key) return false;
  const allowed = (process.env.SHIFT_ATTENDANCE_API_KEY ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return allowed.includes(key);
}

export async function POST(req: Request) {
  if (!process.env.SHIFT_ATTENDANCE_API_KEY) {
    return Response.json(
      { ok: false, error: "server not configured (SHIFT_ATTENDANCE_API_KEY)" },
      { status: 503, headers: CORS_HEADERS }
    );
  }
  if (!checkApiKey(req)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  const body = (await req.json().catch(() => null)) as
    | { date?: string; absentNames?: unknown }
    | null;
  const date = typeof body?.date === "string" ? body.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json(
      { ok: false, error: "date must be YYYY-MM-DD" },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  const incoming = Array.isArray(body?.absentNames)
    ? body!.absentNames.filter((n): n is string => typeof n === "string" && n.trim() !== "")
    : [];

  const db = getAdminDb();
  if (!db) {
    return Response.json(
      { ok: false, error: "server not configured (FIREBASE_SERVICE_ACCOUNT)" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const ref = db.collection("workspace").doc(WORKSPACE_ID);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    let data: Record<string, unknown> = {};
    const raw = snap.exists ? snap.get("json") : null;
    if (typeof raw === "string") {
      try {
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        // 壊れたデータは触らない（上書きして消さないため）
        return { ok: false as const, error: "stored data is not readable" };
      }
    }

    // 既にこのアプリが持っている児童名にそろえる。
    // 児童名がそのままIDなので、表記が1文字違うと別人として増えてしまう
    const known = new Set<string>();
    for (const key of ["presentByDate", "absentByDate"]) {
      const byDate = data[key] as Record<string, string[]> | undefined;
      for (const list of Object.values(byDate ?? {})) for (const n of list) known.add(n);
    }
    const byNormalized = new Map<string, string>();
    for (const n of known) {
      const k = normalizeName(n);
      if (!byNormalized.has(k)) byNormalized.set(k, n);
    }
    const matched: string[] = [];
    const unmatched: string[] = [];
    for (const n of incoming) {
      const hit = byNormalized.get(normalizeName(n));
      if (hit) matched.push(hit);
      else unmatched.push(n);
    }

    const prev = (data.transportAbsences as Record<string, string[]> | undefined) ?? {};
    const next = { ...prev };
    // その日ぶんは毎回まるごと置き換える（送迎アプリ側でお休みを取り消したら、
    // こちらも休みでなくなるようにするため）
    if (matched.length > 0) next[date] = [...new Set(matched)].sort((a, b) => a.localeCompare(b, "ja"));
    else delete next[date];

    tx.set(ref, { json: JSON.stringify({ ...data, transportAbsences: next }) }, { merge: true });
    return { ok: true as const, applied: matched, unmatched };
  });

  if (!result.ok) {
    return Response.json(result, { status: 500, headers: CORS_HEADERS });
  }
  return Response.json(
    { ok: true, date, applied: result.applied, unmatched: result.unmatched },
    { headers: CORS_HEADERS }
  );
}
