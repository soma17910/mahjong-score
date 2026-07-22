// ============================================================
// 手牌の自動解析：和了形の判定 → 役・翻・符 → 点数
//
// 前提：門前（鳴きなし）の手のみ対応。
//   門前 = ポン/チー/明カンをしていない状態。リーチ・ピンフ・
//   一盃口などは門前が条件のため、初心者の実戦にもよく合います。
// ============================================================

import {
  decomposeStandard,
  detectChiitoitsu,
  detectKokushi,
  type Meld,
  type StandardDecomp,
} from './agari';
import { scoreFromBase, type Seat, type ScoreResult, type Players } from './score';
import {
  isDragon,
  isHonor,
  isTerminalOrHonor,
  isWind,
  numOf,
  suitOf,
  windNumber,
  TILE_LABELS,
} from './tiles';

/** 解析に必要な状況 */
export interface HandContext {
  /** 和了牌（上がった牌）のインデックス */
  winningTile: number;
  /** ツモか（falseならロン） */
  isTsumo: boolean;
  /** リーチしているか */
  isRiichi: boolean;
  /** 自風（1=東 2=南 3=西 4=北）。東なら親 */
  seatWind: number;
  /** 場風（1=東 2=南） */
  roundWind: number;
  /** ドラの枚数（役ではないが翻を加算） */
  doraCount: number;
  /** 本場 */
  honba: number;
  /** ゲーム人数（省略時は4人） */
  players?: Players;
  /** 北抜きの枚数（3人麻雀の抜きドラ。1枚ごとに+1翻） */
  kita?: number;
  /** 北（字牌の北）を役牌として扱うか（ハウスルール。3人麻雀でよく使う） */
  northIsYakuhai?: boolean;
}

/** 北（字牌）の牌インデックス（27=東,28=南,29=西,30=北） */
const NORTH = 30;

export interface YakuItem {
  name: string;
  han: number;
}

export interface AnalyzeResult {
  /** 役あり・点数計算可能な和了か */
  ok: boolean;
  /** okでないときの理由（例: 役なし・和了形でない） */
  message?: string;
  /** 成立した役の一覧 */
  yaku: YakuItem[];
  /** 合計翻（ドラ含む・役満のときは無効） */
  han: number;
  /** 符 */
  fu: number;
  /** 点数結果 */
  score?: ScoreResult;
  /** 役満か */
  isYakuman: boolean;
  /** 役満の重複数（1=役満, 2=ダブル役満…） */
  yakumanCount: number;
  /** 和了形の種類 */
  form: '通常形' | '七対子' | '国士無双';
}

type WaitType = 'ryanmen' | 'kanchan' | 'penchan' | 'tanki' | 'shanpon';

const dealerOf = (ctx: HandContext): Seat => (ctx.seatWind === 1 ? 'dealer' : 'nondealer');

// ------------------------------------------------------------
// 補助判定
// ------------------------------------------------------------

/** その牌が役牌（三元牌・場風・自風）か */
function isYakuhaiTile(idx: number, ctx: HandContext): boolean {
  if (isDragon(idx)) return true;
  if (idx === NORTH && ctx.northIsYakuhai) return true;
  if (isWind(idx)) {
    const w = windNumber(idx);
    return w === ctx.seatWind || w === ctx.roundWind;
  }
  return false;
}

/** 標準形の全牌インデックスを列挙 */
function allTilesOf(decomp: StandardDecomp): number[] {
  const out: number[] = [decomp.pair, decomp.pair];
  for (const m of decomp.melds) out.push(...m.tiles);
  return out;
}

// ------------------------------------------------------------
// 待ちの種類を求める（フー計算・ピンフ判定に使用）
// ------------------------------------------------------------

/**
 * 和了牌がその面子/雀頭のどこにハマったかから、待ちの種類を求める。
 * groupKind: 'pair' なら単騎、'meld' なら該当面子で判定。
 */
function waitTypeFor(
  meld: Meld | null,
  isPair: boolean,
  winningTile: number,
): WaitType {
  if (isPair) return 'tanki'; // 雀頭で待っていた＝単騎
  if (!meld) return 'tanki';
  if (meld.type === 'kotsu') return 'shanpon'; // 刻子を完成＝シャンポン
  // 順子 [a, a+1, a+2]
  const a = meld.tiles[0];
  if (winningTile === a + 1) return 'kanchan'; // 真ん中で待ち＝嵌張
  if (winningTile === a) {
    // 下端で和了：残りは a+1, a+2。a==7(789)のときだけ辺張
    return numOf(a) === 7 ? 'penchan' : 'ryanmen';
  }
  // winningTile === a+2（上端）：残りは a, a+1。a==1(123)のときだけ辺張
  return numOf(a) === 1 ? 'penchan' : 'ryanmen';
}

// ------------------------------------------------------------
// 通常形（雀頭＋4面子）の役判定
// ------------------------------------------------------------

interface Interp {
  decomp: StandardDecomp;
  /** 和了牌がハマった面子のインデックス（雀頭のときは -1） */
  agariMeldIndex: number;
  waitType: WaitType;
}

function isPinfu(interp: Interp, ctx: HandContext): boolean {
  const { decomp } = interp;
  if (!decomp.melds.every((m) => m.type === 'shuntsu')) return false; // 全て順子
  if (isYakuhaiTile(decomp.pair, ctx)) return false; // 雀頭が役牌でない
  return interp.waitType === 'ryanmen'; // 両面待ち
}

/** 通常形の役を判定して返す（役満のときは yakuman に名前が入る） */
function detectStandardYaku(
  interp: Interp,
  ctx: HandContext,
): { yaku: YakuItem[]; yakuman: string[] } {
  const { decomp } = interp;
  const melds = decomp.melds;
  const all = allTilesOf(decomp);
  const yaku: YakuItem[] = [];
  const yakuman: string[] = [];

  // --- 各面子が明刻(ロンで完成)か暗刻かを判定 ---
  const kotsuIsConcealed = melds.map((m, i) => {
    if (m.type !== 'kotsu') return false;
    // ロンで、その刻子を和了牌で完成させた場合のみ明刻（＝暗刻でない）
    const openByRon = !ctx.isTsumo && interp.agariMeldIndex === i && interp.waitType === 'shanpon';
    return !openByRon;
  });
  const ankouCount = kotsuIsConcealed.filter(Boolean).length;
  const allKotsu = melds.every((m) => m.type === 'kotsu');

  // --- 使われているスート（数牌）と字牌の有無 ---
  const usedSuits = new Set(all.filter((t) => !isHonor(t)).map((t) => suitOf(t)));
  const hasHonor = all.some((t) => isHonor(t));

  // ============ 役満の判定 ============
  // 四暗刻
  if (allKotsu && ankouCount === 4) yakuman.push('四暗刻');
  // 大三元（白發中すべて刻子）
  const dragonKotsu = melds.filter((m) => m.type === 'kotsu' && isDragon(m.tiles[0])).length;
  if (dragonKotsu === 3) yakuman.push('大三元');
  // 字一色（全て字牌）
  if (all.every((t) => isHonor(t))) yakuman.push('字一色');

  if (yakuman.length > 0) {
    return { yaku, yakuman };
  }

  // ============ 通常役 ============
  // リーチ
  if (ctx.isRiichi) yaku.push({ name: 'リーチ', han: 1 });
  // 門前ツモ
  if (ctx.isTsumo) yaku.push({ name: '門前ツモ', han: 1 });
  // ピンフ
  if (isPinfu(interp, ctx)) yaku.push({ name: 'ピンフ', han: 1 });
  // タンヤオ（么九牌を含まない）
  if (all.every((t) => !isTerminalOrHonor(t))) yaku.push({ name: 'タンヤオ', han: 1 });

  // 役牌（刻子）
  for (const m of melds) {
    if (m.type !== 'kotsu') continue;
    const t = m.tiles[0];
    if (isDragon(t)) {
      const name = t === 31 ? '役牌 白' : t === 32 ? '役牌 發' : '役牌 中';
      yaku.push({ name, han: 1 });
    } else if (isWind(t)) {
      const w = windNumber(t);
      let counted = false;
      if (w === ctx.roundWind) {
        yaku.push({ name: '役牌 場風', han: 1 });
        counted = true;
      }
      if (w === ctx.seatWind) {
        yaku.push({ name: '役牌 自風', han: 1 });
        counted = true;
      }
      // ハウスルール：北を役牌にする（場風・自風で数えていないときのみ）
      if (t === NORTH && ctx.northIsYakuhai && !counted) {
        yaku.push({ name: '役牌 北', han: 1 });
      }
    }
  }

  // 小三元（三元牌のうち2種が刻子＋1種が雀頭）
  if (dragonKotsu === 2 && isDragon(decomp.pair)) {
    yaku.push({ name: '小三元', han: 2 });
  }

  // 一盃口 / 二盃口（同じ順子の重複）
  if (allShuntsuHasIdentical(melds)) {
    const pairsCnt = identicalShuntsuPairs(melds);
    if (pairsCnt >= 2) yaku.push({ name: '二盃口', han: 3 });
    else if (pairsCnt === 1) yaku.push({ name: '一盃口', han: 1 });
  }

  // 三色同順（同じ数字の順子が3スート）
  if (hasSanshoku(melds)) yaku.push({ name: '三色同順', han: 2 });

  // 一気通貫（同スートで 123/456/789）
  if (hasIttsu(melds)) yaku.push({ name: '一気通貫', han: 2 });

  // チャンタ / 純チャン（全ての面子・雀頭に么九牌）
  const chanta = detectChanta(decomp);
  if (chanta === 'junchan') yaku.push({ name: '純チャン', han: 3 });
  else if (chanta === 'chanta') yaku.push({ name: 'チャンタ', han: 2 });

  // 対々和
  if (allKotsu) yaku.push({ name: '対々和', han: 2 });

  // 三暗刻
  if (ankouCount === 3) yaku.push({ name: '三暗刻', han: 2 });

  // 混一色 / 清一色
  if (usedSuits.size === 1) {
    if (hasHonor) yaku.push({ name: '混一色', han: 3 });
    else yaku.push({ name: '清一色', han: 6 });
  }

  return { yaku, yakuman };
}

/** 面子の中に同じ順子が2枚以上あるか（一盃口系の前判定） */
function allShuntsuHasIdentical(melds: Meld[]): boolean {
  return identicalShuntsuPairs(melds) >= 1;
}

/** 同一順子のペア数（2組=一盃口1つ、4組=二盃口） */
function identicalShuntsuPairs(melds: Meld[]): number {
  const map = new Map<number, number>();
  for (const m of melds) {
    if (m.type !== 'shuntsu') continue;
    map.set(m.tiles[0], (map.get(m.tiles[0]) ?? 0) + 1);
  }
  let pairs = 0;
  for (const cnt of map.values()) pairs += Math.floor(cnt / 2);
  return pairs;
}

/** 三色同順が成立するか */
function hasSanshoku(melds: Meld[]): boolean {
  const shuntsu = melds.filter((m) => m.type === 'shuntsu');
  for (let n = 1; n <= 7; n++) {
    const suits = new Set<string>();
    for (const m of shuntsu) {
      if (numOf(m.tiles[0]) === n) suits.add(suitOf(m.tiles[0]));
    }
    if (suits.has('m') && suits.has('p') && suits.has('s')) return true;
  }
  return false;
}

/** 一気通貫が成立するか */
function hasIttsu(melds: Meld[]): boolean {
  for (const suit of ['m', 'p', 's'] as const) {
    const starts = new Set<number>();
    for (const m of melds) {
      if (m.type === 'shuntsu' && suitOf(m.tiles[0]) === suit) starts.add(numOf(m.tiles[0]));
    }
    if (starts.has(1) && starts.has(4) && starts.has(7)) return true;
  }
  return false;
}

/** チャンタ/純チャンの判定 */
function detectChanta(decomp: StandardDecomp): 'none' | 'chanta' | 'junchan' {
  const groups: number[][] = [[decomp.pair], ...decomp.melds.map((m) => m.tiles)];
  let anyHonor = false;
  for (const g of groups) {
    // 面子/雀頭ごとに「么九牌を含む」必要がある
    const hasYaochu = g.some((t) => isTerminalOrHonor(t));
    if (!hasYaochu) return 'none';
    if (g.some((t) => isHonor(t))) anyHonor = true;
  }
  return anyHonor ? 'chanta' : 'junchan';
}

// ------------------------------------------------------------
// 符計算（通常形）
// ------------------------------------------------------------

function calcFu(interp: Interp, ctx: HandContext, pinfu: boolean): number {
  const { decomp } = interp;
  let fu = 20; // 副底（基本符）

  // 門前ロンは +10
  if (!ctx.isTsumo) fu += 10;
  // ツモは +2（ただしピンフのときは付かない）
  if (ctx.isTsumo && !pinfu) fu += 2;

  // 雀頭が役牌なら +2（場風かつ自風なら +4）
  if (isDragon(decomp.pair)) fu += 2;
  if (isWind(decomp.pair)) {
    const w = windNumber(decomp.pair);
    let counted = false;
    if (w === ctx.roundWind) {
      fu += 2;
      counted = true;
    }
    if (w === ctx.seatWind) {
      fu += 2;
      counted = true;
    }
    // ハウスルール：北を役牌にする場合、北の雀頭も +2
    if (decomp.pair === NORTH && ctx.northIsYakuhai && !counted) fu += 2;
  }

  // 待ちの符（両面・シャンポンは0、それ以外は+2）
  if (
    interp.waitType === 'kanchan' ||
    interp.waitType === 'penchan' ||
    interp.waitType === 'tanki'
  ) {
    fu += 2;
  }

  // 面子の符
  decomp.melds.forEach((m, i) => {
    if (m.type === 'shuntsu') return; // 順子は0符
    const t = m.tiles[0];
    const simple = !isTerminalOrHonor(t);
    // ロンで和了牌がこの刻子を完成させた場合は明刻扱い
    const openByRon = !ctx.isTsumo && interp.agariMeldIndex === i && interp.waitType === 'shanpon';
    if (openByRon) {
      fu += simple ? 2 : 4; // 明刻
    } else {
      fu += simple ? 4 : 8; // 暗刻
    }
  });

  // 10符単位で切り上げ
  return Math.ceil(fu / 10) * 10;
}

// ------------------------------------------------------------
// 通常形の1分解ぶんの評価（最善の待ち解釈を選ぶ）
// ------------------------------------------------------------

interface Candidate {
  yaku: YakuItem[];
  yakuman: string[];
  han: number;
  fu: number;
  score: ScoreResult;
}

function buildScore(base: number, limitName: string, ctx: HandContext): ScoreResult {
  const { total, breakdown } = scoreFromBase(
    base,
    dealerOf(ctx),
    ctx.isTsumo ? 'tsumo' : 'ron',
    ctx.honba,
    ctx.players ?? 4,
  );
  return { total, limitName, isLimit: limitName !== '', basePoints: base, breakdown };
}

/** 翻・符から基本点と満貫以上ラベルを求める（score.ts と同じ規則） */
function baseFromHanFu(han: number, fu: number): { base: number; limitName: string } {
  if (han >= 13) return { base: 8000, limitName: '数え役満' };
  if (han >= 11) return { base: 6000, limitName: '三倍満' };
  if (han >= 8) return { base: 4000, limitName: '倍満' };
  if (han >= 6) return { base: 3000, limitName: '跳満' };
  if (han === 5) return { base: 2000, limitName: '満貫' };
  const base = fu * Math.pow(2, 2 + han);
  if (base >= 2000) return { base: 2000, limitName: '満貫' };
  return { base, limitName: '' };
}

function evalStandard(decomp: StandardDecomp, ctx: HandContext): Candidate | null {
  // 和了牌がハマりうる位置（雀頭 or 各面子）ごとに解釈を作り、最善を選ぶ
  const interps: Interp[] = [];
  if (decomp.pair === ctx.winningTile) {
    interps.push({ decomp, agariMeldIndex: -1, waitType: 'tanki' });
  }
  decomp.melds.forEach((m, i) => {
    if (m.tiles.includes(ctx.winningTile)) {
      interps.push({ decomp, agariMeldIndex: i, waitType: waitTypeFor(m, false, ctx.winningTile) });
    }
  });
  if (interps.length === 0) return null; // 和了牌が手牌に無い＝不整合

  let best: Candidate | null = null;
  for (const interp of interps) {
    const pinfu = isPinfu(interp, ctx);
    const { yaku, yakuman } = detectStandardYaku(interp, ctx);

    let cand: Candidate;
    if (yakuman.length > 0) {
      const base = 8000 * yakuman.length;
      const label = yakuman.length >= 2 ? `${yakuman.length}倍役満` : '役満';
      cand = { yaku, yakuman, han: 0, fu: 0, score: buildScore(base, label, ctx) };
    } else {
      let han = yaku.reduce((s, y) => s + y.han, 0);
      if (han === 0) continue; // 役なしはこの解釈を採用しない
      han += ctx.doraCount + (ctx.kita ?? 0); // ドラ・北抜きは役があるときのみ加算
      const fu = calcFu(interp, ctx, pinfu);
      const { base, limitName } = baseFromHanFu(han, fu);
      cand = { yaku, yakuman, han, fu, score: buildScore(base, limitName, ctx) };
    }

    if (!best || betterCandidate(cand, best)) best = cand;
  }
  return best;
}

/** 点数が高い方を優先。役満数 → 合計点 の順で比較 */
function betterCandidate(a: Candidate, b: Candidate): boolean {
  if (a.yakuman.length !== b.yakuman.length) return a.yakuman.length > b.yakuman.length;
  return a.score.total > b.score.total;
}

// ------------------------------------------------------------
// 七対子・国士無双
// ------------------------------------------------------------

function evalChiitoitsu(pairs: number[], ctx: HandContext): Candidate | null {
  const all = pairs.flatMap((p) => [p, p]);
  const yakuman: string[] = [];
  if (all.every((t) => isHonor(t))) yakuman.push('字一色');

  if (yakuman.length > 0) {
    return { yaku: [], yakuman, han: 0, fu: 0, score: buildScore(8000, '役満', ctx) };
  }

  const yaku: YakuItem[] = [{ name: '七対子', han: 2 }];
  if (ctx.isRiichi) yaku.push({ name: 'リーチ', han: 1 });
  if (ctx.isTsumo) yaku.push({ name: '門前ツモ', han: 1 });
  if (all.every((t) => !isTerminalOrHonor(t))) yaku.push({ name: 'タンヤオ', han: 1 });
  const suits = new Set(all.filter((t) => !isHonor(t)).map((t) => suitOf(t)));
  const hasHonor = all.some((t) => isHonor(t));
  if (suits.size === 1) {
    if (hasHonor) yaku.push({ name: '混一色', han: 3 });
    else yaku.push({ name: '清一色', han: 6 });
  }

  let han = yaku.reduce((s, y) => s + y.han, 0) + ctx.doraCount + (ctx.kita ?? 0);
  const fu = 25; // 七対子は25符固定
  const { base, limitName } = baseFromHanFu(han, fu);
  return { yaku, yakuman, han, fu, score: buildScore(base, limitName, ctx) };
}

// ------------------------------------------------------------
// エントリポイント
// ------------------------------------------------------------

export function analyzeHand(tiles: number[], ctx: HandContext): AnalyzeResult {
  const empty: AnalyzeResult = {
    ok: false,
    yaku: [],
    han: 0,
    fu: 0,
    isYakuman: false,
    yakumanCount: 0,
    form: '通常形',
  };

  if (tiles.length !== 14) {
    return { ...empty, message: `手牌は14枚必要です（現在 ${tiles.length} 枚）。` };
  }
  const counts = new Array(34).fill(0);
  for (const t of tiles) counts[t]++;
  if (counts.some((c) => c > 4)) {
    return { ...empty, message: '同じ牌は4枚までです。' };
  }
  if (!tiles.includes(ctx.winningTile)) {
    return { ...empty, message: '和了牌が手牌に含まれていません。' };
  }

  // 国士無双（最優先で判定）
  if (detectKokushi(counts)) {
    const score = buildScore(8000, '役満', ctx);
    return {
      ok: true,
      yaku: [{ name: '国士無双', han: 0 }],
      han: 0,
      fu: 0,
      score,
      isYakuman: true,
      yakumanCount: 1,
      form: '国士無双',
    };
  }

  const candidates: { cand: Candidate; form: AnalyzeResult['form'] }[] = [];

  for (const decomp of decomposeStandard(counts)) {
    const c = evalStandard(decomp, ctx);
    if (c) candidates.push({ cand: c, form: '通常形' });
  }
  const chii = detectChiitoitsu(counts);
  if (chii) {
    const c = evalChiitoitsu(chii, ctx);
    if (c) candidates.push({ cand: c, form: '七対子' });
  }

  if (candidates.length === 0) {
    // 和了形がない or 役なし
    const anyForm = decomposeStandard(counts).length > 0 || !!chii;
    return {
      ...empty,
      message: anyForm
        ? '和了形ですが役がありません（リーチ・タンヤオなどの役が必要です）。'
        : 'アガリの形（4面子1雀頭 or 七対子 or 国士無双）になっていません。',
    };
  }

  // 最善の候補を選ぶ
  let best = candidates[0];
  for (const c of candidates) {
    if (betterCandidate(c.cand, best.cand)) best = c;
  }

  const { cand, form } = best;
  const isYakuman = cand.yakuman.length > 0;

  // 表示用の一覧：役満は役満名、それ以外は役＋ドラ・北抜きも見せる
  let displayYaku: YakuItem[];
  if (isYakuman) {
    displayYaku = cand.yakuman.map((n) => ({ name: n, han: 0 }));
  } else {
    displayYaku = [...cand.yaku];
    if (ctx.doraCount > 0) displayYaku.push({ name: 'ドラ', han: ctx.doraCount });
    if ((ctx.kita ?? 0) > 0) displayYaku.push({ name: '北抜き', han: ctx.kita! });
  }

  return {
    ok: true,
    yaku: displayYaku,
    han: cand.han,
    fu: cand.fu,
    score: cand.score,
    isYakuman,
    yakumanCount: cand.yakuman.length,
    form,
  };
}

/** 対応している役の一覧（UI表示用） */
export const SUPPORTED_YAKU = [
  'リーチ', '門前ツモ', 'ピンフ', 'タンヤオ', '役牌（白發中・場風・自風）',
  '一盃口', '二盃口', '三色同順', '一気通貫', 'チャンタ', '純チャン',
  '対々和', '三暗刻', '小三元', '七対子', '混一色', '清一色',
  '【役満】国士無双', '【役満】四暗刻', '【役満】大三元', '【役満】字一色',
];

/** 牌ラベル（結果表示で使う） */
export function tileLabel(idx: number): string {
  return TILE_LABELS[idx];
}
