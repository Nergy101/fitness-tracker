.PHONY: setup setup-backend setup-frontend run run-backend run-frontend seed build clean

# ─── Setup ───────────────────────────────────────────────

setup: setup-backend setup-frontend ## Install everything

PIP := $(shell command -v pip3 2>/dev/null || command -v pip 2>/dev/null || echo pip3)
PYTHON := $(shell command -v python3 2>/dev/null || command -v python 2>/dev/null || echo python3)

setup-backend: ## Install backend dependencies
	cd backend && $(PIP) install -r requirements.txt

setup-frontend: ## Install frontend dependencies
	cd frontend && npm install

venv: ## Create a Python virtual environment and install deps
	$(PYTHON) -m venv backend/.venv
	backend/.venv/bin/python -m pip install -r backend/requirements.txt
	@echo "✅ Venv created: source backend/.venv/bin/activate"

# ─── Database ───────────────────────────────────────────

seed: ## Seed database with initial exercise data
	$(VENV_PREFIX) cd backend && python seed.py

# ─── Run ─────────────────────────────────────────────────

VENV_ACTIVATE := backend/.venv/bin/activate
ifneq ("$(wildcard $(VENV_ACTIVATE))","")
	VENV_PREFIX := . $(VENV_ACTIVATE) &&
endif

run-backend: ## Start the FastAPI backend (with hot reload)
	$(VENV_PREFIX) cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

run-frontend: ## Start the Astro dev server
	cd frontend && npm run dev

run: ## Start both backend and frontend
	@trap 'kill 0' EXIT; \
		$(MAKE) run-backend & \
		$(MAKE) run-frontend & \
		wait

# ─── Build ───────────────────────────────────────────────

build: ## Build the frontend for production
	cd frontend && npm run build

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