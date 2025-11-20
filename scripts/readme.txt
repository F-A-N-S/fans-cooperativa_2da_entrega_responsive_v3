# Scripts de configuración básica de servidores Rocky Linux

Este conjunto de scripts automatiza la configuración inicial de una máquina Rocky Linux 8 (Minimal) para el proyecto de Administración de Sistemas Operativos.

Con un solo comando se instalan paquetes básicos, se crean usuarios con claves públicas, se configura SSH con autenticación por clave y se activa el firewall con las reglas necesarias.

---

- Requisitos

- Sistema operativo: **Rocky Linux 8.x Minimal**
- Conectividad a Internet (para instalar paquetes con `dnf`).
- Ejecutar los scripts con **usuario root** o usando `sudo`.
- Los archivos deben estar en la **misma carpeta** en el servidor.

---

- Archivos incluidos

- `run.sh`  
  Orquestador principal. Llama a los demás scripts en orden.

- `paquetes.sh`  
  Instala EPEL y paquetes básicos: `vim`, `htop`, `git`, `wget`, `curl`, `firewalld`, `cockpit`, `rsyslog`, etc.  
  Habilita y arranca `firewalld`, `rsyslog` y `cockpit.socket`.

- `usuarios.sh`  
  Crea los usuarios:
  - `santiago`
  - `alex`
  - `profe`
  - `nicolas`
  - `facundo`  

  Los agrega al grupo `wheel` (administradores) y genera el archivo `~/.ssh/authorized_keys` de cada uno con su **clave pública SSH** correspondiente.

- `ssh_config_setup.sh`  
  Configura el servicio SSH (`sshd`) para:
  - Puerto 22  
  - `PermitRootLogin no` (root no puede ingresar por SSH)  
  - `PasswordAuthentication no` (no se puede usar contraseña)  
  - `PubkeyAuthentication yes` (solo se permite clave pública)  
  - `AllowUsers santiago alex profe nicolas facundo`  

  Crea un backup del archivo original `sshd_config` y usa el directorio `sshd_config.d` para aplicar el hardening.

- `firewall.sh`  
  Activa y configura `firewalld`:
  - Asocia la interfaz de red de salida a la zona `public`.
  - Habilita:
    - Servicio `ssh`
    - Puerto `9090/tcp` (Cockpit)
    - Puertos `514/tcp` y `514/udp` (rsyslog)

- `colorcitos.sh`  
  Define colores y funciones auxiliares (`msg`, `ok`, `warn`, `err`) para mostrar mensajes más claros en la consola.

---

- Uso

1. Copiar los scripts al servidor (por ejemplo a `/root/scripts`).
2. Entrar a la carpeta:

   ```bash
   cd /root/scripts
3. dar permisos de ejecucion:
chmod +x *.sh
4.sudo ./run.sh

Si necesitamos adaptarlo a linux:
dnf install -y dos2unix    # instalar herramienta
cd /root/scripts           # carpeta donde están los .sh
dos2unix *.sh              # convertir todos los scripts a formato UNIX
chmod +x *.sh              # volver a marcar como ejecutables
sudo ./run.sh		   # Iniciar

VERIFICACION SI ESTA TODO BIEN:
Que los usuarios existen:

"getent passwd santiago"
"getent passwd facundo"
"getent passwd nicolas"
"getent passwd alex"
"getent passwd profe"

Que el firewall está activo:

"firewall-cmd --list-all"

Que SSH quedó endurecido:

sshd -T | egrep 'passwordauthentication|pubkeyauthentication|permitrootlogin'
