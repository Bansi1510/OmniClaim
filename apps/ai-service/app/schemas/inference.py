from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict, Any
from datetime import datetime

class GPSCoord(BaseModel):
    latitude: float
    longitude: float

class EvidenceImageInput(BaseModel):
    id: str
    url: str
    deviceGps: GPSCoord
    deviceTimestamp: datetime

class BillDocumentInput(BaseModel):
    id: str
    url: str

class ClaimAnalysisRequest(BaseModel):
    claimId: str
    claimNumber: str
    incidentTimestamp: datetime
    incidentGps: GPSCoord
    evidenceImages: List[EvidenceImageInput]
    billDocuments: List[BillDocumentInput]
    callbackUrl: Optional[str] = None

class BoundingBox(BaseModel):
    xmin: float
    ymin: float
    xmax: float
    ymax: float

class DetectedDamageOutput(BaseModel):
    evidenceId: str
    partType: str
    materialType: str
    severity: str
    confidence: float
    boundingBox: BoundingBox
    recommendedAction: str

class BillLineItemOutput(BaseModel):
    billDocumentId: str
    rawDescription: str
    inferredPartType: Optional[str] = None
    inferredMaterialType: Optional[str] = None
    isLabor: bool
    claimedCost: float
    ocrConfidence: float

class ImageFeatureOutput(BaseModel):
    evidenceId: str
    pHash: str
    embedding: List[float] # 512-dimension normalized feature vector

class ClaimAnalysisResult(BaseModel):
    claimId: str
    status: str # "SUCCESS" | "FAILED"
    errorMessage: Optional[str] = None
    damages: List[DetectedDamageOutput]
    billItems: List[BillLineItemOutput]
    imageFeatures: List[ImageFeatureOutput]
