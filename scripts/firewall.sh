#!/bin/bash
# Configura firewalld de forma básica (SSH + Cockpit + rsyslog)
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/colorcitos.sh"

msg "Habilitando firewalld..."
systemctl enable --now firewalld

# Detectar interfaz por defecto
INT_IF=$(ip route show default 2>/dev/null | awk '/default/ {print $5; exit}')

if [[ -z "${INT_IF:-}" ]]; then
  warn "No se detectó interfaz por defecto, intento usar ens160 si existe."
  [[ -d /sys/class/net/ens160 ]] && INT_IF="ens160" || INT_IF=""
fi

if [[ -n "$INT_IF" ]]; then
  msg "Asignando interfaz $INT_IF a zona public mediante NetworkManager..."
  nmcli connection show | awk -v dev="$INT_IF" '$0 ~ dev {print $1; exit}' | while read -r CONN; do
    nmcli connection modify "$CONN" connection.zone public || true
  done
else
  warn "No se pudo asignar interfaz a una zona, revisar luego con firewall-cmd --get-active-zones."
fi

msg "Agregando reglas básicas de firewall..."

# SSH
firewall-cmd --permanent --add-service=ssh
# Cockpit (administración web)
firewall-cmd --permanent --add-port=9090/tcp
# rsyslog (centralización de logs, por si se usa)
firewall-cmd --permanent --add-port=514/tcp
firewall-cmd --permanent --add-port=514/udp

firewall-cmd --reload

ok "Firewall configurado con SSH, Cockpit y puertos básicos."
firewall-cmd --list-all || true

