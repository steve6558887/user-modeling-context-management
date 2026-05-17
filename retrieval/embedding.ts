/**
 * Embedding 生成模块
 *
 * 目前使用阿里云 DashScope Qwen text-embedding-v3。
 * 支持注入自定义 provider 以适配其他 embedding 服务。
 */

// ============================================================
// 接口
// ============================================================

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
}

export interface QwenEmbeddingConfig {
  apiKey: string;
  model?: string;          // 默认 'text-embedding-v3'
  dimensions?: number;      // 默认 1024
  baseUrl?: string;
}

// ============================================================
// Qwen (阿里云 DashScope) 实现
// ============================================================

const DEFAULT_QWEN_BASE_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';

export function createQwenEmbeddingProvider(config: QwenEmbeddingConfig): EmbeddingProvider {
  const apiKey = config.apiKey;
  const model = config.model || 'text-embedding-v3';
  const dimensions = config.dimensions || 1024;
  const baseUrl = config.baseUrl || DEFAULT_QWEN_BASE_URL;

  async function generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    const textType = text.length > 500 ? 'document' : 'query';

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: { texts: [text] },
        parameters: { text_type: textType, dimensions },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qwen API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      output?: { embeddings?: Array<{ embedding: number[] }> };
    };

    const embedding = data.output?.embeddings?.[0]?.embedding;
    if (!embedding) {
      throw new Error('No embedding in Qwen response');
    }

    return embedding;
  }

  async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      try {
        const emb = await generateEmbedding(texts[i]);
        embeddings.push(emb);
      } catch (error) {
        console.error(`[embedding] Failed for text ${i}:`, error);
        embeddings.push(new Array(dimensions).fill(0));
      }
      // 限流保护
      if (i < texts.length - 1) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    return embeddings;
  }

  return { generateEmbedding, generateBatchEmbeddings };
}

// ============================================================
// 便捷工厂
// ============================================================

let defaultProvider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (!defaultProvider) {
    throw new Error(
      'Embedding provider not initialized. Call initEmbeddingProvider() first.',
    );
  }
  return defaultProvider;
}

export function initEmbeddingProvider(config: QwenEmbeddingConfig): EmbeddingProvider {
  defaultProvider = createQwenEmbeddingProvider(config);
  return defaultProvider;
}
