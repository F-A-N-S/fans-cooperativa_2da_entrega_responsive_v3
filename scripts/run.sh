#!/bin/bash
# Orquestador: ejecutar esto como root para dejar una VM básica lista
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/colorcitos.sh"

[[ $EUID -eq 0 ]] || { err "Ejecutá como root: sudo $0"; exit 1; }

msg "1/4 - Instalando paquetes básicos..."
bash "$DIR/paquetes.sh"

msg "2/4 - Creando usuarios y claves..."
bash "$DIR/usuarios.sh"

msg "3/4 - Configurando SSH..."
bash "$DIR/ssh_config_setup.sh"

msg "4/4 - Configurando firewall..."
bash "$DIR/firewall.sh"

ok "Configuración básica de la VM terminada."
