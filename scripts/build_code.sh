#! /bin/bash

###################################################################################
# This script installs dependencies and builds code.
###################################################################################

SCRIPT_DIR=$(realpath $(dirname "$0"))
ROOT=$SCRIPT_DIR/..

echo "Building code..."

cd $ROOT

echo "Installing dependencies..."
npm i

echo "Compiling code..."
tsc

echo "Code-build completed."
