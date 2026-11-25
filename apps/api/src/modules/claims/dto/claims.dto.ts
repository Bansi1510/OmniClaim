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
  @ApiProperty({ example: 'pol-uuid-here' })
  @IsString()
  @IsNotEmpty()
  policyId: string;

  @ApiProperty({ example: '2026-11-24T14:30:00.000Z' })
  @IsDateString()
  incidentDate: string;

  @ApiProperty({ example: 37.7749 })
  @IsNumber()
  incidentLatitude: number;

  @ApiProperty({ example: -122.4194 })
  @IsNumber()
  incidentLongitude: number;

  @ApiProperty({ example: 'Rear-ended at traffic signal in wet road conditions.' })
  @IsString()
  @IsOptional()
  incidentDescription?: string;
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
