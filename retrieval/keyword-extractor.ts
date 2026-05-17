/**
 * 关键词提取器
 *
 * 从用户查询中提取实体关键词，用于混合检索的实体匹配。
 * 使用 Node Segment 中文分词库，带正则回退。
 *
 * 纯函数，无外部依赖（Segment 按需动态加载）。
 */

// ============================================================
// 停用词
// ============================================================

const STOP_WORDS = new Set([
  // 中文
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '自己', '这', '那', '他', '她', '谁', '什么', '哪里', '怎么', '为什么',
  '可以', '应该', '能够', '这个', '那个', '这些', '那些',
  '但是', '然而', '不过', '虽然', '尽管', '如果', '假如',
  '因为', '由于', '所以', '因此', '于是', '然后', '接着',
  '同时', '另外', '此外', '而且', '并且', '或者', '还是',
  '除了', '关于', '对于', '通过', '由', '被', '让', '使',
  '吧', '啊', '呢', '吗', '哦', '嗯', '额', '哈', '呀', '哇',
  '们', '个', '之', '与', '及', '等', '从', '向', '往', '把', '将', '给', '为',
  // 英文
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'i', 'you', 'he', 'she', 'it', 'we',
  'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our',
  'this', 'that', 'these', 'those', 'am', 'can', 'who', 'what', 'where',
  'when', 'why', 'how', 'if', 'so', 'than', 'too', 'very', 'just', 'now',
  'then', 'here', 'there', 'all', 'any', 'each', 'every', 'some', 'no',
  'not', 'yes', 'ok', 'about', 'after', 'against', 'along', 'among',
  'around', 'as', 'before', 'behind', 'below', 'between', 'beyond',
  'down', 'during', 'except', 'inside', 'into', 'like', 'near', 'off',
  'onto', 'outside', 'over', 'since', 'through', 'until', 'upon',
  'within', 'without',
]);

// ============================================================
// 回退提取（纯 JS，无需 Segment）
// ============================================================

function fallbackExtractKeywords(query: string): string[] {
  if (!query || typeof query !== 'string') return [];

  const cleaned = query.trim();
  if (!cleaned || /^[。，！？,.!?]$/.test(cleaned)) return [];

  const keywords: string[] = [];

  // 英文单词 (>=3 chars)
  const englishWords = cleaned.match(/[A-Za-z]+[A-Za-z0-9]*/g) || [];
  for (const word of englishWords) {
    if (word.length >= 3 && !STOP_WORDS.has(word.toLowerCase())) {
      keywords.push(word);
    }
  }

  // 中文词 (2-6 chars)
  const chineseSequences = cleaned.match(/[一-鿿]+/g) || [];
  for (const seq of chineseSequences) {
    if (seq.length >= 2 && seq.length <= 6 && !STOP_WORDS.has(seq)) {
      keywords.push(seq);
    }
  }

  // 短查询回退
  if (keywords.length === 0 && cleaned.length <= 10) {
    const meaningful = cleaned.replace(/[。，！？,.!?\s]/g, '');
    if (meaningful.length > 0) keywords.push(meaningful);
  }

  return [...new Set(keywords)];
}

// ============================================================
// Segment 分词提取（Node 环境尝试加载）
// ============================================================

let segmentInstance: unknown = null;

function getSegment(): unknown | null {
  if (typeof window !== 'undefined') return null;

  if (segmentInstance) return segmentInstance;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Segment = require('segment');
    const seg = new Segment();
    seg.useDefault();
    segmentInstance = seg;
    return seg;
  } catch {
    return null;
  }
}

function segmentExtractKeywords(query: string): string[] {
  const segment = getSegment() as {
    doSegment: (text: string, opts: Record<string, unknown>) => Array<{ w: string; p: number }>;
  } | null;

  if (!segment) return fallbackExtractKeywords(query);

  try {
    const segmented = segment.doSegment(query.trim(), {
      stripPunctuation: true,
    });

    const keywords: string[] = [];
    for (const item of segmented) {
      const word = item.w;
      if (!word || word.trim().length === 0) continue;
      if (word.length < 2 && !/^[A-Za-z0-9]$/.test(word)) continue;
      if (STOP_WORDS.has(word.toLowerCase())) continue;
      if (/^\d+$/.test(word)) continue;

      keywords.push(word);
    }

    const result = [...new Set(keywords)];
    return result.length > 0 ? result : fallbackExtractKeywords(query);
  } catch {
    return fallbackExtractKeywords(query);
  }
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 从查询文本中提取关键词。
 * 优先使用 Segment 中文分词（Node 环境），回退到正则。
 */
export function extractKeywords(query: string): string[] {
  if (!query || typeof query !== 'string') return [];

  const cleaned = query.trim();
  if (!cleaned) return [];

  return segmentExtractKeywords(cleaned);
}

/**
 * 批量提取
 */
export function extractKeywordsBatch(queries: string[]): string[][] {
  return queries.map((q) => extractKeywords(q));
}
