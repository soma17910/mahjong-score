// ============================================================
// 和了形（アガリのかたち）の判定・分解
//
// 標準的なアガリは「4つの面子（メンツ）＋1つの雀頭（ジャントウ）」。
//   面子 : 順子（連続3枚 例 234）または 刻子（同じ3枚 例 555）
//   雀頭 : 同じ2枚（アタマ）
// これに加えて、特殊形として「七対子（2枚ペア×7）」と
// 「国士無双（么九牌13種＋どれか1枚）」があります。
// ============================================================

import { isSuitTile, numOf, isTerminalOrHonor, TILE_KINDS } from './tiles';

export type MeldType = 'shuntsu' | 'kotsu';

/** 面子（順子 or 刻子） */
export interface Meld {
  type: MeldType;
  /** 構成牌のインデックス（順子は昇順3枚、刻子は同じ3枚） */
  tiles: number[];
}

/** 標準形の分解結果（雀頭＋4面子） */
export interface StandardDecomp {
  /** 雀頭の牌インデックス */
  pair: number;
  /** 4つの面子 */
  melds: Meld[];
}

/** カウント配列で、start以降で最初に残っている牌のインデックスを返す */
function firstNonZero(counts: number[], start: number): number {
  for (let i = start; i < TILE_KINDS; i++) {
    if (counts[i] > 0) return i;
  }
  return -1;
}

/**
 * 残りの牌（雀頭を除いた12枚）を面子だけに分解する全パターンを返す。
 * 分解できない場合は空配列。
 */
function extractMelds(counts: number[], start: number): Meld[][] {
  const i = firstNonZero(counts, start);
  if (i === -1) return [[]]; // すべて使い切った＝1通り（空の面子リスト）

  const results: Meld[][] = [];

  // 刻子（同じ牌3枚）を作れるか
  if (counts[i] >= 3) {
    counts[i] -= 3;
    for (const rest of extractMelds(counts, i)) {
      results.push([{ type: 'kotsu', tiles: [i, i, i] }, ...rest]);
    }
    counts[i] += 3;
  }

  // 順子（連続3枚）を作れるか（数牌のみ、同じスート内で i, i+1, i+2）
  if (isSuitTile(i) && numOf(i) <= 7) {
    if (counts[i] > 0 && counts[i + 1] > 0 && counts[i + 2] > 0) {
      counts[i]--;
      counts[i + 1]--;
      counts[i + 2]--;
      for (const rest of extractMelds(counts, i)) {
        results.push([{ type: 'shuntsu', tiles: [i, i + 1, i + 2] }, ...rest]);
      }
      counts[i]++;
      counts[i + 1]++;
      counts[i + 2]++;
    }
  }

  return results;
}

/**
 * 14枚の手牌を「雀頭＋4面子」の標準形に分解する全パターンを返す。
 * 成立しなければ空配列。
 */
export function decomposeStandard(counts: number[]): StandardDecomp[] {
  const results: StandardDecomp[] = [];
  for (let p = 0; p < TILE_KINDS; p++) {
    if (counts[p] >= 2) {
      counts[p] -= 2;
      const meldSets = extractMelds(counts, 0);
      for (const melds of meldSets) {
        if (melds.length === 4) {
          results.push({ pair: p, melds });
        }
      }
      counts[p] += 2;
    }
  }
  return results;
}

/** 七対子（同じ2枚のペアが7種類）かどうか判定し、成立なら7牌を返す */
export function detectChiitoitsu(counts: number[]): number[] | null {
  const pairs: number[] = [];
  for (let i = 0; i < TILE_KINDS; i++) {
    if (counts[i] === 0) continue;
    if (counts[i] === 2) {
      pairs.push(i);
    } else {
      return null; // 2枚以外がある（4枚使いは七対子として認めない）
    }
  }
  return pairs.length === 7 ? pairs : null;
}

/** 国士無双（么九牌13種すべて＋いずれか1枚が2枚）かどうか判定 */
export function detectKokushi(counts: number[]): boolean {
  const yaochu: number[] = [];
  for (let i = 0; i < TILE_KINDS; i++) {
    if (isTerminalOrHonor(i)) yaochu.push(i);
  }
  // 么九牌以外が含まれていたら不成立
  for (let i = 0; i < TILE_KINDS; i++) {
    if (counts[i] > 0 && !isTerminalOrHonor(i)) return false;
  }
  let hasPair = false;
  for (const i of yaochu) {
    if (counts[i] === 0) return false; // 13種すべて必要
    if (counts[i] === 2) hasPair = true;
    if (counts[i] > 2) return false;
  }
  return hasPair;
}
