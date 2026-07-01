# FitnessTracker backend — FastAPI + SQLite.
FROM python:3.12-slim

WORKDIR /app

# Install deps first for layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# SQLite lives on a mounted volume so data survives container restarts.
ENV DATABASE_URL=sqlite:////data/fitness_tracker.db
VOLUME ["/data"]

EXPOSE 8000

# Seed (idempotent) then serve.
CMD ["sh", "-c", "python seed.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
