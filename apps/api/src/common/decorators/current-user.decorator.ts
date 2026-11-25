import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user || {
      // Mock fall-through for local dev/testing if not using strict JWT header
      id: request.headers['x-user-id'] || 'admin-seed-uuid',
      email: request.headers['x-user-email'] || 'admin@omniclaim.internal',
      roles: ['SUPER_ADMIN'],
    };

    return data ? user?.[data] : user;
  },
);
