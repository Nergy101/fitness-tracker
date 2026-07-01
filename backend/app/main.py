from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.database import engine, Base, ensure_schema
from app.routers import exercises, workouts, sessions

# Create all tables on startup, then apply additive migrations.
Base.metadata.create_all(bind=engine)
ensure_schema()

app = FastAPI(title="FitnessTracker API", version="1.0.0")

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


@app.get("/api/health")
def health():
    return {"status": "ok"}
