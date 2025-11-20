#!/bin/bash
# Crea usuarios fijos con claves públicas e incluye a todos en wheel
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/colorcitos.sh"

declare -a USERS=(santiago alex profe nicolas facundo)
declare -A PUBKEYS


PUBKEYS[santiago]="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILx5Pba/YvXlA9NsomaQjJb9DS46asfEM5jKpGCehQnq eddsa-key-20251115"
PUBKEYS[alex]="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAFhkfL+oxI1ltCB4Vjt1qqyi5PpYU5JcUmIGiQfSW6h eddsa-key-20251108"
PUBKEYS[profe]="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGiH1BVrEPj3/BniLwfo6oyTC7dy1SFVm1ZvXfARBtYe gonzalo.martinez@Asgard"
PUBKEYS[nicolas]="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILJlxQ36gxYnkQh8/XvKDxVe9hwHnNYgxSuRCWgYKsKl eddsa-key-20251108"
PUBKEYS[facundo]="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICLueintAEaHbyFcEYu07ffsZX4Mt+mwsVd5MSkfdmkS eddsa-key-20251108"



for u in "${USERS[@]}"; do
  if [[ -z "${PUBKEYS[$u]:-}" ]]; then
    err "Falta clave pública para $u en usuarios.sh"
    exit 1
  fi

  if id "$u" &>/dev/null; then
    warn "Usuario $u ya existe, ajustando grupo wheel."
    usermod -aG wheel "$u" || true
  else
    msg "Creando usuario $u en grupo wheel..."
    useradd -m -s /bin/bash -G wheel "$u"
  fi

  HOME_DIR=$(eval echo "~$u")
  SSH_DIR="$HOME_DIR/.ssh"
  AUTH_KEYS="$SSH_DIR/authorized_keys"

  mkdir -p "$SSH_DIR"
  echo "${PUBKEYS[$u]}" > "$AUTH_KEYS"

  chown -R "$u:$u" "$SSH_DIR"
  chmod 700 "$SSH_DIR"
  chmod 600 "$AUTH_KEYS"

  # Para SELinux (si está activo)
  command -v restorecon &>/dev/null && restorecon -Rv "$SSH_DIR" || true

  ok "Usuario $u listo con clave pública configurada."
done

ok "Todos los usuarios creados y configurados."
