<?php
ini_set('display_errors','0');
error_reporting(E_ALL & ~E_NOTICE);
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(200); exit; }
$action = $_GET["action"] ?? "";

function pdo(): PDO {
  static $pdo=null;
  if ($pdo) return $pdo;
  $pdo = new PDO("mysql:host=db;port=3306;dbname=fans_cooperativa;charset=utf8mb4", "root","root", [
    PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC
  ]);
  return $pdo;
}
$db = pdo();

function j($arr,$code=200){
  header("Content-Type: application/json; charset=utf-8");
  http_response_code($code);
  echo json_encode($arr,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
  exit;
}
function tableExists(PDO $db,$name){
  $s=$db->prepare("SHOW TABLES LIKE ?");
  $s->execute([$name]);
  return (bool)$s->fetch();
}
function hasColumn(PDO $db,$t,$c){
  try{
    $s=$db->prepare("SHOW COLUMNS FROM `$t` LIKE ?");
    $s->execute([$c]);
    return (bool)$s->fetch();
  } catch(Throwable $e){ return false; }
}
function pick_col(PDO $db,string $table,array $cands){ foreach($cands as $c){ if(hasColumn($db,$table,$c)) return $c; } return null; }
function req(): array { static $cache=null; if($cache!==null) return $cache; $json=json_decode(file_get_contents('php://input'),true)?:[]; return $cache=array_merge($_POST??[],$json); }
function starts_with($s,$p){ return substr($s,0,strlen($p))===$p; }

function ensureAuthTables(PDO $db){
  $db->exec("CREATE TABLE IF NOT EXISTS auth_tokens(
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    user_role VARCHAR(16) NOT NULL DEFAULT 'residente',
    token_hash CHAR(64) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NULL,
    INDEX token_idx (token_hash),
    INDEX user_idx (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
}
function tokenColumn(PDO $db){
  return hasColumn($db,"auth_tokens","token") ? "token" : "token_hash";
}
function resolve_role(PDO $db, int $uid): string {
  foreach (['administrador','Administrador','administrator','Administrator'] as $t){
    if (tableExists($db,$t)) {
      $idCol = pick_col($db,$t,["id_Administrador","Id_Administrador","id_Administrator","Id_Administrator","id","Id"]);
      if($idCol){
        $st=$db->prepare("SELECT 1 FROM `$t` WHERE `$idCol`=? LIMIT 1");
        $st->execute([$uid]); if ($st->fetchColumn()) return 'admin';
      }
    }
  }
  foreach (['residente','Residente'] as $t){
    if (tableExists($db,$t)) {
      $idCol = pick_col($db,$t,["id_Residente","Id_Residente","id","Id"]);
      if($idCol){
        $st=$db->prepare("SELECT 1 FROM `$t` WHERE `$idCol`=? LIMIT 1");
        $st->execute([$uid]); if ($st->fetchColumn()) return 'residente';
      }
    }
  }
  return 'residente';
}
function authOrFail(PDO $db){
  ensureAuthTables($db);
  $auth = $_SERVER["HTTP_AUTHORIZATION"] ?? "";
  $tok = null;
  if (preg_match("/Bearer\s+([A-Fa-f0-9]{64})/",$auth,$m)) { $tok=$m[1]; }
  else {
    $q = $_GET['token'] ?? '';
    if (preg_match('/^[A-Fa-f0-9]{64}$/',$q)) $tok = $q;
  }
  if (!$tok) j(["ok"=>false,"error"=>"no token"],401);
  $col = tokenColumn($db);
  $st  = $db->prepare("SELECT user_id FROM auth_tokens WHERE `$col`=? AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1");
  $st->execute([$tok]);
  $row = $st->fetch();
  if(!$row) j(["ok"=>false,"error"=>"token inválido"],401);
  $uid  = (int)$row['user_id'];
  $role = resolve_role($db,$uid);
  return ['user_id'=>$uid,'user_role'=>$role,'token'=>$tok];
}

// === RESERVAS ===
try{
switch($action){
case 'reservas_listar_admin': {
  $st = $db->query("SELECT * FROM reservas ORDER BY Fecha DESC, Hora_Inicio DESC");
  j(['ok'=>true,'rows'=>$st->fetchAll()]);
}
case 'reservas_listar_fecha': {
  $fecha   = $_GET['fecha'] ?? null;
  $espacio = $_GET['espacio'] ?? 'Salón de eventos';
  if(!$fecha) j(['ok'=>false,'error'=>'faltan_campos'],400);
  $st = $db->prepare("SELECT Hora_Inicio, Hora_Fin, Estado FROM reservas WHERE Fecha=? AND Espacio=?");
  $st->execute([$fecha,$espacio]);
  j(['ok'=>true,'rows'=>$st->fetchAll()]);
}
case 'reservas_solicitar': {
  $t = authOrFail($db);
  $b = req();
  $idRes  = $b['id_Residente'] ?? $b['id_residente'] ?? null;
  if(!$idRes) $idRes = ($t['user_role']==='residente') ? $t['user_id'] : null;

  $espacio= $b['espacio'] ?? 'Salón de eventos';
  $fecha  = $b['fecha'] ?? null;
  $hIni   = $b['hora_inicio'] ?? null;
  $hFin   = $b['hora_fin'] ?? null;

  if(!$idRes || !$fecha || !$hIni || !$hFin) j(['ok'=>false,'error'=>'faltan_campos'],400);

  $q = $db->prepare("SELECT COUNT(*) FROM reservas WHERE Fecha=? AND Espacio=? AND NOT (Hora_Fin<=? OR Hora_Inicio>=?)");
  $q->execute([$fecha,$espacio,$hIni,$hFin]);
  if($q->fetchColumn()>0) j(['ok'=>false,'error'=>'horario_ocupado'],409);

  $ins=$db->prepare("INSERT INTO reservas (id_Residente,Espacio,Fecha,Hora_Inicio,Hora_Fin,Estado,created_at)
                     VALUES (?,?,?,?,?,'Pendiente',CURRENT_TIMESTAMP)");
  $ins->execute([$idRes,$espacio,$fecha,$hIni,$hFin]);
  j(['ok'=>true,'id'=>$db->lastInsertId()]);
}
case 'admin_reservas_aprobar': {
  $t=authOrFail($db); if($t['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
  $b = req(); $id = (int)($b['id_Reserva'] ?? $b['id'] ?? $b['ID'] ?? 0);
  if(!$id) j(['ok'=>false,'error'=>'BAD_INPUT'],422);
  $db->prepare("UPDATE reservas SET Estado='Aprobado' WHERE id_Reserva=?")->execute([$id]);
  j(['ok'=>true]);
}
case 'admin_reservas_rechazar': {
  $t=authOrFail($db); if($t['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
  $b = req(); $id = (int)($b['id_Reserva'] ?? $b['id'] ?? $b['ID'] ?? 0);
  if(!$id) j(['ok'=>false,'error'=>'BAD_INPUT'],422);
  $db->prepare("UPDATE reservas SET Estado='Rechazado' WHERE id_Reserva=?")->execute([$id]);
  j(['ok'=>true]);
}
case 'admin_reservas_marcar_ocupado': {
  $t=authOrFail($db); if($t['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
  $R = req();
  $id   = (int)($R['id_Reserva'] ?? $R['id'] ?? $R['ID'] ?? 0);
  $ocup = (int)($R['ocupado'] ?? $R['Ocupado'] ?? 0);
  if(!$id) j(['ok'=>false,'error'=>'BAD_INPUT'],422);

  $pk = hasColumn($db,'reservas','id_Reserva') ? 'id_Reserva' :
        (hasColumn($db,'reservas','id') ? 'id' : null);
  if(!$pk) j(['ok'=>false,'error'=>'schema_reservas_sin_pk'],500);

  $colO = hasColumn($db,'reservas','Ocupado') ? 'Ocupado' :
          (hasColumn($db,'reservas','ocupado') ? 'ocupado' : null);
  if(!$colO){
    $db->exec("ALTER TABLE reservas ADD COLUMN Ocupado TINYINT(1) NOT NULL DEFAULT 0");
    $colO = 'Ocupado';
  }

  $st = $db->prepare("UPDATE reservas SET `$colO`=? WHERE `$pk`=?");
  $st->execute([$ocup,$id]);
  j(['ok'=>true]);
}
default: j(["ok"=>true,"pong"=>true]);
}} catch(Throwable $e){ j(["ok"=>false,"error"=>"DB","detail"=>$e->getMessage()],500); }
