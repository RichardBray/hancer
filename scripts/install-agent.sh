#!/bin/sh
# Hancer agent-friendly installer. Terse, line-per-step output for AI agents.
# Usage: sh install-agent.sh [--version vX.Y.Z]
set -eu

REPO="${HANCE_REPO:-Orva-Studio/hancer}"
INSTALL_DIR="${HANCE_INSTALL_DIR:-$HOME/.hance/bin}"
VERSION="${HANCE_VERSION:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --version=*) VERSION="${1#*=}"; shift ;;
    -h|--help) echo "Usage: install-agent.sh [--version vX.Y.Z]"; exit 0 ;;
    *) echo "ERR: unknown arg: $1" >&2; exit 2 ;;
  esac
done

step() { printf '[%s] %s\n' "$1" "$2"; }
fail() { printf 'ERR: %s\n' "$*" >&2; exit 1; }

# Platform check (Windows not supported)
uname_s=$(uname -s 2>/dev/null || echo unknown)
case "$uname_s" in
  MINGW*|MSYS*|CYGWIN*|Windows*)
    fail "Windows is not currently supported. Hance supports macOS (arm64/x64) and Linux (x64/arm64) only."
    ;;
esac

uname_m=$(uname -m)
case "$uname_s/$uname_m" in
  Darwin/arm64)              PLATFORM="macos-arm64" ;;
  Darwin/x86_64)             PLATFORM="macos-x64" ;;
  Linux/x86_64)              PLATFORM="linux-x64" ;;
  Linux/aarch64|Linux/arm64) PLATFORM="linux-arm64" ;;
  *) fail "unsupported platform: $uname_s/$uname_m" ;;
esac
step 1/6 "platform: $PLATFORM"

# Already installed?
if [ -x "$INSTALL_DIR/hance" ]; then
  installed=$("$INSTALL_DIR/hance" --version 2>/dev/null || echo unknown)
  step "-" "already installed at $INSTALL_DIR/hance (version: $installed) — skipping"
  echo "OK"
  exit 0
fi

# Resolve version
if [ -z "$VERSION" ]; then
  VERSION=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n1)
  [ -n "$VERSION" ] || fail "could not resolve latest version"
fi
step 2/6 "version: $VERSION"

# Prereq: ffmpeg
if ! command -v ffmpeg >/dev/null 2>&1; then
  case "$uname_s" in
    Darwin) step "!" "ffmpeg missing — install with: brew install ffmpeg" ;;
    Linux)  step "!" "ffmpeg missing — install with your package manager" ;;
  esac
fi

# Download
tarball="hance-${PLATFORM}.tar.gz"
base="https://github.com/${REPO}/releases/download/${VERSION}"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
step 3/6 "downloading $tarball"
curl -fsSL -o "$tmp/$tarball"        "$base/$tarball"      || fail "download failed: $tarball"
curl -fsSL -o "$tmp/checksums.txt"   "$base/checksums.txt" || fail "download failed: checksums.txt"

# Verify
( cd "$tmp" && grep " $tarball\$" checksums.txt > checksums.expected ) \
  || fail "no checksum entry for $tarball"
if command -v shasum >/dev/null 2>&1; then
  ( cd "$tmp" && shasum -a 256 -c checksums.expected >/dev/null ) || fail "checksum mismatch"
elif command -v sha256sum >/dev/null 2>&1; then
  ( cd "$tmp" && sha256sum -c checksums.expected >/dev/null ) || fail "checksum mismatch"
else
  fail "no shasum/sha256sum available"
fi
step 4/6 "checksum verified"

# Install binary + companion + presets + ui
mkdir -p "$INSTALL_DIR"
tar -xzf "$tmp/$tarball" -C "$tmp"
cp -f "$tmp/hance-${PLATFORM}/hance"     "$INSTALL_DIR/hance"
cp -f "$tmp/hance-${PLATFORM}/hance-gpu" "$INSTALL_DIR/hance-gpu"
chmod 0755 "$INSTALL_DIR/hance" "$INSTALL_DIR/hance-gpu"

PRESETS_SRC="$tmp/hance-${PLATFORM}/presets"
PRESETS_DST="$HOME/.hance/presets"
if [ -d "$PRESETS_SRC" ]; then
  mkdir -p "$PRESETS_DST"
  for f in "$PRESETS_SRC"/*; do
    name=$(basename "$f")
    [ -f "$PRESETS_DST/$name" ] || cp "$f" "$PRESETS_DST/$name"
  done
fi

UI_SRC="$tmp/hance-${PLATFORM}/ui"
UI_DST="$HOME/.hance/ui"
if [ -d "$UI_SRC" ]; then
  rm -rf "$UI_DST"; mkdir -p "$UI_DST"; cp -r "$UI_SRC/." "$UI_DST/"
fi

[ "$uname_s" = "Darwin" ] && command -v xattr >/dev/null 2>&1 \
  && xattr -dr com.apple.quarantine "$INSTALL_DIR" 2>/dev/null || true

step 5/6 "installed to $INSTALL_DIR"

# PATH check (no interactive prompt — agent context)
case ":$PATH:" in
  *":$INSTALL_DIR:"*) step 6/6 "PATH: ok" ;;
  *) step 6/6 "PATH: $INSTALL_DIR is NOT on PATH — add: export PATH=\"$INSTALL_DIR:\$PATH\"" ;;
esac

echo "OK"
echo "Try:"
echo "  hance --help"
echo "  hance ui"
echo "  hance input.jpg -o out.jpg --preset portra-400"
