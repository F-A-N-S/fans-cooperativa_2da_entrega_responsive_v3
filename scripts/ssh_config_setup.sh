#!/bin/bash
# Configura SSH para usar SOLO clave pública y bloquear root
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/colorcitos.sh"

[[ $EUID -eq 0 ]] || { err "Ejecutá como root: sudo $0"; exit 1; }

CONFIG="/etc/ssh/sshd_config"
SNIPPET_DIR="/etc/ssh/sshd_config.d"
SNIPPET="$SNIPPET_DIR/00-hardening.conf"

msg "Haciendo backup de $CONFIG..."
cp -a "$CONFIG" "${CONFIG}.bak.$(date +%F_%H%M%S)"

mkdir -p "$SNIPPET_DIR"

cat > "$SNIPPET" << 'CONF'
Port 22
AddressFamily any
ListenAddress 0.0.0.0

PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
UsePAM yes
X11Forwarding no
PrintMotd no

AllowUsers santiago alex profe nicolas facundo

ClientAliveInterval 300
ClientAliveCountMax 2
CONF

grep -q '^Include /etc/ssh/sshd_config.d/\*.conf' "$CONFIG" || \
  echo 'Include /etc/ssh/sshd_config.d/*.conf' >> "$CONFIG"

msg "Probando configuración de sshd..."
sshd -t
systemctl restart sshd

ok "SSH configurado: solo clave pública, root deshabilitado."
