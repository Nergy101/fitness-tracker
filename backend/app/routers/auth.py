"""Auth router: login endpoint + auth dependency for protected routes.

A single shared password gates the whole API. Login exchanges the password for
an opaque, server-side session token (random, not derived from the password) so
a stolen token cannot be reversed back into the password and can be expired /
revoked independently. The password itself still works as a Basic-Auth fallback
for hand-configured automation.

Tokens are kept in process memory: this is a single-user, single-process
deployment, so a restart simply forces a re-login. A small in-memory,
per-client-IP sliding-window rate limiter (NER-182) locks a client out after
too many failed attempts.
"""

import base64
import hashlib
import hmac
import secrets
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
# Defense-in-depth cap so a flood of distinct client keys can't grow the map
# without bound (see _client_ip — keys are trusted-proxy IPs, not raw headers).
_MAX_TRACKED_IPS = 10_000

_attempts_lock = threading.Lock()
_failed_attempts: dict[str, list[float]] = defaultdict(list)


def _client_ip(request: Request) -> str:
    """Resolve the real client IP behind the nginx reverse proxy.

    nginx overwrites X-Forwarded-For with the connecting peer (see
    frontend/nginx.conf), so the value is a single trusted entry. We read the
    RIGHT-MOST entry defensively: even if an upstream appended to a
    client-supplied list, the right-most hop is the one our own proxy set —
    never attacker-controlled. Falls back to the socket peer for direct calls.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            return parts[-1]
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
        # Bounded-map guard: if we are tracking an implausible number of IPs,
        # evict the entries whose newest attempt is oldest (least likely locked).
        if len(_failed_attempts) >= _MAX_TRACKED_IPS and ip not in _failed_attempts:
            for stale_ip in sorted(
                _failed_attempts, key=lambda k: _failed_attempts[k][-1]
            )[: _MAX_TRACKED_IPS // 10]:
                _failed_attempts.pop(stale_ip, None)
        _failed_attempts[ip].append(now)


def clear_failures(ip: str) -> None:
    """Forget an IP's failures after a successful auth."""
    with _attempts_lock:
        _failed_attempts.pop(ip, None)


def reset_rate_limit() -> None:
    """Clear all tracked attempts. Used by tests to isolate cases."""
    with _attempts_lock:
        _failed_attempts.clear()


# ─── Session tokens ───────────────────────────────────────────

TOKEN_TTL_SECONDS = 30 * 24 * 3600  # 30-day sliding window

_tokens_lock = threading.Lock()
# token -> expiry timestamp (sliding: refreshed on use)
_tokens: dict[str, float] = {}


def issue_token() -> str:
    """Mint a fresh opaque session token and remember it with a TTL."""
    token = secrets.token_urlsafe(32)
    with _tokens_lock:
        _tokens[token] = time.time() + TOKEN_TTL_SECONDS
    return token


def validate_token(token: str) -> bool:
    """True if `token` is known and unexpired; refreshes its sliding TTL."""
    if not token:
        return False
    now = time.time()
    with _tokens_lock:
        expiry = _tokens.get(token)
        if expiry is None:
            return False
        if expiry < now:
            _tokens.pop(token, None)
            return False
        _tokens[token] = now + TOKEN_TTL_SECONDS
        return True


def revoke_token(token: str) -> None:
    """Forget a token (logout)."""
    with _tokens_lock:
        _tokens.pop(token, None)


def reset_tokens() -> None:
    """Clear all issued tokens. Used by tests to isolate cases."""
    with _tokens_lock:
        _tokens.clear()


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
    return LoginResponse(token=issue_token())


@router.post("/api/auth/logout")
def logout(request: Request):
    """Revoke the presented bearer token, if any. Always returns ok."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        revoke_token(auth_header[7:].strip())
    return {"status": "ok"}


def _authorized(auth_header: str) -> bool:
    """Validate an Authorization header value.

    Accepts an opaque session token (`Bearer <token>`) or the shared password
    via Basic auth (`Basic base64(user:password)` or `Basic base64(password)`),
    the latter for hand-configured automation. Returns False on any mismatch.
    """
    if auth_header.startswith("Bearer "):
        return validate_token(auth_header[7:].strip())
    if auth_header.startswith("Basic "):
        try:
            decoded = base64.b64decode(auth_header[6:]).decode()
        except Exception:
            return False
        # Username is ignored (only the password gates access).
        password = decoded.split(":", 1)[1] if ":" in decoded else decoded
        return _check_password(password)
    return False


async def auth_middleware(request: Request, call_next):
    """FastAPI middleware that protects all /api/* routes.

    The /api/health and /api/auth/* endpoints are public.
    OPTIONS preflight requests pass through for CORS. Repeated failed attempts
    from one client are rate-limited (429) to blunt brute force.
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

        if not (auth_header.startswith("Basic ") or auth_header.startswith("Bearer ")):
            return JSONResponse(
                status_code=401,
                content={"detail": "Authorization header missing"},
            )

        # Malformed Basic payloads are a distinct 401 for clearer diagnostics.
        if auth_header.startswith("Basic "):
            try:
                base64.b64decode(auth_header[6:]).decode()
            except Exception:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid authorization format"},
                )

        if not _authorized(auth_header):
            # Only rate-limit Basic auth failures (password guessing).
            # Bearer token failures are expired/revoked tokens — not
            # password attempts — and rate-limiting them would lock out
            # legitimate users whose old tokens were invalidated by a
            # deploy or restart.
            if auth_header.startswith("Basic "):
                record_failure(ip)
            return JSONResponse(
                status_code=401,
                content={"detail": "Wrong password"},
            )

        clear_failures(ip)

    return await call_next(request)
