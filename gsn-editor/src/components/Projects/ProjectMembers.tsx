import React, { useState, useEffect } from 'react';
import { projectMembersApi, type ProjectMember, type User } from '../../api/projectMembers';

interface ProjectMembersProps {
  projectId: string;
  isOwner: boolean;
  onClose: () => void;
}

const ProjectMembers: React.FC<ProjectMembersProps> = ({ projectId, isOwner, onClose }) => {
  const [owner, setOwner] = useState<User | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);

  // Load members
  useEffect(() => {
    loadMembers();
  }, [projectId]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await projectMembersApi.getMembers(projectId);
      setOwner(data.owner);
      setMembers(data.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メンバーの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setInviting(true);
      setError(null);
      await projectMembersApi.inviteMember(projectId, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteEmail('');
      setShowInviteForm(false);
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メンバーの招待に失敗しました');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'editor' | 'viewer') => {
    try {
      setError(null);
      await projectMembersApi.updateMemberRole(projectId, memberId, { role: newRole });
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ロールの変更に失敗しました');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('このメンバーを削除してもよろしいですか?')) return;

    try {
      setError(null);
      await projectMembersApi.removeMember(projectId, memberId);
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メンバーの削除に失敗しました');
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'owner':
        return 'オーナー';
      case 'editor':
        return '編集者';
      case 'viewer':
        return '閲覧者';
      default:
        return role;
    }
  };

  const getUserName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
          <div>
            <h2 className="text-xl font-bold text-gray-900">プロジェクトメンバー</h2>
            <p className="text-sm text-gray-500 mt-1">プロジェクトに参加しているメンバーを管理</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-all"
            aria-label="閉じる"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
              {error}
            </div>
          )}

          {/* Invite button (owner only) */}
          {isOwner && !showInviteForm && (
            <button
              onClick={() => setShowInviteForm(true)}
              className="mb-6 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-md flex items-center gap-2 font-medium"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z"/>
              </svg>
              メンバーを招待
            </button>
          )}

          {/* Invite form */}
          {showInviteForm && (
            <form onSubmit={handleInvite} className="mb-6 p-4 bg-gray-50 rounded-md border border-gray-200">
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ロール
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="editor">編集者 (編集可能)</option>
                  <option value="viewer">閲覧者 (閲覧のみ)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {inviting ? '招待中...' : '招待'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteForm(false);
                    setInviteEmail('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </form>
          )}

          {/* Loading state */}
          {loading && (
            <div className="text-center py-8 text-gray-500">
              読み込み中...
            </div>
          )}

          {/* Members list */}
          {!loading && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>ユーザー</th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151', width: '150px' }}>参加日</th>
                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151', width: '120px' }}>ロール</th>
                    <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#374151', width: '100px' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Owner row */}
                  {owner && (
                    <tr style={{ backgroundColor: '#EFF6FF', borderBottom: '1px solid #DBEAFE' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: '#2563EB',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold',
                            flexShrink: 0
                          }}>
                            {owner.email.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: '500', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {owner.email}
                            </div>
                            <div style={{ fontSize: '12px', color: '#1D4ED8' }}>プロジェクトの作成者</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: '14px', color: '#4B5563' }}>—</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 12px',
                          backgroundColor: '#2563EB',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: '600',
                          borderRadius: '9999px'
                        }}>
                          オーナー
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', color: '#6B7280' }}>—</td>
                    </tr>
                  )}

                  {/* Member rows */}
                  {members.map((member, index) => (
                    <tr
                      key={member.id}
                      style={{
                        backgroundColor: 'white',
                        borderBottom: index !== members.length - 1 ? '1px solid #E5E7EB' : 'none'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: '#9CA3AF',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold',
                            flexShrink: 0
                          }}>
                            {member.user.email.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: '500', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {member.user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: '14px', color: '#4B5563' }}>
                        {new Date(member.createdAt).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        })}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        {isOwner ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.id, e.target.value as 'editor' | 'viewer')}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              border: '1px solid #D1D5DB',
                              borderRadius: '6px',
                              fontSize: '14px',
                              backgroundColor: 'white',
                              outline: 'none'
                            }}
                          >
                            <option value="editor">編集者</option>
                            <option value="viewer">閲覧者</option>
                          </select>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            backgroundColor: member.role === 'editor' ? '#D1FAE5' : '#F3F4F6',
                            color: member.role === 'editor' ? '#065F46' : '#374151',
                            fontSize: '12px',
                            fontWeight: '600',
                            borderRadius: '9999px'
                          }}>
                            {getRoleName(member.role)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        {isOwner && (
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            style={{
                              padding: '6px 12px',
                              color: '#DC2626',
                              backgroundColor: 'transparent',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEF2F2'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            削除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* Empty state */}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '48px 16px', textAlign: 'center' }}>
                        <div style={{ width: '64px', height: '64px', backgroundColor: '#F3F4F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                          <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor" style={{ color: '#9CA3AF' }}>
                            <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm2.735.5a3.5 3.5 0 10-5.47 0A6.01 6.01 0 001 14.5a.5.5 0 001 0 5 5 0 0110 0 .5.5 0 001 0 6.01 6.01 0 00-4.265-5.5z"/>
                          </svg>
                        </div>
                        <p style={{ color: '#4B5563', fontWeight: '500', marginBottom: '8px' }}>
                          {isOwner ? 'まだメンバーがいません' : 'メンバーはあなただけです'}
                        </p>
                        <p style={{ fontSize: '14px', color: '#6B7280' }}>
                          {isOwner ? '「メンバーを招待」ボタンから他のユーザーを招待できます' : 'オーナーが他のメンバーを招待するまでお待ちください'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all font-medium shadow-sm hover:shadow-md"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectMembers;
