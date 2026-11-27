import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEnum,
  IsIn,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClaimStatus } from '@omniclaim/database';

export class CreateClaimSupplementDto {
  @ApiProperty({ example: 'SUPPLEMENT', enum: ['SUPPLEMENT', 'DISPUTE', 'APPEAL'] })
  @IsString()
  @IsIn(['SUPPLEMENT', 'DISPUTE', 'APPEAL'])
  type: 'SUPPLEMENT' | 'DISPUTE' | 'APPEAL';

  @ApiProperty({ example: 325.5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  requestedAmount?: number;

  @ApiProperty({ example: 'Hidden bumper reinforcement bar damage found after teardown.' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ReopenClaimDto {
  @ApiProperty({ example: 2, description: 'Current record version for optimistic locking' })
  @IsNumber()
  expectedVersion: number;

  @ApiProperty({ example: 'Supplemental repair invoice submitted by body shop.' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class CaptureEvidenceDto {
  @ApiProperty({
    example: 'FRONT_VIEW',
    enum: [
      'FRONT_VIEW',
      'REAR_VIEW',
      'LEFT_SIDE',
      'RIGHT_SIDE',
      'DAMAGE_CLOSEUP',
      'NUMBER_PLATE',
      'ADDITIONAL',
    ],
  })
  @IsString()
  @IsIn([
    'FRONT_VIEW',
    'REAR_VIEW',
    'LEFT_SIDE',
    'RIGHT_SIDE',
    'DAMAGE_CLOSEUP',
    'NUMBER_PLATE',
    'ADDITIONAL',
  ])
  captureStep:
    | 'FRONT_VIEW'
    | 'REAR_VIEW'
    | 'LEFT_SIDE'
    | 'RIGHT_SIDE'
    | 'DAMAGE_CLOSEUP'
    | 'NUMBER_PLATE'
    | 'ADDITIONAL';

  @ApiProperty({ description: 'Base64-encoded image captured directly from live camera (max 8 MB)' })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ example: 37.7749 })
  @IsOptional()
  @IsNumber()
  deviceLatitude?: number;

  @ApiPropertyOptional({ example: -122.4194 })
  @IsOptional()
  @IsNumber()
  deviceLongitude?: number;
}

export class StaffExceptionEvidenceDto extends CaptureEvidenceDto {
  @ApiProperty({ example: 'Adjuster uploading police report damage photo under documented exception.' })
  @IsString()
  @IsNotEmpty()
  exceptionReason: string;
}

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
