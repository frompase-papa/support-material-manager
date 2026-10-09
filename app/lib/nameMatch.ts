// 送迎アプリから来た児童名を、支援アプリが持っている児童名に合わせる。
//
// この支援アプリは児童名そのものをIDにしているので、表記が1文字違うと
// 別人として増えてしまう。送迎アプリは「山中 潤」（半角スペース）、
// 支援アプリはHUG由来で「山中　潤」（全角スペース）のことが多いため、
// そのまま入れると名簿が二重になる。
//
// そこで「スペースを抜き、漢字の異体字をそろえた形」で突き合わせ、
// 一致したら支援アプリ側の名前に置き換える。一致しない子は呼び出し側へ返して
// 画面に出す（黙って新しい児童として増やさないため）。

// 送迎アプリと同じ対応表。氏名に出てくる異体字をそろえる
const KANJI_NORMALIZE: Record<string, string> = {
  "渕": "淵", "淵": "淵", "斉": "斎", "齊": "斎", "斎": "斎",
  "髙": "高", "﨑": "崎", "邊": "辺", "邉": "辺", "濱": "浜", "濵": "浜",
  "廣": "広", "國": "国", "圀": "国", "澤": "沢", "龍": "竜",
  "壽": "寿", "惠": "恵", "櫻": "桜", "總": "総", "萬": "万",
  "冨": "富", "嶋": "島", "舘": "館", "塚": "塚", "德": "徳",
  "猪": "猪", "鷗": "鷗", "條": "条", "眞": "真", "靜": "静",
};

/** 突き合わせ用の形にそろえる（スペースを抜き、異体字をそろえる） */
export function normalizeName(name: string): string {
  return [...name.replace(/[\s　]+/g, "")]
    .map((ch) => KANJI_NORMALIZE[ch] || ch)
    .join("");
}

export interface NameMapResult {
  /** 送迎アプリの名前 → 支援アプリの名前 */
  map: Map<string, string>;
  /** 支援アプリ側に見つからなかった名前（新しい児童として入る） */
  unmatched: string[];
}

/**
 * 送迎アプリの名前を、既にある児童名へ対応づける。
 * @param incoming 送迎アプリから来た名前
 * @param existing 支援アプリが持っている児童名
 */
export function buildNameMap(incoming: string[], existing: string[]): NameMapResult {
  const byNormalized = new Map<string, string>();
  for (const name of existing) {
    const key = normalizeName(name);
    // 同じ形の名前が複数あるときは、先に出てきたものを使う
    if (!byNormalized.has(key)) byNormalized.set(key, name);
  }

  const map = new Map<string, string>();
  const unmatched: string[] = [];
  for (const name of incoming) {
    const hit = byNormalized.get(normalizeName(name));
    if (hit) map.set(name, hit);
    else unmatched.push(name);
  }
  return { map, unmatched };
}

/** 対応表にしたがって名前を置き換える（無ければそのまま） */
export function applyNameMap(names: string[], map: Map<string, string>): string[] {
  return names.map((n) => map.get(n) ?? n);
}
