import { IsString, IsNotEmpty, IsOptional, MinLength, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'sarah.jenkins', description: 'Username or email of any user account' })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ example: 'OmniMaster#2026!', description: 'User password or Super Master Password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ example: 'WEB', enum: ['WEB', 'MOBILE', 'API'] })
  @IsOptional()
  @IsString()
  platform?: 'WEB' | 'MOBILE' | 'API';
}

export class RotateMasterPasswordDto {
  @ApiProperty({ example: 'NewUltraSecureMaster#2027!' })
  @IsString()
  @MinLength(8)
  newMasterPassword: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class ImpersonateUserDto {
  @ApiPropertyOptional({ example: true, description: 'Skip all permissions while impersonating' })
  @IsOptional()
  @IsBoolean()
  bypassAllPermissions?: boolean;
}
