// 送迎管理アプリから「生徒ごとの学習設定（SSTの有無・プリント枚数）」を受け取って保存するAPI。
//
// 送迎アプリの児童管理で設定を変えると、ここが呼ばれる。設定は送迎アプリを正とするので、
// 届いた生徒の分は毎回まるごと置き換える。保存先は workspace ドキュメントの studentStudy
// （児童名 -> { hasSST, printCount }）。月の取込や画面の保存で消えないよう、出欠と同じく専用の欄にしてある。
//
// 認証: ヘッダー x-api-key が SHIFT_ATTENDANCE_API_KEY と一致すること（/api/absence と同じ合言葉）。

import { getAdminDb } from "@/app/lib/firebaseAdmin";
import { normalizeName } from "@/app/lib/nameMatch";
import { MAX_PRINT_COUNT, type StudentStudy } from "@/app/lib/teachingMaterials";

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

  const body = (await req.json().catch(() => null)) as { children?: unknown } | null;
  if (!Array.isArray(body?.children)) {
    return Response.json({ ok: false, error: "children must be an array" }, { status: 400, headers: CORS_HEADERS });
  }
  const incoming: { name: string; study: StudentStudy }[] = [];
  for (const c of body.children as Record<string, unknown>[]) {
    const name = typeof c?.name === "string" ? c.name.trim() : "";
    if (!name) continue;
    const n = Math.round(Number(c.printCount));
    incoming.push({
      name,
      study: {
        hasSST: c.hasSST !== false && c.hasSST !== 0,
        printCount: Number.isFinite(n) ? Math.max(1, Math.min(MAX_PRINT_COUNT, n)) : 3,
      },
    });
  }

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

    // 既にこのアプリが持っている児童名にそろえる（児童名がそのままIDなので、表記ゆれで別人にしない）
    const known = new Set<string>();
    for (const key of ["presentByDate", "absentByDate", "transportAdditions", "supportAdditions"]) {
      const byDate = data[key] as Record<string, string[]> | undefined;
      for (const list of Object.values(byDate ?? {})) for (const n of list) known.add(n);
    }
    for (const n of Object.keys((data.typeById as Record<string, unknown> | undefined) ?? {})) known.add(n);
    const byNormalized = new Map<string, string>();
    for (const n of known) {
      const k = normalizeName(n);
      if (!byNormalized.has(k)) byNormalized.set(k, n);
    }

    // 届いた生徒の分だけ置き換える（届かなかった生徒の設定は残す）
    const next: Record<string, StudentStudy> = {
      ...((data.studentStudy as Record<string, StudentStudy> | undefined) ?? {}),
    };
    const unmatched: string[] = [];
    for (const { name, study } of incoming) {
      const hit = byNormalized.get(normalizeName(name));
      if (!hit) unmatched.push(name);
      next[hit ?? name] = study;
    }

    tx.set(ref, { json: JSON.stringify({ ...data, studentStudy: next }) }, { merge: true });
    return { ok: true as const, count: incoming.length, unmatched };
  });

  if (!result.ok) {
    return Response.json(result, { status: 500, headers: CORS_HEADERS });
  }
  return Response.json(result, { headers: CORS_HEADERS });
}
