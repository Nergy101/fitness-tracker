"""Auth router: login endpoint + Basic Auth dependency for protected routes."""

import base64
import hashlib

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from app.settings import settings

router = APIRouter(tags=["auth"])

AUTH_PASSWORD = settings["auth"]["password"]


class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    token: str
    message: str = "Authenticated successfully"


def _check_password(provided: str) -> bool:
    """Constant-time comparison to prevent timing attacks."""
    return hashlib.sha256(provided.encode()).digest() == hashlib.sha256(AUTH_PASSWORD.encode()).digest()


def _make_basic_token(password: str) -> str:
    """Create a Basic auth token from the password (username is 'fitness')."""
    raw = f"fitness:{password}"
    return base64.b64encode(raw.encode()).decode()


@router.post("/api/auth/login", response_model=LoginResponse)
def login(data: LoginRequest):
    if not _check_password(data.password):
        raise HTTPException(status_code=401, detail="Wrong password")
    return LoginResponse(token=_make_basic_token(data.password))


async def auth_middleware(request: Request, call_next):
    """FastAPI middleware that protects all /api/v1/* routes with Basic Auth.

    The /api/health and /api/auth/* endpoints are public.
    """
    path = request.url.path

    # Public endpoints
    if path == "/api/health" or path.startswith("/api/auth/"):
        return await call_next(request)

    # All /api/* paths need auth
    if path.startswith("/api/"):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Basic "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Authorization header missing"},
            )

        try:
            decoded = base64.b64decode(auth_header[6:]).decode()
            _username, password = decoded.split(":", 1)
        except Exception:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid authorization format"},
            )

        if not _check_password(password):
            return JSONResponse(
                status_code=401,
                content={"detail": "Wrong password"},
            )

    return await call_next(request)
