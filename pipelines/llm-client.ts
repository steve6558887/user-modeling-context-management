/**
 * DeepSeek API 客户端
 *
 * 单一职责：发送请求，返回内容字符串，失败时 throw。
 * 重试逻辑由调用方决定（见 capsule-extractor.ts）。
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

export interface DeepSeekOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export async function callDeepSeek(
  prompt: string,
  apiKey: string,
  model: string,
  options: DeepSeekOptions = {},
): Promise<string> {
  const { maxTokens = 8000, temperature, topP } = options;

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      max_tokens: maxTokens,
      ...(temperature !== undefined && { temperature }),
      ...(topP !== undefined && { top_p: topP }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('DeepSeek returned empty content');
  }

  return content;
}
