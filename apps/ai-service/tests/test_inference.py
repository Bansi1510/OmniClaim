import pytest
from app.core.security import generate_hmac_signature, verify_hmac_signature

def test_hmac_signature_generation_and_validation():
    secret = "test_omniclaim_secret_2026"
    payload = {
        "claimId": "clm-test-1",
        "status": "SUCCESS",
        "damages": [
            {
                "evidenceId": "ev-1",
                "partType": "BUMPER_FRONT",
                "confidence": 0.94
            }
        ]
    }

    sig = generate_hmac_signature(payload, secret)
    assert isinstance(sig, str)
    assert len(sig) == 64 # SHA256 hex length

    # Verify valid payload
    assert verify_hmac_signature(payload, sig, secret) is True

    # Tampered payload must fail verification
    tampered_payload = {**payload, "status": "FAILED"}
    assert verify_hmac_signature(tampered_payload, sig, secret) is False

def test_feature_embedding_dimensions():
    from app.services.feature_service import FeatureExtractorService
    service = FeatureExtractorService()
    feat = service.extract_features("ev-test", b"mock_image_bytes")

    assert feat.evidenceId == "ev-test"
    assert len(feat.embedding) == 512 # Strict 512-dim pgvector alignment
    assert isinstance(feat.pHash, str)
