"""Auth router: login endpoint + Basic Auth dependency for protected routes.

A single shared password gates the whole API, so both the login endpoint and
the Basic-Auth middleware are directly brute-forceable. A small in-memory,
per-client-IP sliding-window rate limiter (NER-182) locks a client out after
too many failed attempts.
"""

import base64
import hashlib
import hmac
import threading
import time
from collections import defaultdict

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.settings import settings

router = APIRouter(tags=["auth"])

AUTH_PASSWORD = settings["auth"]["password"]

# ─── Rate limiting ────────────────────────────────────────────

MAX_FAILED_ATTEMPTS = 5
WINDOW_SECONDS = 300  # 5 minutes

_attempts_lock = threading.Lock()
_failed_attempts: dict[str, list[float]] = defaultdict(list)


def _client_ip(request: Request) -> str:
    """Resolve the real client IP behind the nginx reverse proxy.

    nginx sets X-Forwarded-For (see frontend/nginx.conf); the left-most entry
    is the originating client. Fall back to the socket peer for direct calls.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _prune(ip: str, now: float) -> None:
    """Drop attempts older than the window; forget IPs with none left."""
    cutoff = now - WINDOW_SECONDS
    kept = [t for t in _failed_attempts[ip] if t > cutoff]
    if kept:
        _failed_attempts[ip] = kept
    else:
        _failed_attempts.pop(ip, None)


def rate_limit_retry_after(ip: str) -> int:
    """Seconds the client must wait if it is locked out, else 0."""
    now = time.time()
    with _attempts_lock:
        _prune(ip, now)
        attempts = _failed_attempts.get(ip, [])
        if len(attempts) >= MAX_FAILED_ATTEMPTS:
            return max(int(WINDOW_SECONDS - (now - attempts[0])) + 1, 1)
        return 0


def record_failure(ip: str) -> None:
    """Record a failed auth attempt for `ip`."""
    now = time.time()
    with _attempts_lock:
        _prune(ip, now)
        _failed_attempts[ip].append(now)


def clear_failures(ip: str) -> None:
    """Forget an IP's failures after a successful auth."""
    with _attempts_lock:
        _failed_attempts.pop(ip, None)


def reset_rate_limit() -> None:
    """Clear all tracked attempts. Used by tests to isolate cases."""
    with _attempts_lock:
        _failed_attempts.clear()


class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    token: str
    message: str = "Authenticated successfully"


def _check_password(provided: str) -> bool:
    """Constant-time comparison to prevent timing attacks."""
    provided_hash = hashlib.sha256(provided.encode()).digest()
    expected_hash = hashlib.sha256(AUTH_PASSWORD.encode()).digest()
    return hmac.compare_digest(provided_hash, expected_hash)


def _make_basic_token(password: str) -> str:
    """Create a Basic auth token from the password (username is 'fitness')."""
    raw = f"fitness:{password}"
    return base64.b64encode(raw.encode()).decode()


@router.post("/api/auth/login", response_model=LoginResponse)
def login(data: LoginRequest, request: Request):
    ip = _client_ip(request)
    retry_after = rate_limit_retry_after(ip)
    if retry_after:
        raise HTTPException(
            status_code=429,
            detail="Too many failed attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )
    if not _check_password(data.password):
        record_failure(ip)
        raise HTTPException(status_code=401, detail="Wrong password")
    clear_failures(ip)
    return LoginResponse(token=_make_basic_token(data.password))


async def auth_middleware(request: Request, call_next):
    """FastAPI middleware that protects all /api/* routes with Basic Auth.

    The /api/health and /api/auth/* endpoints are public.
    OPTIONS preflight requests pass through for CORS. Repeated wrong-password
    attempts from one client are rate-limited (429) to blunt brute force.
    """
    path = request.url.path

    # Public endpoints + CORS preflight
    if request.method == "OPTIONS" or path == "/api/health" or path.startswith("/api/auth/"):
        return await call_next(request)

    # All /api/* paths need auth
    if path.startswith("/api/"):
        ip = _client_ip(request)
        retry_after = rate_limit_retry_after(ip)
        if retry_after:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many failed attempts. Try again later."},
                headers={"Retry-After": str(retry_after)},
            )

        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Basic "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Authorization header missing"},
            )

        try:
            decoded = base64.b64decode(auth_header[6:]).decode()
        except Exception:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid authorization format"},
            )
        # The username is ignored (only the password gates access), so accept
        # both a standard "user:password" token and a bare "password" token —
        # the latter is what hand-configured automation headers often send.
        password = decoded.split(":", 1)[1] if ":" in decoded else decoded

        if not _check_password(password):
            record_failure(ip)
            return JSONResponse(
                status_code=401,
                content={"detail": "Wrong password"},
            )

        clear_failures(ip)

    return await call_next(request)
