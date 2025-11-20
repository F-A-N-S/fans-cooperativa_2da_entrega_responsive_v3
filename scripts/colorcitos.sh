#!/bin/bash
# Colores y helpers simples para mensajes

reset="\e[0m"
rojo="\e[31m"
verde="\e[32m"
amarillo="\e[33m"
azul="\e[34m"

msg()  { echo -e "${azul}[*] $*${reset}"; }
ok()   { echo -e "${verde}[OK] $*${reset}"; }
warn() { echo -e "${amarillo}[WARN] $*${reset}"; }
err()  { echo -e "${rojo}[ERR] $*${reset}" >&2; }
