<?php
declare(strict_types=1);

/* ---------- OUTPUT & ERRORS ---------- */
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);

/* ---------- SESSION (SameSite=Lax) ---------- */
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
function db(): PDO {
  static $pdo = null;
  if ($pdo instanceof PDO) return $pdo;

  $host = '127.0.0.1';
  $dbname = 'fans_cooperativa';
  $user = 'root';
  $pass = '';
  $charset = 'utf8mb4';

  $pdo = new PDO(
    "mysql:host=$host;dbname=$dbname;charset=$charset",
    $user, $pass,
    [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]
  );
  return $pdo;
}

/* ---------- JSON helpers ---------- */
function json_ok(array $data = []): never {
  http_response_code(200);
  if (!array_key_exists('ok', $data)) $data['ok'] = true;
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}
function json_error(int $status, string $code, array $extra = []): never {
  http_response_code($status);
  echo json_encode(['ok'=>false, 'error'=>$code] + $extra, JSON_UNESCAPED_UNICODE);
  exit;
}

/* ---------- Password helper ---------- */
function check_password(string $plain, string $hash): bool {
  if (preg_match('/^\$(2y|argon2)/', $hash)) return password_verify($plain, $hash);
  return hash_equals($hash, $plain);
}

/* ---------- Token header ---------- */
function fans_getallheaders_safe(): array {
  if (function_exists('getallheaders')) return getallheaders();
  $h = [];
  foreach ($_SERVER as $k => $v) {
    if (strpos($k, 'HTTP_') === 0) {
      $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_',' ',substr($k,5)))));
      $h[$name] = $v;
    }
  }
  return $h;
}
function bearer_token(): string {
  $hdrs = fans_getallheaders_safe();
  foreach ($hdrs as $k => $v) {
    if (strtolower($k) === 'authorization' && preg_match('/Bearer\s+(.+)/i', $v, $m)) {
      return trim($m[1]);
    }
  }
  if (!empty($_COOKIE['fans_token'])) return (string)$_COOKIE['fans_token'];
  if (!empty($_GET['token']))  return (string)$_GET['token'];
  if (!empty($_POST['token'])) return (string)$_POST['token'];
  return '';
}

/* ---------- Tokens table compat ---------- */
function token_store(int $userId, string $role, string $token): void {
  $pdo  = db();
  $hash = hash('sha256', $token);
  // Try with both token_hash + token
  try {
    $pdo->prepare(
      "INSERT INTO auth_tokens (user_id, user_role, token_hash, token, expires_at)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 12 HOUR))"
    )->execute([$userId, $role, $hash, $token]);
    return;
  } catch (Throwable $e) {}
  // Fallback only token_hash
  try {
    $pdo->prepare(
      "INSERT INTO auth_tokens (user_id, user_role, token_hash, expires_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 12 HOUR))"
    )->execute([$userId, $role, $hash]);
    return;
  } catch (Throwable $e) {}
  // Fallback only token
  $pdo->prepare(
    "INSERT INTO auth_tokens (user_id, user_role, token, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 12 HOUR))"
  )->execute([$userId, $role, $token]);
}

function token_find(string $role, string $token): ?array {
  if ($token === '') return null;
  $pdo  = db();
  $hash = hash('sha256', $token);
  $st = $pdo->prepare(
    "SELECT t.user_id
       FROM auth_tokens t
      WHERE t.user_role = ?
        AND ((t.token_hash = ?) OR (t.token = ?))
        AND (t.expires_at IS NULL OR t.expires_at > NOW())
      ORDER BY t.id DESC
      LIMIT 1"
  );
  $st->execute([$role, $hash, $token]);
  $row = $st->fetch();
  return $row ?: null;
}
