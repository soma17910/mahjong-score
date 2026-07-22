// ============================================================
// 牌（パイ）の定義とユーティリティ
//
// 麻雀の牌は全部で34種類：
//   萬子(m) 1〜9、筒子(p) 1〜9、索子(s) 1〜9、字牌(z) 1〜7
//   字牌の内訳： 1=東 2=南 3=西 4=北（風牌）／ 5=白 6=發 7=中（三元牌）
//
// このアプリでは各牌を 0〜33 の「インデックス」で表します：
//   0〜8   : 1m〜9m
//   9〜17  : 1p〜9p
//   18〜26 : 1s〜9s
//   27〜33 : 1z〜7z
// ============================================================

export type Suit = 'm' | 'p' | 's' | 'z';

export const TILE_KINDS = 34;

/** 表示用ラベル（ボタンや結果に出す文字） */
export const TILE_LABELS: string[] = [
  '1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m',
  '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p',
  '1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s',
  '東', '南', '西', '北', '白', '發', '中',
];

/** スート（種類）を返す */
export function suitOf(idx: number): Suit {
  if (idx < 9) return 'm';
  if (idx < 18) return 'p';
  if (idx < 27) return 's';
  return 'z';
}

/** 牌の数字を返す（萬筒索は1〜9、字牌は1〜7） */
export function numOf(idx: number): number {
  if (idx < 27) return (idx % 9) + 1;
  return idx - 27 + 1;
}

/** 数牌（萬・筒・索）かどうか */
export function isSuitTile(idx: number): boolean {
  return idx < 27;
}

/** 字牌かどうか */
export function isHonor(idx: number): boolean {
  return idx >= 27;
}

/** 風牌（東南西北）かどうか */
export function isWind(idx: number): boolean {
  return idx >= 27 && idx <= 30;
}

/** 三元牌（白發中）かどうか */
export function isDragon(idx: number): boolean {
  return idx >= 31 && idx <= 33;
}

/** 老頭牌（数牌の1と9）かどうか */
export function isTerminal(idx: number): boolean {
  if (!isSuitTile(idx)) return false;
  const n = numOf(idx);
  return n === 1 || n === 9;
}

/** 么九牌（1・9・字牌）かどうか — タンヤオ判定などに使う */
export function isTerminalOrHonor(idx: number): boolean {
  return isHonor(idx) || isTerminal(idx);
}

/** 風牌の番号（東=1, 南=2, 西=3, 北=4）。風牌以外は0 */
export function windNumber(idx: number): number {
  if (!isWind(idx)) return 0;
  return idx - 27 + 1;
}

/** インデックスを作る（テスト・パース用） */
export function makeIndex(suit: Suit, num: number): number {
  switch (suit) {
    case 'm':
      return num - 1;
    case 'p':
      return 9 + num - 1;
    case 's':
      return 18 + num - 1;
    case 'z':
      return 27 + num - 1;
  }
}

/**
 * 表記文字列を牌インデックスの配列に変換する（主にテスト用）。
 * 例: "123m 456p 77z" → [0,1,2, 12,13,14, 33,33]
 *   数字の並びのあとにスート文字(m/p/s/z)を置く。空白は無視。
 */
export function parseTiles(str: string): number[] {
  const result: number[] = [];
  let digits: number[] = [];
  for (const ch of str) {
    if (ch >= '1' && ch <= '9') {
      digits.push(Number(ch));
    } else if (ch === 'm' || ch === 'p' || ch === 's' || ch === 'z') {
      for (const d of digits) result.push(makeIndex(ch, d));
      digits = [];
    }
    // それ以外（空白など）は無視
  }
  return result;
}

/** 牌インデックス配列 → 34要素のカウント配列 */
export function toCounts(tiles: number[]): number[] {
  const counts = new Array(TILE_KINDS).fill(0);
  for (const t of tiles) counts[t]++;
  return counts;
}
