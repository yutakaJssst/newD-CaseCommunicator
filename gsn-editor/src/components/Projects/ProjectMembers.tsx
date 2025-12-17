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
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">プロジェクトメンバー</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="閉じる"
          >
            ✕
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
              className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              + メンバーを招待
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
            <div className="space-y-3">
              {/* Owner */}
              {owner && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{getUserName(owner)}</div>
                      <div className="text-sm text-gray-600">{owner.email}</div>
                    </div>
                    <span className="px-3 py-1 bg-blue-600 text-white text-sm rounded-full">
                      オーナー
                    </span>
                  </div>
                </div>
              )}

              {/* Team members */}
              {members.map((member) => (
                <div key={member.id} className="p-4 bg-white border border-gray-200 rounded-md hover:border-gray-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{getUserName(member.user)}</div>
                      <div className="text-sm text-gray-600">{member.user.email}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        参加日: {new Date(member.createdAt).toLocaleDateString('ja-JP')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOwner ? (
                        <>
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.id, e.target.value as 'editor' | 'viewer')}
                            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="editor">編集者</option>
                            <option value="viewer">閲覧者</option>
                          </select>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm"
                          >
                            削除
                          </button>
                        </>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                          {getRoleName(member.role)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Empty state */}
              {members.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {isOwner ? 'まだメンバーがいません。メンバーを招待してください。' : 'メンバーはあなただけです。'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectMembers;
