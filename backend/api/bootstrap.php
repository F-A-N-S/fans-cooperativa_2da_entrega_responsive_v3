<?php
/* ---------- Salida JSON + errores controlados ---------- */
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);

/* ---------- Sesión segura ---------- */
if (session_status() !== PHP_SESSION_ACTIVE) {
  session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'domain'   => '',
    'secure'   => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
  session_start();
}

/* ---------- DB ---------- */
function db() {
  static $pdo = null;
  if ($pdo instanceof PDO) return $pdo;

  $host    = '127.0.0.1';
  $dbname  = 'fans_cooperativa'; // <- cambia si usás otro nombre
  $user    = 'root';
  $pass    = '';                  // XAMPP por defecto
  $charset = 'utf8mb4';

  $pdo = new PDO(
    "mysql:host=$host;dbname=$dbname;charset=$charset",
    $user, $pass,
    [
      PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]
  );
  return $pdo;
}

/* ---------- Helpers JSON ---------- */
function json_ok($data = []) {
  if (!array_key_exists('ok', $data)) $data['ok'] = true;
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}
function json_error($status, $code, $extra = []) {
  http_response_code($status);
  echo json_encode(['ok'=>false, 'error'=>$code] + $extra, JSON_UNESCAPED_UNICODE);
  exit;
}

/* ---------- Utilidades de esquema ---------- */
function col_exists($table, $col) {
  try {
    $q = db()->query("SHOW COLUMNS FROM `$table` LIKE " . db()->quote($col));
    return $q && $q->rowCount() > 0;
  } catch (Throwable $e) { return false; }
}
function first_existing_col($table, $candidates, $fallback = null) {
  foreach ($candidates as $c) if (col_exists($table, $c)) return $c;
  return $fallback ?: $candidates[0];
}

/* ---------- Autenticación y tokens ---------- */
function getallheaders_safe() {
  if (function_exists('getallheaders')) return getallheaders();
  $h = [];
  foreach ($_SERVER as $k=>$v) {
    if (strpos($k,'HTTP_')===0) {
      $name = str_replace(' ','-', ucwords(strtolower(str_replace('_',' ',substr($k,5)))));
      $h[$name] = $v;
    }
  }
  return $h;
}
function bearer_token() {
  $hdrs = getallheaders_safe();
  foreach ($hdrs as $k=>$v) {
    if (strtolower($k)==='authorization' && preg_match('/Bearer\s+(.+)/i',$v,$m)) return trim($m[1]);
  }
  if (!empty($_COOKIE['fans_token'])) return (string)$_COOKIE['fans_token'];
  if (!empty($_GET['token']))        return (string)$_GET['token'];
  if (!empty($_POST['token']))       return (string)$_POST['token'];
  return '';
}
function check_password_compat($plain, $hash) {
  if (preg_match('/^\$(2y|argon2)/', (string)$hash)) return password_verify($plain, (string)$hash);
  return hash_equals((string)$hash, (string)$plain);
}

function auth_store_token($userId, $role, $rawToken) {
  $pdo  = db();
  $hash = hash('sha256', $rawToken);

  $hasToken      = col_exists('auth_tokens','token');
  $hasTokenHash  = col_exists('auth_tokens','token_hash');
  $hasExpires    = col_exists('auth_tokens','expires_at');

  // Construir INSERT dinámico según columnas presentes
  $cols = ['user_id','user_role'];
  $vals = ['?','?'];
  $args = [$userId, $role];

  if ($hasTokenHash) { $cols[]='token_hash'; $vals[]='?'; $args[]=$hash; }
  if ($hasToken)     { $cols[]='token';      $vals[]='?'; $args[]=$rawToken; }
  if ($hasExpires)   { $cols[]='expires_at'; $vals[]="DATE_ADD(NOW(), INTERVAL 12 HOUR)"; }

  $sql = "INSERT INTO auth_tokens (".implode(',',$cols).") VALUES (".implode(',',$vals).")";
  $pdo->prepare($sql)->execute($args);
}

function auth_find_by_token($role, $rawToken) {
  if ($rawToken==='') return null;
  $pdo  = db();
  $hash = hash('sha256', $rawToken);

  $hasToken     = col_exists('auth_tokens','token');
  $hasTokenHash = col_exists('auth_tokens','token_hash');
  $hasExpires   = col_exists('auth_tokens','expires_at');

  $conds = ["t.user_role=?"];
  $args  = [$role];

  if ($hasTokenHash && $hasToken) {
    $conds[] = "(t.token_hash=? OR t.token=?)"; $args[]=$hash; $args[]=$rawToken;
  } elseif ($hasTokenHash) {
    $conds[] = "t.token_hash=?"; $args[]=$hash;
  } elseif ($hasToken) {
    $conds[] = "t.token=?"; $args[]=$rawToken;
  }

  if ($hasExpires) $conds[] = "t.expires_at>NOW()";

  // Mapear tabla y PK según rol
  if ($role==='admin') {
    $join = "JOIN administrador a ON a.id_Administrador=t.user_id";
    $select = "t.user_id AS id, a.Correo AS correo";
  } else {
    $join = "JOIN residente r ON r.id_Residente=t.user_id";
    $select = "t.user_id AS id, r.Correo AS correo";
  }

  $sql = "SELECT $select
          FROM auth_tokens t
          $join
          WHERE ".implode(' AND ',$conds)."
          LIMIT 1";

  $st = $pdo->prepare($sql);
  $st->execute($args);
  $row = $st->fetch();
  return $row ?: null;
}

function start_session_from_token($role, $token) {
  $row = auth_find_by_token($role, $token);
  if (!$row) return false;
  if ($role==='admin') {
    $_SESSION['aid']   = (int)$row['id'];
    $_SESSION['role']  = 'admin';
    $_SESSION['email'] = (string)$row['correo'];
  } else {
    $_SESSION['uid']   = (int)$row['id'];
    $_SESSION['role']  = 'residente';
    $_SESSION['email'] = (string)$row['correo'];
  }
  setcookie('fans_token', $token, 0, '/', '', false, true);
  return true;
}

function require_admin_or_401() {
  if (!empty($_SESSION['aid']) && ($_SESSION['role'] ?? '')==='admin') return (int)$_SESSION['aid'];
  $tok = bearer_token();
  if ($tok!=='' && start_session_from_token('admin', $tok)) return (int)$_SESSION['aid'] ?? 0;
  json_error(401, 'UNAUTHENTICATED');
}
function require_user_or_401() {
  if (!empty($_SESSION['uid']) && ($_SESSION['role'] ?? '')==='residente') return (int)$_SESSION['uid'];
  $tok = bearer_token();
  if ($tok!=='' && start_session_from_token('residente', $tok)) return (int)$_SESSION['uid'] ?? 0;
  json_error(401, 'UNAUTHENTICATED');
}

/* ---------- Helpers de columnas “flex” ---------- */
function pick_comm_cols() {
  // Devuelve nombres reales de columnas para comunicados
  return [
    'id'     => first_existing_col('comunicados', ['id','id_Comunicado','ID_Comunicado'],'id'),
    'titulo' => first_existing_col('comunicados', ['titulo','Titulo'],'titulo'),
    'cuerpo' => first_existing_col('comunicados', ['cuerpo','Contenido','contenido'],'cuerpo'),
    'fecha'  => first_existing_col('comunicados', ['fecha','Fecha','creado_en','created_at'],'fecha'),
  ];
}