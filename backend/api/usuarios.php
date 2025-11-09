<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors','0');
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);

function db(): PDO {
  static $pdo=null;
  if ($pdo) return $pdo;
  $pdo = new PDO(
    'mysql:host=127.0.0.1;dbname=fans_cooperativa;charset=utf8mb4',
    'root','',
    [
      PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC
    ]
  );
  return $pdo;
}
function json_ok($arr=[]){ if(!isset($arr['ok']))$arr['ok']=true; echo json_encode($arr,JSON_UNESCAPED_UNICODE); exit; }
function json_err($code,$msg,$extra=[]){ http_response_code($code); echo json_encode(['ok'=>false,'error'=>$msg]+$extra); exit; }

/* ---------- helpers ---------- */
function password_ok(string $plain, string $hash): bool {
  // Soporta bcrypt/argon2 y también texto plano (para datos legacy)
  if (preg_match('/^\$(2y|argon2)/',$hash)) return password_verify($plain,$hash);
  return hash_equals($hash,$plain);
}
function allheaders(): array {
  if (function_exists('getallheaders')) return getallheaders();
  $h=[]; foreach($_SERVER as $k=>$v){ if(strpos($k,'HTTP_')===0){
    $name=str_replace(' ','-',ucwords(strtolower(str_replace('_',' ',substr($k,5)))));
    $h[$name]=$v;
  }} return $h;
}
function bearer(): string {
  foreach(allheaders() as $k=>$v){
    if (strtolower($k)==='authorization' && preg_match('/Bearer\s+(.+)/i',$v,$m)) return trim($m[1]);
  }
  if (!empty($_COOKIE['fans_token'])) return (string)$_COOKIE['fans_token'];
  if (!empty($_GET['token']))        return (string)$_GET['token'];
  return '';
}

function require_residente(): int {
  $t = bearer();
  $row = residente_by_token($t);
  if (!$row) json_err(401,'UNAUTHENTICATED');
  return (int)$row['user_id'];
}

function residente_by_token(string $token): ?array {
  if ($token==='') return null;
  $pdo = db(); $hash = hash('sha256',$token);
  $st = $pdo->prepare(
    "SELECT t.user_id, r.Correo
       FROM auth_tokens t
       JOIN residente r ON r.id_Residente=t.user_id
      WHERE t.user_role='residente'
        AND (t.token_hash=? OR t.token=?)
        AND t.expires_at>NOW()
      LIMIT 1"
  );
  $st->execute([$hash,$token]);
  $row = $st->fetch();
  return $row?:null;
}
/* ---------- /helpers ---------- */

$action = $_GET['action'] ?? '';

try {
  switch ($action) {
    case 'ping':
      json_ok(['api'=>'users','php'=>PHP_VERSION]);

    case 'login': {
      $r = json_decode(file_get_contents('php://input'), true) ?: $_POST;
      $email = trim((string)($r['email'] ?? $r['usuario'] ?? ''));
      $pass  = (string)($r['password'] ?? $r['pass'] ?? '');
      if ($email==='' || $pass==='') json_err(400,'BAD_REQUEST');

      $st = db()->prepare(
        "SELECT id_Residente AS id, Correo, Usuario, Contrasena
           FROM residente
          WHERE Correo=? OR Usuario=?
          LIMIT 1"
      );
      $st->execute([$email,$email]);
      $u = $st->fetch();
      if (!$u || !password_ok($pass, (string)$u['Contrasena'])) {
        json_err(401,'INVALID_CREDENTIALS');
      }

      $token = bin2hex(random_bytes(32));
      try {
        db()->prepare(
          "INSERT INTO auth_tokens (user_id,user_role,token,token_hash,expires_at)
           VALUES (?,?,?,?,DATE_ADD(NOW(),INTERVAL 12 HOUR))"
        )->execute([(int)$u['id'],'residente',$token,hash('sha256',$token)]);
      } catch(Throwable $e) {
        // si no existe la columna token, al menos guardamos el hash
        try {
          db()->prepare(
            "INSERT INTO auth_tokens (user_id,user_role,token_hash,expires_at)
             VALUES (?,?,?,DATE_ADD(NOW(),INTERVAL 12 HOUR))"
          )->execute([(int)$u['id'],'residente',hash('sha256',$token)]);
        } catch(Throwable $e2) {}
      }

      // cookie para el guard
      setcookie('fans_token',$token,0,'/','',false,true);

      json_ok([
        'role'=>'residente',
        'token'=>$token,
        'user'=>[
          'id'=>(int)$u['id'],
          'correo'=>(string)($u['Correo'] ?? ''),
          'usuario'=>(string)($u['Usuario'] ?? '')
        ]
      ]);
    }

    case 'me': {
      $t = bearer();
      $row = residente_by_token($t);
      if (!$row) json_err(401,'UNAUTHENTICATED');

      $st = db()->prepare(
        "SELECT id_Residente AS id, Usuario, Correo
           FROM residente
          WHERE id_Residente=? LIMIT 1"
      );
      $st->execute([(int)$row['user_id']]);
      $u = $st->fetch() ?: ['id'=>(int)$row['user_id']];

      json_ok(['user'=>$u]);
    }

    case 'logout': {
      // opcional: para que puedas llamar /usuarios.php?action=logout
      setcookie('fans_token','',time()-3600,'/','',false,true);
      json_ok();
    }

case 'hours_create': {
  $rid = require_residente();

  // Admite JSON o form (FormData)
  $r = json_decode(file_get_contents('php://input'), true) ?: $_POST;

  // Espera: fecha (YYYY-MM-DD), desde (HH:MM), hasta (HH:MM), descripcion
  $fecha = trim((string)($r['fecha'] ?? ''));
  $desde = trim((string)($r['desde'] ?? ''));
  $hasta = trim((string)($r['hasta'] ?? ''));
  $desc  = trim((string)($r['descripcion'] ?? ''));

  if ($fecha==='' || $desde==='' || $hasta==='') {
    json_err(400,'BAD_REQUEST',['message'=>'Faltan campos']);
  }

  // Calculamos minutos entre desde-hasta
  // Guardaremos en la columna Cantidad los MINUTOS totales (entero).
  $t0 = strtotime("$fecha $desde");
  $t1 = strtotime("$fecha $hasta");
  if ($t0===false || $t1===false || $t1 <= $t0) {
    json_err(400,'BAD_REQUEST',['message'=>'Rango horario inválido']);
  }
  $min = (int) round(($t1 - $t0) / 60);

  $st = db()->prepare(
    "INSERT INTO horas_trabajo (id_Residente, Fecha, Cantidad, Descripcion, Fecha_Registro)
     VALUES (?,?,?,?, NOW())"
  );
  $st->execute([$rid, $fecha, $min, $desc]);

  json_ok(['id'=>(int)db()->lastInsertId(), 'min'=>$min]);
}

case 'hours_list': {
  $rid = require_residente();
  $st = db()->prepare(
    "SELECT id_Hora AS id,
            Fecha,
            Cantidad,        -- minutos totales guardados
            Descripcion,
            Fecha_Registro
       FROM horas_trabajo
      WHERE id_Residente=?
      ORDER BY id_Hora DESC
      LIMIT 100"
  );
  $st->execute([$rid]);
  $items = $st->fetchAll();

  // Normalizamos un campo de conveniencia (h y m)
  foreach ($items as &$it) {
    $mins = (int)$it['Cantidad'];
    $it['mins'] = $mins;
    $it['h'] = intdiv($mins,60);
    $it['m'] = $mins % 60;
  }

  json_ok(['items'=>$items]);
}

    default:
      json_err(400,'UNKNOWN_ACTION',['action'=>$action]);
  }
} catch (Throwable $e) {
  json_err(500,'SERVER_ERROR',['message'=>$e->getMessage()]);
}