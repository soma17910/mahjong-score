import { describe, it, expect } from 'vitest';
import { analyzeHand, type HandContext } from './analyze';
import { parseTiles, makeIndex } from './tiles';

// テスト用の状況を作るヘルパー（既定：子・東場・リーチなし・ロン・本場0）
function ctx(over: Partial<HandContext>): HandContext {
  return {
    winningTile: 0,
    isTsumo: false,
    isRiichi: false,
    seatWind: 2, // 南＝子
    roundWind: 1, // 東場
    doraCount: 0,
    honba: 0,
    ...over,
  };
}

const yakuNames = (r: ReturnType<typeof analyzeHand>) => r.yaku.map((y) => y.name);

describe('ピンフ', () => {
  it('門前ツモ＋ピンフ（子）= 2翻20符 = 400/700（合計1500）', () => {
    const tiles = parseTiles('234m 567m 345p 234s 99p');
    const r = analyzeHand(tiles, ctx({ winningTile: makeIndex('p', 3), isTsumo: true }));
    expect(r.ok).toBe(true);
    expect(r.han).toBe(2);
    expect(r.fu).toBe(20);
    expect(r.score?.total).toBe(1500);
    expect(yakuNames(r)).toContain('ピンフ');
    expect(yakuNames(r)).toContain('門前ツモ');
  });

  it('リーチ＋ピンフ ロン（子）= 2翻30符 = 2000点', () => {
    const tiles = parseTiles('234m 567m 345p 234s 99p');
    const r = analyzeHand(tiles, ctx({ winningTile: makeIndex('p', 3), isRiichi: true }));
    expect(r.han).toBe(2);
    expect(r.fu).toBe(30);
    expect(r.score?.total).toBe(2000);
  });
});

describe('タンヤオ', () => {
  it('タンヤオのみ ロン（子・暗刻あり）= 1翻40符 = 1300点', () => {
    const tiles = parseTiles('234m 456p 678s 444s 55m');
    const r = analyzeHand(tiles, ctx({ winningTile: makeIndex('m', 2) }));
    expect(r.ok).toBe(true);
    expect(yakuNames(r)).toContain('タンヤオ');
    expect(r.han).toBe(1);
    expect(r.fu).toBe(40);
    expect(r.score?.total).toBe(1300);
  });
});

describe('役牌', () => {
  it('中の暗刻 ロン（子）= 役牌1翻40符 = 1300点', () => {
    const tiles = parseTiles('777z 234m 567p 789s 55m');
    const r = analyzeHand(tiles, ctx({ winningTile: makeIndex('m', 2) }));
    expect(yakuNames(r)).toContain('役牌 中');
    expect(r.han).toBe(1);
    expect(r.fu).toBe(40);
    expect(r.score?.total).toBe(1300);
  });
});

describe('七対子', () => {
  it('リーチ＋七対子 ロン（子）= 3翻25符 = 3200点', () => {
    const tiles = parseTiles('11m 33m 55p 77p 22s 88s 11z');
    const r = analyzeHand(tiles, ctx({ winningTile: makeIndex('s', 8), isRiichi: true }));
    expect(r.form).toBe('七対子');
    expect(r.han).toBe(3);
    expect(r.fu).toBe(25);
    expect(r.score?.total).toBe(3200);
  });
});

describe('混一色（満貫の丸め込み）', () => {
  it('混一色＋役牌 ロン（子）= 4翻40符 → 満貫 = 8000点', () => {
    const tiles = parseTiles('123m 345m 678m 777z 99m');
    const r = analyzeHand(tiles, ctx({ winningTile: makeIndex('m', 6) }));
    expect(yakuNames(r)).toContain('混一色');
    expect(r.han).toBe(4);
    expect(r.score?.total).toBe(8000);
    expect(r.score?.limitName).toBe('満貫');
  });
});

describe('役満', () => {
  it('国士無双 ロン（子）= 32000点', () => {
    const tiles = parseTiles('19m 19p 19s 1234567z 1m');
    const r = analyzeHand(tiles, ctx({ winningTile: makeIndex('m', 1) }));
    expect(r.isYakuman).toBe(true);
    expect(r.form).toBe('国士無双');
    expect(r.score?.total).toBe(32000);
  });

  it('四暗刻 ツモ（子）= 32000点', () => {
    const tiles = parseTiles('111m 333m 555p 777s 99s');
    const r = analyzeHand(tiles, ctx({ winningTile: makeIndex('s', 7), isTsumo: true }));
    expect(r.isYakuman).toBe(true);
    expect(yakuNames(r)).toContain('四暗刻');
    expect(r.score?.total).toBe(32000);
  });
});

describe('役なし・和了形でない', () => {
  it('形はあるが役がない → ok:false', () => {
    const tiles = parseTiles('123m 456m 789p 234s 99s');
    const r = analyzeHand(tiles, ctx({ winningTile: makeIndex('p', 8) })); // 嵌張待ちでピンフなし
    expect(r.ok).toBe(false);
    expect(r.message).toContain('役');
  });

  it('14枚でないとエラー', () => {
    const r = analyzeHand(parseTiles('123m'), ctx({ winningTile: 0 }));
    expect(r.ok).toBe(false);
    expect(r.message).toContain('14枚');
  });
});

describe('一気通貫', () => {
  it('一気通貫を検出する', () => {
    // 123m456m789m + 22p + 345s、両面ロン
    const tiles = parseTiles('123m 456m 789m 345s 22p');
    const r = analyzeHand(tiles, ctx({ winningTile: makeIndex('s', 3) }));
    expect(yakuNames(r)).toContain('一気通貫');
  });
});
