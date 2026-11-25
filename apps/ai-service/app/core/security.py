import hmac
import hashlib
import json
from typing import Any, Dict

def generate_hmac_signature(payload: Dict[str, Any], secret: str) -> str:
    """
    Computes a cryptographic HMAC-SHA256 signature for outgoing webhook verification.
    """
    canonical_json = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode('utf-8')
    return hmac.new(secret.encode('utf-8'), canonical_json, hashlib.sha256).hexdigest()

def verify_hmac_signature(payload: Dict[str, Any], signature: str, secret: str) -> bool:
    """
    Validates an incoming HMAC-SHA256 signature in constant time.
    """
    expected = generate_hmac_signature(payload, secret)
    return hmac.compare_digest(expected, signature)
