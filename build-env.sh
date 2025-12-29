#!/usr/bin/env bash
# Build environment setup for Tauri

# Find all pkgconfig directories
PKG_DIRS=""
for dir in /nix/store/*glib*-dev/lib/pkgconfig \
           /nix/store/*gtk+3*-dev/lib/pkgconfig \
           /nix/store/*cairo*-dev/lib/pkgconfig \
           /nix/store/*pango*-dev/lib/pkgconfig \
           /nix/store/*gdk-pixbuf*-dev/lib/pkgconfig \
           /nix/store/*harfbuzz*-dev/lib/pkgconfig \
           /nix/store/*freetype*-dev/lib/pkgconfig \
           /nix/store/*fontconfig*-dev/lib/pkgconfig \
           /nix/store/*libX11*-dev/lib/pkgconfig \
           /nix/store/*libxcb*-dev/lib/pkgconfig \
           /nix/store/*at-spi2-core*-dev/lib/pkgconfig \
           /nix/store/*libpng*-dev/lib/pkgconfig \
           /nix/store/*pixman*/lib/pkgconfig \
           /nix/store/*xorgproto*/share/pkgconfig \
           /nix/store/*wayland*-dev/lib/pkgconfig \
           /nix/store/*libxkbcommon*-dev/lib/pkgconfig \
           /nix/store/*fribidi*-dev/lib/pkgconfig \
           /nix/store/*libepoxy*-dev/lib/pkgconfig \
           /nix/store/*webkit2gtk*-dev/lib/pkgconfig \
           /nix/store/*libsoup*-dev/lib/pkgconfig \
           /nix/store/*alsa-lib*-dev/lib/pkgconfig; do
  for d in $dir; do
    if [ -d "$d" ]; then
      PKG_DIRS="$PKG_DIRS:$d"
    fi
  done
done

export PKG_CONFIG_PATH="${PKG_DIRS#:}"
echo "PKG_CONFIG_PATH set with $(echo $PKG_CONFIG_PATH | tr ':' '\n' | wc -l) directories"

# Run the build
exec "$@"
