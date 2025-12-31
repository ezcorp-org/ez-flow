{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Rust toolchain
    rustup
    pkg-config

    # Tauri dependencies
    gtk3
    webkitgtk_4_1
    libsoup_3
    glib
    cairo
    pango
    gdk-pixbuf
    harfbuzz
    freetype
    fontconfig
    libpng
    pixman

    # X11 dependencies
    xorg.libX11
    xorg.libXcursor
    xorg.libXrandr
    xorg.libXi
    xorg.libxcb
    xorg.libXext
    xorg.libXfixes
    xorg.libXcomposite
    xorg.libXdamage
    xorg.libXinerama

    # Wayland dependencies
    wayland
    libxkbcommon

    # Other
    at-spi2-core
    dbus
    libayatana-appindicator
    fribidi
    libepoxy

    # Audio dependencies for cpal
    alsa-lib

    # whisper-rs dependencies (bindgen needs libclang)
    llvmPackages.libclang
    llvmPackages.clang
    cmake

    # OpenSSL for tauri-plugin-updater
    openssl

    # Node/Bun
    bun
    nodejs
  ];

  shellHook = ''
    export LIBCLANG_PATH="${pkgs.llvmPackages.libclang.lib}/lib"
    export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath [
      pkgs.gtk3
      pkgs.webkitgtk_4_1
      pkgs.glib
      pkgs.cairo
      pkgs.pango
      pkgs.gdk-pixbuf
      pkgs.libsoup_3
      pkgs.at-spi2-core
      pkgs.dbus
      pkgs.libayatana-appindicator
      pkgs.alsa-lib
      pkgs.openssl
      pkgs.stdenv.cc.cc.lib
    ]}:$LD_LIBRARY_PATH"
  '';
}
