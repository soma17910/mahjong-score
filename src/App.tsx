import { useMemo, useState } from 'react';
import { calcScore, type Seat, type WinType, type ScoreResult } from './score';
import { analyzeHand, SUPPORTED_YAKU, tileLabel } from './analyze';
import { TILE_LABELS } from './tiles';

// ============================================================
// 共通パーツ
// ============================================================

function fmt(n: number): string {
  return n.toLocaleString('ja-JP');
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs leading-relaxed text-slate-500">{children}</p>;
}

function Toggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={
              'rounded-xl px-3 py-3 text-base font-semibold transition ' +
              (active
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50')
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// 支払い内訳の表示（フェーズ1・2で共有）
function PaymentBreakdown({ result, seat }: { result: ScoreResult; seat: Seat }) {
  const b = result.breakdown;
  if (b.kind === 'ron') {
    return (
      <p className="text-lg">
        放銃者（振り込んだ人）が
        <span className="mx-1 text-2xl font-bold text-white">{fmt(b.fromDiscarder)}</span>
        点 支払い
      </p>
    );
  }
  if (seat === 'dealer') {
    return (
      <p className="text-lg">
        子3人が それぞれ
        <span className="mx-1 text-2xl font-bold text-white">{fmt(b.fromNonDealer)}</span>
        点ずつ 支払い
        <span className="ml-1 text-sm text-emerald-200">（{fmt(b.fromNonDealer)}オール）</span>
      </p>
    );
  }
  return (
    <div className="space-y-1 text-lg">
      <p>
        親が<span className="mx-1 text-2xl font-bold text-white">{fmt(b.fromDealer ?? 0)}</span>点
      </p>
      <p>
        子2人が それぞれ
        <span className="mx-1 text-2xl font-bold text-white">{fmt(b.fromNonDealer)}</span>
        点ずつ 支払い
      </p>
    </div>
  );
}

// ============================================================
// フェーズ1：翻・符から計算
// ============================================================

const FU_OPTIONS: { value: number; note: string }[] = [
  { value: 20, note: 'ピンフ・ツモの形など、最も基本の符' },
  { value: 25, note: '七対子（チートイツ）専用の符' },
  { value: 30, note: 'いちばん多い符。ロン上がりの基本' },
  { value: 40, note: '30符より少し高い手' },
  { value: 50, note: '暗刻や役牌が絡む手など' },
  { value: 60, note: 'さらに符が高い手' },
  { value: 70, note: '高い符の手' },
  { value: 80, note: '非常に符が高い手' },
  { value: 100, note: 'ごく稀に発生する高符' },
  { value: 110, note: '理論上の最大クラスの符' },
];

const HAN_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

function Phase1View() {
  const [han, setHan] = useState(4);
  const [fu, setFu] = useState(30);
  const [seat, setSeat] = useState<Seat>('nondealer');
  const [winType, setWinType] = useState<WinType>('ron');
  const [honba, setHonba] = useState(0);

  const fuIrrelevant = han >= 5;
  const result = calcScore({ han, fu, seat, winType, honba });
  const currentFuNote = FU_OPTIONS.find((f) => f.value === fu)?.note ?? '';

  return (
    <div className="space-y-5">
      {/* 翻 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">翻（ハン）</h2>
          <span className="text-2xl font-bold text-emerald-700">{han} 翻</span>
        </div>
        <Hint>役の大きさ。大きいほど高得点になります。</Hint>
        <div className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-2">
          {HAN_OPTIONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHan(h)}
              className={
                'rounded-lg py-2 text-sm font-semibold transition ' +
                (h === han
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100')
              }
            >
              {h === 13 ? '13+' : h}
            </button>
          ))}
        </div>
      </section>

      {/* 符 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">符（フ）</h2>
          <span className="text-2xl font-bold text-emerald-700">{fu} 符</span>
        </div>
        <Hint>点数の細かい調整値。20符を基準に加算されます。</Hint>
        <div className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2">
          {FU_OPTIONS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFu(f.value)}
              disabled={fuIrrelevant}
              className={
                'rounded-lg py-2 text-sm font-semibold transition ' +
                (f.value === fu
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100') +
                (fuIrrelevant ? ' cursor-not-allowed opacity-40' : '')
              }
            >
              {f.value}
            </button>
          ))}
        </div>
        {fuIrrelevant ? (
          <Hint>5翻以上（満貫以上）は点数が頭打ちになるため、符は結果に影響しません。</Hint>
        ) : (
          <Hint>
            {fu}符：{currentFuNote}
          </Hint>
        )}
      </section>

      {/* 親子・ロンツモ */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold">親 / 子</h2>
          <Hint>親は点数が約1.5倍になります。</Hint>
          <div className="mt-3">
            <Toggle<Seat>
              value={seat}
              onChange={setSeat}
              options={[
                { value: 'dealer', label: '親' },
                { value: 'nondealer', label: '子' },
              ]}
            />
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold">ロン / ツモ</h2>
          <Hint>ロン＝他人の捨て牌／ツモ＝自分で引く。</Hint>
          <div className="mt-3">
            <Toggle<WinType>
              value={winType}
              onChange={setWinType}
              options={[
                { value: 'ron', label: 'ロン' },
                { value: 'tsumo', label: 'ツモ' },
              ]}
            />
          </div>
        </div>
      </section>

      {/* 本場 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">本場（ホンバ）</h2>
            <Hint>連荘の回数。ロンは+300点／ツモは各家+100点/本場。</Hint>
          </div>
          <Stepper value={honba} onChange={(n) => setHonba(Math.max(0, n))} />
        </div>
      </section>

      <ResultCard total={result.total} limitName={result.limitName}>
        <PaymentBreakdown result={result} seat={seat} />
        <p className="mt-3 text-xs text-emerald-200">
          基本点 {fmt(result.basePoints)}（符 × 2の(2+翻)乗）をもとに、
          {seat === 'dealer' ? '親' : '子'}・{winType === 'ron' ? 'ロン' : 'ツモ'}の倍率をかけ、
          100点単位で切り上げています。
        </p>
      </ResultCard>
    </div>
  );
}

// 増減ステッパー
function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        className="h-11 w-11 rounded-xl bg-slate-100 text-2xl font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
      >
        −
      </button>
      <span className="w-10 text-center text-2xl font-bold">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="h-11 w-11 rounded-xl bg-slate-100 text-2xl font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
      >
        ＋
      </button>
    </div>
  );
}

// 緑の結果カード
function ResultCard({
  total,
  limitName,
  children,
}: {
  total: number;
  limitName: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-emerald-700 p-6 text-white shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-emerald-100">獲得合計</span>
        {limitName && (
          <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">{limitName}</span>
        )}
      </div>
      <div className="mt-1 text-5xl font-black tracking-tight">
        {fmt(total)}
        <span className="ml-1 text-2xl font-bold">点</span>
      </div>
      <div className="mt-5 rounded-xl bg-white/10 p-4 text-emerald-50">{children}</div>
    </section>
  );
}

// ============================================================
// フェーズ2：手牌から自動計算
// ============================================================

// 牌ピッカーの並び（インデックス）
const MAN = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const PIN = [9, 10, 11, 12, 13, 14, 15, 16, 17];
const SOU = [18, 19, 20, 21, 22, 23, 24, 25, 26];
const HONORS = [27, 28, 29, 30, 31, 32, 33];

function TileButton({
  idx,
  onClick,
  highlight,
  small,
  disabled,
}: {
  idx: number;
  onClick?: () => void;
  highlight?: boolean;
  small?: boolean;
  disabled?: boolean;
}) {
  const isHonor = idx >= 27;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        (small ? 'h-10 w-9 text-sm ' : 'h-12 w-full text-base ') +
        'rounded-lg font-bold transition ring-1 ' +
        (highlight
          ? 'bg-amber-400 text-amber-950 ring-amber-500 shadow'
          : isHonor
            ? 'bg-rose-50 text-rose-800 ring-rose-200 hover:bg-rose-100'
            : 'bg-white text-slate-800 ring-slate-200 hover:bg-slate-50') +
        (disabled ? ' cursor-not-allowed opacity-40' : '')
      }
    >
      {TILE_LABELS[idx]}
    </button>
  );
}

function Phase2View() {
  const [hand, setHand] = useState<number[]>([]);
  const [winningTile, setWinningTile] = useState<number | null>(null);
  const [isTsumo, setIsTsumo] = useState(false);
  const [isRiichi, setIsRiichi] = useState(false);
  const [seatWind, setSeatWind] = useState(1); // 1=東(親)
  const [roundWind, setRoundWind] = useState(1); // 1=東場
  const [dora, setDora] = useState(0);

  const sortedHand = useMemo(() => [...hand].sort((a, b) => a - b), [hand]);

  const addTile = (idx: number) => {
    if (hand.length >= 14) return;
    const cnt = hand.filter((t) => t === idx).length;
    if (cnt >= 4) return;
    const next = [...hand, idx];
    setHand(next);
    setWinningTile(idx); // 直近に足した牌を和了牌の初期値に
  };

  const removeAt = (posInSorted: number) => {
    // sortedHand の位置から、元 hand の該当牌を1枚消す
    const idx = sortedHand[posInSorted];
    const pos = hand.indexOf(idx);
    const next = [...hand];
    next.splice(pos, 1);
    setHand(next);
    if (!next.includes(idx)) {
      if (winningTile === idx) setWinningTile(next[next.length - 1] ?? null);
    }
  };

  const reset = () => {
    setHand([]);
    setWinningTile(null);
  };

  const distinctTiles = useMemo(() => Array.from(new Set(sortedHand)), [sortedHand]);
  const seat: Seat = seatWind === 1 ? 'dealer' : 'nondealer';

  const result = useMemo(() => {
    if (hand.length !== 14 || winningTile === null) return null;
    return analyzeHand(hand, {
      winningTile,
      isTsumo,
      isRiichi,
      seatWind,
      roundWind,
      doraCount: dora,
      honba: 0,
    });
  }, [hand, winningTile, isTsumo, isRiichi, seatWind, roundWind, dora]);

  return (
    <div className="space-y-5">
      {/* 手牌エリア */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">手牌（{hand.length} / 14）</h2>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200"
          >
            クリア
          </button>
        </div>
        <Hint>下のボタンで14枚そろえます。ここの牌をタップすると1枚削除できます。</Hint>
        <div className="mt-3 flex min-h-[3rem] flex-wrap gap-1.5 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-100">
          {sortedHand.length === 0 && (
            <span className="p-2 text-sm text-slate-400">まだ牌がありません</span>
          )}
          {sortedHand.map((idx, i) => (
            <TileButton key={`${idx}-${i}`} idx={idx} small onClick={() => removeAt(i)} />
          ))}
        </div>
      </section>

      {/* 牌ピッカー */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">牌を選ぶ</h2>
        <div className="space-y-2">
          {[MAN, PIN, SOU].map((row, r) => (
            <div key={r} className="grid grid-cols-9 gap-1.5">
              {row.map((idx) => (
                <TileButton key={idx} idx={idx} onClick={() => addTile(idx)} disabled={hand.length >= 14} />
              ))}
            </div>
          ))}
          <div className="grid grid-cols-9 gap-1.5">
            {HONORS.map((idx) => (
              <TileButton key={idx} idx={idx} onClick={() => addTile(idx)} disabled={hand.length >= 14} />
            ))}
          </div>
        </div>
        <Hint>萬子(m)・筒子(p)・索子(s)＝数の牌／東南西北白發中＝字牌。</Hint>
      </section>

      {/* 和了牌 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">和了牌（上がった牌）</h2>
        <Hint>14枚のうち「最後に引いた／ロンした牌」を選びます。待ちの形で符が変わります。</Hint>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {distinctTiles.length === 0 && <span className="text-sm text-slate-400">手牌をそろえてください</span>}
          {distinctTiles.map((idx) => (
            <TileButton
              key={idx}
              idx={idx}
              small
              highlight={winningTile === idx}
              onClick={() => setWinningTile(idx)}
            />
          ))}
        </div>
      </section>

      {/* 状況設定 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold">ロン / ツモ</h2>
          <div className="mt-2">
            <Toggle<WinType>
              value={isTsumo ? 'tsumo' : 'ron'}
              onChange={(v) => setIsTsumo(v === 'tsumo')}
              options={[
                { value: 'ron', label: 'ロン' },
                { value: 'tsumo', label: 'ツモ' },
              ]}
            />
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold">リーチ</h2>
          <Hint>門前で「リーチ」を宣言した状態。</Hint>
          <div className="mt-2">
            <Toggle<string>
              value={isRiichi ? 'on' : 'off'}
              onChange={(v) => setIsRiichi(v === 'on')}
              options={[
                { value: 'off', label: 'しない' },
                { value: 'on', label: 'リーチ' },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold">自風（じかぜ）</h2>
          <Hint>自分の風。東なら親（オヤ）になります。</Hint>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {['東', '南', '西', '北'].map((w, i) => (
              <button
                key={w}
                type="button"
                onClick={() => setSeatWind(i + 1)}
                className={
                  'rounded-xl py-2.5 font-semibold transition ' +
                  (seatWind === i + 1
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50')
                }
              >
                {w}
              </button>
            ))}
          </div>
          <Hint>今：{seat === 'dealer' ? '親' : '子'}</Hint>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold">場風（ばかぜ）</h2>
          <Hint>その局の風。東場か南場か。</Hint>
          <div className="mt-2">
            <Toggle<string>
              value={String(roundWind)}
              onChange={(v) => setRoundWind(Number(v))}
              options={[
                { value: '1', label: '東場' },
                { value: '2', label: '南場' },
              ]}
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-600">ドラ</span>
            <Stepper value={dora} onChange={(n) => setDora(Math.max(0, n))} />
          </div>
        </div>
      </section>

      {/* 結果 */}
      {result === null ? (
        <section className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center text-slate-500">
          14枚そろえて和了牌を選ぶと、役・翻・符・点数が表示されます。
        </section>
      ) : !result.ok ? (
        <section className="rounded-2xl bg-amber-50 p-5 text-amber-900 ring-1 ring-amber-200">
          <p className="font-semibold">計算できませんでした</p>
          <p className="mt-1 text-sm">{result.message}</p>
        </section>
      ) : (
        <ResultCard total={result.score!.total} limitName={result.isYakuman ? '役満' : result.score!.limitName}>
          {/* 役一覧 */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {result.yaku.map((y) => (
              <span key={y.name} className="rounded-full bg-white/20 px-2.5 py-1 text-sm font-semibold">
                {y.name}
                {!result.isYakuman && `（${y.han}翻）`}
              </span>
            ))}
          </div>
          <p className="mb-3 text-sm text-emerald-100">
            {result.isYakuman
              ? `役満・${result.form}`
              : `合計 ${result.han}翻 ${result.fu}符 ・ ${result.form}`}
            {' ／ '}
            {winningTile !== null && `和了牌 ${tileLabel(winningTile)}`}
          </p>
          <PaymentBreakdown result={result.score!} seat={seat} />
        </ResultCard>
      )}

      {/* 対応役 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">対応している役</h2>
        <Hint>フェーズ2は門前（鳴きなし）の手に対応しています。</Hint>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUPPORTED_YAKU.map((y) => (
            <span key={y} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
              {y}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================================
// ルート：タブ切り替え
// ============================================================

export default function App() {
  const [tab, setTab] = useState<'phase1' | 'phase2'>('phase1');

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        <header className="mb-5">
          <h1 className="text-2xl font-bold sm:text-3xl">🀄 麻雀 点数計算</h1>
          <p className="mt-1 text-sm text-slate-600">
            翻・符から計算するモードと、手牌から役を自動判定するモードがあります。
          </p>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-white p-1.5 shadow-sm">
          {(
            [
              { key: 'phase1', label: '翻・符から計算' },
              { key: 'phase2', label: '手牌から自動計算' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                'rounded-xl py-2.5 text-sm font-semibold transition ' +
                (tab === t.key ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50')
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'phase1' ? <Phase1View /> : <Phase2View />}

        <footer className="mt-8 text-center text-xs text-slate-400">
          ロジックは自前実装・Vitestでテスト済み（35件）
        </footer>
      </div>
    </div>
  );
}
