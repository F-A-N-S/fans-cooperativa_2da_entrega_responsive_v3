#!/bin/bash
# Instala paquetes básicos necesarios en cualquier servidor Rocky
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/colorcitos.sh"

msg "Agregando EPEL si hace falta..."
if [[ -f /etc/yum.repos.d/epel.repo ]]; then
  warn "EPEL ya está instalado."
else
  dnf install -y epel-release
fi

msg "Instalando paquetes básicos..."
dnf install -y \
  vim htop git wget curl tree rsync tar gzip net-tools \
  bash-completion policycoreutils-python-utils \
  firewalld cockpit rsyslog

ok "Paquetes básicos instalados."

msg "Habilitando y arrancando servicios básicos..."
systemctl enable --now firewalld
systemctl enable --now rsyslog
systemctl enable --now cockpit.socket

ok "Servicios firewalld, rsyslog y cockpit activos."
