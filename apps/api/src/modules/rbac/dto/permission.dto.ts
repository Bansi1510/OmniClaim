import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePermissionDto {
  @ApiProperty({ example: 'claims:approve' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'CLAIMS' })
  @IsString()
  @IsNotEmpty()
  module: string;

  @ApiProperty({ example: 'Approve Claims' })
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiProperty({ example: 'Allows the user to approve insurance claims up to the threshold' })
  @IsString()
  @IsNotEmpty()
  description: string;
}
