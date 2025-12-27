import React, { useEffect, useMemo, useState } from 'react';
import { publicSurveysApi, type PublicSurveyAnswer, type PublicSurveyResponse } from '../../api/surveys';
import type { DiagramData, ProjectData } from '../../types/diagram';
import { LoadingState } from '../Status/LoadingState';
import { ErrorState } from '../Status/ErrorState';

interface PublicSurveyPageProps {
  token: string;
}

type DraftAnswer = {
  questionId: string;
  score?: number;
  comment?: string;
};

const DEFAULT_EXPERT_INTRO = `以下は現状のシステムの安全性を、厳密に測定するための質問です。議論の基盤になるGSNの末端のゴールノードと戦略ノードについて専門家の立場から回答をお願いいたします。

それぞれの質問では0から1点の値(確信値)を入力していただきます。以下の基準で回答してください。0と1は使用しないでください。
0.98 ほぼ標準・教科書どおり。抜けや疑問点はほとんどない
0.90 概ね妥当。多少気になる点はあるが実務上は許容
0.80 妥当だが弱点あり。前提依存・カバレッジ不足が気になる
0.70  かなり弱い。重要な前提の抜けや想定外シナリオの懸念
0.40. 根本的に疑問。議論・エビデンスの組み直しレベル
またその採点の理由もできるだけ詳細に記入をお願いいたします。`;

const ROLE_OPTIONS = [
  'アーキテクト',
  'フェロー',
  '事業本部',
  'プロダクト本部',
  'R&Dユニット',
  '経営層（CxO）',
  'その他',
];

const isRoleQuestion = (question: PublicSurveyResponse['survey']['questions'][number]) =>
  question.nodeId === 'meta_role' && question.nodeType === 'Meta';

type GsnSnapshot = ProjectData | DiagramData;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isDiagramData = (value: unknown): value is DiagramData =>
  isRecord(value) && Array.isArray(value.nodes) && Array.isArray(value.links);

const isProjectData = (value: unknown): value is ProjectData =>
  isRecord(value) && isRecord(value.modules);

const normalizeSnapshot = (value: unknown): GsnSnapshot | null => {
  if (isProjectData(value)) return value;
  if (isDiagramData(value)) return value;
  return null;
};

const getApiErrorMessage = (err: unknown, fallback: string) => {
  if (err && typeof err === 'object') {
    const response = (err as { response?: { data?: { error?: string } } }).response;
    if (typeof response?.data?.error === 'string') {
      return response.data.error;
    }
  }
  if (err instanceof Error) return err.message;
  return fallback;
};

// contextInfo内の "text (url)" 形式をクリック可能なリンクに変換するコンポーネント
const ContextInfoWithLinks: React.FC<{ text: string }> = ({ text }) => {
  // URLパターン: "テキスト (http...)" or "テキスト (https...)"
  const urlPattern = /([^\s]+)\s+\((https?:\/\/[^\s)]+)\)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = urlPattern.exec(text)) !== null) {
    // マッチ前のテキストを追加
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // リンクを追加
    const linkText = match[1];
    const url = match[2];
    parts.push(
      <a
        key={`link-${keyIndex++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: '#2563EB',
          textDecoration: 'underline',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {linkText}
      </a>
    );

    lastIndex = match.index + match[0].length;
  }

  // 残りのテキストを追加
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
};

export const PublicSurveyPage: React.FC<PublicSurveyPageProps> = ({ token }) => {
  const [survey, setSurvey] = useState<PublicSurveyResponse['survey'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const [missingScores, setMissingScores] = useState<Set<string>>(new Set());
  const entryAudience = survey?.entryAudience ?? survey?.audience;
  const questionsToDisplay = useMemo(() => {
    if (!survey?.questions) return [];
    const list = [...survey.questions];
    if (entryAudience !== 'expert') return list;
    const rank = (question: PublicSurveyResponse['survey']['questions'][number]) =>
      (question.scaleType || 'likert_0_3') === 'continuous_0_1' ? 1 : 0;
    return list.sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }, [survey?.questions, entryAudience]);
  const expertIntroText = useMemo(() => {
    if (entryAudience !== 'expert') return null;
    const intro = survey?.expertIntro;
    if (intro && intro.trim()) return intro;
    return DEFAULT_EXPERT_INTRO;
  }, [entryAudience, survey?.expertIntro]);
  const confidenceIntroIndex = useMemo(() => {
    if (entryAudience !== 'expert') return -1;
    return questionsToDisplay.findIndex(
      (question) => (question.scaleType || 'likert_0_3') === 'continuous_0_1'
    );
  }, [questionsToDisplay, entryAudience]);

  const diagramData = useMemo(() => {
    const snapshot = normalizeSnapshot(survey?.gsnSnapshot);
    if (!snapshot) return null;
    if (isProjectData(snapshot)) {
      const currentId = snapshot.currentDiagramId || 'root';
      const moduleData = snapshot.modules[currentId] || snapshot.modules.root || null;
      if (!moduleData) return null;
      return {
        nodes: Array.isArray(moduleData.nodes) ? moduleData.nodes : [],
        links: Array.isArray(moduleData.links) ? moduleData.links : [],
      };
    }
    return {
      nodes: Array.isArray(snapshot.nodes) ? snapshot.nodes : [],
      links: Array.isArray(snapshot.links) ? snapshot.links : [],
    };
  }, [survey?.gsnSnapshot]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await publicSurveysApi.getSurvey(token);
        setSurvey(response.survey);
        setMissingScores(new Set());
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, 'アンケートの読み込みに失敗しました'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const handleScoreChange = (questionId: string, score: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        questionId,
        score,
        comment: prev[questionId]?.comment,
      },
    }));
    setMissingScores((prev) => {
      if (!prev.has(questionId)) return prev;
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
  };

  const handleRoleScoreChange = (questionId: string, score: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        questionId,
        score,
        comment: score === ROLE_OPTIONS.length - 1 ? prev[questionId]?.comment : '',
      },
    }));
    setMissingScores((prev) => {
      if (!prev.has(questionId)) return prev;
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
  };

  const handleCommentChange = (questionId: string, comment: string) => {
    const isOtherSelected = answers[questionId]?.score === ROLE_OPTIONS.length - 1;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        questionId,
        score: prev[questionId]?.score,
        comment,
      },
    }));
    if (!isOtherSelected) return;
    if (!comment.trim()) return;
    setMissingScores((prev) => {
      if (!prev.has(questionId)) return prev;
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey) return;

    const answerList = questionsToDisplay.map((question) => answers[question.id]);
    const missing = questionsToDisplay
      .filter((question) => answers[question.id]?.score === undefined)
      .map((question) => question.id);
    if (missing.length > 0) {
      setMissingScores(new Set(missing));
      setError('スコアが未入力の項目があります。各質問の指示に従って入力してください。');
      return;
    }
    const roleQuestion = questionsToDisplay.find((question) => isRoleQuestion(question));
    if (roleQuestion) {
      const roleAnswer = answers[roleQuestion.id];
      if (
        roleAnswer?.score === ROLE_OPTIONS.length - 1 &&
        !roleAnswer.comment?.trim()
      ) {
        setMissingScores(new Set([roleQuestion.id]));
        setError('「その他」を選んだ場合は内容を入力してください。');
        return;
      }
    }
    setMissingScores(new Set());

    try {
      setError(null);
      await publicSurveysApi.submitResponse(token, answerList as PublicSurveyAnswer[]);
      setSubmitted(true);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '送信に失敗しました'));
    }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        backgroundColor: '#F9FAFB',
        padding: '40px 20px 60px',
      }}
    >
      <div
        style={{
          maxWidth: '760px',
          margin: '0 auto',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '28px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
        }}
      >
        {error && <ErrorState message={error} />}
        {!survey ? (
          <div style={{ color: '#6B7280' }}>アンケートが見つかりません。</div>
        ) : submitted ? (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: '12px' }}>ご回答ありがとうございました</h2>
            <p style={{ color: '#6B7280' }}>回答が送信されました。</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h1 style={{ marginTop: 0 }}>{survey.title}</h1>
            {entryAudience && (
              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
                対象: {entryAudience === 'expert' ? '専門家' : '非専門家'}
              </div>
            )}
            {survey.description && (
              <p style={{ color: '#6B7280', whiteSpace: 'pre-wrap' }}>{survey.description}</p>
            )}
            {survey.publicImageUrl && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <img
                  src={survey.publicImageUrl}
                  alt="アンケート画像"
                  style={{ maxWidth: '100%', borderRadius: '8px' }}
                />
              </div>
            )}

            {diagramData && diagramData.nodes.length > 0 && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  backgroundColor: '#F9FAFB',
                }}
              >
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                  対象GSN（スクロールで全体を確認できます）
                </div>
                <SvgDiagram nodes={diagramData.nodes} links={diagramData.links} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
            {questionsToDisplay.map((question, index) => {
                const roleQuestion = isRoleQuestion(question);
                const scaleType = question.scaleType || 'likert_0_3';
                const roleScore = answers[question.id]?.score;
                const roleOtherSelected = roleScore === ROLE_OPTIONS.length - 1;
                const roleErrorMessage =
                  roleQuestion
                    ? roleScore === undefined
                      ? '役職を選択してください'
                      : roleOtherSelected && !answers[question.id]?.comment?.trim()
                        ? 'その他の内容を入力してください'
                        : '役職を選択してください'
                    : scaleType === 'continuous_0_1'
                      ? 'スコアを入力してください'
                      : 'スコアを選択してください';
                return (
                  <React.Fragment key={question.id}>
                    {expertIntroText && index === confidenceIntroIndex && (
                      <div
                        style={{
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          padding: '16px',
                          backgroundColor: '#F9FAFB',
                          whiteSpace: 'pre-wrap',
                          color: '#374151',
                          fontSize: '13px',
                        }}
                      >
                        {expertIntroText}
                      </div>
                    )}
                    <div
                      style={{
                        border: missingScores.has(question.id) ? '1px solid #DC2626' : '1px solid #E5E7EB',
                        borderRadius: '8px',
                        padding: '16px',
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: '8px', whiteSpace: 'pre-wrap' }}>
                        {question.questionText}
                      </div>
                      {!roleQuestion && question.contextInfo && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#374151',
                            marginBottom: '12px',
                            padding: '8px 12px',
                            backgroundColor: '#F9FAFB',
                            borderRadius: '6px',
                            borderLeft: '3px solid #3B82F6',
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: '4px', color: '#6B7280' }}>
                            Safety Status Report参照
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>
                            <ContextInfoWithLinks text={question.contextInfo} />
                          </div>
                        </div>
                      )}
                      {roleQuestion ? (
                        <>
                          <div style={{ fontSize: '12px', color: '#374151', marginBottom: '6px' }}>
                            該当する役職を選択してください（必須）
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                            {ROLE_OPTIONS.map((label, optionIndex) => (
                              <label
                                key={label}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '12px',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #D1D5DB',
                                  cursor: 'pointer',
                                }}
                              >
                                <input
                                  type="radio"
                                  name={`question-${question.id}`}
                                  value={optionIndex}
                                  checked={answers[question.id]?.score === optionIndex}
                                  onChange={() => handleRoleScoreChange(question.id, optionIndex)}
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                          {roleOtherSelected && (
                            <textarea
                              placeholder="その他の内容を入力してください"
                              value={answers[question.id]?.comment || ''}
                              onChange={(e) => handleCommentChange(question.id, e.target.value)}
                              rows={2}
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #E5E7EB',
                                borderRadius: '6px',
                              }}
                            />
                          )}
                        </>
                      ) : scaleType === 'continuous_0_1' ? (
                        <>
                          <div style={{ fontSize: '12px', color: '#374151', marginBottom: '6px' }}>
                            0.0〜1.0の評価（必須）
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', color: '#6B7280', minWidth: '80px' }}>確信が持てない</span>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.01}
                              value={answers[question.id]?.score ?? 0.5}
                              onChange={(e) => handleScoreChange(question.id, Number(e.target.value))}
                              style={{ flex: 1 }}
                            />
                            <span style={{ fontSize: '11px', color: '#6B7280', minWidth: '70px', textAlign: 'right' }}>確信が持てる</span>
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step={0.01}
                              value={answers[question.id]?.score ?? ''}
                              onChange={(e) => {
                                const value = e.target.value === '' ? undefined : Number(e.target.value);
                                if (value === undefined) {
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [question.id]: {
                                      questionId: question.id,
                                      score: undefined,
                                      comment: prev[question.id]?.comment,
                                    },
                                  }));
                                  return;
                                }
                                handleScoreChange(question.id, value);
                              }}
                              placeholder="0.0"
                              style={{
                                width: '80px',
                                padding: '4px 6px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '6px',
                                fontSize: '12px',
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: '12px', color: '#374151', marginBottom: '6px' }}>
                            0〜3点の評価（必須）
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#6B7280' }}>合意できない</span>
                            {[0, 1, 2, 3].map((value) => (
                              <label
                                key={value}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '12px',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #D1D5DB',
                                  cursor: 'pointer',
                                }}
                              >
                                <input
                                  type="radio"
                                  name={`question-${question.id}`}
                                  value={value}
                                  checked={answers[question.id]?.score === value}
                                  onChange={() => handleScoreChange(question.id, value)}
                                />
                                {value}
                              </label>
                            ))}
                            <span style={{ fontSize: '11px', color: '#6B7280' }}>合意できる</span>
                          </div>
                        </>
                      )}
                      {missingScores.has(question.id) && (
                        <div style={{ color: '#DC2626', fontSize: '12px', marginBottom: '8px' }}>
                          {roleErrorMessage}
                        </div>
                      )}
                      {!roleQuestion && (
                        <textarea
                          placeholder="コメント（任意）"
                          value={answers[question.id]?.comment || ''}
                          onChange={(e) => handleCommentChange(question.id, e.target.value)}
                          rows={2}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #E5E7EB',
                            borderRadius: '6px',
                          }}
                        />
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            <div style={{ textAlign: 'right', marginTop: '24px' }}>
              <button
                type="submit"
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#3B82F6',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                送信
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ノードタイプごとの色（types/diagram.tsのNODE_COLORSと同一）
const NODE_COLORS: Record<string, string> = {
  Goal: '#FFFFFF',
  Strategy: '#FFFFFF',
  Context: '#FFFFFF',
  Evidence: '#FFFFFF',
  Assumption: '#FFFFFF',
  Justification: '#FFFFFF',
  Undeveloped: '#FFFFFF',
  Module: '#E0E0E0',
};

interface SvgDiagramProps {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    label?: string;
    content?: string;
  }>;
  links: Array<{ id: string; source: string; target: string; type?: 'solid' | 'dashed' }>;
}

const SvgDiagram: React.FC<SvgDiagramProps> = ({ nodes, links }) => {
  const bounds = nodes.reduce(
    (acc, node) => {
      // ラベル表示のスペースも含める（上方に24px）
      const left = node.position.x - node.size.width / 2;
      const right = node.position.x + node.size.width / 2;
      const top = node.position.y - node.size.height / 2 - 30;
      const bottom = node.position.y + node.size.height / 2;
      return {
        minX: Math.min(acc.minX, left),
        maxX: Math.max(acc.maxX, right),
        minY: Math.min(acc.minY, top),
        maxY: Math.max(acc.maxY, bottom),
      };
    },
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  );

  const padding = 40;
  const minX = bounds.minX - padding;
  const minY = bounds.minY - padding;
  const width = bounds.maxX - bounds.minX + padding * 2;
  const height = bounds.maxY - bounds.minY + padding * 2;

  const getNode = (id: string) => nodes.find((node) => node.id === id);

  const stripHtml = (html?: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  };

  // CJK文字判定関数
  const isCJK = (char: string): boolean => {
    const code = char.charCodeAt(0);
    return (
      (code >= 0x3000 && code <= 0x9FFF) ||   // CJK統合漢字、ひらがな、カタカナ等
      (code >= 0xAC00 && code <= 0xD7AF) ||   // 韓国語
      (code >= 0xFF00 && code <= 0xFFEF)      // 全角英数
    );
  };

  // 文字幅を考慮したテキスト折り返し
  const wrapText = (text: string, nodeWidth: number, nodeHeight: number, nodeType: string) => {
    if (!text) return [];

    const fontSize = 14;
    const halfWidthChar = fontSize * 0.6;  // 半角文字の幅
    const fullWidthChar = fontSize;        // 全角文字の幅
    const lineHeight = fontSize * 1.4;

    // ノードタイプに応じたパディング調整
    const padding = nodeType === 'Module' ? 40 : 20;
    const availableWidth = nodeWidth - padding;
    const availableHeight = nodeHeight - (nodeType === 'Module' ? 50 : 30);
    const maxLines = Math.max(1, Math.floor(availableHeight / lineHeight));

    const lines: string[] = [];
    let currentLine = '';
    let currentWidth = 0;

    for (const char of text) {
      const charWidth = isCJK(char) ? fullWidthChar : halfWidthChar;

      if (currentWidth + charWidth > availableWidth) {
        if (currentLine) {
          lines.push(currentLine);
          if (lines.length >= maxLines) break;
        }
        currentLine = char;
        currentWidth = charWidth;
      } else {
        currentLine += char;
        currentWidth += charWidth;
      }
    }

    if (currentLine && lines.length < maxLines) {
      lines.push(currentLine);
    }

    // 最後の行に省略記号を追加
    if (lines.length >= maxLines && text.length > lines.join('').length) {
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = `${last.slice(0, Math.max(0, last.length - 1))}…`;
    }

    return lines;
  };

  const renderShape = (node: SvgDiagramProps['nodes'][0]) => {
    const { width: w, height: h } = node.size;
    const stroke = '#374151';
    const fill = NODE_COLORS[node.type] || '#FFFFFF';

    switch (node.type) {
      case 'Goal':
        return (
          <rect
            x={-w / 2}
            y={-h / 2}
            width={w}
            height={h}
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
          />
        );

      case 'Strategy':
        // skewX(-15)を使用してキャンバスと同一の形状に
        return (
          <rect
            x={-w / 2}
            y={-h / 2}
            width={w}
            height={h}
            transform="skewX(-15)"
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
          />
        );

      case 'Context':
        return (
          <rect
            x={-w / 2}
            y={-h / 2}
            width={w}
            height={h}
            rx={10}
            ry={10}
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
          />
        );

      case 'Evidence':
      case 'Assumption':
      case 'Justification':
        return (
          <ellipse
            cx={0}
            cy={0}
            rx={w / 2}
            ry={h / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
          />
        );

      case 'Undeveloped': {
        const points = [
          `${-w / 2},0`,
          `0,${h / 2}`,
          `${w / 2},0`,
          `0,${-h / 2}`,
        ].join(' ');
        return <polygon points={points} fill={fill} stroke={stroke} strokeWidth={2} />;
      }

      case 'Module': {
        // フォルダ形状（タブ付き矩形）- Node.tsxと同一
        const tabWidth = 60;
        const tabHeight = 20;
        const pathData = `
          M ${-w / 2} ${-h / 2 + tabHeight}
          L ${-w / 2} ${-h / 2}
          L ${-w / 2 + tabWidth} ${-h / 2}
          L ${-w / 2 + tabWidth + 10} ${-h / 2 + tabHeight}
          L ${w / 2} ${-h / 2 + tabHeight}
          L ${w / 2} ${h / 2}
          L ${-w / 2} ${h / 2}
          Z
        `;
        return (
          <>
            <path d={pathData} fill={fill} stroke={stroke} strokeWidth={2} />
            <text
              x={-w / 2 + 10}
              y={-h / 2 + 15}
              fill="#666666"
              fontSize={14}
              fontWeight="bold"
            >
              M
            </text>
          </>
        );
      }

      default:
        return (
          <rect
            x={-w / 2}
            y={-h / 2}
            width={w}
            height={h}
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
          />
        );
    }
  };

  // リンクの接続点を計算（Link.tsxと同一のロジック）
  const calculateLinkPoints = (source: SvgDiagramProps['nodes'][0], target: SvgDiagramProps['nodes'][0]) => {
    const isInContextOf = ['Context', 'Assumption', 'Justification'].includes(target.type);
    const verticalTargets = ['Goal', 'Strategy', 'Evidence', 'Undeveloped', 'Module'];
    const shouldConnectVertically = verticalTargets.includes(target.type);

    let x1: number, y1: number, x2: number, y2: number;

    if (shouldConnectVertically) {
      const dy = target.position.y - source.position.y;
      if (dy > 0) {
        x1 = source.position.x;
        y1 = source.position.y + source.size.height / 2;
        x2 = target.position.x;
        y2 = target.position.y - target.size.height / 2;
      } else {
        x1 = source.position.x;
        y1 = source.position.y - source.size.height / 2;
        x2 = target.position.x;
        y2 = target.position.y + target.size.height / 2;
      }
    } else {
      const dx = target.position.x - source.position.x;
      if (dx > 0) {
        x1 = source.position.x + source.size.width / 2;
        y1 = source.position.y;
        x2 = target.position.x - target.size.width / 2;
        y2 = target.position.y;
      } else {
        x1 = source.position.x - source.size.width / 2;
        y1 = source.position.y;
        x2 = target.position.x + target.size.width / 2;
        y2 = target.position.y;
      }
    }

    return { x1, y1, x2, y2, isInContextOf };
  };

  return (
    <div
      style={{
        maxHeight: '400px',
        overflow: 'auto',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        backgroundColor: '#FFFFFF',
      }}
    >
      <svg
        width={Math.max(width, 600)}
        height={Math.max(height, 300)}
        viewBox={`${minX} ${minY} ${width} ${height}`}
        style={{ display: 'block' }}
      >
        <defs>
          {/* 通常の塗りつぶし矢印（SupportedBy関係用） */}
          <marker
            id="survey-arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#1F2937" />
          </marker>
          {/* 白抜き矢印（InContextOf関係用） */}
          <marker
            id="survey-arrowhead-hollow"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="white" stroke="#1F2937" strokeWidth="1.5" />
          </marker>
        </defs>

        {/* リンク描画 */}
        {links.map((link) => {
          const source = getNode(link.source);
          const target = getNode(link.target);
          if (!source || !target) return null;

          const { x1, y1, x2, y2, isInContextOf } = calculateLinkPoints(source, target);
          const markerEnd = isInContextOf ? 'url(#survey-arrowhead-hollow)' : 'url(#survey-arrowhead)';

          return (
            <line
              key={link.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#1F2937"
              strokeWidth={2}
              strokeDasharray={link.type === 'dashed' ? '8 8' : undefined}
              markerEnd={markerEnd}
            />
          );
        })}

        {/* ノード描画 */}
        {nodes.map((node) => {
          const contentLines = wrapText(stripHtml(node.content), node.size.width, node.size.height, node.type);
          const fontSize = 14;
          const lineHeight = fontSize * 1.4;
          const totalTextHeight = contentLines.length * lineHeight;
          const startY = -totalTextHeight / 2 + lineHeight / 2;

          return (
            <g key={node.id} transform={`translate(${node.position.x}, ${node.position.y})`}>
              {renderShape(node)}

              {/* コンテンツテキスト */}
              {contentLines.map((line, index) => (
                <text
                  key={`${node.id}-line-${index}`}
                  x={0}
                  y={startY + index * lineHeight + (node.type === 'Module' ? 15 : 0)}
                  textAnchor="middle"
                  fontSize={fontSize}
                  fill="#111827"
                  dominantBaseline="middle"
                >
                  {line}
                </text>
              ))}

              {/* ラベル表示（ノードの上） */}
              {node.label && (
                <>
                  <rect
                    x={-node.size.width / 2}
                    y={-node.size.height / 2 - 24}
                    width={Math.max(40, node.label.length * 9)}
                    height={20}
                    fill="#FFFFFF"
                    stroke="#D1D5DB"
                    strokeWidth={1}
                    rx={4}
                    ry={4}
                  />
                  <text
                    x={-node.size.width / 2 + Math.max(40, node.label.length * 9) / 2}
                    y={-node.size.height / 2 - 9}
                    fill="#374151"
                    fontSize={13}
                    fontWeight="600"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {node.label}
                  </text>
                </>
              )}

              {/* Assumption/Justification添え字 */}
              {(node.type === 'Assumption' || node.type === 'Justification') && (
                <text
                  x={node.size.width / 2 - 10}
                  y={node.size.height / 2 - 5}
                  fill={node.type === 'Assumption' ? '#DC2626' : '#2563EB'}
                  fontSize={16}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {node.type === 'Assumption' ? 'A' : 'J'}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
