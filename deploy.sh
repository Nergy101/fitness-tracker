#!/bin/bash
# Pull latest Docker images and restart the FitnessTracker stack.
# Run this on the production server, or let CI auto-deploy after build.
set -euo pipefail

cd /root/code/fitness-tracker
docker compose pull
docker compose up -d
echo "✅ FitnessTracker updated and running."
