import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsInt,
  IsArray,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import {
  SettingValueType,
  VehiclePartType,
  MaterialType,
  AutomationRuleType,
  LedgerAccountType,
  ClaimStatus,
} from '@omniclaim/database';

export class UpsertSystemSettingDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsEnum(SettingValueType)
  valueType?: SettingValueType;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isEditable?: boolean;
}

export class CreatePolicyDto {
  @IsString()
  @IsNotEmpty()
  policyNumber: string;

  @IsString()
  @IsNotEmpty()
  policyHolderId: string;

  @IsString()
  @IsNotEmpty()
  vehicleVin: string;

  @IsString()
  @IsNotEmpty()
  vehicleMake: string;

  @IsString()
  @IsNotEmpty()
  vehicleModel: string;

  @IsInt()
  vehicleYear: number;

  @IsNumber()
  coverageLimit: number;

  @IsNumber()
  baseDeductible: number;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePolicyDto {
  @IsOptional() @IsString() vehicleVin?: string;
  @IsOptional() @IsString() vehicleMake?: string;
  @IsOptional() @IsString() vehicleModel?: string;
  @IsOptional() @IsInt() vehicleYear?: number;
  @IsOptional() @IsNumber() coverageLimit?: number;
  @IsOptional() @IsNumber() baseDeductible?: number;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreatePartCatalogDto {
  @IsString() @IsNotEmpty() partCode: string;
  @IsString() @IsNotEmpty() partName: string;
  @IsEnum(VehiclePartType) partType: VehiclePartType;
  @IsEnum(MaterialType) materialType: MaterialType;
  @IsNumber() oemBasePrice: number;
  @IsNumber() aftermarketPrice: number;
  @IsOptional() @IsNumber() defaultLaborHours?: number;
  @IsOptional() @IsNumber() laborRatePerHour?: number;
  @IsOptional() @IsNumber() depreciationOverridePct?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdatePartCatalogDto {
  @IsOptional() @IsString() partName?: string;
  @IsOptional() @IsEnum(VehiclePartType) partType?: VehiclePartType;
  @IsOptional() @IsEnum(MaterialType) materialType?: MaterialType;
  @IsOptional() @IsNumber() oemBasePrice?: number;
  @IsOptional() @IsNumber() aftermarketPrice?: number;
  @IsOptional() @IsNumber() defaultLaborHours?: number;
  @IsOptional() @IsNumber() laborRatePerHour?: number;
  @IsOptional() @IsNumber() depreciationOverridePct?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateDepreciationRuleDto {
  @IsString() @IsNotEmpty() name: string;
  @IsEnum(MaterialType) materialType: MaterialType;
  @IsInt() @Min(0) minVehicleAgeYears: number;
  @IsInt() @Min(0) maxVehicleAgeYears: number;
  @IsNumber() @Min(0) @Max(100) depreciationPercent: number;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateDepreciationRuleDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(MaterialType) materialType?: MaterialType;
  @IsOptional() @IsInt() minVehicleAgeYears?: number;
  @IsOptional() @IsInt() maxVehicleAgeYears?: number;
  @IsOptional() @IsNumber() depreciationPercent?: number;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateAutomationRuleDto {
  @IsString() @IsNotEmpty() name: string;
  @IsEnum(AutomationRuleType) ruleType: AutomationRuleType;
  @IsString() @IsNotEmpty() metricKey: string;
  @IsString() @IsNotEmpty() operator: string;
  @IsString() @IsNotEmpty() thresholdValue: string;
  @IsOptional() @IsNumber() riskWeight?: number;
  @IsString() @IsNotEmpty() action: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateAutomationRuleDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(AutomationRuleType) ruleType?: AutomationRuleType;
  @IsOptional() @IsString() metricKey?: string;
  @IsOptional() @IsString() operator?: string;
  @IsOptional() @IsString() thresholdValue?: string;
  @IsOptional() @IsNumber() riskWeight?: number;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateGarageDto {
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() city: string;
  @IsOptional() @IsString() taxId?: string;
  @IsOptional() @IsNumber() hourlyLaborRate?: number;
  @IsOptional() @IsNumber() rating?: number;
  @IsOptional() @IsBoolean() isPreferredNetwork?: boolean;
  @IsOptional() @IsBoolean() isBlacklisted?: boolean;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
}

export class UpdateGarageDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() taxId?: string;
  @IsOptional() @IsNumber() hourlyLaborRate?: number;
  @IsOptional() @IsNumber() rating?: number;
  @IsOptional() @IsBoolean() isPreferredNetwork?: boolean;
  @IsOptional() @IsBoolean() isBlacklisted?: boolean;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
}

export class CreateDynamicMenuDto {
  @IsString() @IsNotEmpty() menuKey: string;
  @IsString() @IsNotEmpty() label: string;
  @IsOptional() @IsString() navLink?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() parentKey?: string;
  @IsOptional() @IsString() requiredPermission?: string;
  @IsOptional() @IsString() badgeName?: string;
  @IsOptional() @IsString() badgeColor?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isVisible?: boolean;
}

export class UpdateDynamicMenuDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() navLink?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() parentKey?: string;
  @IsOptional() @IsString() requiredPermission?: string;
  @IsOptional() @IsString() badgeName?: string;
  @IsOptional() @IsString() badgeColor?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isVisible?: boolean;
}

export class CreatePermissionDto {
  @IsString() @IsNotEmpty() slug: string;
  @IsString() @IsNotEmpty() module: string;
  @IsString() @IsNotEmpty() description: string;
}

export class UpdatePermissionDto {
  @IsOptional() @IsString() module?: string;
  @IsOptional() @IsString() description?: string;
}

export class CreateUserDto {
  @IsString() @IsNotEmpty() username: string;
  @IsString() @IsNotEmpty() email: string;
  @IsString() @IsNotEmpty() fullName: string;
  @IsString() @IsNotEmpty() password: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isSuperAdmin?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) roleIds?: string[];
}

export class UpdateUserDto {
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isSuperAdmin?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) roleIds?: string[];
}

export class CreateLedgerAccountDto {
  @IsString() @IsNotEmpty() accountNumber: string;
  @IsString() @IsNotEmpty() name: string;
  @IsEnum(LedgerAccountType) type: LedgerAccountType;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateLedgerAccountDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(LedgerAccountType) type?: LedgerAccountType;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ForceClaimStatusDto {
  @IsEnum(ClaimStatus) status: ClaimStatus;
  @IsString() @IsNotEmpty() reason: string;
}
