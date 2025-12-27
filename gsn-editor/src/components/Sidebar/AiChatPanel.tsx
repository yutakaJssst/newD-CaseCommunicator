import React, { useEffect, useState } from 'react';
import { aiApi, type AiAttachment, type AiOp } from '../../api/ai';
import { AiOpsPreviewModal } from './AiOpsPreviewModal';
import { applyAiOps, normalizeAiOps } from '../../utils/aiOps';
import { useDiagramStore } from '../../stores/diagramStore';

const MODEL_NAME = 'claude-sonnet-4-20250514';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const AiChatPanel: React.FC = () => {
  const projectId = useDiagramStore((state) => state.currentProjectId);
  const exportProjectData = useDiagramStore((state) => state.exportProjectData);
  const projectRole = useDiagramStore((state) => state.projectRole);
  const canEdit = projectRole !== 'viewer';

  const [isOpen, setIsOpen] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string; ops?: AiOp[] }>
  >([]);
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingOps, setPendingOps] = useState<AiOp[] | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await aiApi.getCredentials();
        setApiConfigured(response.providers.some((p) => p.provider === 'claude' && p.configured));
      } catch (err) {
        console.error('Failed to load AI credentials:', err);
      }
    };
    load();
  }, []);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      setError('APIキーを入力してください');
      return;
    }
    try {
      setError(null);
      await aiApi.setCredential('claude', apiKey.trim());
      setApiConfigured(true);
      setApiKey('');
    } catch (err) {
      console.error(err);
      setError('APIキーの保存に失敗しました');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!projectId) return;
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          setError('ファイルサイズは10MBまでです');
          continue;
        }
        const uploaded = await aiApi.uploadAttachment(projectId, file, conversationId || undefined);
        setAttachments((prev) => [...prev, uploaded]);
      }
    } catch (err) {
      console.error(err);
      setError('添付ファイルのアップロードに失敗しました');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((item) => item.attachmentId !== attachmentId));
  };

  const handleSend = async () => {
    if (!projectId) return;
    if (!input.trim()) return;
    if (!apiConfigured) {
      setError('APIキーが未設定です');
      return;
    }
    if (!canEdit) {
      setError('編集権限がありません');
      return;
    }

    const prompt = input.trim();
    setInput('');
    setError(null);
    setIsSending(true);
    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);

    try {
      const diagramSnapshot = exportProjectData();
      const response = await aiApi.sendChat(projectId, {
        conversationId: conversationId || undefined,
        provider: 'claude',
        model: MODEL_NAME,
        prompt,
        diagramSnapshot,
        attachments: attachments.map((item) => item.attachmentId),
      });

      const ops = normalizeAiOps(response.ops);
      setConversationId(response.conversationId);
      setMessages((prev) => [...prev, { role: 'assistant', content: response.assistantMessage, ops }]);
      setAttachments([]);

      if (ops.length > 0) {
        setPendingOps(ops);
      }
    } catch (err) {
      console.error(err);
      setError('AIへのリクエストに失敗しました');
    } finally {
      setIsSending(false);
    }
  };

  const handleApplyOps = () => {
    if (!pendingOps) return;
    applyAiOps(pendingOps);
    setPendingOps(null);
  };

  return (
    <div
      style={{
        borderTop: '1px solid #E5E7EB',
        backgroundColor: '#FFFFFF',
        marginTop: 'auto',
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: 'none',
          backgroundColor: '#F3F4F6',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        🤖 AIアシスタント {isOpen ? '▲' : '▼'}
      </button>

      {isOpen && (
        <div
          style={{
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '40vh',
            overflowY: 'auto',
          }}
        >
          {!apiConfigured && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', color: '#6B7280' }}>
                Claude APIキーを登録してください。
              </div>
              <input
                type="password"
                value={apiKey}
                placeholder="Claude API Key"
                onChange={(e) => setApiKey(e.target.value)}
                style={{
                  padding: '6px 8px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              <button
                type="button"
                onClick={handleSaveKey}
                style={{
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                APIキーを保存
              </button>
            </div>
          )}

          {error && (
            <div style={{ fontSize: '11px', color: '#DC2626' }}>{error}</div>
          )}

          <div
            style={{
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '8px',
              maxHeight: '220px',
              overflowY: 'auto',
              backgroundColor: '#F9FAFB',
            }}
          >
            {messages.length === 0 ? (
              <div style={{ fontSize: '11px', color: '#6B7280' }}>
                AIへの質問を入力してください。
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  style={{
                    marginBottom: '8px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: message.role === 'user' ? '#DBEAFE' : '#FFFFFF',
                    fontSize: '11px',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                    {message.role === 'user' ? 'You' : 'AI'}
                  </div>
                  {message.content}
                </div>
              ))
            )}
          </div>

          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {attachments.map((file) => (
                <div
                  key={file.attachmentId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px',
                    padding: '4px 6px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                  }}
                >
                  <span>{file.fileName}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(file.attachmentId)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: '#DC2626',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="例: GSNのノード説明を英語にしてください"
              rows={3}
              style={{
                padding: '8px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '12px',
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <label
                style={{
                  padding: '6px 8px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  backgroundColor: '#FFFFFF',
                }}
              >
                添付
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  multiple
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending || isUploading || !input.trim()}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: isSending ? '#9CA3AF' : '#2563EB',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  cursor: isSending ? 'not-allowed' : 'pointer',
                }}
              >
                {isSending ? '送信中...' : '送信'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingOps && (
        <AiOpsPreviewModal
          ops={pendingOps}
          onCancel={() => setPendingOps(null)}
          onConfirm={handleApplyOps}
        />
      )}
    </div>
  );
};
