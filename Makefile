.PHONY: setup setup-backend setup-frontend run run-backend run-frontend seed seed-fake-history remove-fake-history build lint lint-backend lint-frontend e2e clean help

# ─── Config ──────────────────────────────────────────────

PYTHON ?= python3
VENV   := $(CURDIR)/backend/.venv
VENV_PY := $(VENV)/bin/python
STAMP  := $(VENV)/.deps-installed

# Ports/hosts are overridable: `make FRONTEND_PORT=5199` if 5173 is taken.
BACKEND_HOST  ?= localhost
BACKEND_PORT  ?= 8000
FRONTEND_HOST ?= localhost
FRONTEND_PORT ?= 5173

BACKEND_URL  := http://$(BACKEND_HOST):$(BACKEND_PORT)
FRONTEND_URL := http://$(FRONTEND_HOST):$(FRONTEND_PORT)

# Keep the two sides in sync automatically:
#   • the browser tells the API its Origin  → CORS must allow the frontend URL
#   • the frontend must call the right API   → VITE_API_URL points at the backend
# Exported so the uvicorn / vite subprocesses inherit them.
export CORS_ORIGINS := http://localhost:$(FRONTEND_PORT),http://127.0.0.1:$(FRONTEND_PORT)
export VITE_API_URL := $(BACKEND_URL)

# Browser opener: macOS `open`, Linux `xdg-open`, else no-op. Override with
# `make OPEN=...` (e.g. OPEN=true to disable).
OPEN ?= $(shell command -v open 2>/dev/null || command -v xdg-open 2>/dev/null || echo true)

# Bare `make` starts everything.
.DEFAULT_GOAL := run

# ─── Setup ───────────────────────────────────────────────

setup: setup-backend setup-frontend ## Install everything

# Create the venv only if it's missing.
$(VENV_PY):
	$(PYTHON) -m venv $(VENV)

# (Re)install deps into the venv whenever a requirements file changes. The dev
# file pulls in runtime deps via `-r requirements.txt`, so the local venv has
# the full toolchain (pytest, ruff); the Docker image installs runtime-only.
$(STAMP): backend/requirements.txt backend/requirements-dev.txt | $(VENV_PY)
	$(VENV_PY) -m pip install --upgrade pip
	$(VENV_PY) -m pip install -r backend/requirements-dev.txt
	@touch $(STAMP)

setup-backend: $(STAMP) ## Install backend dependencies (into backend/.venv)

# Install node deps only when package.json changes.
frontend/node_modules: frontend/package.json
	cd frontend && npm install
	@touch frontend/node_modules

setup-frontend: frontend/node_modules ## Install frontend dependencies

# ─── Database ───────────────────────────────────────────

seed: $(STAMP) ## Seed database with initial exercise data
	cd backend && $(VENV_PY) seed.py

seed-fake-history: $(STAMP) ## Seed example workout history (for demos)
	cd backend && $(VENV_PY) scripts/seed_fake_history.py

remove-fake-history: $(STAMP) ## Remove all workout history (sessions)
	cd backend && $(VENV_PY) scripts/seed_fake_history.py clear

# ─── Run ─────────────────────────────────────────────────

run-backend: $(STAMP) ## Start the FastAPI backend (with hot reload)
	cd backend && $(VENV_PY) -m uvicorn app.main:app --host $(BACKEND_HOST) --port $(BACKEND_PORT) --reload

run-frontend: frontend/node_modules ## Start the Vite dev server
	cd frontend && npm run dev -- --host $(FRONTEND_HOST) --port $(FRONTEND_PORT) --strictPort

run: $(STAMP) seed frontend/node_modules ## Start backend + frontend, then open the app
	@echo "Backend  → $(BACKEND_URL)"
	@echo "Frontend → $(FRONTEND_URL)"
	@trap 'kill 0' EXIT; \
		$(MAKE) run-backend & \
		$(MAKE) run-frontend & \
		( for i in $$(seq 1 60); do \
			curl -sf -o /dev/null $(FRONTEND_URL) && break; \
			sleep 0.5; \
		  done; \
		  echo "Opening $(FRONTEND_URL)"; \
		  $(OPEN) $(FRONTEND_URL) >/dev/null 2>&1 || true ) & \
		wait

# ─── Build ───────────────────────────────────────────────

build: frontend/node_modules ## Build the frontend for production
	cd frontend && npm run build

# ─── Test ────────────────────────────────────────────────

e2e: $(STAMP) frontend/node_modules ## Run the Playwright end-to-end suite
	cd frontend && npx playwright install chromium
	cd frontend && npm run test:e2e

lint: lint-backend lint-frontend ## Lint backend (ruff) and frontend (eslint)

lint-backend: $(STAMP)
	cd backend && $(VENV_PY) -m ruff check .

lint-frontend: frontend/node_modules
	cd frontend && npm run lint

# ─── Clean ───────────────────────────────────────────────

clean: ## Remove generated files
	rm -rf frontend/node_modules frontend/dist
	rm -rf backend/__pycache__ backend/app/__pycache__
	rm -f backend/*.db
	rm -rf backend/.venv

# ─── Help ────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
