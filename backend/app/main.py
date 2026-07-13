import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.database import run_migrations
from app.logging_config import configure_logging
from app.routers import exercises, workouts, sessions, health, runs, auth, stats, notifications, backup, health_import, boxing

# Configure logging as early as possible at startup.
configure_logging()

logger = logging.getLogger("app.request")

# Apply any pending schema migrations on startup.
run_migrations()

app = FastAPI(title="FitnessTracker API", version="1.2.0")

# Auth middleware — must be added before other middleware/routes
app.middleware("http")(auth.auth_middleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Registered last so it wraps every other layer and logs the final status.
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s -> %s (%.1fms)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


app.include_router(exercises.router)
app.include_router(workouts.router)
app.include_router(sessions.router)
app.include_router(health.router)
app.include_router(runs.router)
app.include_router(auth.router)
app.include_router(stats.router)
app.include_router(notifications.router)
app.include_router(backup.router)
app.include_router(health_import.router)
app.include_router(boxing.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
