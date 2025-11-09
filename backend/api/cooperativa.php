<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors','0');
error_reporting(E_ALL & ~E_WARNING & ~E_NOTICE & ~E_DEPRECATED);

/* ================== SESSION ================== */
if (session_status() !== PHP_SESSION_ACTIVE) {
  session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>false,'httponly'=>true,'samesite'=>'Lax']);
  session_start();
}

/* ================== DB & JSON ================== */
function db(): PDO {
  static $pdo=null;
  if ($pdo) return $pdo;
  $pdo = new PDO('mysql:host=127.0.0.1;dbname=fans_cooperativa;charset=utf8mb4','root','',[
    PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
  ]);
  return $pdo;
}
function json_ok($arr=[]){ if(!isset($arr['ok']))$arr['ok']=true; echo json_encode($arr, JSON_UNESCAPED_UNICODE); exit; }
function json_err($code,$msg,$extra=[]){ http_response_code($code); echo json_encode(['ok'=>false,'error'=>$msg]+$extra); exit; }

/* ================== HELPERS ================== */
function allheaders(): array {
  if (function_exists('getallheaders')) return getallheaders();
  $h=[]; foreach($_SERVER as $k=>$v){ if(strpos($k,'HTTP_')===0){
    $name=str_replace(' ','-',ucwords(strtolower(str_replace('_',' ',substr($k,5)))));
    $h[$name]=$v;
  } }
  return $h;
}
function bearer(): string {
  foreach(allheaders() as $k=>$v){ if(strtolower($k)==='authorization' && preg_match('/Bearer\s+(.+)/i',$v,$m)) return trim($m[1]); }
  if(!empty($_COOKIE['fans_token'])) return (string)$_COOKIE['fans_token'];
  if(!empty($_GET['token']))        return (string)$_GET['token'];
  return '';
}
function bearer_any(): string { return bearer(); }

function token_save(int $uid, string $role, string $token): void {
  $pdo=db(); $hash=hash('sha256',$token);
  try{ $pdo->prepare("INSERT INTO auth_tokens (user_id,user_role,token,token_hash,expires_at) VALUES (?,?,?,?,DATE_ADD(NOW(),INTERVAL 12 HOUR))")->execute([$uid,$role,$token,$hash]); return; }catch(Throwable $e){}
  try{ $pdo->prepare("INSERT INTO auth_tokens (user_id,user_role,token_hash,expires_at) VALUES (?,?,?,DATE_ADD(NOW(),INTERVAL 12 HOUR))")->execute([$uid,$role,$hash]); return; }catch(Throwable $e){}
  $pdo->prepare("INSERT INTO auth_tokens (user_id,user_role,token,expires_at) VALUES (?,?,?,DATE_ADD(NOW(),INTERVAL 12 HOUR))")->execute([$uid,$role,$token]);
}
function admin_by_token(string $token): ?array {
  if ($token==='') return null;
  $pdo=db(); $hash=hash('sha256',$token);
  $st=$pdo->prepare("SELECT t.user_id, a.Correo
                       FROM auth_tokens t
                       JOIN administrador a ON a.id_Administrador=t.user_id
                      WHERE t.user_role='admin' AND (t.token_hash=? OR t.token=?) AND t.expires_at>NOW()
                      LIMIT 1");
  $st->execute([$hash,$token]);
  $row=$st->fetch(); return $row?:null;
}
function residente_by_token(string $token): ?array {
  if ($token==='') return null;
  $pdo=db(); $hash=hash('sha256',$token);
  $st=$pdo->prepare("SELECT t.user_id, r.Correo
                       FROM auth_tokens t
                       JOIN residente r ON r.id_Residente=t.user_id
                      WHERE t.user_role='residente' AND (t.token_hash=? OR t.token=?) AND t.expires_at>NOW()
                      LIMIT 1");
  $st->execute([$hash,$token]);
  $row=$st->fetch(); return $row?:null;
}

/* session guards */
function require_admin(): int {
  if (($_SESSION['role'] ?? '')==='admin' && isset($_SESSION['aid'])) return (int)$_SESSION['aid'];
  $row = admin_by_token(bearer());
  if (!$row) json_err(401,'UNAUTHENTICATED');
  $_SESSION['role']='admin'; $_SESSION['aid']=(int)$row['user_id']; $_SESSION['email']=(string)$row['Correo'];
  return (int)$_SESSION['aid'];
}
function require_residente(): int {
  if (($_SESSION['role']??'')==='residente' && isset($_SESSION['rid'])) return (int)$_SESSION['rid'];
  $row = residente_by_token(bearer_any());
  if ($row){
    $_SESSION['role']='residente';
    $_SESSION['rid']=(int)$row['user_id'];
    $_SESSION['email']=(string)$row['Correo'];
    return (int)$row['user_id'];
  }
  json_err(401,'UNAUTHENTICATED');
}
function has_col(string $table, string $col): bool {
  static $cache = [];
  $key = $table.'.'.$col;
  if (isset($cache[$key])) return $cache[$key];
  $st = db()->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
  $st->execute([$col]);
  return $cache[$key] = (bool)$st->fetch();
}

/* files */
function ensure_dir(string $dir): void { if (!is_dir($dir)) @mkdir($dir, 0777, true); }
function safe_filename(string $name): string { $name=preg_replace('/[^A-Za-z0-9\.\-_]/','_',$name); return $name?:('file_'.bin2hex(random_bytes(4))); }

/* ================== ROUTER ================== */
$action = $_GET['action'] ?? $_POST['action'] ?? '';

// Alias para compatibilidad
$alias = [
  'postulantes_listar'   => 'admin_postulantes_listar',
  'postulante_aprobar'   => 'admin_postulantes_aprobar',
  'postulante_rechazar'  => 'admin_postulantes_rechazar',
  'admin_hours_list'     => 'hours_admin_listar',
];
if (isset($alias[$action])) $action = $alias[$action];

try {
switch ($action) {

  case 'ping': json_ok(['api'=>'coop','php'=>PHP_VERSION]);

  /* ---------- AUTH ADMIN ---------- */
  case 'admin_login': {
    $r = json_decode(file_get_contents('php://input'), true) ?: [];
    $email = trim((string)($r['email'] ?? ''));
    $pass  = (string)($r['password'] ?? '');
    if ($email==='' || $pass==='') json_err(400,'BAD_REQUEST');

    $st=db()->prepare("SELECT id_Administrador AS id, Correo, Contrasena FROM administrador WHERE Correo=? OR Usuario=? LIMIT 1");
    $st->execute([$email,$email]);
    $a=$st->fetch();
    if(!$a) json_err(401,'INVALID_CREDENTIALS');
    $hash=(string)$a['Contrasena'];
    $ok = (preg_match('/^\$(2y|argon2)/',$hash)) ? password_verify($pass,$hash) : hash_equals($hash,$pass);
    if(!$ok) json_err(401,'INVALID_CREDENTIALS');

    $token = bin2hex(random_bytes(32));
    token_save((int)$a['id'],'admin',$token);
    $_SESSION['aid']=(int)$a['id']; $_SESSION['role']='admin'; $_SESSION['email']=(string)$a['Correo'];
    setcookie('fans_token',$token,['expires'=>0,'path'=>'/','secure'=>false,'httponly'=>true,'samesite'=>'Lax']);
    json_ok(['role'=>'admin','token'=>$token]);
  }

  case 'me': {
    if (($_SESSION['role'] ?? '')!=='admin'){
      $row = admin_by_token(bearer());
      if ($row){ $_SESSION['aid']=(int)$row['user_id']; $_SESSION['role']='admin'; $_SESSION['email']=(string)$row['Correo']; }
    }
    if (($_SESSION['role'] ?? '')!=='admin') json_err(401,'UNAUTHENTICATED');
    json_ok(['admin'=>['id'=>(int)$_SESSION['aid'],'correo'=>(string)($_SESSION['email']??'')]]);
  }

  case 'logout': {
    $tok = bearer();
    if ($tok!=='') {
      $hash = hash('sha256',$tok);
      try { db()->prepare("DELETE FROM auth_tokens WHERE token_hash=? OR token=?")->execute([$hash,$tok]); } catch(Throwable $e){}
    }
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
      $p=session_get_cookie_params();
      setcookie(session_name(),'',time()-42000,$p['path'],$p['domain']??'', $p['secure'], $p['httponly']);
    }
    setcookie('fans_token','', time()-3600, '/', '', false, true);
    json_ok(['logged_out'=>true]);
  }

  /* ---------- COMUNICADOS ---------- */
  case 'admin_comunicados_crear': {
    $aid = require_admin();
    $r = json_decode(file_get_contents('php://input'), true) ?: [];
    $titulo = trim((string)($r['Titulo'] ?? $r['titulo'] ?? ''));
    $contenido = trim((string)($r['Contenido'] ?? $r['contenido'] ?? ''));
    $dest = trim((string)($r['Destinatario'] ?? 'Todos'));
    if ($titulo==='') json_err(400,'BAD_REQUEST',['message'=>'Falta título']);
    $st = db()->prepare("INSERT INTO comunicados (Titulo,Fecha,Destinatario,Contenido,id_Administrador) VALUES (?,?,?,?,?)");
    $st->execute([$titulo, date('Y-m-d'), $dest, $contenido, $aid]);
    json_ok(['id'=> (int)db()->lastInsertId()]);
  }

  case 'comunicados_listar': {
    $st = db()->query("SELECT Id_Aviso AS id, Titulo, Fecha, Destinatario, Contenido FROM comunicados ORDER BY Id_Aviso DESC LIMIT 50");
    json_ok(['items'=>$st->fetchAll()]);
  }

  case 'comunicado_eliminar': {
    require_admin();
    $r = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = (int)($r['id'] ?? 0);
    if (!$id) json_err(400,'BAD_REQUEST');
    db()->prepare("DELETE FROM comunicados WHERE Id_Aviso=?")->execute([$id]);
    json_ok();
  }

  /* ---------- RECLAMOS (residente) ---------- */
  case 'reclamos_crear': {
    $rid = require_residente();
    $r = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $asunto = trim((string)($r['asunto'] ?? ''));
    $desc   = trim((string)($r['descripcion'] ?? ''));
    if ($asunto==='' && $desc==='') json_err(400,'BAD_REQUEST');
    $texto = $asunto ? ($asunto.' — '.$desc) : $desc;
    $prio = $r['prioridad'] ?? null; if ($prio==='') $prio = null;
    $st = db()->prepare("INSERT INTO reclamos (Descripcion, Fecha, Estado, id_Residente, Prioridad) VALUES (?, NOW(), 'abierto', ?, ?)");
    $st->execute([$texto, $rid, $prio]);
    json_ok(['id'=>(int)db()->lastInsertId()]);
  }

  case 'reclamos_listar': {
    $rid = require_residente();
    $st = db()->prepare("SELECT Id_Reclamo AS id, Descripcion, Estado, Fecha FROM reclamos WHERE id_Residente=? ORDER BY Id_Reclamo DESC LIMIT 100");
    $st->execute([$rid]);
    json_ok(['items'=>$st->fetchAll()]);
  }

  /* ---------- RECLAMOS (admin) ---------- */
  case 'admin_reclamos_listar': {
    require_admin();
    $st=db()->query("SELECT Id_Reclamo AS id, id_Residente, Descripcion, Estado, Fecha FROM reclamos ORDER BY Id_Reclamo DESC LIMIT 300");
    json_ok(['items'=>$st->fetchAll()]);
  }

  case 'reclamos_estado': {
    $aid = require_admin();
    $r = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = (int)($r['id'] ?? 0);
    $estado = trim((string)($r['estado'] ?? ''));
    if (!$id || $estado==='') json_err(400,'BAD_REQUEST');
    try {
      db()->prepare("UPDATE reclamos SET Estado=?, id_Administrador=?, Fecha_Revision=NOW() WHERE Id_Reclamo=?")->execute([$estado,$aid,$id]);
    } catch(Throwable $e) {
      db()->prepare("UPDATE reclamos SET Estado=? WHERE Id_Reclamo=?")->execute([$estado,$id]);
    }
    json_ok();
  }

  case 'reclamos_eliminar': {
    require_admin();
    $r = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = (int)($r['id'] ?? 0);
    if (!$id) json_err(400,'BAD_REQUEST');
    db()->prepare("DELETE FROM reclamos WHERE Id_Reclamo=?")->execute([$id]);
    json_ok();
  }

  /* ---------- RESERVAS (BACKOFFICE) ---------- */
  case 'admin_reservas_listar': {
    require_admin();
    $sql = "
      SELECT
        id                                   AS id,
        id_Residente                         AS residente,
        DATE_FORMAT(fecha,'%Y-%m-%d')        AS fecha,
        CONCAT(LPAD(hora_inicio,5,'0'),'–',LPAD(hora_fin,5,'0')) AS hora,
        CASE LOWER(COALESCE(estado,'pendiente'))
          WHEN 'pendiente' THEN 'Pendiente'
          WHEN 'aprobado'  THEN 'Aprobado'
          WHEN 'rechazado' THEN 'Rechazado'
          ELSE estado
        END AS estado
      FROM reservas
      ORDER BY fecha DESC, hora_inicio DESC
      LIMIT 500";
    $st = db()->query($sql);
    json_ok(['items'=>$st->fetchAll()]);
  }

  case 'reservas_estado': {
    $aid = require_admin();
    $r = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = (int)($r['id'] ?? 0);
    $estado = trim((string)($r['estado'] ?? ''));
    if (!$id || $estado==='') json_err(400,'BAD_REQUEST');

    $estado_db = strtolower($estado);
    try {
      db()->prepare("UPDATE reservas SET estado=?, id_Administrador=?, fecha_revision=NOW() WHERE id=?")
        ->execute([$estado_db,$aid,$id]);
    } catch (Throwable $e) {
      db()->prepare("UPDATE reservas SET estado=?, id_Administrador=? WHERE id=?")
        ->execute([$estado_db,$aid,$id]);
    }
    json_ok();
  }

  case 'reservas_eliminar': {
    require_admin();
    $r = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = (int)($r['id'] ?? 0);
    if (!$id) json_err(400,'BAD_REQUEST');
    db()->prepare("DELETE FROM reservas WHERE id=?")->execute([$id]);
    json_ok();
  }

  /* ---------- COMPROBANTES (residente) ---------- */
case 'comprobantes_listar':
case 'mis_comprobantes': {  // alias opcional
  $rid = require_residente();
  $estado = isset($_GET['estado']) ? trim((string)$_GET['estado']) : '';

  $sql = "SELECT
            id_Comprobante AS id,
            Tipo, Fecha, Monto, Estado, Archivo,
            COALESCE(Fecha_Subida, Fecha) AS Fecha_Subida
          FROM comprobantes_pago
          WHERE id_Residente = ?";
  $par = [$rid];

  if ($estado !== '') { $sql .= " AND Estado = ?"; $par[] = $estado; }

  $sql .= " ORDER BY id_Comprobante DESC LIMIT 100";
  $st = db()->prepare($sql);
  $st->execute($par);

  json_ok(['items' => $st->fetchAll()]);
}

  /* ---------- COMPROBANTES ---------- */
  case 'admin_comprobantes_listar': {
    require_admin();
    $estado = isset($_GET['estado']) ? trim((string)$_GET['estado']) : '';
    $rid    = isset($_GET['rid']) ? (int)$_GET['rid'] : 0;

    $cols = "id_Comprobante AS id, Tipo, Fecha, Monto, Estado, Archivo, Fecha_Subida, id_Residente";
    if (has_col('comprobantes_pago','id_Administrador')) $cols .= ", id_Administrador AS admin";
    if (has_col('comprobantes_pago','Fecha_Revision'))   $cols .= ", Fecha_Revision AS revision";

    $sql = "SELECT $cols FROM comprobantes_pago WHERE 1=1";
    $par = [];
    if ($estado!==''){ $sql.=" AND Estado=?"; $par[]=$estado; }
    if ($rid){ $sql.=" AND id_Residente=?";   $par[]=$rid; }
    $sql .= " ORDER BY id_Comprobante DESC LIMIT 300";
    $st = db()->prepare($sql);
    $st->execute($par);
    json_ok(['items'=>$st->fetchAll()]);
  }

  case 'comprobantes_subir': {
    $rid = require_residente();
    if (empty($_FILES['archivo']['tmp_name'])) json_err(400,'BAD_REQUEST',['message'=>'Falta archivo']);
    $monto = isset($_POST['monto']) && $_POST['monto'] !== '' ? (float)$_POST['monto'] : null;
    $tipo  = trim((string)($_POST['tipo']  ?? 'Otros'));

    $root = dirname(__DIR__, 2);
    $dir  = $root . '/uploads/comprobantes';
    ensure_dir($dir);

    $ext = strtolower(pathinfo($_FILES['archivo']['name'], PATHINFO_EXTENSION));
    $allow = ['pdf','jpg','jpeg','png'];
    if (!in_array($ext, $allow, true)) json_err(400,'BAD_REQUEST',['message'=>'Extensión no permitida']);

    $name = 'comp_'.time().'_'.bin2hex(random_bytes(4)).'.'.$ext;
    $abs  = $dir . '/' . $name;
    $rel  = 'uploads/comprobantes/'.$name;

    if (!move_uploaded_file($_FILES['archivo']['tmp_name'], $abs)) json_err(500,'SERVER_ERROR',['message'=>'No se pudo mover el archivo']);

    db()->prepare("INSERT INTO comprobantes_pago
                    (Tipo, Fecha, Monto, Estado, Archivo, Fecha_Subida, id_Residente, id_Administrador)
                  VALUES (?, CURDATE(), ?, 'Pendiente', ?, NOW(), ?, NULL)")
       ->execute([$tipo,$monto,$rel,$rid]);

    json_ok(['id'=>(int)db()->lastInsertId(),'archivo'=>$rel,'monto'=>$monto,'tipo'=>$tipo]);
  }

  case 'comprobantes_estado': {
    $aid = require_admin();
    $r = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = (int)($r['id'] ?? 0);
    $estado = trim((string)($r['estado'] ?? ''));
    if (!$id || $estado==='') json_err(400,'BAD_REQUEST');
    try {
      db()->prepare("UPDATE comprobantes_pago SET Estado=?, id_Administrador=?, Fecha_Revision=NOW() WHERE id_Comprobante=?")->execute([$estado,$aid,$id]);
    } catch(Throwable $e) {
      db()->prepare("UPDATE comprobantes_pago SET Estado=?, id_Administrador=? WHERE id_Comprobante=?")->execute([$estado,$aid,$id]);
    }
    json_ok();
  }

  case 'comprobantes_eliminar': {
    require_admin();
    $r = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = (int)($r['id'] ?? 0);
    if (!$id) json_err(400,'BAD_REQUEST');

    // borrar archivo si existe
    $st=db()->prepare("SELECT Archivo FROM comprobantes_pago WHERE id_Comprobante=?");
    $st->execute([$id]); $row=$st->fetch();
    if ($row && !empty($row['Archivo'])) {
      $path = dirname(__DIR__,2).'/'.$row['Archivo'];
      if (is_file($path)) @unlink($path);
    }
    db()->prepare("DELETE FROM comprobantes_pago WHERE id_Comprobante=?")->execute([$id]);
    json_ok();
  }

  /* ---------- HORAS (residente) ---------- */
  case 'hours_create': {
    $rid = require_residente();
    $r = json_decode(file_get_contents('php://input'), true) ?: $_POST;

    $fecha = trim((string)($r['fecha'] ?? ''));   // dd/mm/aaaa o yyyy-mm-dd
    $desde = trim((string)($r['desde'] ?? ''));   // HH:MM
    $hasta = trim((string)($r['hasta'] ?? ''));   // HH:MM
    $desc  = trim((string)($r['descripcion'] ?? ''));

    if (preg_match('/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/', $fecha, $m)) { $fecha = "{$m[3]}-{$m[2]}-{$m[1]}"; }
    if ($fecha==='' || $desde==='' || $hasta==='') json_err(400,'BAD_REQUEST',['message'=>'Faltan campos']);

    $t0 = strtotime("$fecha $desde");
    $t1 = strtotime("$fecha $hasta");
    if ($t1 !== false && $t0 !== false && $t1 <= $t0) $t1 = strtotime("$fecha $hasta +1 day");
    if ($t0===false || $t1===false || $t1 <= $t0) json_err(400,'BAD_REQUEST',['message'=>'Rango horario inválido']);

    $min = (int) round(($t1 - $t0) / 60);
    db()->prepare("INSERT INTO horas_trabajo (id_Residente, Fecha, Cantidad, Descripcion, Fecha_Registro) VALUES (?,?,?,?, NOW())")
       ->execute([$rid, $fecha, $min, $desc]);
    json_ok(['id'=>(int)db()->lastInsertId(), 'min'=>$min]);
  }

  case 'hours_list': {
    $rid = require_residente();
    $st = db()->prepare("SELECT id_Hora AS id, Fecha, Cantidad, Descripcion, Fecha_Registro
                           FROM horas_trabajo
                          WHERE id_Residente=?
                          ORDER BY id_Hora DESC
                          LIMIT 100");
    $st->execute([$rid]);
    $items=$st->fetchAll();
    foreach($items as &$it){ $mins=(int)$it['Cantidad']; $it['mins']=$mins; $it['h']=intdiv($mins,60); $it['m']=$mins%60; }
    json_ok(['items'=>$items]);
  }

  /* ---------- HORAS (admin) ---------- */
  case 'admin_hours_list':
case 'hours_admin_listar': {
  require_admin();

  $rid   = (int)($_GET['residente_id'] ?? ($_GET['rid'] ?? 0));
  $month = (int)($_GET['mes'] ?? 0);
  $year  = (int)($_GET['anio'] ?? 0);

  $sql = "
    SELECT
      h.id_Hora                          AS id,
      h.id_Residente                     AS residente,          -- numérico
      h.id_Residente                     AS id_Residente,       -- alias compatible
      h.Fecha                            AS Fecha,
      CAST(h.Cantidad AS SIGNED)         AS mins,
      h.Descripcion                      AS Descripcion,
      h.Fecha_Registro                   AS Fecha_Registro,

      -- Datos del residente (si están)
      r.Usuario,
      r.Nombre,
      r.Apellido,
      r.Correo,

      -- Etiqueta lista para mostrar en tabla
      COALESCE(
        CONCAT(h.id_Residente, ' — ', NULLIF(r.Usuario,'')),
        CONCAT(h.id_Residente, ' — ', NULLIF(r.Correo,'')),
        CONCAT(h.id_Residente, ' — ', TRIM(CONCAT(COALESCE(r.Nombre,''),' ',COALESCE(r.Apellido,'')))),
        CAST(h.id_Residente AS CHAR)
      ) AS residente_label
    FROM horas_trabajo h
    LEFT JOIN residente r ON r.id_Residente = h.id_Residente
    WHERE 1=1
  ";

  $args = [];
  if ($rid > 0) { $sql .= " AND h.id_Residente=?"; $args[] = $rid; }

  if ($month >= 1 && $month <= 12 && $year >= 2000) {
    $start = sprintf('%04d-%02d-01', $year, $month);
    $end   = date('Y-m-d', strtotime("$start +1 month"));
    $sql  .= " AND h.Fecha >= ? AND h.Fecha < ?"; $args[] = $start; $args[] = $end;
  }

  $sql .= " ORDER BY h.id_Hora DESC LIMIT 500";
  $st = db()->prepare($sql);
  $st->execute($args);
  $items = $st->fetchAll();

  foreach ($items as &$it) {
    $mins = (int)$it['mins'];
    $it['h'] = intdiv($mins, 60);
    $it['m'] = $mins % 60;
  }

  json_ok(['items' => $items]);
}

  case 'hours_admin_eliminar': {
    require_admin();
    $r = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = (int)($r['id'] ?? 0);
    if (!$id) json_err(400,'BAD_REQUEST');
    db()->prepare("DELETE FROM horas_trabajo WHERE id_Hora=?")->execute([$id]);
    json_ok();
  }

  /* ---------- RESERVAS (usuario + utilidades) ---------- */

  // Crea una reserva de [desde ... hasta) con bloques de 30'
  case 'reservas_crear': {
    $rid = require_residente();
    $r = json_decode(file_get_contents('php://input'), true) ?: [];

    $espacio = (int)($r['espacio'] ?? 0);
    $fecha   = trim((string)($r['fecha']   ?? ''));
    $desde   = trim((string)($r['desde']   ?? ''));
    $hasta   = trim((string)($r['hasta']   ?? ''));

    if (!$espacio || $fecha==='' || $desde==='' || $hasta==='') json_err(400,'BAD_REQUEST');

    if (preg_match('/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/',$fecha,$m)) $fecha="$m[3]-$m[2]-$m[1]";
    if (!preg_match('/^\d{2}:\d{2}$/',$desde) || !preg_match('/^\d{2}:\d{2}$/',$hasta)) json_err(400,'BAD_REQUEST');
    if (strcmp($hasta,$desde) <= 0) json_err(400,'BAD_REQUEST',['message'=>'Rango inválido']);

    $st = db()->prepare("
      SELECT id
        FROM reservas
       WHERE id_Espacio=? AND Fecha=?
         AND NOT ( ? <= hora_inicio OR ? >= hora_fin )
       LIMIT 1
    ");
    $st->execute([$espacio,$fecha,$desde,$hasta]);
    if ($st->fetch()) json_err(409,'CONFLICT',['message'=>'Rango ocupado']);

    $ins = db()->prepare("
      INSERT INTO reservas (fecha, hora_inicio, hora_fin, id_Espacio, id_Residente, estado, creado_en)
      VALUES (?, ?, ?, ?, ?, 'pendiente', NOW())
    ");
    $ins->execute([$fecha,$desde,$hasta,$espacio,$rid]);

    json_ok(['id'=>(int)db()->lastInsertId(),'fecha'=>$fecha,'desde'=>$desde,'hasta'=>$hasta]);
  }

  // Lista las reservas del usuario logueado
  case 'reservas_mias': {
    $rid = require_residente();
    $st = db()->prepare("
      SELECT id, fecha, hora_inicio, hora_fin, estado, id_Espacio AS espacio_id
        FROM reservas
       WHERE id_Residente=?
       ORDER BY fecha DESC, hora_inicio DESC
       LIMIT 100
    ");
    $st->execute([$rid]);
    $items = $st->fetchAll();
    foreach($items as &$it){ $it['espacio']=''; }
    json_ok(['items'=>$items]);
  }

  // Marca ocupados los intervalos existentes de un día (para pintar busy)
  case 'reservas_disponibilidad': {
    $tok = bearer();
    $auth = admin_by_token($tok) || residente_by_token($tok);
    if (!$auth) json_err(401,'UNAUTHENTICATED');

    $espacio = (int)($_GET['espacio'] ?? 0);
    $fecha   = trim((string)($_GET['fecha']   ?? ''));
    if (!$espacio || $fecha==='') json_err(400,'BAD_REQUEST');
    if (preg_match('/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/',$fecha,$m)) $fecha="$m[3]-$m[2]-$m[1]";

    $st = db()->prepare("
      SELECT hora_inicio AS desde, hora_fin AS hasta
        FROM reservas
       WHERE id_Espacio=? AND Fecha=?
         AND (estado IN ('pendiente','aprobado') OR estado IS NULL)
       ORDER BY hora_inicio
    ");
    $st->execute([$espacio,$fecha]);
    json_ok(['busy'=>$st->fetchAll()]);
  }

  /* ---------- POSTULANTES (registro público + backoffice) ---------- */

  // Registro público → guarda en postulante
  case 'postulante_crear': {
    $r = json_decode(file_get_contents('php://input'), true) ?: [];

    $nombre   = trim((string)($r['nombre']   ?? ''));
    $apellido = trim((string)($r['apellido'] ?? ''));
    $correo   = trim((string)($r['correo']   ?? ''));
    $telefono = trim((string)($r['telefono'] ?? ''));
    $usuario  = trim((string)($r['usuario']  ?? ''));
    $pass     = (string)($r['password']      ?? '');

    if ($nombre==='' || $apellido==='' || $correo==='' || strlen($pass)<6) {
      json_err(400,'BAD_REQUEST',['message'=>'Completá nombre, apellido, correo y contraseña (>=6).']);
    }

    $hash = password_hash($pass, PASSWORD_BCRYPT);

    try {
      db()->prepare("
        INSERT INTO postulante
          (Usuario, Contrasena, Nombre, Apellido, Correo, Telefono, Fecha_Registro, id_Vivienda)
        VALUES (?,?,?,?,?,?, NOW(), NULL)
      ")->execute([$usuario,$hash,$nombre,$apellido,$correo,$telefono]);
    } catch(Throwable $e) {
      json_err(500,'SERVER_ERROR',['message'=>'No se pudo guardar la solicitud']);
    }

    json_ok(['id'=>(int)db()->lastInsertId()]);
  }

  // Backoffice: listar pendientes
  case 'admin_postulantes_listar': {
  require_admin();
  $st = db()->query("
    SELECT
      id_Postulante AS id,
      Usuario,
      Nombre,
      Apellido,
      Correo,
      Telefono,
      Fecha_Registro AS fecha,
      id_Vivienda,
      -- alias en minúsculas para compatibilidad con el front
      Nombre  AS nombre,
      Correo  AS correo,
      Usuario AS usuario
    FROM postulante
    ORDER BY id_Postulante DESC
    LIMIT 200
  ");
  $items = $st->fetchAll();
  json_ok(['items'=>$items]);
}

  // Backoffice: aprobar → mover a residente (y eliminar postulante)
  case 'admin_postulantes_aprobar': {
    require_admin();
    $r = json_decode(file_get_contents('php://input'), true) ?: [];
    $pid = (int)($r['id'] ?? 0);
    $cedula = trim((string)($r['cedula'] ?? '')); // opcional
    if ($pid<=0) json_err(400,'BAD_REQUEST');

    $pdo = db(); $pdo->beginTransaction();
    try{
      $q=$pdo->prepare("SELECT * FROM postulante WHERE id_Postulante=? FOR UPDATE");
      $q->execute([$pid]); $p=$q->fetch();
      if(!$p){ $pdo->rollBack(); json_err(404,'NOT_FOUND'); }

      $usuario = (string)($p['Usuario'] ?? 'usuario');
      $correo  = (string)($p['Correo'] ?? '');
      $nombre  = (string)($p['Nombre'] ?? '');
      $apellido= (string)($p['Apellido'] ?? '');
      $tel     = (string)($p['Telefono'] ?? '');
      $hash    = (string)($p['Contrasena'] ?? '');
      if ($hash==='') $hash = password_hash('fans123', PASSWORD_BCRYPT);

      // intento 1: tabla residente con columna Cedula
      $ok = false;
      try {
        $pdo->prepare("
          INSERT INTO residente
            (Usuario, Correo, Contrasena, Nombre, Apellido, Telefono, Cedula,
             Fecha_Ingreso, id_Vivienda, estado_aprobacion, fecha_registro)
          VALUES (?,?,?,?,?,?,?, CURDATE(), ?, 1, NOW())
        ")->execute([$usuario,$correo,$hash,$nombre,$apellido,$tel, ($cedula?:null), ($p['id_Vivienda'] ?? null)]);
        $ok = true;
      } catch(Throwable $e1){
        // intento 2: sin columna Cedula / otros esquemas
        $pdo->prepare("
          INSERT INTO residente
            (Usuario, Correo, Contrasena, Nombre, Apellido, Telefono,
             Fecha_Ingreso, id_Vivienda, estado_aprobacion, fecha_registro)
          VALUES (?,?,?,?,?,?, CURDATE(), ?, 1, NOW())
        ")->execute([$usuario,$correo,$hash,$nombre,$apellido,$tel, ($p['id_Vivienda'] ?? null)]);
        $ok = true;
      }

      if ($ok) {
        $pdo->prepare("DELETE FROM postulante WHERE id_Postulante=?")->execute([$pid]);
      }

      $pdo->commit();
      json_ok(['moved_to_residente'=>true]);
    }catch(Throwable $e){
      $pdo->rollBack();
      json_err(500,'SERVER_ERROR',['message'=>$e->getMessage()]);
    }
  }

  // Backoffice: rechazar
  case 'admin_postulantes_rechazar': {
    require_admin();
    $r = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = (int)($r['id'] ?? 0);
    if ($id<=0) json_err(400,'BAD_REQUEST');
    db()->prepare("DELETE FROM postulante WHERE id_Postulante=?")->execute([$id]);
    json_ok(['deleted'=>true]);
  }

  /* ---------- DEFAULT ---------- */
  default: json_err(400,'UNKNOWN_ACTION',['action'=>$action]);
}
} catch(Throwable $e){
  json_err(500,'SERVER_ERROR',['message'=>$e->getMessage()]);
}