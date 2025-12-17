import { Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

// Get all projects for the current user
export const getProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw createError(401, 'Unauthorized');
    }

    // Get projects where user is owner or member
    const projects = await prisma.project.findMany({
      where: {
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
          select: {
            id: true,
            role: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            diagrams: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    res.json({
      result: 'OK',
      projects,
    });
  } catch (error) {
    next(error);
  }
};

// Get a single project by ID
export const getProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;

    if (!userId) {
      throw createError(401, 'Unauthorized');
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
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
          select: {
            id: true,
            role: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        diagrams: {
          select: {
            id: true,
            title: true,
            version: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        },
      },
    });

    if (!project) {
      throw createError(404, 'Project not found');
    }

    // Check if user has access to this project
    const hasAccess =
      project.ownerId === userId ||
      project.members.some((m) => m.user.id === userId);

    if (!hasAccess) {
      throw createError(403, 'Access denied');
    }

    res.json({
      result: 'OK',
      project,
    });
  } catch (error) {
    next(error);
  }
};

// Create a new project
export const createProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { title, description } = req.body;

    if (!userId) {
      throw createError(401, 'Unauthorized');
    }

    if (!title) {
      throw createError(400, 'Title is required');
    }

    const project = await prisma.project.create({
      data: {
        title,
        description: description || null,
        ownerId: userId,
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
      },
    });

    res.status(201).json({
      result: 'OK',
      project,
    });
  } catch (error) {
    next(error);
  }
};

// Update a project
export const updateProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;
    const { title, description } = req.body;

    if (!userId) {
      throw createError(401, 'Unauthorized');
    }

    // Check if user is the owner
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw createError(404, 'Project not found');
    }

    if (project.ownerId !== userId) {
      throw createError(403, 'Only the owner can update the project');
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        title: title || project.title,
        description: description !== undefined ? description : project.description,
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
      },
    });

    res.json({
      result: 'OK',
      project: updatedProject,
    });
  } catch (error) {
    next(error);
  }
};

// Delete a project
export const deleteProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;

    if (!userId) {
      throw createError(401, 'Unauthorized');
    }

    // Check if user is the owner
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw createError(404, 'Project not found');
    }

    if (project.ownerId !== userId) {
      throw createError(403, 'Only the owner can delete the project');
    }

    await prisma.project.delete({
      where: { id: projectId },
    });

    res.json({
      result: 'OK',
      message: 'Project deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
