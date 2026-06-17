#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="dsf_gateway_flutter"
OUT_DIR="$ROOT_DIR/dist"
BUNDLE_DIR="$ROOT_DIR/build/linux/x64/release/bundle"

cd "$ROOT_DIR"
flutter pub get
flutter build linux --release

mkdir -p "$OUT_DIR"
ARCHIVE="$OUT_DIR/${APP_NAME}-linux-x64.tar.gz"
tar -C "$BUNDLE_DIR" -czf "$ARCHIVE" "$APP_NAME" data lib

echo "Built: $ARCHIVE"
ls -lh "$ARCHIVE"
