#!/bin/bash
# FoodPlanner Database Backup Script
# Usage: ./scripts/backup.sh [backup_dir]
#
# Requires: docker compose running with postgres service

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/foodplanner_$TIMESTAMP.sql.gz"
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "Creating backup: $BACKUP_FILE"
docker compose exec -T postgres pg_dump -U foodplanner foodplanner | gzip > "$BACKUP_FILE"

echo "Backup created: $(du -h "$BACKUP_FILE" | cut -f1)"

# Remove backups older than KEEP_DAYS
find "$BACKUP_DIR" -name "foodplanner_*.sql.gz" -mtime +"$KEEP_DAYS" -delete
echo "Cleaned up backups older than $KEEP_DAYS days"
