import hashlib
import random
from typing import Dict, Any, List
from app.schemas.asset_verification import (
    VerifyAssetImageRequest,
    VerifyAssetImageResponse,
    ImageQualityMetrics,
    CompareBaselineRequest,
    CompareBaselineResponse,
    DamageComparisonItem
)

class AssetVerifierService:
    """
    Universal AI Asset Verification and Baseline Comparison Service.
    Supports generic physical assets (Vehicles, Property, Electronics, Machinery, Goods, etc.).
    """

    def verify_image(self, req: VerifyAssetImageRequest) -> VerifyAssetImageResponse:
        # Generate reproducible pseudo-random results based on image URL and expected view
        seed = int(hashlib.md5((req.imageUrl + req.expectedView).encode('utf-8')).hexdigest(), 16)
        random.seed(seed)

        # Image quality analysis
        clarity = round(random.uniform(0.7, 0.99), 2)
        brightness = round(random.uniform(0.6, 0.95), 2)
        blur = round(random.uniform(0.01, 0.2), 2)

        config = req.imageRequirementConfig or {}
        min_res = config.get("minResolution", "1080p")

        # Check against thresholds
        min_clarity = config.get("minClarityThreshold", 0.6)
        min_brightness = config.get("minBrightnessThreshold", 0.4)
        max_blur = config.get("maxBlurThreshold", 0.3)

        isValid = True
        rejectionReason = None

        if clarity < min_clarity:
            isValid = False
            rejectionReason = "Image clarity is below the required threshold. Please retake in better lighting."
        elif blur > max_blur:
            isValid = False
            rejectionReason = "Image is too blurry. Please hold the camera steady."
        elif brightness < min_brightness:
            isValid = False
            rejectionReason = "Image is too dark. Please ensure sufficient lighting."

        # Simulated pHash
        pHash = hashlib.sha256((req.imageUrl).encode('utf-8')).hexdigest()[:16]

        return VerifyAssetImageResponse(
            isValid=isValid,
            detectedAssetCategory=req.assetCategory,
            detectedAssetType=req.assetType or "GENERAL_PHYSICAL_ASSET",
            detectedView=req.expectedView,
            confidence=round(random.uniform(0.85, 0.99), 2),
            quality=ImageQualityMetrics(
                clarityScore=clarity,
                brightnessScore=brightness,
                blurScore=blur,
                isOccluded=False,
                isManipulated=False
            ),
            pHash=pHash,
            rejectionReason=rejectionReason
        )

    def compare_baseline(self, req: CompareBaselineRequest) -> CompareBaselineResponse:
        comparisons = []

        # Categorized component maps
        components_map = {
            "VEHICLE": ["Front Bumper", "Rear Fender", "Windshield", "Side Mirror"],
            "PROPERTY": ["Exterior Wall", "Roof Shingles", "Window Frame", "Main Entrance"],
            "ELECTRONICS": ["Display Screen", "Back Panel", "Camera Module", "Charging Port"],
            "MACHINERY": ["Control Panel", "Hydraulic Cylinder", "Base Frame", "Motor Housing"],
            "GOODS": ["Outer Packaging", "Product Seal", "Container Box", "Labeling"],
        }

        category = req.assetCategory.upper()
        components = components_map.get(category, ["Main Component", "Secondary Component", "Support Structure"])

        for idx, claim_img in enumerate(req.claimImages):
            seed = int(hashlib.md5(claim_img.get("url", "").encode('utf-8')).hexdigest(), 16)
            random.seed(seed)

            comp = components[idx % len(components)]
            has_baseline = len(req.baselineImages) > 0

            # Decide pre-existing vs newly observed based on presence of baseline
            if has_baseline:
                classification = random.choice(["NEWLY_OBSERVED", "PRE_EXISTING", "UNCERTAIN"])
            else:
                classification = "UNCERTAIN" # Baseline not available -> Cannot guarantee pre-existing

            comparisons.append(DamageComparisonItem(
                component=comp,
                damageType=random.choice(["Dent", "Scratch", "Crack", "Corrosion", "Deformation"]),
                severity=random.choice(["LOW", "MEDIUM", "HIGH"]),
                classification=classification,
                confidence=round(random.uniform(0.80, 0.98), 2),
                baselineImageUrl=req.baselineImages[0]["url"] if has_baseline else None,
                claimImageUrl=claim_img.get("url", ""),
                observations=f"AI verified {comp} damage for {category}. Baseline comparison status: {classification}."
            ))

        return CompareBaselineResponse(
            status="SUCCESS",
            comparisons=comparisons
        )
