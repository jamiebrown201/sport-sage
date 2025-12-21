#!/bin/bash

set -e

CLUSTER_ARN="arn:aws:rds:eu-west-1:238708724680:cluster:sportsage-dev-database-databaseb269d8bb-jgbqgx6yzvi7"
SECRET_ARN="arn:aws:secretsmanager:eu-west-1:238708724680:secret:DatabaseSecret3B817195-R7aao5xJupze-Lkf02d"
DATABASE="sportsage"
REGION="eu-west-1"

# Read and execute migration
MIGRATION_FILE="drizzle/0000_pale_post.sql"

echo "Running migration from $MIGRATION_FILE..."

# Split by statement-breakpoint and execute each statement
IFS='--> statement-breakpoint' read -ra STATEMENTS <<< "$(cat "$MIGRATION_FILE")"

count=0
for stmt in "${STATEMENTS[@]}"; do
  # Trim whitespace
  stmt=$(echo "$stmt" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

  if [ -n "$stmt" ]; then
    count=$((count + 1))
    echo "Executing statement $count..."

    aws rds-data execute-statement \
      --resource-arn "$CLUSTER_ARN" \
      --secret-arn "$SECRET_ARN" \
      --database "$DATABASE" \
      --sql "$stmt" \
      --region "$REGION" > /dev/null 2>&1 || {
        echo "Failed on statement $count:"
        echo "$stmt" | head -1
        exit 1
      }
  fi
done

echo "Migration completed! Executed $count statements."
