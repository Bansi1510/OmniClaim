import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ClaimStatus } from '@omniclaim/database';

export class CreateClaimDto {
  @ApiProperty({ example: 'pol-uuid-here', required: false })
  @IsOptional()
  @IsString()
  policyId?: string;

  @ApiProperty({ example: 'POL-OMNI-2026-9081', required: false })
  @IsOptional()
  @IsString()
  policyNumber?: string;

  @ApiProperty({ example: '2026-11-24T14:30:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  incidentDate?: string;

  @ApiProperty({ example: 37.7749, required: false })
  @IsOptional()
  @IsNumber()
  incidentLatitude?: number;

  @ApiProperty({ example: -122.4194, required: false })
  @IsOptional()
  @IsNumber()
  incidentLongitude?: number;

  @ApiProperty({ example: 'Rear-ended at traffic signal in wet road conditions.', required: false })
  @IsString()
  @IsOptional()
  incidentDescription?: string;

  @ApiProperty({ enum: ClaimStatus, required: false })
  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  netPayout?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  fraudScore?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adjusterId?: string;
}

export class TransitionClaimDto {
  @ApiProperty({ enum: ClaimStatus, example: 'APPROVED' })
  @IsEnum(ClaimStatus)
  targetStatus: ClaimStatus;

  @ApiProperty({ example: 0, description: 'Current record version for optimistic locking' })
  @IsNumber()
  expectedVersion: number;

  @ApiProperty({ example: 'All parts verified by YOLO, damage diff cleared, settlement within coverage limits.' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class AssignAdjusterDto {
  @ApiProperty({ example: 'user-uuid-of-adjuster' })
  @IsString()
  @IsNotEmpty()
  adjusterId: string;
}

export class UpdateClaimDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  incidentDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  incidentLatitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  incidentLongitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  incidentDescription?: string;

  @ApiProperty({ enum: ClaimStatus, required: false })
  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  netPayout?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  fraudScore?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adjusterId?: string;
}
