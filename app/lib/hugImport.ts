// HUG の出席カレンダー（コピペしたテキスト）を解析する。
//
// 想定フォーマット（1日分の例）:
//   1
//   出席11人
//   山中　潤
//   中田　陽葵
//   ...
//   欠席Ⅰ1人
//   大橋　拓真
//
// ・日番号は数字のみの行（祝日ラベル付きの場合は「海の日 20」のように末尾が数字）
// ・「出席N人」以降が出席児童、「欠席…N人」以降が欠席児童
// ・29〜31日などは名前の直後に「迎HH:MM  送HH:MM」の送迎時刻行が入る
// ・日曜など休業日は「出席0人」で児童名が無い

import { toDateKey } from "@/app/lib/date";

export interface ParsedDay {
  day: number;
  dateKey: string; // YYYY-MM-DD
  holiday?: string;
  present: string[];
  absent: string[];
  /** 児童名 -> 送迎時刻（あれば） */
  times: Record<string, { pickup?: string; dropoff?: string }>;
}

export interface ParsedMonth {
  year: number;
  month: number; // 1-12
  days: ParsedDay[];
  presentByDate: Record<string, string[]>;
  absentByDate: Record<string, string[]>;
  studentNames: string[];
}

const RE_PRESENT = /^出席(\d+)人$/;
const RE_ABSENT = /^欠席[^0-9]*(\d+)人$/;
const RE_WEEKDAY_HEADER = /^[日月火水木金土\s　]+$/;
const RE_TIME = /\d{1,2}:\d{2}/; // 非グローバル（状態を持たせない）
// 日番号行（祝日ラベル付きも許容）: 末尾が 1〜31 の数字
const RE_DAY = /^(?:(.*\S)[\s　]+)?(\d{1,2})$/;

function normalize(line: string): string {
  return line.trim();
}

/** 「迎10:00  送17:00」から送迎時刻を抽出 */
function parseTimes(line: string): { pickup?: string; dropoff?: string } {
  const result: { pickup?: string; dropoff?: string } = {};
  const pickupMatch = line.match(/迎\s*(\d{1,2}:\d{2})/);
  const dropoffMatch = line.match(/送\s*(\d{1,2}:\d{2})/);
  if (pickupMatch) result.pickup = pickupMatch[1];
  if (dropoffMatch) result.dropoff = dropoffMatch[1];
  return result;
}

/**
 * HUG の貼り付けテキストを解析して、指定した年月の出席データに変換する。
 */
export function parseHugMonth(
  text: string,
  year: number,
  month: number
): ParsedMonth {
  const lines = text.split(/\r?\n/);
  const days: ParsedDay[] = [];

  let current: ParsedDay | null = null;
  let mode: "present" | "absent" | null = null;
  let lastName: string | null = null;

  const pushCurrent = () => {
    if (current) days.push(current);
  };

  for (const raw of lines) {
    const line = normalize(raw);
    if (!line) continue;

    // 曜日ヘッダー行はスキップ
    if (RE_WEEKDAY_HEADER.test(line) && !/\d/.test(line)) continue;

    // 出席人数
    const presentMatch = line.match(RE_PRESENT);
    if (presentMatch) {
      mode = "present";
      lastName = null;
      continue;
    }

    // 欠席人数
    const absentMatch = line.match(RE_ABSENT);
    if (absentMatch) {
      mode = "absent";
      lastName = null;
      continue;
    }

    // 送迎時刻行（直前の出席児童に紐付け）
    if ((line.includes("迎") || line.includes("送")) && RE_TIME.test(line)) {
      if (current && lastName && mode === "present") {
        current.times[lastName] = parseTimes(line);
      }
      continue;
    }

    // 日番号行（新しい日の開始）
    const dayMatch = line.match(RE_DAY);
    if (dayMatch) {
      const day = parseInt(dayMatch[2], 10);
      if (day >= 1 && day <= 31) {
        pushCurrent();
        current = {
          day,
          dateKey: toDateKey(new Date(year, month - 1, day)),
          holiday: dayMatch[1]?.trim() || undefined,
          present: [],
          absent: [],
          times: {},
        };
        mode = null;
        lastName = null;
        continue;
      }
    }

    // それ以外は児童名
    if (current && mode) {
      if (mode === "present") current.present.push(line);
      else current.absent.push(line);
      lastName = line;
    }
  }
  pushCurrent();

  // 集計
  const presentByDate: Record<string, string[]> = {};
  const absentByDate: Record<string, string[]> = {};
  const names = new Set<string>();

  for (const d of days) {
    if (d.present.length > 0) presentByDate[d.dateKey] = d.present;
    if (d.absent.length > 0) absentByDate[d.dateKey] = d.absent;
    d.present.forEach((n) => names.add(n));
    d.absent.forEach((n) => names.add(n));
  }

  return {
    year,
    month,
    days,
    presentByDate,
    absentByDate,
    studentNames: [...names],
  };
}
