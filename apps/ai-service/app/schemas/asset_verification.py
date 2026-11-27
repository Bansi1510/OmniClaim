from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict, Any

class ImageQualityMetrics(BaseModel):
    clarityScore: float  # 0.0 to 1.0
    brightnessScore: float # 0.0 to 1.0
    blurScore: float       # 0.0 to 1.0 (higher = more blurry)
    isOccluded: bool = False
    isManipulated: bool = False

class VerifyAssetImageRequest(BaseModel):
    assetCategory: str
    assetType: Optional[str] = None
    expectedView: str
    imageUrl: str
    imageRequirementConfig: Optional[Dict[str, Any]] = None

class VerifyAssetImageResponse(BaseModel):
    isValid: bool
    detectedAssetCategory: str
    detectedAssetType: Optional[str] = None
    detectedView: str
    confidence: float
    quality: ImageQualityMetrics
    pHash: str
    rejectionReason: Optional[str] = None

class CompareBaselineRequest(BaseModel):
    assetCategory: str
    baselineImages: List[Dict[str, Any]] # [{ view: "FRONT", url: "..." }]
    claimImages: List[Dict[str, Any]]    # [{ view: "FRONT", url: "..." }]

class DamageComparisonItem(BaseModel):
    component: str
    damageType: str
    severity: str
    classification: str # "NEWLY_OBSERVED" | "PRE_EXISTING" | "UNCERTAIN"
    confidence: float
    baselineImageUrl: Optional[str] = None
    claimImageUrl: str
    observations: str

class CompareBaselineResponse(BaseModel):
    status: str
    comparisons: List[DamageComparisonItem]
