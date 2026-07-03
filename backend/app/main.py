from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.database import engine, Base, ensure_schema
from app.routers import exercises, workouts, sessions, health, runs, auth, stats

# Create all tables on startup, then apply additive migrations.
Base.metadata.create_all(bind=engine)
ensure_schema()

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

app.include_router(exercises.router)
app.include_router(workouts.router)
app.include_router(sessions.router)
app.include_router(health.router)
app.include_router(runs.router)
app.include_router(auth.router)
app.include_router(stats.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
