#!/usr/bin/env bash

set -e

pushd frontend
yarn run build
popd
