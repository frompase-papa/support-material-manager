// Firebase クライアント初期化。
//
// この firebaseConfig は「Webアプリに埋め込む前提の公開設定」であり、
// 秘密情報ではない（誰でもアプリのJSから見える性質のもの）。
// データ保護は Firebase Authentication（ログイン）＋ Firestore セキュリティルール
// （request.auth != null）で担保している。

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCb-dTKTvOQPhBmUnAiQCPWsFVaDHsEO-E",
  authDomain: "support-material-manager-5da03.firebaseapp.com",
  projectId: "support-material-manager-5da03",
  storageBucket: "support-material-manager-5da03.firebasestorage.app",
  messagingSenderId: "347757534509",
  appId: "1:347757534509:web:a4eeaa59482b9a0ba107a4",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

/** 共有ワークスペースのドキュメントID（施設で1つのデータを共有） */
export const WORKSPACE_ID = "default";
