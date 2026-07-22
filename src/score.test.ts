import { describe, it, expect } from 'vitest';
import { calcScore, baseAndLimit, ceil100 } from './score';

describe('ceil100', () => {
  it('100点単位で切り上げる', () => {
    expect(ceil100(7680)).toBe(7700);
    expect(ceil100(2000)).toBe(2000);
    expect(ceil100(1281)).toBe(1300);
  });
});

describe('baseAndLimit（基本点と満貫以上の判定）', () => {
  it('子30符4翻は基本点1920（満貫未満）', () => {
    expect(baseAndLimit(4, 30)).toEqual({ base: 1920, limitName: '' });
  });
  it('4翻40符は満貫に切り上げ', () => {
    expect(baseAndLimit(4, 40)).toEqual({ base: 2000, limitName: '満貫' });
  });
  it('3翻70符は満貫に切り上げ', () => {
    expect(baseAndLimit(3, 70)).toEqual({ base: 2000, limitName: '満貫' });
  });
  it('5翻は満貫', () => {
    expect(baseAndLimit(5, 30).limitName).toBe('満貫');
  });
  it('6〜7翻は跳満', () => {
    expect(baseAndLimit(6, 20)).toEqual({ base: 3000, limitName: '跳満' });
    expect(baseAndLimit(7, 20)).toEqual({ base: 3000, limitName: '跳満' });
  });
  it('8〜10翻は倍満', () => {
    expect(baseAndLimit(8, 20)).toEqual({ base: 4000, limitName: '倍満' });
  });
  it('11〜12翻は三倍満', () => {
    expect(baseAndLimit(11, 20)).toEqual({ base: 6000, limitName: '三倍満' });
  });
  it('13翻以上は数え役満', () => {
    expect(baseAndLimit(13, 20)).toEqual({ base: 8000, limitName: '数え役満' });
  });
});

describe('ロンの計算', () => {
  it('子30符4翻ロン = 7700点', () => {
    const r = calcScore({ han: 4, fu: 30, seat: 'nondealer', winType: 'ron', honba: 0 });
    expect(r.total).toBe(7700);
    expect(r.breakdown).toEqual({ kind: 'ron', fromDiscarder: 7700 });
  });

  it('子40符3翻ロン = 5200点', () => {
    const r = calcScore({ han: 3, fu: 40, seat: 'nondealer', winType: 'ron', honba: 0 });
    expect(r.total).toBe(5200);
  });

  it('親40符3翻ロン = 7700点', () => {
    const r = calcScore({ han: 3, fu: 40, seat: 'dealer', winType: 'ron', honba: 0 });
    expect(r.total).toBe(7700);
  });

  it('子満貫ロン = 8000点', () => {
    const r = calcScore({ han: 5, fu: 30, seat: 'nondealer', winType: 'ron', honba: 0 });
    expect(r.total).toBe(8000);
    expect(r.limitName).toBe('満貫');
  });

  it('親満貫ロン = 12000点', () => {
    const r = calcScore({ han: 5, fu: 30, seat: 'dealer', winType: 'ron', honba: 0 });
    expect(r.total).toBe(12000);
  });

  it('跳満（子6翻ロン）= 12000点', () => {
    const r = calcScore({ han: 6, fu: 30, seat: 'nondealer', winType: 'ron', honba: 0 });
    expect(r.total).toBe(12000);
    expect(r.limitName).toBe('跳満');
  });

  it('倍満（子8翻ロン）= 16000点', () => {
    const r = calcScore({ han: 8, fu: 30, seat: 'nondealer', winType: 'ron', honba: 0 });
    expect(r.total).toBe(16000);
  });

  it('数え役満（子13翻ロン）= 32000点', () => {
    const r = calcScore({ han: 13, fu: 30, seat: 'nondealer', winType: 'ron', honba: 0 });
    expect(r.total).toBe(32000);
    expect(r.limitName).toBe('数え役満');
  });

  it('本場加算：子30符4翻ロン 2本場 = 7700 + 600 = 8300点', () => {
    const r = calcScore({ han: 4, fu: 30, seat: 'nondealer', winType: 'ron', honba: 2 });
    expect(r.total).toBe(8300);
    expect(r.breakdown).toEqual({ kind: 'ron', fromDiscarder: 8300 });
  });
});

describe('ツモの計算', () => {
  it('親40符3翻ツモ = 2600オール（合計7800点）', () => {
    const r = calcScore({ han: 3, fu: 40, seat: 'dealer', winType: 'tsumo', honba: 0 });
    expect(r.total).toBe(7800);
    expect(r.breakdown).toEqual({ kind: 'tsumo', fromNonDealer: 2600 });
  });

  it('子30符4翻ツモ = 子2000 / 親3900（合計7900点）', () => {
    const r = calcScore({ han: 4, fu: 30, seat: 'nondealer', winType: 'tsumo', honba: 0 });
    // 基本点1920 → 親 ceil100(3840)=3900, 子 ceil100(1920)=2000
    expect(r.breakdown).toEqual({ kind: 'tsumo', fromDealer: 3900, fromNonDealer: 2000 });
    expect(r.total).toBe(7900);
  });

  it('子満貫ツモ = 子2000 / 親4000（合計8000点）', () => {
    const r = calcScore({ han: 5, fu: 30, seat: 'nondealer', winType: 'tsumo', honba: 0 });
    expect(r.breakdown).toEqual({ kind: 'tsumo', fromDealer: 4000, fromNonDealer: 2000 });
    expect(r.total).toBe(8000);
  });

  it('親満貫ツモ = 4000オール（合計12000点）', () => {
    const r = calcScore({ han: 5, fu: 30, seat: 'dealer', winType: 'tsumo', honba: 0 });
    expect(r.breakdown).toEqual({ kind: 'tsumo', fromNonDealer: 4000 });
    expect(r.total).toBe(12000);
  });

  it('本場加算：親満貫ツモ 1本場 = 4100オール（合計12300点）', () => {
    const r = calcScore({ han: 5, fu: 30, seat: 'dealer', winType: 'tsumo', honba: 1 });
    expect(r.breakdown).toEqual({ kind: 'tsumo', fromNonDealer: 4100 });
    expect(r.total).toBe(12300);
  });

  it('本場加算：子満貫ツモ 1本場 = 子2100 / 親4100（合計8300点）', () => {
    const r = calcScore({ han: 5, fu: 30, seat: 'nondealer', winType: 'tsumo', honba: 1 });
    expect(r.breakdown).toEqual({ kind: 'tsumo', fromDealer: 4100, fromNonDealer: 2100 });
    expect(r.total).toBe(8300);
  });
});
