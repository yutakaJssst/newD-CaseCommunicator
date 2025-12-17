import React, { useState, useEffect } from 'react';
import { projectAPI } from '../../services/api';
import type { Project } from '../../services/api';
import ProjectMembers from './ProjectMembers';

interface ProjectListProps {
  onSelectProject: (projectId: string) => void;
  user?: { firstName: string | null; lastName: string | null; email: string; id: string } | null;
  onLogout?: () => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({ onSelectProject, user, onLogout }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedProjectForMembers, setSelectedProjectForMembers] = useState<{ id: string; isOwner: boolean } | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const response = await projectAPI.getAll();
      setProjects(response.projects);
    } catch (err: any) {
      setError(err.response?.data?.error || 'プロジェクトの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;

    try {
      setIsCreating(true);
      const response = await projectAPI.create({
        title: newProjectTitle,
        description: newProjectDescription || undefined,
      });
      setProjects([response.project, ...projects]);
      setShowCreateModal(false);
      setNewProjectTitle('');
      setNewProjectDescription('');
      // 新規作成したプロジェクトを自動的に開く
      onSelectProject(response.project.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'プロジェクトの作成に失敗しました');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (projectId: string, projectTitle: string) => {
    if (!confirm(`「${projectTitle}」を削除しますか？この操作は取り消せません。`)) {
      return;
    }

    try {
      await projectAPI.delete(projectId);
      setProjects(projects.filter((p) => p.id !== projectId));
    } catch (err: any) {
      alert(err.response?.data?.error || 'プロジェクトの削除に失敗しました');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        color: '#666',
      }}>
        読み込み中...
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#f5f5f5',
      overflow: 'auto',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 20px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
        }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#374151',
          }}>
            マイプロジェクト
          </h1>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {user && onLogout && (
              <>
                <span style={{
                  fontSize: '14px',
                  color: '#374151',
                  fontWeight: '500',
                }}>
                  {user.firstName || user.lastName
                    ? `${user.lastName || ''} ${user.firstName || ''}`.trim()
                    : user.email}
                </span>
                <button
                  onClick={onLogout}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: '#FFFFFF',
                    color: '#EF4444',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#FEF2F2';
                    e.currentTarget.style.borderColor = '#EF4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                    e.currentTarget.style.borderColor = '#D1D5DB';
                  }}
                >
                  ログアウト
                </button>
              </>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '500',
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2563EB')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3B82F6')}
            >
              ＋ 新規プロジェクト
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fee',
            color: '#c00',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '24px',
          }}>
            {error}
          </div>
        )}

        {projects.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            padding: '60px 40px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <p style={{
              fontSize: '18px',
              color: '#9CA3AF',
              marginBottom: '16px',
            }}>
              プロジェクトがありません
            </p>
            <p style={{
              fontSize: '14px',
              color: '#9CA3AF',
            }}>
              「新規プロジェクト」ボタンから最初のプロジェクトを作成しましょう
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '24px',
          }}>
            {projects.map((project) => (
              <div
                key={project.id}
                style={{
                  backgroundColor: 'white',
                  padding: '24px',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                }}
                onClick={() => onSelectProject(project.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: '#374151',
                  marginBottom: '8px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {project.title}
                </h3>
                {project.description && (
                  <p style={{
                    fontSize: '14px',
                    color: '#6B7280',
                    marginBottom: '16px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {project.description}
                  </p>
                )}
                <div style={{
                  fontSize: '13px',
                  color: '#9CA3AF',
                  marginBottom: '12px',
                }}>
                  更新: {formatDate(project.updatedAt)}
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '12px',
                  borderTop: '1px solid #E5E7EB',
                  gap: '12px',
                }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
                    <span style={{
                      fontSize: '13px',
                      color: '#6B7280',
                    }}>
                      📊 {project._count?.diagrams || 0}
                    </span>
                    <div
                      style={{
                        fontSize: '13px',
                        color: user?.id === project.ownerId ? '#3B82F6' : '#6B7280',
                        fontWeight: user?.id === project.ownerId ? '500' : 'normal',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'help',
                        position: 'relative',
                      }}
                      title={
                        project.members && project.members.length > 0
                          ? `オーナー: ${project.owner.email}\nメンバー: ${project.members.map((m) => m.user.email).join(', ')}`
                          : `オーナー: ${project.owner.email}\n（共有メンバーなし）`
                      }
                    >
                      👥 {(project.members?.length || 0) + 1}
                      {user?.id === project.ownerId && (
                        <span style={{
                          fontSize: '11px',
                          backgroundColor: '#EFF6FF',
                          color: '#3B82F6',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: '600',
                        }}>
                          オーナー
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProjectForMembers({
                          id: project.id,
                          isOwner: user?.id === project.ownerId,
                        });
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '13px',
                        color: '#3B82F6',
                        backgroundColor: 'transparent',
                        border: '1px solid #3B82F6',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#EFF6FF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      メンバー
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id, project.title);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '13px',
                        color: '#EF4444',
                        backgroundColor: 'transparent',
                        border: '1px solid #EF4444',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#FEF2F2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 新規プロジェクト作成モーダル */}
        {showCreateModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setShowCreateModal(false)}
          >
            <div
              style={{
                backgroundColor: 'white',
                padding: '32px',
                borderRadius: '12px',
                maxWidth: '500px',
                width: '90%',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                marginBottom: '24px',
                color: '#374151',
              }}>
                新規プロジェクト作成
              </h2>
              <form onSubmit={handleCreateProject}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    プロジェクト名 *
                  </label>
                  <input
                    type="text"
                    value={newProjectTitle}
                    onChange={(e) => setNewProjectTitle(e.target.value)}
                    required
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '15px',
                      outline: 'none',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#3B82F6')}
                    onBlur={(e) => (e.target.style.borderColor = '#D1D5DB')}
                  />
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    説明（任意）
                  </label>
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '15px',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#3B82F6')}
                    onBlur={(e) => (e.target.style.borderColor = '#D1D5DB')}
                  />
                </div>
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end',
                }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      padding: '10px 20px',
                      fontSize: '15px',
                      fontWeight: '500',
                      backgroundColor: 'white',
                      color: '#374151',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    style={{
                      padding: '10px 20px',
                      fontSize: '15px',
                      fontWeight: '500',
                      backgroundColor: isCreating ? '#9CA3AF' : '#3B82F6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isCreating ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isCreating ? '作成中...' : '作成'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* プロジェクトメンバー管理モーダル */}
        {selectedProjectForMembers && (
          <ProjectMembers
            projectId={selectedProjectForMembers.id}
            isOwner={selectedProjectForMembers.isOwner}
            onClose={() => setSelectedProjectForMembers(null)}
          />
        )}
      </div>
    </div>
  );
};
