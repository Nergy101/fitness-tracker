.PHONY: setup setup-backend setup-frontend run run-backend run-frontend seed build clean

# ─── Setup ───────────────────────────────────────────────

setup: setup-backend setup-frontend ## Install everything

setup-backend: ## Install backend dependencies
	cd backend && pip install -r requirements.txt

setup-frontend: ## Install frontend dependencies
	cd frontend && npm install

# ─── Database ───────────────────────────────────────────

seed: ## Seed database with initial exercise data
	cd backend && python seed.py

# ─── Run ─────────────────────────────────────────────────

run-backend: ## Start the FastAPI backend
	cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

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

# ─── Help ────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'