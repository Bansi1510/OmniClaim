import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'Senior Fraud Auditor' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'SENIOR_FRAUD_AUDITOR' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'Authorized to review SIU referrals and override risk flags' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: ['fraud:read', 'fraud:override', 'claims:read'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissionSlugs?: string[];
}

export class UpdateRoleDto {
  @ApiProperty({ example: 'Senior Claims & Fraud Specialist' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'Updated role description' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class AssignPermissionsDto {
  @ApiProperty({ example: ['claims:read', 'claims:approve'] })
  @IsArray()
  @IsString({ each: true })
  permissionSlugs: string[];
}

export class AssignRolesDto {
  @ApiProperty({ example: ['role-uuid-1', 'role-uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  roleIds: string[];
}
