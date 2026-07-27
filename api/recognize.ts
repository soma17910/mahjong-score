// ============================================================
// 写真から麻雀牌を認識するサーバーレス関数（Vercel）
//
// ・ブラウザから縮小した写真（base64）を受け取り、Claudeの画像認識で
//   牌14枚を読み取って返す。
// ・APIキーは Vercel の環境変数 ANTHROPIC_API_KEY から読む（ブラウザには出さない）。
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// 牌のコード（34種類）。フロント側でインデックスに変換する。
const TILE_CODES = [
  '1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m',
  '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p',
  '1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s',
  'east', 'south', 'west', 'north', 'haku', 'hatsu', 'chun',
];

const PROMPT = `あなたは日本の麻雀（リーチ麻雀）の牌を読み取る専門家です。
この画像には手牌が並んでいます（通常13枚または14枚、横一列のことが多い）。

左から順にすべての牌を識別し、次のコードで返してください：
- 萬子（マンズ・漢数字と「萬」）: 1m〜9m
- 筒子（ピンズ・丸）: 1p〜9p
- 索子（ソウズ・竹）: 1s〜9s
- 風牌: east(東) south(南) west(西) north(北)
- 三元牌: haku(白) hatsu(發) chun(中)

ルール：
- 見えている牌は鳴き（ポン/チー）の牌も含めて全部、左から右の順で列挙する。
- 判別に自信がない牌でも最善の推測を入れ、confidence を "low" にする。
- notes には気づいた点や不確かな牌を日本語で簡潔に書く（無ければ空文字）。`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POSTのみ対応しています。' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'サーバーにAPIキー（ANTHROPIC_API_KEY）が設定されていません。',
    });
    return;
  }

  const body = (req.body ?? {}) as { imageBase64?: string; mediaType?: string };
  if (!body.imageBase64) {
    res.status(400).json({ error: '画像データがありません。' });
    return;
  }

  const client = new Anthropic({ apiKey });

  try {
    // SDKのバージョン差でも動くよう、パラメータは any で渡す
    const params = {
      model: 'claude-opus-5',
      max_tokens: 2000,
      thinking: { type: 'disabled' },
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              tiles: { type: 'array', items: { type: 'string', enum: TILE_CODES } },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              notes: { type: 'string' },
            },
            required: ['tiles', 'confidence', 'notes'],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: body.mediaType || 'image/jpeg',
                data: body.imageBase64,
              },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message: any = await (client as any).messages.create(params);

    const textBlock = (message.content as Array<{ type: string; text?: string }>).find(
      (b) => b.type === 'text',
    );
    if (!textBlock?.text) {
      res.status(502).json({ error: '認識結果を取得できませんでした。' });
      return;
    }

    const parsed = JSON.parse(textBlock.text) as {
      tiles: string[];
      confidence: string;
      notes: string;
    };
    res.status(200).json(parsed);
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: '画像認識に失敗しました。', detail });
  }
}
