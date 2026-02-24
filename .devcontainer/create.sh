#!/bin/bash

sudo apt update -y
sudo apt upgrade -y
sudo apt install -y vim ripgrep sqlite3 curl xz-utils

arch="$(uname -m)"
case "$arch" in
  x86_64)
    typst_arch="x86_64-unknown-linux-musl"
    ;;
  aarch64|arm64)
    typst_arch="aarch64-unknown-linux-musl"
    ;;
  *)
    echo "Unsupported architecture: $arch"
    exit 1
    ;;
esac

tmp_dir="$(mktemp -d)"
curl -fsSL "https://github.com/typst/typst/releases/latest/download/typst-${typst_arch}.tar.xz" -o "$tmp_dir/typst.tar.xz"
tar -xJf "$tmp_dir/typst.tar.xz" -C "$tmp_dir"
sudo install -m 755 "$tmp_dir"/typst-*/typst /usr/local/bin/typst
rm -rf "$tmp_dir"
