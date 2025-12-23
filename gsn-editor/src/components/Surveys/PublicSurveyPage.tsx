import React, { useEffect, useMemo, useState } from 'react';
import { publicSurveysApi, type PublicSurveyAnswer, type PublicSurveyResponse } from '../../api/surveys';
import { LoadingState } from '../Status/LoadingState';
import { ErrorState } from '../Status/ErrorState';

interface PublicSurveyPageProps {
  token: string;
}

export const PublicSurveyPage: React.FC<PublicSurveyPageProps> = ({ token }) => {
  const [survey, setSurvey] = useState<PublicSurveyResponse['survey'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, PublicSurveyAnswer>>({});

  const nodeMap = useMemo(() => {
    const snapshot = survey?.gsnSnapshot as any;
    if (!snapshot || typeof snapshot !== 'object') return new Map<string, any>();
    const modules = snapshot.modules && typeof snapshot.modules === 'object'
      ? snapshot.modules
      : { root: snapshot };
    const allNodes = Object.values(modules)
      .flatMap((module: any) => (Array.isArray(module?.nodes) ? module.nodes : []));
    return new Map(allNodes.map((node: any) => [String(node.id), node]));
  }, [survey?.gsnSnapshot]);

  const stripHtml = (html?: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  };

  const diagramData = useMemo(() => {
    const snapshot = survey?.gsnSnapshot as any;
    if (!snapshot || typeof snapshot !== 'object') return null;
    const currentId = snapshot.currentDiagramId || 'root';
    const modules = snapshot.modules && typeof snapshot.modules === 'object'
      ? snapshot.modules
      : { root: snapshot };
    const moduleData = modules[currentId] || modules.root || null;
    if (!moduleData) return null;
    return {
      nodes: Array.isArray(moduleData.nodes) ? moduleData.nodes : [],
      links: Array.isArray(moduleData.links) ? moduleData.links : [],
    };
  }, [survey?.gsnSnapshot]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await publicSurveysApi.getSurvey(token);
        setSurvey(response.survey);
      } catch (err: any) {
        setError(err.response?.data?.error || 'アンケートの読み込みに失敗しました');
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
  };

  const handleCommentChange = (questionId: string, comment: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        questionId,
        score: prev[questionId]?.score ?? 0,
        comment,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey) return;

    const answerList = survey.questions.map((question) => answers[question.id]);
    if (answerList.some((answer) => answer?.score === undefined)) {
      setError('すべての質問に回答してください');
      return;
    }

    try {
      setError(null);
      await publicSurveysApi.submitResponse(token, answerList as PublicSurveyAnswer[]);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.error || '送信に失敗しました');
    }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <div
      style={{
        width: '100vw',
        minHeight: '100vh',
        backgroundColor: '#F9FAFB',
        padding: '40px 20px',
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
            {survey.description && (
              <p style={{ color: '#6B7280' }}>{survey.description}</p>
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
                  対象GSN（簡易表示）
                </div>
                <SvgDiagram nodes={diagramData.nodes} links={diagramData.links} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
              {survey.questions.map((question) => {
                const node = nodeMap.get(question.nodeId);
                const descriptionText = stripHtml(node?.content) || '-';
                const nodeLabel = node?.label || '-';
                return (
                  <div
                    key={question.id}
                    style={{
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      padding: '16px',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                      {question.questionText}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                      ID: {nodeLabel} / {question.nodeType}
                    </div>
                    <div style={{ fontSize: '12px', color: '#374151', marginBottom: '12px' }}>
                      説明: {descriptionText}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
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
                    </div>
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
                  </div>
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

interface SvgDiagramProps {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    label?: string;
    content?: string;
  }>;
  links: Array<{ id: string; source: string; target: string }>;
}

const SvgDiagram: React.FC<SvgDiagramProps> = ({ nodes, links }) => {
  const bounds = nodes.reduce(
    (acc, node) => {
      const left = node.position.x - node.size.width / 2;
      const right = node.position.x + node.size.width / 2;
      const top = node.position.y - node.size.height / 2;
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

  const wrapText = (text: string, maxChars: number, maxLines: number) => {
    if (!text) return [];
    const chars = [...text];
    const lines: string[] = [];
    for (let i = 0; i < chars.length; i += maxChars) {
      lines.push(chars.slice(i, i + maxChars).join(''));
      if (lines.length >= maxLines) break;
    }
    if (chars.length > maxChars * maxLines) {
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = `${last.slice(0, Math.max(0, last.length - 1))}…`;
    }
    return lines;
  };

  const renderShape = (node: SvgDiagramProps['nodes'][0]) => {
    const { width: w, height: h } = node.size;
    const stroke = '#374151';
    const fill = node.type === 'Module' ? '#E5E7EB' : '#FFFFFF';

    switch (node.type) {
      case 'Strategy': {
        const points = [
          `${-w / 2 + 20},${-h / 2}`,
          `${w / 2 + 20},${-h / 2}`,
          `${w / 2 - 20},${h / 2}`,
          `${-w / 2 - 20},${h / 2}`,
        ].join(' ');
        return <polygon points={points} fill={fill} stroke={stroke} strokeWidth={2} />;
      }
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

  return (
    <svg
      width="100%"
      height="260"
      viewBox={`${minX} ${minY} ${width} ${height}`}
      style={{ backgroundColor: '#FFFFFF', borderRadius: '8px' }}
    >
      <defs>
        <marker
          id="arrow"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
        >
          <polygon points="0,0 8,4 0,8" fill="#374151" />
        </marker>
      </defs>
      {links.map((link) => {
        const source = getNode(link.source);
        const target = getNode(link.target);
        if (!source || !target) return null;
        return (
          <line
            key={link.id}
            x1={source.position.x}
            y1={source.position.y}
            x2={target.position.x}
            y2={target.position.y}
            stroke="#374151"
            strokeWidth={2}
            markerEnd="url(#arrow)"
          />
        );
      })}
      {nodes.map((node) => (
        <g key={node.id} transform={`translate(${node.position.x}, ${node.position.y})`}>
          {renderShape(node)}
          <rect
            x={-node.size.width / 2 + 6}
            y={-node.size.height / 2 + 6}
            width={40}
            height={16}
            rx={3}
            ry={3}
            fill="#FFFFFF"
            stroke="#374151"
            strokeWidth={1}
          />
          <text
            x={-node.size.width / 2 + 26}
            y={-node.size.height / 2 + 18}
            textAnchor="middle"
            fontSize={10}
            fill="#111827"
          >
            {node.label || node.type}
          </text>
          {wrapText(stripHtml(node.content), 12, 3).map((line, index) => (
            <text
              key={`${node.id}-line-${index}`}
              x={0}
              y={index * 14 - 2}
              textAnchor="middle"
              fontSize={12}
              fill="#111827"
            >
              {line}
            </text>
          ))}
        </g>
      ))}
    </svg>
  );
};
