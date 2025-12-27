import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { createError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
  userRole?: string;
  file?: Express.Multer.File;
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError(401, 'No token provided');
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    // Verify JWT
    const decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string };

    // Check if session exists and is not expired
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw createError(401, 'Invalid or expired token');
    }

    // Attach user to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(createError(401, 'Invalid token'));
    } else {
      next(error);
    }
  }
};

export const requireProjectAccess = (minRole: 'viewer' | 'editor' | 'owner') => {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const { projectId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw createError(401, 'Unauthorized');
      }

      // Check if user is a member of the project
      const member = await prisma.projectMember.findFirst({
        where: {
          projectId,
          userId,
        },
      });

      if (!member) {
        throw createError(403, 'Access denied');
      }

      // Check role hierarchy
      const roleHierarchy: Record<string, number> = {
        viewer: 0,
        editor: 1,
        owner: 2,
      };

      if (roleHierarchy[member.role] < roleHierarchy[minRole]) {
        throw createError(403, 'Insufficient permissions');
      }

      req.userRole = member.role;
      next();
    } catch (error) {
      next(error);
    }
  };
};
