#! /bin/bash

###################################################################################
# This script builds docker image.
###################################################################################

SCRIPT_DIR=$(realpath $(dirname "$0"))
ROOT=$SCRIPT_DIR/..

REGISTRY="extraktaiacrpublic"
IMG_ACR="web-app-playground"
IMG_TAG="latest"
FULL_TAG="$REGISTRY.azurecr.io/$IMG_ACR:$IMG_TAG"

cd $ROOT
docker build -t $FULL_TAG $ROOT
