"""Encryption helpers for credentials stored at rest (Canvas token today;
Gradescope/PrairieLearn session data later use the same helpers)."""
from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


class DecryptionError(Exception):
    pass


def _fernet() -> Fernet:
    return Fernet(get_settings().secret_key.encode())


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise DecryptionError(
            "Could not decrypt stored credentials. If MANAPEER_SECRET_KEY changed, "
            "reconnect your integrations."
        ) from exc
