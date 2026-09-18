// 専門支援マスタ（専門的支援として実際に提供する内容そのもの）。
//
// 教材マスタ（TeachingMaterial）とは別概念。
// 教材は「カリキュラムの生徒に選定するプリント等」だが、専門支援は
// **カリキュラム／タブレットのどちらの生徒にも**割り当てられる。

export interface SupportProgram {
  id: string;
  /** 名称（必須）。例：「感覚統合：バランス運動」 */
  title: string;
  /** 内容・進め方の文章（任意）。改行をそのまま表示する。 */
  body: string;
  /** 参考サイトや資料のURL（任意） */
  url: string;
}

/** 新規の専門支援ID生成（ユーザー操作時のみ＝クライアントで呼ばれる） */
export function newSupportProgramId(): string {
  return "sp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** http(s) のURLだけを許可する（javascript: 等をそのまま開かないため） */
export function isSafeHttpUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
