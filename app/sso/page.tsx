"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/app/lib/firebase";

// 送迎管理アプリの「支援アプリ」アイコンから開かれたときの入口。
// URLの「#token=…」の通行証をサーバーで確かめてログインし、トップへ移る。
// 通行証は「#」の後ろにあるので、サーバーのログや参照元には残らない。
export default function SsoPage() {
  const [message, setMessage] = useState("ログインしています…");
  const [failed, setFailed] = useState(false);
  // 失敗の理由（原因を調べる手がかりとして画面に出す）
  const [detail, setDetail] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(location.hash.replace(/^#/, "")).get("token");
    // 通行証をアドレス欄に残さない（コピーされても使われないように）
    history.replaceState(null, "", location.pathname);
    if (!token) {
      location.replace("/");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/sso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = (await res.json().catch(() => null)) as { ok: boolean; customToken?: string; error?: string } | null;
        if (!json?.ok || !json.customToken) {
          throw new Error(`通行証の確認 (${res.status}): ${json?.error ?? "応答を読めませんでした"}`);
        }
        try {
          await signInWithCustomToken(auth, json.customToken);
        } catch (e) {
          throw new Error(`ログイン処理: ${(e as { code?: string }).code ?? (e as Error).message}`);
        }
        location.replace("/");
      } catch (e) {
        setDetail((e as Error).message);
        setFailed(true);
        setMessage("自動ログインできませんでした。");
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-zinc-500">
      <p>{message}</p>
      {failed && detail && <p className="max-w-sm break-words px-4 text-xs text-zinc-400">原因: {detail}</p>}
      {failed && (
        <Link href="/" className="text-blue-600 underline">
          ログイン画面へ（メールアドレスとパスワードで入る）
        </Link>
      )}
    </div>
  );
}
