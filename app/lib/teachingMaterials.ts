// 教材マスタ（登録して管理する実際の教材：プリント・PDF・Webサイト等）。
//
// 既存の Material（"curriculum" | "tablet"）は「提供モード」を表すもので別概念。
// こちらは1枚1枚の教材そのもの（タイトル・URL・種別）を表す。

export type TeachingMaterialType = "free" | "sst" | "other";

export const TM_TYPE_LABEL: Record<TeachingMaterialType, string> = {
  free: "自由問題",
  sst: "SST",
  other: "その他",
};

export const TM_TYPE_OPTIONS: { value: TeachingMaterialType; label: string }[] = [
  { value: "free", label: TM_TYPE_LABEL.free },
  { value: "sst", label: TM_TYPE_LABEL.sst },
  { value: "other", label: TM_TYPE_LABEL.other },
];

export interface TeachingMaterial {
  id: string;
  title: string;
  url: string; // Webサイト or GoogleドライブPDF 等
  type: TeachingMaterialType;
}

/** 教材選定の1日あたり上限（自由問題2＋SST1、または自由問題3 の運用） */
export const MAX_MATERIALS_PER_DAY = 3;

/** 種別バッジの色クラス */
export function tmTypeBadgeClass(type: TeachingMaterialType): string {
  switch (type) {
    case "free":
      return "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300";
    case "sst":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
    default:
      return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

/** 新規教材のID生成（ユーザー操作時のみ＝クライアントで呼ばれる） */
export function newMaterialId(): string {
  return "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** 初期ダミー教材（動作確認用） */
export const DEFAULT_TEACHING_MATERIALS: TeachingMaterial[] = [
  {
    id: "m1",
    title: "算数：たし算・ひき算プリント",
    url: "https://drive.google.com/file/d/1DUMMY-tashizan/view?usp=sharing",
    type: "free",
  },
  {
    id: "m2",
    title: "算数：かけ算九九プリント",
    url: "https://drive.google.com/file/d/1DUMMY-kuku/view?usp=sharing",
    type: "free",
  },
  {
    id: "m3",
    title: "算数：時計の読み方プリント",
    url: "https://drive.google.com/file/d/1DUMMY-tokei/view?usp=sharing",
    type: "free",
  },
  {
    id: "m4",
    title: "算数：お金の計算プリント",
    url: "https://drive.google.com/file/d/1DUMMY-okane/view?usp=sharing",
    type: "free",
  },
  {
    id: "m5",
    title: "国語：漢字練習プリント（小3〜4）",
    url: "https://drive.google.com/file/d/1DUMMY-kanji/view?usp=sharing",
    type: "free",
  },
  {
    id: "m6",
    title: "国語：読解プリント（物語文）",
    url: "https://drive.google.com/file/d/1DUMMY-dokkai/view?usp=sharing",
    type: "free",
  },
  {
    id: "m7",
    title: "国語：ことわざ・慣用句プリント",
    url: "https://drive.google.com/file/d/1DUMMY-kotowaza/view?usp=sharing",
    type: "free",
  },
  {
    id: "m8",
    title: "SST：きもちの理解カード",
    url: "https://drive.google.com/file/d/1DUMMY-kimochi/view?usp=sharing",
    type: "sst",
  },
  {
    id: "m9",
    title: "SST：あいさつ・会話ロールプレイ",
    url: "https://drive.google.com/file/d/1DUMMY-aisatsu/view?usp=sharing",
    type: "sst",
  },
  {
    id: "m10",
    title: "SST：順番を待つ練習シート",
    url: "https://drive.google.com/file/d/1DUMMY-junban/view?usp=sharing",
    type: "sst",
  },
  {
    id: "m11",
    title: "タイピング練習（Webサイト）",
    url: "https://example.com/typing-practice",
    type: "other",
  },
  {
    id: "m12",
    title: "ぬりえプリント",
    url: "https://drive.google.com/file/d/1DUMMY-nurie/view?usp=sharing",
    type: "other",
  },
];
