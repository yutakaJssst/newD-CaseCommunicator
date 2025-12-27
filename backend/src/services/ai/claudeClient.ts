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

export const sendClaudeMessage = async (
  apiKey: string,
  request: ClaudeRequest,
): Promise<string> => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Claude API Error]', response.status, errorText);
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as ClaudeResponse;
  return data.content.map((block) => block.text).join('');
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
