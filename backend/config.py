import os
import secrets


class Config:
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY") or secrets.token_hex(32)
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "POSTGRES_DATABASE_URL",
        "postgresql+psycopg2://postgres@localhost:5432/jr13_savings",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = os.environ.get("FLASK_ENV") == "production"
    SESSION_COOKIE_SAMESITE = "Lax"
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
    CORS_ALLOWED_ORIGINS = [
        origin.strip()
        for origin in os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ]
    DEMO_MODE = os.environ.get("JR13_DEMO_MODE", "true").lower() == "true"
