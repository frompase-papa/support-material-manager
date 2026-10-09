// 送迎管理アプリから、その月の出欠（利用／休み）を取ってくる中継API。
//
// 送迎アプリ側は児童の氏名を返すので合言葉（APIキー）が必要。
// そのキーをブラウザに出さないよう、ここ（サーバー）で付けて呼ぶ。
//
// 必要な環境変数
//   SHIFT_ATTENDANCE_API_KEY … 送迎アプリの ATTENDANCE_API_KEY と同じ値
//   SHIFT_APP_BASE           … 送迎アプリのURL（未設定なら本番URLを使う）

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_BASE = "https://shift-manager-self.vercel.app";

export async function GET(req: Request) {
  const key = process.env.SHIFT_ATTENDANCE_API_KEY;
  if (!key) {
    return Response.json(
      {
        ok: false,
        error:
          "送迎アプリとの連携が未設定です。Vercelの環境変数 SHIFT_ATTENDANCE_API_KEY を設定してください。",
      },
      { status: 503 }
    );
  }

  const month = new URL(req.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ ok: false, error: "month must be YYYY-MM" }, { status: 400 });
  }

  const base = (process.env.SHIFT_APP_BASE || DEFAULT_BASE).replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/api/attendance?month=${month}`, {
      headers: { "x-api-key": key },
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { ok: false, error: "送迎アプリに接続できませんでした。通信環境を確認してください。" },
      { status: 502 }
    );
  }

  if (res.status === 401) {
    return Response.json(
      { ok: false, error: "送迎アプリに拒否されました。両方のAPIキーが同じ値か確認してください。" },
      { status: 502 }
    );
  }
  if (!res.ok) {
    return Response.json(
      { ok: false, error: `送迎アプリがエラーを返しました（${res.status}）。` },
      { status: 502 }
    );
  }

  const data = await res.json().catch(() => null);
  if (!data || !data.ok) {
    return Response.json(
      { ok: false, error: "送迎アプリの返事を読み取れませんでした。" },
      { status: 502 }
    );
  }
  return Response.json(data);
}
