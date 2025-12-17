import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middleware/auth';

// Get all members of a project
export const getProjectMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }

  // Verify user has access to the project
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    include: {
      owner: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!project) {
    res.status(404).json({ error: 'プロジェクトが見つかりません' });
    return;
  }

  res.json({
    result: 'OK',
    owner: project.owner,
    members: project.members,
  });
};

// Invite a user to the project
export const inviteMember = async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { email, role } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }

  if (!email || !role) {
    res.status(400).json({ error: 'メールアドレスとロールが必要です' });
    return;
  }

  if (!['editor', 'viewer'].includes(role)) {
    res.status(400).json({ error: 'ロールは editor または viewer である必要があります' });
    return;
  }

  // Verify user is the project owner
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    res.status(404).json({ error: 'プロジェクトが見つかりません' });
    return;
  }

  if (project.ownerId !== userId) {
    res.status(403).json({ error: 'プロジェクトのオーナーのみがメンバーを招待できます' });
    return;
  }

  // Find the user to invite by email
  const invitedUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!invitedUser) {
    res.status(404).json({ error: '指定されたメールアドレスのユーザーが見つかりません' });
    return;
  }

  // Check if user is already a member
  const existingMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: invitedUser.id,
      },
    },
  });

  if (existingMember) {
    res.status(400).json({ error: 'このユーザーは既にプロジェクトのメンバーです' });
    return;
  }

  // Create project member
  const member = await prisma.projectMember.create({
    data: {
      projectId,
      userId: invitedUser.id,
      role,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      projectId,
      userId,
      action: 'invite_member',
      data: {
        invitedUserId: invitedUser.id,
        invitedUserEmail: email,
        role,
      },
    },
  });

  res.status(201).json({
    result: 'OK',
    member,
  });
};

// Update a member's role
export const updateMemberRole = async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId, memberId } = req.params;
  const { role } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }

  if (!role || !['editor', 'viewer'].includes(role)) {
    res.status(400).json({ error: 'ロールは editor または viewer である必要があります' });
    return;
  }

  // Verify user is the project owner
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    res.status(404).json({ error: 'プロジェクトが見つかりません' });
    return;
  }

  if (project.ownerId !== userId) {
    res.status(403).json({ error: 'プロジェクトのオーナーのみがロールを変更できます' });
    return;
  }

  // Update member role
  const member = await prisma.projectMember.update({
    where: { id: memberId },
    data: { role },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      projectId,
      userId,
      action: 'update_member_role',
      data: {
        memberId,
        newRole: role,
      },
    },
  });

  res.json({
    result: 'OK',
    member,
  });
};

// Remove a member from the project
export const removeMember = async (req: AuthRequest, res: Response): Promise<void> => {
  const { projectId, memberId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: '認証が必要です' });
    return;
  }

  // Verify user is the project owner
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    res.status(404).json({ error: 'プロジェクトが見つかりません' });
    return;
  }

  if (project.ownerId !== userId) {
    res.status(403).json({ error: 'プロジェクトのオーナーのみがメンバーを削除できます' });
    return;
  }

  // Delete the member
  const member = await prisma.projectMember.delete({
    where: { id: memberId },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      projectId,
      userId,
      action: 'remove_member',
      data: {
        memberId,
        removedUserId: member.userId,
      },
    },
  });

  res.json({
    result: 'OK',
    message: 'メンバーを削除しました',
  });
};
