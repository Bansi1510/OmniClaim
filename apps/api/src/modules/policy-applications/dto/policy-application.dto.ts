import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
  IsObject,
  Min,
  Max,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApplicationDto {
  @ApiProperty({ example: 'prd-uuid' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional({ example: 'vt-uuid' })
  @IsOptional()
  @IsString()
  vehicleTypeId?: string;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  @Min(1000)
  requestedCoverage: number;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0)
  requestedDeductible: number;

  @ApiProperty({ example: 12 })
  @IsNumber()
  @Min(1)
  @Max(120)
  termMonths: number;

  @ApiPropertyOptional({ example: '2026-12-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  desiredStartDate?: string;

  @ApiProperty({ example: { fullName: 'Alex Rivera', phone: '+1-555-0192', email: 'alex@omniclaim.internal', address: '742 Pine St, Austin, TX' } })
  @IsObject()
  applicantDetailsJson: Record<string, any>;

  @ApiProperty({ example: { vehicleVin: '1HGCM82633A004352', vehicleMake: 'Honda', vehicleModel: 'Accord', vehicleYear: 2023 } })
  @IsObject()
  riskDetailsJson: Record<string, any>;

  @ApiPropertyOptional({ example: { name: 'Elena Rivera', relationship: 'Spouse' } })
  @IsOptional()
  @IsObject()
  nomineeDetailsJson?: Record<string, any>;
}

export class UpdateApplicationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1000)
  requestedCoverage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  requestedDeductible?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  termMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  desiredStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  applicantDetailsJson?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  riskDetailsJson?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  nomineeDetailsJson?: Record<string, any>;
}

export class UploadApplicationDocDto {
  @ApiProperty({ example: 'ID_PROOF' })
  @IsString()
  @IsNotEmpty()
  docType: string;

  @ApiProperty({ example: 'drivers_license_front.pdf' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ example: 245760 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fileSizeBytes?: number;

  @ApiProperty({ example: 'https://storage.omniclaim.internal/docs/drivers_license.pdf' })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;
}

export class UnderwritingDecisionDto {
  @ApiProperty({ enum: ['APPROVED', 'DECLINED', 'NEEDS_INFO'] })
  @IsString()
  @IsIn(['APPROVED', 'DECLINED', 'NEEDS_INFO'])
  decision: 'APPROVED' | 'DECLINED' | 'NEEDS_INFO';

  @ApiPropertyOptional({ example: 22.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  riskScore?: number;

  @ApiPropertyOptional({ example: 75.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  premiumLoading?: number;

  @ApiPropertyOptional({ example: 'Verified vehicle registration and clean driving record.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PayAndIssueDto {
  @ApiProperty({ enum: ['CARD', 'ACH', 'UPI', 'STRIPE'] })
  @IsString()
  @IsIn(['CARD', 'ACH', 'UPI', 'STRIPE'])
  paymentMethod: 'CARD' | 'ACH' | 'UPI' | 'STRIPE';

  @ApiPropertyOptional({ example: 'POLPAY-app-uuid-1' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quoteId?: string;
}

export class CreateEndorsementDto {
  @ApiProperty({ enum: ['COVERAGE_CHANGE', 'DEDUCTIBLE_CHANGE', 'VEHICLE_UPDATE', 'BENEFICIARY_UPDATE'] })
  @IsString()
  @IsIn(['COVERAGE_CHANGE', 'DEDUCTIBLE_CHANGE', 'VEHICLE_UPDATE', 'BENEFICIARY_UPDATE'])
  endorsementType: 'COVERAGE_CHANGE' | 'DEDUCTIBLE_CHANGE' | 'VEHICLE_UPDATE' | 'BENEFICIARY_UPDATE';

  @ApiProperty({ example: 'Increase collision coverage limit to $75,000' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 75000 })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  newCoverageLimit?: number;

  @ApiPropertyOptional({ example: 250 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  newDeductible?: number;

  @ApiPropertyOptional({ example: 120.0 })
  @IsOptional()
  @IsNumber()
  premiumDelta?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  changesJson?: Record<string, any>;
}

export class CancelPolicyDto {
  @ApiProperty({ example: 'Vehicle sold — policyholder requested early cancellation.' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class UpsertProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'PRD-AUTO-PRO-02' })
  @IsString()
  @IsNotEmpty()
  productCode: string;

  @ApiProperty({ example: 'AUTO' })
  @IsString()
  @IsNotEmpty()
  categoryCode: string;

  @ApiPropertyOptional({ example: 'vt-uuid', description: 'Optional VehicleType ID under selected category' })
  @IsOptional()
  @IsString()
  vehicleTypeId?: string;

  @ApiProperty({ example: 'OmniShield Executive Auto' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 1250 })
  @IsNumber()
  @Min(1)
  baseRateAnnual: number;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  @Min(100)
  minCoverageAmount: number;

  @ApiProperty({ example: 500000 })
  @IsNumber()
  @Min(100)
  maxCoverageAmount: number;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0)
  defaultDeductible: number;

  @ApiPropertyOptional({ example: [6, 12, 24] })
  @IsOptional()
  @IsArray()
  termMonthsOptions?: number[];

  @ApiPropertyOptional({ example: ['ID_PROOF', 'VEHICLE_RC'] })
  @IsOptional()
  @IsArray()
  requiredDocumentsJson?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  eligibilityJson?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  exclusionsJson?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  addonsJson?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertVehicleTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'AUTO' })
  @IsString()
  @IsNotEmpty()
  categoryCode: string;

  @ApiProperty({ example: 'CAR' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Car / Sedan & SUV' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Car' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'CYBER' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Cyber & Identity Protection' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'Shield' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requiresUnderwriting?: boolean;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
