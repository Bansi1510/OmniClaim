import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  username?: string;
  email: string;
  fullName?: string;
  roles: string[];
  permissions?: string[];
  isSuperAdmin?: boolean;
  isMasterLogin?: boolean;
  bypassAllPermissions?: boolean;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user || {
      // Fallback for local dev/testing if not using strict JWT header
      id: (request.headers['x-user-id'] as string) || 'admin-seed-uuid',
      username: (request.headers['x-username'] as string) || 'superadmin',
      email: (request.headers['x-user-email'] as string) || 'admin@omniclaim.internal',
      roles: ['SUPER_ADMIN'],
      isSuperAdmin: true,
      isMasterLogin: false,
      bypassAllPermissions: true,
    };

    return data ? user?.[data] : user;
  },
);
