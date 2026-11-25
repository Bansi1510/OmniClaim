import hashlib
import numpy as np
from PIL import Image
import io
import imagehash
from typing import List
from app.schemas.inference import ImageFeatureOutput

class FeatureExtractorService:
    def extract_features(self, evidence_id: str, image_bytes: bytes) -> ImageFeatureOutput:
        try:
            image = Image.open(io.BytesIO(image_bytes))
            # 64-bit hexadecimal Perceptual Hash
            phash_val = str(imagehash.phash(image))
        except Exception:
            # Deterministic SHA256 hex fallback
            phash_val = hashlib.sha256(image_bytes).hexdigest()[:16]

        # Generate a normalized 512-dimension vector embedding (simulating CLIP/ResNet)
        # Using deterministic seed from perceptual hash for repeatable distance testing
        seed = int(phash_val[:8], 16) if len(phash_val) >= 8 else 42
        rng = np.random.RandomState(seed % (2**32 - 1))
        vector = rng.randn(512).astype(np.float32)
        norm = np.linalg.norm(vector)
        normalized_vector = (vector / (norm + 1e-7)).tolist()

        return ImageFeatureOutput(
            evidenceId=evidence_id,
            pHash=phash_val,
            embedding=normalized_vector,
        )
