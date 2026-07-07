#!/bin/bash
# Pull latest Docker images and restart the FitnessTracker stack.
# Run this on the production server, or let CI auto-deploy after build.
set -euo pipefail

cd /opt/fitness-tracker
docker compose pull
docker compose up -d --remove-orphans
docker image prune -f
echo "✅ FitnessTracker updated and running."
