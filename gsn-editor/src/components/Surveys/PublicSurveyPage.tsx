import React, { useEffect, useState } from 'react';
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
              {survey.questions.map((question) => (
                <div
                  key={question.id}
                  style={{
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                    {question.questionText}
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
              ))}
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
