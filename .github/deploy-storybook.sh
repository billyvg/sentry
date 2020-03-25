#!/bin/bash
set -eu

echo "gcloud version: $(gcloud version)"
GS_BUCKET_NAME=sentryio-storybook

# Transform the branch name to a bucket directory
BUCKET_DIR_NAME="branches/${STORYBOOK_BRANCH_SLUG}"
echo "Bucket directory: ${BUCKET_DIR_NAME}"

# Upload the files
gsutil cp .storybook-out/favicon.ico "gs://${GS_BUCKET_NAME}/favicon.ico"
gsutil -m rsync -r -d .storybook-out/ "gs://${GS_BUCKET_NAME}/${BUCKET_DIR_NAME}"

# Upload build metadata
echo "{\"branch\": \"${STORYBOOK_BRANCH}\", \"commit\": \"${GITHUB_SHA}\", \"synced_at\": $(date +%s)}" > build-info.json
gsutil cp build-info.json "gs://${GS_BUCKET_NAME}/${BUCKET_DIR_NAME}"
