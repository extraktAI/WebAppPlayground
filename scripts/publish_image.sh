#! /bin/bash

###################################################################################
# This script publishes docker image.
###################################################################################

SCRIPT_DIR=$(realpath $(dirname "$0"))
ROOT=$SCRIPT_DIR/..

REGISTRY="extraktaiacrpublic"
IMG_ACR="web-app-playground"
IMG_TAG="latest"
FULL_TAG="$REGISTRY.azurecr.io/$IMG_ACR:$IMG_TAG"

echo "Publishing image $FULL_TAG"

cd $ROOT
docker push $FULL_TAG

echo "Done"
