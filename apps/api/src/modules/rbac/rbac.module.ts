import { Module } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';
import { DynamicPermissionsGuard } from '../../common/guards/dynamic-permissions.guard';

@Module({
  controllers: [RbacController],
  providers: [RbacService, DynamicPermissionsGuard],
  exports: [RbacService, DynamicPermissionsGuard],
})
export class RbacModule {}
