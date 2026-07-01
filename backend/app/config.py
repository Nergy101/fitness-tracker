import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fitness_tracker.db")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:4321,http://localhost:5173").split(",")
