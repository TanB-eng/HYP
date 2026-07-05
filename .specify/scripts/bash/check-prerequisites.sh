#!/usr/bin/env bash
set -euo pipefail

# check-prerequisites.sh — Spec Kit prerequisite checker
# Usage: check-prerequisites.sh [--json]

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SPECS_DIR="$REPO_ROOT/specs"
OUTPUT_JSON=false

if [[ "${1:-}" == "--json" ]]; then
  OUTPUT_JSON=true
fi

# Find the first feature directory under specs/
FEATURE_DIR=""
AVAILABLE_DOCS=()

if [[ -d "$SPECS_DIR" ]]; then
  for dir in "$SPECS_DIR"/*/; do
    if [[ -d "$dir" ]]; then
      FEATURE_DIR="${dir%/}"
      break
    fi
  done
fi

if [[ -n "$FEATURE_DIR" && -d "$FEATURE_DIR" ]]; then
  for doc in spec.md plan.md tasks.md data-model.md research.md quickstart.md; do
    if [[ -f "$FEATURE_DIR/$doc" ]]; then
      AVAILABLE_DOCS+=("$doc")
    fi
  done
  # Check contracts subdirectory
  if [[ -d "$FEATURE_DIR/contracts" ]]; then
    AVAILABLE_DOCS+=("contracts/")
  fi
fi

if $OUTPUT_JSON; then
  echo "{"
  echo "  \"featureDir\": \"$FEATURE_DIR\","
  echo "  \"availableDocs\": [$(IFS=,; echo "${AVAILABLE_DOCS[*]}" | sed 's/[^,]*/"\0"/g')],"
  echo "  \"repoRoot\": \"$REPO_ROOT\""
  echo "}"
else
  echo "Repo root: $REPO_ROOT"
  echo "Feature dir: $FEATURE_DIR"
  echo "Available docs: ${AVAILABLE_DOCS[*]:-none}"
fi
