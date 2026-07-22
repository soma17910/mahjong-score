// ============================================================
// 麻雀 点数計算ロジック（外部ライブラリ不使用・自前実装）
//
// 用語メモ（初心者向け）
//   翻(han) : 役の大きさ。大きいほど高得点。
//   符(fu)  : 細かい点数調整。20符を基準に加算される。
//   親(dealer)   : 点数が約1.5倍になるプレイヤー。
//   子(nondealer): 親以外の3人。
//   ロン(ron)    : 他人の捨て牌で上がる → 放銃者1人が全額支払う。
//   ツモ(tsumo)  : 自分で引いて上がる   → 他3人で分担して支払う。
//   本場(honba)  : 連荘の回数。1本場ごとに点数が加算される。
// ============================================================

/** 席：親か子か */
export type Seat = 'dealer' | 'nondealer';

/** 上がり方：ロンかツモか */
export type WinType = 'ron' | 'tsumo';

/** 計算の入力 */
export interface ScoreInput {
  /** 翻数 */
  han: number;
  /** 符数 */
  fu: number;
  /** 親か子か */
  seat: Seat;
  /** ロンかツモか */
  winType: WinType;
  /** 本場の数（0以上） */
  honba: number;
}

/** ロンのときの支払い内訳 */
export interface RonBreakdown {
  kind: 'ron';
  /** 放銃者（振り込んだ人）が支払う点数 */
  fromDiscarder: number;
}

/** ツモのときの支払い内訳 */
export interface TsumoBreakdown {
  kind: 'tsumo';
  /** 親が支払う点数（子が上がったときのみ。親自身が上がった場合は undefined） */
  fromDealer?: number;
  /** 子1人あたりが支払う点数 */
  fromNonDealer: number;
}

/** 計算結果 */
export interface ScoreResult {
  /** 上がった人が獲得する合計点（本場分を含む） */
  total: number;
  /** 満貫以上の場合の呼び名（例: '満貫'）。通常役は空文字。 */
  limitName: string;
  /** 満貫以上に達しているか */
  isLimit: boolean;
  /** 丸め前の基本点 */
  basePoints: number;
  /** 支払い内訳 */
  breakdown: RonBreakdown | TsumoBreakdown;
}

/** 100点単位で切り上げる */
export function ceil100(n: number): number {
  return Math.ceil(n / 100) * 100;
}

/**
 * 基本点と満貫以上の呼び名を求める。
 *
 * ・翻が大きいと点数が頭打ちになる（満貫→跳満→倍満→三倍満→役満）。
 * ・1〜4翻は「符 × 2^(2+翻)」で計算し、2000以上なら満貫に切り上げ。
 *   （この計算により「4翻40符」「3翻70符以上」も自動的に満貫になる）
 */
export function baseAndLimit(han: number, fu: number): { base: number; limitName: string } {
  if (han >= 13) return { base: 8000, limitName: '数え役満' };
  if (han >= 11) return { base: 6000, limitName: '三倍満' };
  if (han >= 8) return { base: 4000, limitName: '倍満' };
  if (han >= 6) return { base: 3000, limitName: '跳満' };
  if (han === 5) return { base: 2000, limitName: '満貫' };

  // 1〜4翻：符から計算
  const base = fu * Math.pow(2, 2 + han);
  if (base >= 2000) return { base: 2000, limitName: '満貫' };
  return { base, limitName: '' };
}

/**
 * 基本点と親子・ロン/ツモ・本場から、支払い内訳と合計点を求める。
 * （満貫以上の丸めは baseAndLimit 側で済んでいる前提。役満などで
 *  直接 base を渡したいフェーズ2からも再利用する）
 */
export function scoreFromBase(
  base: number,
  seat: Seat,
  winType: WinType,
  honba: number,
): { total: number; breakdown: RonBreakdown | TsumoBreakdown } {
  if (winType === 'ron') {
    // ロン：放銃者1人が支払う。子は基本点×4、親は基本点×6。
    const mult = seat === 'dealer' ? 6 : 4;
    const fromDiscarder = ceil100(base * mult) + honba * 300;
    return { total: fromDiscarder, breakdown: { kind: 'ron', fromDiscarder } };
  }

  // ツモ：他3人が分担して支払う。本場は各家 +100/本場。
  if (seat === 'dealer') {
    // 親ツモ：子3人がそれぞれ 基本点×2 を支払う。
    const fromNonDealer = ceil100(base * 2) + honba * 100;
    return { total: fromNonDealer * 3, breakdown: { kind: 'tsumo', fromNonDealer } };
  } else {
    // 子ツモ：親は 基本点×2、子2人はそれぞれ 基本点×1 を支払う。
    const fromDealer = ceil100(base * 2) + honba * 100;
    const fromNonDealer = ceil100(base * 1) + honba * 100;
    const total = fromDealer + fromNonDealer * 2;
    return { total, breakdown: { kind: 'tsumo', fromDealer, fromNonDealer } };
  }
}

/**
 * 点数を計算する。
 */
export function calcScore(input: ScoreInput): ScoreResult {
  const { han, fu, seat, winType, honba } = input;
  const { base, limitName } = baseAndLimit(han, fu);
  const { total, breakdown } = scoreFromBase(base, seat, winType, honba);
  return {
    total,
    limitName,
    isLimit: limitName !== '',
    basePoints: base,
    breakdown,
  };
}
