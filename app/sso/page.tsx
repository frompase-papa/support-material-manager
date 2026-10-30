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
        const json = (await res.json()) as { ok: boolean; customToken?: string; error?: string };
        if (!json.ok || !json.customToken) throw new Error(json.error ?? "ログインできませんでした");
        await signInWithCustomToken(auth, json.customToken);
        location.replace("/");
      } catch {
        setFailed(true);
        setMessage("自動ログインできませんでした。");
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-zinc-500">
      <p>{message}</p>
      {failed && (
        <Link href="/" className="text-blue-600 underline">
          ログイン画面へ（メールアドレスとパスワードで入る）
        </Link>
      )}
    </div>
  );
}
