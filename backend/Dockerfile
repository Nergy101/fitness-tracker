# FitnessTracker backend — FastAPI + SQLite.
FROM python:3.14-slim

WORKDIR /app

# Install deps first for layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# SQLite + settings + backup config all live on the mounted volume so they
# survive container recreation. A fresh settings.toml would otherwise mint a
# new password + VAPID keys on every deploy, logging everyone out and killing
# push subscriptions.
ENV DATABASE_URL=sqlite:////data/fitness_tracker.db
ENV FITNESS_SETTINGS_PATH=/data/settings.toml
ENV FITNESS_BACKUP_CONFIG_PATH=/data/backup_config.json
VOLUME ["/data"]

EXPOSE 8000

# Seed (idempotent) then serve.
CMD ["sh", "-c", "python seed.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
