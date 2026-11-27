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
    const user: AuthenticatedUser | undefined = request.user;

    return data ? user?.[data] : user;
  },
);
