type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: {
        type: 'base64';
        media_type: string;
        data: string;
      };
    };

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: ClaudeContentBlock[];
}

interface ClaudeRequest {
  model: string;
  system: string;
  messages: ClaudeMessage[];
  max_tokens: number;
}

interface ClaudeResponse {
  content: Array<{ type: 'text'; text: string }>;
}

// Timeout for Claude API requests (2 minutes)
const CLAUDE_API_TIMEOUT_MS = 120000;

export const sendClaudeMessage = async (
  apiKey: string,
  request: ClaudeRequest,
): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLAUDE_API_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Claude API Error]', response.status, errorText);
      // Translate common error codes to Japanese
      if (response.status === 401) {
        throw new Error('APIキーが無効です。設定を確認してください。');
      } else if (response.status === 429) {
        throw new Error('APIリクエストの制限に達しました。しばらく待ってから再試行してください。');
      } else if (response.status === 500 || response.status === 502 || response.status === 503) {
        throw new Error('AIサービスが一時的に利用できません。しばらく待ってから再試行してください。');
      }
      throw new Error(`AI APIエラー (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as ClaudeResponse;
    return data.content.map((block) => block.text).join('');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI応答がタイムアウトしました。もう一度お試しください。');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const buildClaudeContent = (
  text: string,
  images: Array<{ mediaType: string; data: string }>,
): ClaudeContentBlock[] => {
  const blocks: ClaudeContentBlock[] = [{ type: 'text', text }];
  images.forEach((image) => {
    blocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mediaType,
        data: image.data,
      },
    });
  });
  return blocks;
};
