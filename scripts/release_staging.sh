#! /bin/bash

###################################################################################
# This script publishes docker image.
###################################################################################

SCRIPT_DIR=$(realpath $(dirname "$0"))
ROOT=$SCRIPT_DIR/..

$BRANCH_MAIN=main
$BRANCH_STAGING=staging

cd $ROOT

echo "Getting latest changes into main..."
git checkout $BRANCH_MAIN
git pull
git fetch --all
git merge $BRANCH_STAGING

echo "Upgrading version..."
npm version minor
git push

echo "Merging into staging..."
git checkout $BRANCH_STAGING
git pull
git merge $BRANCH_MAIN
git push

echo "Pulling back to main..."
git checkout $BRANCH_MAIN
git pull
git merge $BRANCH_STAGING
