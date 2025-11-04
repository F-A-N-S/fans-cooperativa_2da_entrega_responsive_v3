<?php
// ===== Bootstrap =====
ini_set('display_errors','0');
error_reporting(E_ALL & ~E_NOTICE);
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(200); exit; }
$action = $_GET["action"] ?? "";

// ===== Conexión =====
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

if (!function_exists('require_admin')) {
  function require_admin() { /* TODO: validar token/rol si querés endurecer */ return true; }
}

// ===== Utils =====
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
    if(!tableExists($db,$t)) return false;
    $s=$db->prepare("SHOW COLUMNS FROM `$t` LIKE ?");
    $s->execute([$c]);
    return (bool)$s->fetch();
  } catch(Throwable $e){ return false; }
}
function pick_col(PDO $db,string $table,array $cands){ foreach($cands as $c){ if(hasColumn($db,$table,$c)) return $c; } return null; }
function req(): array { static $cache=null; if($cache!==null) return $cache; $json=json_decode(file_get_contents('php://input'),true)?:[]; return $cache=array_merge($_POST??[],$json); }
function starts_with($s,$p){ return substr($s,0,strlen($p))===$p; }

// ===== Seguridad / Passwords =====
function verify_any_password($plain,$stored){
  $stored = rtrim((string)$stored);
  if ($stored==='') return false;
  if (starts_with($stored,'$2y$')||starts_with($stored,'$2a$')||starts_with($stored,'$argon2')||starts_with($stored,'$P$')||starts_with($stored,'$S$')) return password_verify($plain,$stored);
  if (preg_match('/^[a-f0-9]{32}$/i',$stored)) return strtolower($stored)===md5($plain);
  if (preg_match('/^[a-f0-9]{40}$/i',$stored)) return strtolower($stored)===sha1($plain);
  if (strlen($stored)===13 || starts_with($stored,'_') || starts_with($stored,'$1$')) return hash_equals(crypt($plain,$stored),$stored);
  return hash_equals($stored,$plain);
}
function debug_alg($h){
  if (starts_with($h,'$2y$')||starts_with($h,'$2a$')) return 'bcrypt';
  if (starts_with($h,'$argon2')) return 'argon2';
  if (starts_with($h,'$P$')||starts_with($h,'$S$')) return 'phpass';
  if (preg_match('/^[a-f0-9]{32}$/i',$h)) return 'md5';
  if (preg_match('/^[a-f0-9]{40}$/i',$h)) return 'sha1';
  if (strlen($h)===13 || starts_with($h,'_') || starts_with($h,'$1$')) return 'crypt';
  return 'plain/otro';
}

// ===== Infra de tokens =====
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

// ===== Helpers de tablas/rol =====
function adminTable(PDO $db){
  foreach(['administrador','Administrador','administrator','Administrator'] as $t){ if(tableExists($db,$t)) return $t; }
  return null;
}
function residente_table(PDO $db){
  if (tableExists($db,'residente')) return 'residente';
  if (tableExists($db,'Residente')) return 'Residente';
  return null;
}
function residente_exists(PDO $db, int $id): bool {
  $t = residente_table($db); if(!$t || $id<=0) return false;
  $st = $db->prepare("SELECT 1 FROM `$t` WHERE id_Residente=? LIMIT 1");
  $st->execute([$id]);
  return (bool)$st->fetchColumn();
}
function admin_email(PDO $db, int $adminId): ?string {
  foreach (['administrador','Administrador'] as $t) {
    if (tableExists($db,$t)) {
      $st=$db->prepare("SELECT Correo FROM `$t` WHERE id_Administrador=? LIMIT 1");
      $st->execute([$adminId]);
      if ($x=$st->fetch()) return $x['Correo'] ?? null;
    }
  }
  return null;
}
function residente_id_by_email(PDO $db, string $email): ?int {
  $t = residente_table($db); if(!$t) return null;
  foreach (['Correo','Email','correo','email'] as $c) {
    if (hasColumn($db,$t,$c)) {
      $st=$db->prepare("SELECT id_Residente FROM `$t` WHERE LOWER(TRIM(`$c`))=LOWER(TRIM(?)) LIMIT 1");
      $st->execute([$email]);
      if ($r=$st->fetch()) return (int)$r['id_Residente'];
    }
  }
  return null;
}
/** id_Residente efectivo para acciones “de residente” */
function effective_residente_id(PDO $db, array $auth, array $payload): int {
  if ($auth['user_role']==='residente') return (int)$auth['user_id'];
  $id = (int)($payload['id_residente'] ?? $payload['residente_id'] ?? 0);
  if ($id>0 && residente_exists($db,$id)) return $id;
  $admMail = admin_email($db, (int)$auth['user_id']);
  if ($admMail) {
    $rid = residente_id_by_email($db, $admMail);
    if ($rid && residente_exists($db,$rid)) return $rid;
  }
  return 0;
}

// ===== Descubridores de usuarios =====
function find_user_anywhere(PDO $db, string $email){
  $email = strtolower(trim($email));
  if ($email==='') return null;
  $tables=[];
  foreach (['administrador','Administrador','administrator','Administrator','residente','Residente'] as $t){
    if (tableExists($db,$t)) $tables[]=$t;
  }
  if (!$tables) return null;

  $emailCols=["Correo","Email","CorreoElectronico","correo_electronico","mail","email"];
  $pwdCols  =["Contrasena","Password","password","clave","pass","pwd","hash"];
  $idCols   =["id_Administrador","Id_Administrador","id_Administrator","Id_Administrator","id_Residente","Id_Residente","id","Id"];
  $apCols   =["estado_aprobacion","Aprobado","EstadoAprobacion","Estado","aprobado"];

  foreach($tables as $t){
    $eCols=[]; foreach($emailCols as $c){ if(hasColumn($db,$t,$c)) $eCols[]=$c; }
    if(!$eCols) continue;
    $pwdCol=null; foreach($pwdCols as $c){ if(hasColumn($db,$t,$c)){ $pwdCol=$c; break; } }
    $idCol=null;  foreach($idCols  as $c){ if(hasColumn($db,$t,$c)){ $idCol=$c;  break; } }
    $apCol=null;  foreach($apCols  as $c){ if(hasColumn($db,$t,$c)){ $apCol=$c;  break; } }
    $parts=[]; $params=[];
    foreach($eCols as $c){ $parts[]="LOWER(TRIM(`$c`))=LOWER(TRIM(?))"; $params[]=$email; }
    $sql="SELECT * FROM `$t` WHERE ".implode(" OR ",$parts)." LIMIT 1";
    $st=$db->prepare($sql); $st->execute($params);
    if($row=$st->fetch()){
      return [
        "table"=>$t, "email_col"=>$eCols[0], "pwd_col"=>$pwdCol, "id_col"=>$idCol, "ap_col"=>$apCol,
        "row"=>$row, "pwd"=>$pwdCol? (string)($row[$pwdCol]??'') : '', "id"=>$idCol? (int)($row[$idCol]??0):0,
        "approved"=>($apCol && isset($row[$apCol]))? (int)$row[$apCol] : 1
      ];
    }
  }
  return null;
}
function find_user_by_login(PDO $db, string $login){
  $login = trim(strtolower($login));
  if ($login === '') return null;

  $tables = [];
  foreach (['administrador','Administrador','administrator','Administrator','residente','Residente'] as $t) {
    if (tableExists($db,$t)) $tables[] = $t;
  }
  if (!$tables) return null;

  $emailCols = ["Correo","Email","CorreoElectronico","correo_electronico","mail","email"];
  $userCols  = ["Usuario","usuario","username","login"];
  $pwdCols   = ["Contrasena","Password","password","clave","pass","pwd","hash"];
  $idCols    = ["id_Administrador","Id_Administrador","id_Administrator","Id_Administrator","id_Residente","Id_Residente","id","Id"];
  $apCols    = ["estado_aprobacion","Aprobado","EstadoAprobacion","Estado","aprobado"];

  foreach($tables as $t){
    $eCols=[]; foreach($emailCols as $c){ if(hasColumn($db,$t,$c)) $eCols[]=$c; }
    $uCols=[]; foreach($userCols  as $c){ if(hasColumn($db,$t,$c)) $uCols[]=$c; }
    if(!$eCols && !$uCols) continue;
    $pwdCol=null; foreach($pwdCols as $c){ if(hasColumn($db,$t,$c)){ $pwdCol=$c; break; } }
    $idCol=null;  foreach($idCols  as $c){ if(hasColumn($db,$t,$c)){ $idCol=$c;  break; } }
    $apCol=null;  foreach($apCols  as $c){ if(hasColumn($db,$t,$c)){ $apCol=$c;  break; } }

    $parts=[]; $params=[];
    foreach($eCols as $c){ $parts[]="LOWER(TRIM(`$c`))=LOWER(TRIM(?))"; $params[]=$login; }
    foreach($uCols as $c){ $parts[]="LOWER(TRIM(`$c`))=LOWER(TRIM(?))"; $params[]=$login; }
    $sql="SELECT * FROM `$t` WHERE ".implode(' OR ',$parts)." LIMIT 1";
    $st=$db->prepare($sql); $st->execute($params);
    if($row=$st->fetch()){
      return [
        'table'=>$t, 'row'=>$row,
        'pwd'=> $pwdCol ? (string)($row[$pwdCol]??'') : '',
        'id' => $idCol  ? (int)($row[$idCol] ?? 0) : 0,
        'id_col'=>$idCol,
        'email_col'=> $eCols ? $eCols[0] : null,
        'user_col' => $uCols ? $uCols[0] : null,
        'ap_col'   => $apCol
      ];
    }
  }
  return null;
}

// ===== Reclamos helpers =====
function reclamos_schema(PDO $db): array {
  $tbl = "reclamos"; if (!tableExists($db,$tbl)) return [];
  return [
    "tbl"=>$tbl,
    "idRes"=> pick_col($db,$tbl,["id_Residente","id_residente","user_id","id_usuario","residente_id"]),
    "asunto"=> pick_col($db,$tbl,["Asunto","asunto","titulo","subject"]),
    "desc"=> pick_col($db,$tbl,["Descripcion","descripcion","detalle","description"]),
    "estado"=> pick_col($db,$tbl,["Estado","estado","status"]),
    "fecha"=> pick_col($db,$tbl,["Fecha","fecha","created_at","creado"]),
    "prior"=> pick_col($db,$tbl,["Prioridad","prioridad","priority"]),
    "pk"=> pick_col($db,$tbl,["Id_Reclamo","id_reclamo","IdReclamo","id","ID"])
  ];
}

// ===== Comunicados helpers =====
function ensureComunicadosTable(PDO $db){
  if (tableExists($db,'comunicados') || tableExists($db,'anuncios')) return;
  $db->exec("CREATE TABLE IF NOT EXISTS comunicados(
    ID INT AUTO_INCREMENT PRIMARY KEY,
    Titulo VARCHAR(255) NOT NULL,
    Contenido TEXT NOT NULL,
    Fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Destinatario VARCHAR(255) NULL,
    id_Administrador INT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
}
function comunicados_schema(PDO $db): array {
  ensureComunicadosTable($db);
  $tbl = tableExists($db,'comunicados') ? 'comunicados'
       : (tableExists($db,'anuncios') ? 'anuncios' : 'comunicados');
  $colTitulo = pick_col($db,$tbl,['Titulo','titulo','title','Title']);
  $colCuerpo = pick_col($db,$tbl,['Contenido','contenido','cuerpo','Cuerpo','texto','text','body']);
  $colFecha  = pick_col($db,$tbl,['Fecha','fecha','created_at','Publicado','publicado','createdAt']);
  $colDest   = pick_col($db,$tbl,['Destinatario','destinatario','audiencia','audience']);
  $colAutor  = pick_col($db,$tbl,['id_Administrador','author_id','admin_id']);
  $colPk     = pick_col($db,$tbl,['Id_Aviso','ID','id']);
  return ['tbl'=>$tbl,'titulo'=>$colTitulo?:'Titulo','cuerpo'=>$colCuerpo?:'Contenido','fecha'=>$colFecha?:'Fecha','dest'=>$colDest,'autor'=>$colAutor,'pk'=>$colPk?:'ID'];
}
function announcements_list(PDO $db){
  $s = comunicados_schema($db);
  $sql = "SELECT `{$s['pk']}` AS ID, `{$s['titulo']}` AS Titulo, `{$s['cuerpo']}` AS Contenido, `{$s['fecha']}` AS Fecha,
                 ".($s['dest']?"`{$s['dest']}`":"NULL")." AS Destinatario,
                 ".($s['autor']?"`{$s['autor']}`":"NULL")." AS id_Administrador
          FROM `{$s['tbl']}` ORDER BY `{$s['fecha']}` DESC, `{$s['pk']}` DESC LIMIT 50";
  $rows = $db->query($sql)->fetchAll();
  j(['ok'=>true,'rows'=>$rows,'items'=>$rows]);
}
function announcements_create(PDO $db){
  $me = authOrFail($db);
  if ($me['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
  $s=comunicados_schema($db);
  $r=req();
  $titulo = trim($r['Titulo']??$r['titulo']??'');
  $cuerpo = trim($r['Contenido']??$r['contenido']??$r['cuerpo']??'');
  $dest   = trim($r['Destinatario']??$r['destinatario']??'');
  if($titulo===''||$cuerpo==='') j(['ok'=>false,'error'=>'faltan_campos'],422);
  $cols = ["`{$s['titulo']}`","`{$s['cuerpo']}`"];
  $vals = ["?","?"]; $par=[$titulo,$cuerpo];
  if ($s['dest']) { $cols[]="`{$s['dest']}`"; $vals[]="?"; $par[] = ($dest!==''?$dest:null); }
  if ($s['autor']){ $cols[]="`{$s['autor']}`"; $vals[]="?"; $par[] = (int)$me['user_id']; }
  $sql="INSERT INTO `{$s['tbl']}` (".implode(",",$cols).") VALUES (".implode(",",$vals).")";
  $st=$db->prepare($sql); $st->execute($par);
  j(['ok'=>true,'id'=>$db->lastInsertId()]);
}

// ===== Auth / rol =====
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
  if (preg_match("/Bearer\\s+([A-Fa-f0-9]{64})/",$auth,$m)) { $tok=$m[1]; }
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

// ===== Router =====
try{
switch($action){

// --- Diagnóstico
case "login_probe": {
  $p=req(); $email=strtolower(trim($p["email"]??"")); $test=(string)($p["test_pass"]??"");
  if($email==="") j(["ok"=>false,"error"=>"Falta email"],400);
  $u=find_user_anywhere($db,$email);
  if(!$u) j(["ok"=>false,"error"=>"No se encontró el email en DB"],404);
  $pwd=(string)$u["pwd"]; $info=[
    "ok"=>true,"table"=>$u["table"],"email_col"=>$u["email_col"],"pwd_col"=>$u["pwd_col"],
    "id_col"=>$u["id_col"],"ap_col"=>$u["ap_col"],
    "id"=>$u["id"],"approved"=>$u["approved"],
    "pwd_len"=>strlen($pwd),"pwd_prefix"=>substr($pwd,0,6),"pwd_alg"=>debug_alg($pwd)
  ];
  if($test!=="") $info["verify_with_test_pass"]=verify_any_password($test,$pwd);
  j($info);
}

// --- Login / Me ---
case "login": {
  ensureAuthTables($db);
  $r=req();
  $login = trim((string)($r['email'] ?? $r['usuario'] ?? $r['user'] ?? $r['login'] ?? ''));
  $pass  = (string)($r['password'] ?? $r['contrasena'] ?? $r['pass'] ?? '');
  if ($login==='' || $pass==='') j(["ok"=>false,"error"=>"Faltan credenciales"],400);

  $u=find_user_by_login($db,$login);
  if(!$u) j(["ok"=>false,"error"=>"Usuario no encontrado"],401);
  if(!verify_any_password($pass,$u['pwd'])) j(["ok"=>false,"error"=>"Credenciales inválidas"],401);

  $uid  = (int)($u['id'] ?? 0);
  if($uid<=0) j(["ok"=>false,"error"=>"ID inválido"],500);

  $role_guess = (stripos($u['table'],'admin')!==false) ? 'admin' : resolve_role($db,$uid);
  if ($role_guess!=='admin') {
    $apCol = $u['ap_col'];
    $isApproved = ($apCol && isset($u['row'][$apCol])) ? (int)$u['row'][$apCol] : 1;
    if ($isApproved===0) j(["ok"=>false,"error"=>"Usuario no aprobado"],403);
  }
  $role = $role_guess;

  $token   = bin2hex(random_bytes(32));
  $tokCol  = tokenColumn($db);
  $hasRole = hasColumn($db,"auth_tokens","user_role");

  if ($hasRole) {
    $st=$db->prepare("INSERT INTO auth_tokens (user_id,user_role,`$tokCol`,expires_at) VALUES (?,?,?,DATE_ADD(NOW(), INTERVAL 12 HOUR))");
    $st->execute([$uid,$role,$token]);
  } else {
    $st=$db->prepare("INSERT INTO auth_tokens (user_id,`$tokCol`,expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 12 HOUR))");
    $st->execute([$uid,$token]);
  }

  j(["ok"=>true,"token"=>$token,"role"=>$role]);
}

case "me": {
  $t=authOrFail($db);
  $admT = adminTable($db);
  $resT = residente_table($db);

  if ($t["user_role"]==="admin" && $admT) {
    $idCol = pick_col($db,$admT,["id_Administrador","Id_Administrador","id_Administrator","Id_Administrator","id","Id"]);
    $nom = pick_col($db,$admT,["Nombre","nombre"]); $ape = pick_col($db,$admT,["Apellido","apellido"]);
    $mail= pick_col($db,$admT,["Correo","Email","correo","email"]);
    $ap  = pick_col($db,$admT,["estado_aprobacion","Aprobado","Estado"]);
    $st = $db->prepare("SELECT `$idCol` AS id, `$nom` AS Nombre, `$ape` AS Apellido, `$mail` AS Correo, ".($ap?"`$ap`":"1")." AS estado_aprobacion FROM `$admT` WHERE `$idCol`=? LIMIT 1");
    $st->execute([$t["user_id"]]); $r=$st->fetch()?:[];
    j(["ok"=>true,"user"=>[
      "id"     => (int)($r["id"]??$t["user_id"]),
      "role"   => "admin",
      "status" => ((int)($r["estado_aprobacion"]??1)===1 ? "aprobado":"pendiente"),
      "nombre" => trim(($r["Nombre"]??'').' '.($r["Apellido"]??'')),
      "correo" => $r["Correo"]??null
    ]]);
  } else if ($resT) {
    $idCol = pick_col($db,$resT,["id_Residente","Id_Residente","id","Id"]);
    $nom = pick_col($db,$resT,["Nombre","nombre"]); $ape = pick_col($db,$resT,["Apellido","apellido"]);
    $mail= pick_col($db,$resT,["Correo","Email","correo","email"]);
    $tel = pick_col($db,$resT,["Telefono","telefono"]);
    $ced = pick_col($db,$resT,["Cedula","cedula","CI","ci"]);
    $fec = pick_col($db,$resT,["Fecha_Ingreso","fecha_ingreso","Fecha","fecha"]);
    $ap  = pick_col($db,$resT,["estado_aprobacion","Aprobado","Estado"]);
    $st = $db->prepare("SELECT `$idCol` AS id, `$nom` AS Nombre, `$ape` AS Apellido, `$mail` AS Correo, `$tel` AS Telefono, `$ced` AS Cedula, `$fec` AS Fecha_Ingreso, ".($ap?"`$ap`":"1")." AS estado_aprobacion FROM `$resT` WHERE `$idCol`=? LIMIT 1");
    $st->execute([$t["user_id"]]); $r=$st->fetch()?:[];
    j(["ok"=>true,"user"=>[
      "id"     => (int)($r["id"]??$t["user_id"]),
      "role"   => "residente",
      "status" => ((int)($r["estado_aprobacion"]??1)===1 ? "aprobado":"pendiente"),
      "nombre" => trim(($r["Nombre"]??'').' '.($r["Apellido"]??'')),
      "correo" => $r["Correo"]??null,
      "telefono"=>$r["Telefono"]??null,
      "cedula"  =>$r["Cedula"]??null,
      "fecha_ingreso"=>$r["Fecha_Ingreso"]??null
    ]]);
  } else {
    j(["ok"=>false,"error"=>"Tablas de usuarios no encontradas"],500);
  }
}

// --- SSO al Backoffice ---
case 'admin_sso': {
  $t = authOrFail($db);
  if ($t['user_role'] !== 'admin') { http_response_code(403); echo 'forbidden'; exit; }
  $admT = adminTable($db); if(!$admT){ http_response_code(500); echo 'no admin table'; exit; }
  $idCol = pick_col($db,$admT,["id_Administrador","Id_Administrador","id_Administrator","Id_Administrator","id","Id"]);
  $mail = pick_col($db,$admT,["Correo","Email","correo","email"]);
  $nom  = pick_col($db,$admT,["Nombre","nombre"]); $ape = pick_col($db,$admT,["Apellido","apellido"]);
  $st = $db->prepare("SELECT `$mail` AS Correo, `$nom` AS Nombre, `$ape` AS Apellido FROM `$admT` WHERE `$idCol`=?");
  $st->execute([$t['user_id']]); $a = $st->fetch() ?: [];
  @session_start();
  $_SESSION['admin_id']    = (int)$t['user_id'];
  $_SESSION['admin_email'] = $a['Correo'] ?? null;
  $_SESSION['admin_name']  = trim(($a['Nombre'] ?? '').' '.($a['Apellido'] ?? ''));
  header("Location: /backoffice/index.php");
  exit;
}
case 'admin_sso_from_token': {
  ensureAuthTables($db);
  $tok = $_GET['token'] ?? '';
  if (!preg_match('/^[A-Fa-f0-9]{64}$/',$tok)) { http_response_code(400); echo 'bad token'; exit; }
  $tokCol = tokenColumn($db);
  $st=$db->prepare("SELECT user_id FROM auth_tokens WHERE `$tokCol`=? AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1");
  $st->execute([$tok]); $row=$st->fetch();
  if(!$row){ http_response_code(401); echo 'invalid token'; exit; }
  $uid=(int)$row['user_id'];
  $admT = adminTable($db); if(!$admT){ http_response_code(403); echo 'not admin'; exit; }
  $idCol = pick_col($db,$admT,["id_Administrador","Id_Administrador","id_Administrator","Id_Administrator","id","Id"]);
  $mail = pick_col($db,$admT,["Correo","Email","correo","email"]);
  $nom  = pick_col($db,$admT,["Nombre","nombre"]); $ape = pick_col($db,$admT,["Apellido","apellido"]);
  $st=$db->prepare("SELECT `$mail` AS Correo, `$nom` AS Nombre, `$ape` AS Apellido FROM `$admT` WHERE `$idCol`=?");
  $st->execute([$uid]); $a=$st->fetch();
  if(!$a){ http_response_code(403); echo 'not admin'; exit; }
  @session_start();
  $_SESSION['admin_id']    = $uid;
  $_SESSION['admin_email'] = $a['Correo'] ?? null;
  $_SESSION['admin_name']  = trim(($a['Nombre'] ?? '').' '.($a['Apellido'] ?? ''));
  header("Location: /backoffice/index.php");
  exit;
}

// --- Comprobantes ---
case "list_receipts": {
  $t=authOrFail($db);
  $tbl = tableExists($db,"comprobantes_pago") ? "comprobantes_pago" : (tableExists($db,"comprobante") ? "comprobante" : null);
  if(!$tbl) j(["ok"=>true,"rows"=>[]]);

  $colIdRes  = pick_col($db,$tbl,["id_Residente","id_residente","Residente_id","IdResidente","user_id","id_usuario"]);
  $colTipo   = pick_col($db,$tbl,["Tipo","tipo","Tipo_Comprobante","TipoComprobante","Concepto","Servicio"]);
  $colFecha  = pick_col($db,$tbl,["Fecha","fecha","Fecha_Pago","FechaComprobante","FecPago","Fecha_Subida","created_at"]);
  $colEstado = pick_col($db,$tbl,["Estado","estado","Estado_Comprobante","Aprobado","Situacion"]);
  $colArchivo= pick_col($db,$tbl,["Archivo","archivo","Ruta","Ruta_Archivo","FilePath","ArchivoURL","Url"]);
  $colPk     = pick_col($db,$tbl,["id_Comprobante","id_comprobante","id","ID","numero"]);

  $id = isset($_GET["id_residente"]) ? (int)$_GET["id_residente"] : (int)$t["user_id"];
  if($t["user_role"]!=="admin") $id=(int)$t["user_id"];

  $fields=[];
  if ($colTipo)    $fields[]="`$colTipo`   AS Tipo";
  if ($colFecha)   $fields[]="`$colFecha`  AS Fecha";
  if ($colEstado)  $fields[]="`$colEstado` AS Estado";
  if ($colArchivo) $fields[]="`$colArchivo` AS Archivo";
  if (!$fields) $fields[]="1 AS dummy";

  $order = $colFecha ? "ORDER BY `$colFecha` DESC".($colPk?", `$colPk` DESC":"") : ($colPk ? "ORDER BY `$colPk` DESC" : "");
  $sql="SELECT ".implode(", ",$fields)." FROM `$tbl` WHERE `$colIdRes`=? $order";
  $st=$db->prepare($sql); $st->execute([$id]); j(["ok"=>true,"rows"=>$st->fetchAll()]);
}
case "upload_receipt": {
  $t=authOrFail($db);
  $tbl = tableExists($db,"comprobantes_pago") ? "comprobantes_pago" : (tableExists($db,"comprobante") ? "comprobante" : null);
  if(!$tbl) j(["ok"=>false,"error"=>"Tabla comprobantes no encontrada"],500);

  $rid = effective_residente_id($db,$t,$_POST);
  if ($rid<=0) j(["ok"=>false,"error"=>"id_residente_no_encontrado","message"=>"Como admin, pasá id_residente o creá un Residente con el mismo email."],422);
  $id_res = $rid;
  if($t["user_role"]!=="admin") $id_res=(int)$t["user_id"];
  if($id_res<=0) j(["ok"=>false,"error"=>"id_residente inválido"],400);
  if(!residente_exists($db,$id_res)) j(["ok"=>false,"error"=>"id_residente_no_existe","message"=>"El id_residente ($id_res) no existe en residente.id_Residente"],422);

  $tipo  = trim($_POST["tipo"]  ?? $_POST["Tipo"]  ?? "");
  $fecha = trim($_POST["fecha"] ?? $_POST["Fecha"] ?? "");
  if ($fecha && preg_match('#^(\d{2})/(\d{2})/(\d{4})$#',$fecha,$m)) $fecha = "{$m[3]}-{$m[2]}-{$m[1]}";
  $monto = $_POST["monto"] ?? null;

  $f = $_FILES["archivo"] ?? $_FILES["file"] ?? $_FILES["comprobante"] ?? null;
  if(!$f || empty($f["tmp_name"])) j(["ok"=>false,"error"=>"Falta archivo"],400);
  if($f["error"]!==UPLOAD_ERR_OK) j(["ok"=>false,"error"=>"Error de subida"],400);
  if($f["size"]>5*1024*1024) j(["ok"=>false,"error"=>"Archivo > 5MB"],400);
  $ext=strtolower(pathinfo($f["name"],PATHINFO_EXTENSION));
  if(!in_array($ext,["jpg","jpeg","png","pdf"])) j(["ok"=>false,"error"=>"Formato no permitido"],400);

  $colIdRes  = pick_col($db,$tbl,["id_Residente","id_residente","Residente_id","IdResidente","user_id","id_usuario"]);
  $colTipo   = pick_col($db,$tbl,["Tipo","tipo","Tipo_Comprobante","TipoComprobante","Concepto","Servicio"]);
  $colFecha  = pick_col($db,$tbl,["Fecha","fecha","Fecha_Pago","FechaComprobante","FecPago"]);
  $colMonto  = pick_col($db,$tbl,["Monto","monto","Importe","Total","Valor"]);
  $colEstado = pick_col($db,$tbl,["Estado","estado","Estado_Comprobante","Aprobado","Situacion"]);
  $colArchivo= pick_col($db,$tbl,["Archivo","archivo","Ruta","Ruta_Archivo","FilePath","ArchivoURL","Url"]);
  if(!$colIdRes || !$colTipo || !$colFecha || !$colArchivo) j(["ok"=>false,"error"=>"Tabla incompleta (tipo/fecha/archivo)"],500);

  $dir=__DIR__."/../uploads/comprobantes"; if(!is_dir($dir)) @mkdir($dir,0777,true);
  $name="comp_".time()."_".bin2hex(random_bytes(8)).".$ext"; $abs="$dir/$name";
  if(!move_uploaded_file($f["tmp_name"],$abs)) j(["ok"=>false,"error"=>"No se pudo mover el archivo"],500);
  $rel="uploads/comprobantes/$name";

  $set=["`$colIdRes`=?","`$colTipo`=?","`$colFecha`=?","`$colArchivo`=?"];
  $params=[$id_res,$tipo,$fecha,$rel];
  if($colMonto && $monto!==""){ $set[]="`$colMonto`=?"; $params[]=$monto; }
  if($colEstado){ $set[]="`$colEstado`=?"; $params[]="Pendiente"; }

  $sql="INSERT INTO `$tbl` SET ".implode(", ",$set);
  $st=$db->prepare($sql); $st->execute($params);
  j(["ok"=>true,"message"=>"Comprobante subido","path"=>$rel]);
}
case "approve_receipt": {
  $t=authOrFail($db); if($t["user_role"]!=="admin") j(["ok"=>false,"error"=>"forbidden"],403);
  $tbl = tableExists($db,"comprobantes_pago")?"comprobantes_pago":(tableExists($db,"comprobante")?"comprobante":null);
  $id=(int)($_POST["id"]??$_GET["id"]??0); if($id<=0||!$tbl) j(["ok"=>false,"error"=>"id inválido"],400);
  $pk=pick_col($db,$tbl,["id_Comprobante","id_comprobante","id","ID","numero"]);
  if(!$pk) j(["ok"=>false,"error"=>"PK no encontrada"],500);
  $st=$db->prepare("UPDATE `$tbl` SET Estado='Aprobado' WHERE `$pk`=?"); $st->execute([$id]);
  j(["ok"=>true,"message"=>"Comprobante aprobado"]);
}

// --- Horas ---
case "list_hours": {
  $t=authOrFail($db);
  $tbl=tableExists($db,"horas_trabajo")?"horas_trabajo":null;
  if(!$tbl) j(["ok"=>true,"rows"=>[]]);
  $idCol = pick_col($db,$tbl,["id_Residente","id_residente","user_id"]);
  $fec   = pick_col($db,$tbl,["Fecha","fecha","created_at"]);
  $pk    = pick_col($db,$tbl,["id_Hora","id_hora","id","ID"]);
  $id = isset($_GET["id_residente"])?(int)$_GET["id_residente"]:(int)$t["user_id"];
  if($t["user_role"]!=="admin") $id=(int)$t["user_id"];
  $order = $fec ? "ORDER BY `$fec` DESC".($pk?", `$pk` DESC":"") : ($pk?"ORDER BY `$pk` DESC":"");
  $st=$db->prepare("SELECT * FROM `$tbl` WHERE `$idCol`=? $order");
  $st->execute([$id]); j(["ok"=>true,"rows"=>$st->fetchAll()]);
}
case "add_hour": {
  $t=authOrFail($db);
  $tbl=tableExists($db,"horas_trabajo")?"horas_trabajo":null;
  if(!$tbl) j(["ok"=>false,"error"=>"Tabla horas_trabajo no existe"],500);
  $idCol = pick_col($db,$tbl,["id_Residente","id_residente","user_id"]);
  $fec   = pick_col($db,$tbl,["Fecha","fecha","created_at"]);
  $cantC = pick_col($db,$tbl,["Cantidad","cantidad","horas"]);
  $descC = pick_col($db,$tbl,["Descripcion","descripcion","detalle"]);
  $id=(int)($_POST["id_residente"]??0); if($t["user_role"]!=="admin") $id=(int)$t["user_id"];
  $fecha=trim($_POST["fecha"]??""); $cant=(float)($_POST["cantidad"]??0); $desc=trim($_POST["descripcion"]??"");
  if($id<=0||$fecha===""||$cant<=0) j(["ok"=>false,"error"=>"Datos inválidos"],400);
  $st=$db->prepare("INSERT INTO `$tbl` (`$idCol`,`$fec`,`$cantC`,`$descC`) VALUES (?,?,?,?)");
  $st->execute([$id,$fecha,$cant,($desc!==""?$desc:null)]);
  j(["ok"=>true,"message"=>"Hora registrada"]);
}

// --- Pendientes / aprobar residentes (Admin Tools) ---
case "pending_users":
case "admin_residentes_pendientes": {
  $t=authOrFail($db); if($t["user_role"]!=="admin") j(["ok"=>false,"error"=>"forbidden"],403);
  $resT = residente_table($db); if(!$resT) j(["ok"=>true,"rows"=>[]]);
  $idCol = pick_col($db,$resT,["id_Residente","Id_Residente","id","Id"]);
  $mail  = pick_col($db,$resT,["Correo","Email","correo","email"]);
  $nom   = pick_col($db,$resT,["Nombre","nombre"]); $ape = pick_col($db,$resT,["Apellido","apellido"]);
  $reg   = pick_col($db,$resT,["fecha_registro","Fecha_Registro","created_at"]);
  $ap    = pick_col($db,$resT,["estado_aprobacion","Aprobado","Estado"]);
  $order = $reg ? "ORDER BY `$reg` DESC" : "";
  $st=$db->query("SELECT `$idCol` AS id, `$nom` AS Nombre, `$ape` AS Apellido, `$mail` AS Correo, ".($reg?"`$reg`":"NOW()")." AS fecha_registro, ".($ap?"`$ap`":"0")." AS estado_aprobacion FROM `$resT` WHERE ".($ap?"`$ap`=0":"1=0")." $order");
  j(["ok"=>true,"rows"=>$st->fetchAll()]);
}
case "approve_user":
case "admin_residente_aprobar": {
  $t=authOrFail($db); if($t["user_role"]!=="admin") j(["ok"=>false,"error"=>"forbidden"],403);
  $resT = residente_table($db); if(!$resT) j(["ok"=>false,"error"=>"no residente table"],500);
  $id=(int)($_POST["id"]??$_GET["id"]??0);
  if($id<=0) j(["ok"=>false,"error"=>"id inválido"],400);
  $idCol = pick_col($db,$resT,["id_Residente","Id_Residente","id","Id"]);
  $ap    = pick_col($db,$resT,["estado_aprobacion","Aprobado","Estado"]);
  if(!$ap) j(["ok"=>false,"error"=>"no approval column"],500);
  $st=$db->prepare("UPDATE `$resT` SET `$ap`=1 WHERE `$idCol`=?");
  $st->execute([$id]); j(["ok"=>true,"message"=>"Usuario aprobado"]);
}

// --- Perfil simple ---
case "profile": {
  $t=authOrFail($db);
  $resT = residente_table($db);
  $admT = adminTable($db);
  if ($t["user_role"]==="residente" && $resT) {
    $idCol = pick_col($db,$resT,["id_Residente","Id_Residente","id","Id"]);
    $nom = pick_col($db,$resT,["Nombre","nombre"]); $ape = pick_col($db,$resT,["Apellido","apellido"]);
    $mail= pick_col($db,$resT,["Correo","Email","correo","email"]);
    $tel = pick_col($db,$resT,["Telefono","telefono"]);
    $ced = pick_col($db,$resT,["Cedula","cedula","CI","ci"]);
    $fec = pick_col($db,$resT,["Fecha_Ingreso","fecha_ingreso","Fecha","fecha"]);
    $ap  = pick_col($db,$resT,["estado_aprobacion","Aprobado","Estado"]);
    $st = $db->prepare("SELECT * FROM `$resT` WHERE `$idCol`=? LIMIT 1");
    $st->execute([$t["user_id"]]); $r = $st->fetch() ?: [];
    j(["ok"=>true,"user"=>[
      "id" => (int)$t["user_id"], "role"=>"residente",
      "nombre"=>$r[$nom]??null, "apellido"=>$r[$ape]??null,
      "correo"=>$r[$mail]??null, "telefono"=>$r[$tel]??null,
      "cedula"=>$r[$ced]??null, "fecha_ingreso"=>$r[$fec]??null,
      "estado"=> isset($r[$ap])?(int)$r[$ap]:1
    ]]);
  } else if ($admT) {
    $idCol = pick_col($db,$admT,["id_Administrador","Id_Administrador","id_Administrator","Id_Administrator","id","Id"]);
    $nom = pick_col($db,$admT,["Nombre","nombre"]); $ape = pick_col($db,$admT,["Apellido","apellido"]);
    $mail= pick_col($db,$admT,["Correo","Email","correo","email"]);
    $ap  = pick_col($db,$admT,["estado_aprobacion","Aprobado","Estado"]);
    $st = $db->prepare("SELECT * FROM `$admT` WHERE `$idCol`=? LIMIT 1");
    $st->execute([$t["user_id"]]); $r = $st->fetch() ?: [];
    j(["ok"=>true,"user"=>[
      "id"=>(int)$t["user_id"], "role"=>"admin",
      "nombre"=>trim(($r[$nom]??'').' '.($r[$ape]??'')),
      "correo"=>$r[$mail]??null,
      "estado"=> isset($r[$ap])?(int)$r[$ap]:1
    ]]);
  } else {
    j(["ok"=>false,"error"=>"Tablas de usuarios no encontradas"],500);
  }
}

// --- Reclamos (usuario y admin) ---
case "create_claim":
case "reclamos_create": {
  $t=authOrFail($db);
  $S=reclamos_schema($db);
  if(!$S||!$S["tbl"]||!$S["idRes"]||!$S["desc"]) j(["ok"=>false,"error"=>"Tabla reclamos incompleta"],500);

  $r=req();
  $asunto=trim($r["asunto"]??$r["subject"]??"");
  $desc  =trim($r["descripcion"]??$r["description"]??"");
  $prior =trim($r["prioridad"]??$r["priority"]??"");

  $rid = effective_residente_id($db,$t,$r);
  if ($rid<=0) j(["ok"=>false,"error"=>"id_residente_no_encontrado","message"=>"Como admin, pasá id_residente o creá un Residente con el mismo email."],422);

  if($S["asunto"]){ if($asunto===""||$desc==="") j(["ok"=>false,"error"=>"Faltan datos"],400); }
  else { if($desc===""&&$asunto==="") j(["ok"=>false,"error"=>"Faltan datos"],400); if($desc===""&&$asunto!=="") $desc=$asunto; }

  $cols=["`{$S['idRes']}`","`{$S['desc']}`"]; $vals=["?","?"]; $params=[(int)$rid,$desc];
  if($S["asunto"]){ $cols[]="`{$S['asunto']}`"; $vals[]="?"; $params[]=$asunto; }
  if($S["estado"]){ $cols[]="`{$S['estado']}`"; $vals[]="?"; $params[]="abierto"; }
  if($S["prior"] && $prior!==""){ $cols[]="`{$S['prior']}`"; $vals[]="?"; $params[]=$prior; }
  if($S["fecha"]){ $cols[]="`{$S['fecha']}`"; $vals[]="NOW()"; }

  $sql="INSERT INTO `{$S['tbl']}` (".implode(",",$cols).") VALUES (".implode(",",$vals).")";
  $st=$db->prepare($sql); $st->execute($params);
  j(["ok"=>true]);
}
case "list_claims":
case "reclamos_list": {
  $t=authOrFail($db); $S=reclamos_schema($db);
  if(!$S||!$S["tbl"]||!$S["idRes"]||!$S["desc"]) j(["ok"=>false,"error"=>"Tabla reclamos incompleta"],500);
  $SelAsunto=$S["asunto"] ? "`{$S['asunto']}` AS asunto" : "LEFT(`{$S['desc']}`,80) AS asunto";
  $SelFecha =$S["fecha"]  ? "`{$S['fecha']}` AS fecha"   : "NULL AS fecha";
  $SelEstado=$S["estado"] ? "`{$S['estado']}` AS estado" : "'abierto' AS estado";
  $order = $S["fecha"] ? "ORDER BY `{$S['fecha']}` DESC".($S["pk"]?", `{$S['pk']}` DESC":"") : ($S["pk"]?"ORDER BY `{$S['pk']}` DESC":"");
  if($t["user_role"]==="admin"){
    $rid=isset($_GET["id_residente"])?(int)$_GET["id_residente"]:0;
    $where=$rid>0 ? "WHERE `{$S['idRes']}`=$rid" : "";
    $sql="SELECT $SelFecha,$SelAsunto,$SelEstado FROM `{$S['tbl']}` $where $order";
    $rows=$db->query($sql)->fetchAll(); j(["ok"=>true,"items"=>$rows]);
  } else {
    $sql="SELECT $SelFecha,$SelAsunto,$SelEstado FROM `{$S['tbl']}` WHERE `{$S['idRes']}`=? $order";
    $st=$db->prepare($sql); $st->execute([(int)$t["user_id"]]); j(["ok"=>true,"items"=>$st->fetchAll()]);
  }
}
// Admin Tools: reclamos listar / cambiar estado
case 'admin_reclamos_listar': {
  $t=authOrFail($db); if($t['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
  if(!tableExists($db,'reclamos')) j(['ok'=>true,'rows'=>[]]);
  $estado = $_GET['estado'] ?? '';
  $sql="SELECT r.Id_Reclamo AS id, r.Descripcion, r.Fecha, r.Prioridad, r.Estado,
               r.id_Residente AS residente_id,
               CONCAT(res.Nombre,' ',res.Apellido) AS residente, res.Correo AS residente_correo
        FROM reclamos r LEFT JOIN residente res ON res.id_Residente = r.id_Residente";
  $args=[];
  if ($estado!=='' && in_array($estado,['abierto','en_proceso','cerrado','Pendiente','Cerrado'])) { $sql.=" WHERE r.Estado=?"; $args[]=$estado; }
  $sql.=" ORDER BY r.Fecha DESC";
  $st=$db->prepare($sql); $st->execute($args); j(['ok'=>true,'rows'=>$st->fetchAll()]);
}
case 'admin_reclamos_cambiar_estado': {
  $t=authOrFail($db); if($t['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
  if(!tableExists($db,'reclamos')) j(['ok'=>false,'error'=>'tabla reclamos no existe'],500);
  $id=(int)($_POST['id']??0); $estado=trim($_POST['estado']??'');
  if(!$id || $estado==='') j(['ok'=>false,'error'=>'BAD_INPUT'],400);
  $st=$db->prepare("UPDATE reclamos SET Estado=? WHERE Id_Reclamo=?"); $st->execute([$estado,$id]);
  j(['ok'=>true]);
}

// --- Comunicados ---
case 'list_announcements':
case 'comunicados_listar':   announcements_list($db); break;
case 'create_announcement':
case 'admin_comunicados_crear': announcements_create($db); break;

// --- Admin Tools: comprobantes ---
case 'admin_comprobantes_listar': {
  $t=authOrFail($db); if($t['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
  $tbl = tableExists($db,"comprobantes_pago")?"comprobantes_pago":(tableExists($db,"comprobante")?"comprobante":null);
  if(!$tbl) j(['ok'=>true,'rows'=>[]]);
  $estado = $_GET['estado'] ?? '';
  $colIdRes  = pick_col($db,$tbl,["id_Residente","id_residente","user_id"]);
  $colPk     = pick_col($db,$tbl,["id_Comprobante","id_comprobante","id","ID"]);
  $colFecha  = pick_col($db,$tbl,["Fecha_Subida","Fecha","fecha","created_at"]);
  $SQL="SELECT cp.$colPk AS id, cp.Tipo, cp.Fecha, cp.Monto, cp.Estado, cp.Archivo,
               cp.$colIdRes AS id_Residente, CONCAT(r.Nombre,' ',r.Apellido) AS residente, r.Correo AS residente_correo
        FROM $tbl cp JOIN residente r ON r.id_Residente=cp.$colIdRes";
  $args=[]; if($estado!=='' && in_array($estado,['Pendiente','Aprobado','Rechazado'])){ $SQL.=" WHERE cp.Estado=?"; $args[]=$estado; }
  if ($colFecha) $SQL.=" ORDER BY cp.`$colFecha` DESC";
  $st=$db->prepare($SQL); $st->execute($args); j(['ok'=>true,'rows'=>$st->fetchAll()]);
}
case 'admin_comprobantes_set_estado': {
  $t=authOrFail($db); if($t['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
  $tbl = tableExists($db,"comprobantes_pago")?"comprobantes_pago":(tableExists($db,"comprobante")?"comprobante":null);
  if(!$tbl) j(['ok'=>false,'error'=>'tabla comprobantes no existe'],500);

  $R = req();
  $id = (int)($R['id']??$R['ID']??$R['id_comprobante']??0);
  $estado_in = (string)($R['estado'] ?? $R['Estado'] ?? '');
  $map = ['pendiente'=>'Pendiente','aprobado'=>'Aprobado','rechazado'=>'Rechazado'];
  $estado_norm = strtolower(trim($estado_in));
  if(!$id || !isset($map[$estado_norm])) j(['ok'=>false,'error'=>'BAD_INPUT'],400);
  $estado = $map[$estado_norm];

  $pk = pick_col($db,$tbl,['id_Comprobante','id_comprobante','id','ID']);
  $colAdmin = hasColumn($db,$tbl,'id_Administrador') ? 'id_Administrador' : null;

  $sql="UPDATE `$tbl` SET Estado=?".($colAdmin?", $colAdmin=?":"")." WHERE `$pk`=?";
  $st=$db->prepare($sql);
  $colAdmin ? $st->execute([$estado,(int)$t['user_id'],$id]) : $st->execute([$estado,$id]);

  j(['ok'=>true]);
}

case 'admin_comprobantes_eliminar': {
  $t=authOrFail($db); if($t['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
  $tbl = tableExists($db,"comprobantes_pago")?"comprobantes_pago":(tableExists($db,"comprobante")?"comprobante":null);
  if(!$tbl) j(['ok'=>false,'error'=>'tabla comprobantes no existe'],500);

  $R=req(); $id=(int)($R['id']??$R['ID']??0); if(!$id) j(['ok'=>false,'error'=>'BAD_INPUT'],400);
  $pk      = pick_col($db,$tbl,['id_Comprobante','id_comprobante','id','ID']);
  $colPath = pick_col($db,$tbl,['Archivo','archivo','Ruta','Ruta_Archivo','FilePath','ArchivoURL','Url']);

  $path=null;
  if($colPath){ $st=$db->prepare("SELECT `$colPath` FROM `$tbl` WHERE `$pk`=?"); $st->execute([$id]); $path=$st->fetchColumn(); }

  $st=$db->prepare("DELETE FROM `$tbl` WHERE `$pk`=?"); $st->execute([$id]);

  if($path){ $abs=__DIR__."/../".ltrim($path,'/'); if(is_file($abs)) @unlink($abs); }
  j(['ok'=>true]);
}

case '__whereami': { j(['file'=>__FILE__]); }

case 'resolve_my_residente': {
  // requiere que ya exista authOrFail
  $t = authOrFail($db);

  // Si tenés ya definida effective_residente_id úsala, si no, un fallback simple:
  if (function_exists('effective_residente_id')) {
    $payload = array_merge($_GET ?? [], $_POST ?? []);
    $rid = effective_residente_id($db, $t, $payload);
  } else {
    // Fallback: residente => su propio id; admin => usa ?id_residente=...
    $rid = ($t['user_role']==='residente')
      ? (int)$t['user_id']
      : (int)($_GET['id_residente'] ?? $_POST['id_residente'] ?? 0);
  }

  j(['ok'=>true,'residente_id'=>$rid]);
}
// === RESERVAS ===
// Tabla sugerida: reservas(id, residente_id, espacio, fecha, hora_inicio, hora_fin, estado, ocupado, notas, created_at)

// ====== RESERVAS (adaptado a tu esquema con mayúsculas) ======

/* ====== RESERVAS (esquema con mayúsculas) ====== */

// ====== RESERVAS (tabla: id_Reserva, id_Residente, Espacio, Fecha, Hora_Inicio, Hora_Fin, Estado, created_at) ======

case 'reservas_listar_admin': {
  $t = authOrFail($db); if ($t['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
  if (!tableExists($db,'reservas')) j(['ok'=>true,'rows'=>[]]);
  $sql = "SELECT id_Reserva, id_Residente, Espacio, Fecha, Hora_Inicio, Hora_Fin, Estado, created_at
          FROM reservas
          ORDER BY created_at DESC, Fecha DESC, Hora_Inicio DESC
          LIMIT 300";
  $rows = $db->query($sql)->fetchAll();
  j(['ok'=>true,'rows'=>$rows,'items'=>$rows]);
}

case 'reservas_listar_fecha': {
  $t = authOrFail($db); // cualquier rol
  if (!tableExists($db,'reservas')) j(['ok'=>true,'rows'=>[]]);
  $fecha   = trim($_GET['fecha']   ?? '');
  $espacio = trim($_GET['espacio'] ?? 'Salón de eventos');
  if ($fecha==='') j(['ok'=>false,'error'=>'BAD_INPUT'],400);
  $st = $db->prepare("SELECT Hora_Inicio, Hora_Fin, Estado FROM reservas WHERE Fecha=? AND Espacio=?");
  $st->execute([$fecha,$espacio]);
  j(['ok'=>true,'rows'=>$st->fetchAll()]);
}

case 'reservas_solicitar': {
  $t = authOrFail($db);
  if (!tableExists($db,'reservas')) j(['ok'=>false,'error'=>'tabla reservas no existe'],500);
  $r = req();
  $rid    = effective_residente_id($db,$t,$r);
  $esp    = trim($r['espacio'] ?? 'Salón de eventos');
  $fecha  = trim($r['fecha'] ?? '');
  $hIni   = trim($r['hora_inicio'] ?? '');
  $hFin   = trim($r['hora_fin'] ?? '');
  $notas  = trim($r['notas'] ?? '');

  if ($rid<=0 || $fecha==='' || $hIni==='' || $hFin==='') j(['ok'=>false,'error'=>'BAD_INPUT'],400);

  // choque simple
  $q = $db->prepare("SELECT COUNT(*) FROM reservas
                     WHERE Fecha=? AND Espacio=? AND NOT (Hora_Fin<=? OR Hora_Inicio>=?)");
  $q->execute([$fecha,$esp,$hIni,$hFin]);
  if ((int)$q->fetchColumn()>0) j(['ok'=>false,'error'=>'horario_ocupado'],409);

  $sql = "INSERT INTO reservas (id_Residente, Espacio, Fecha, Hora_Inicio, Hora_Fin, Estado, created_at)
          VALUES (?,?,?,?,?,'Pendiente',CURRENT_TIMESTAMP)";
  $st = $db->prepare($sql);
  $st->execute([$rid,$esp,$fecha,$hIni,$hFin]);
  j(['ok'=>true,'id'=>$db->lastInsertId()]);
}

case 'admin_reservas_aprobar':
case 'admin_reservas_rechazar': {
  $t = authOrFail($db); if ($t['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
  if (!tableExists($db,'reservas')) j(['ok'=>false,'error'=>'tabla reservas no existe'],500);
  $r  = req();
  $id = (int)($r['id_Reserva'] ?? $r['id'] ?? $r['ID'] ?? 0);
  if ($id<=0) j(['ok'=>false,'error'=>'BAD_INPUT'],400);
  $estado = ($action==='admin_reservas_aprobar') ? 'Aprobado' : 'Rechazado';
  $st = $db->prepare("UPDATE reservas SET Estado=? WHERE id_Reserva=?");
  $st->execute([$estado,$id]);
  j(['ok'=>true,'updated'=>$st->rowCount()]);
}

case 'admin_reservas_marcar_ocupado': {
  $t = authOrFail($db); if($t['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
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

// --- Mis reservas (por usuario logueado) ---
case 'reservas_listar_mis': {
  $t = authOrFail($db);
  $rid = effective_residente_id($db,$t,$_GET);
  if ($rid <= 0) j(['ok'=>false,'error'=>'sin_residente'],400);
  if (!tableExists($db,'reservas')) j(['ok'=>true,'rows'=>[]]);
  $sql = "SELECT id_Reserva, id_Residente, Espacio, Fecha, Hora_Inicio, Hora_Fin, Estado, created_at
          FROM reservas WHERE id_Residente=?
          ORDER BY created_at DESC, Fecha DESC, Hora_Inicio DESC
          LIMIT 100";
  $st = $db->prepare($sql); $st->execute([$rid]);
  $rows = $st->fetchAll();
  j(['ok'=>true,'rows'=>$rows,'items'=>$rows]);
}

// ====== ELIMINAR COMUNICADOS / RECLAMOS (backoffice) ======

case 'admin_comunicados_eliminar': {
  $t=authOrFail($db); if($t['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
  $s = comunicados_schema($db);
  $tbl = $s['tbl']; $pk = $s['pk'] ?: 'ID';
  $R = req(); $id = (int)($R['id'] ?? $R['ID'] ?? 0);
  if(!$id) j(['ok'=>false,'error'=>'BAD_INPUT'],400);
  $st=$db->prepare("DELETE FROM `$tbl` WHERE `$pk`=?"); $st->execute([$id]);
  j(['ok'=>true]);
}

case 'admin_reclamos_eliminar': {
  $t = authOrFail($db); if ($t['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
  if (!tableExists($db,'reclamos')) j(['ok'=>false,'error'=>'tabla reclamos no existe'],500);
  // intenta detectar la PK:
  $pk = pick_col($db,'reclamos', ['Id_Reclamo','id_reclamo','id','ID']);
  $id = (int)($_POST['id'] ?? $_GET['id'] ?? 0);
  if ($id<=0 || !$pk) j(['ok'=>false,'error'=>'BAD_INPUT'],400);
  $st = $db->prepare("DELETE FROM reclamos WHERE `$pk`=?");
  $st->execute([$id]);
  j(['ok'=>true,'deleted'=>$st->rowCount()]);
}  

// === USUARIOS (registro + pendientes + aprobar/rechazar) ===
case 'registrar_usuario':
case 'usuarios_registrar':
case 'register_user':
case 'signup': {
  $b = req();

  // Lee datos con compat de nombres
  $nombre   = trim($b['nombre']??$b['Nombre']??'');
  $apellido = trim($b['apellido']??$b['Apellido']??'');
  $correo   = trim($b['correo']??$b['email']??$b['Correo']??$b['Email']??'');
  $pass     = (string)($b['password']??$b['Password']??'');
  $fechaIng = $b['fecha_ingreso']??$b['Fecha_Ingreso']??date('Y-m-d');
  $cedula   = $b['cedula']??$b['Cedula']??null;
  $telefono = $b['telefono']??$b['Telefono']??null;

  if(!$nombre || !$apellido || !$correo || !$pass){
    j(['ok'=>false,'error'=>'faltan_campos'],400);
  }

  // Tabla Residente (soporta 'residente' o 'Residente')
  $tbl = tableExists($db,'residente') ? 'residente' : (tableExists($db,'Residente')?'Residente':null);
  if(!$tbl) j(['ok'=>false,'error'=>'tabla_residente_inexistente'],500);

  // ¿Correo duplicado?
  $st = $db->prepare("SELECT 1 FROM `$tbl` WHERE `Correo`=? LIMIT 1");
  $st->execute([$correo]);
  if($st->fetchColumn()) j(['ok'=>false,'error'=>'correo_ya_existe'],409);

  $hash = password_hash($pass, PASSWORD_BCRYPT);

  // Inserta como PENDIENTE (estado_aprobacion = 0)
  $sql = "INSERT INTO `$tbl`
          (Nombre, Apellido, Cedula, Correo, Telefono, Fecha_Ingreso, Contrasena, estado_aprobacion, fecha_registro, Usuario)
          VALUES (?,?,?,?,?,?,?,?,NOW(),?)";
  $ins = $db->prepare($sql);
  $ins->execute([$nombre,$apellido,$cedula,$correo,$telefono,$fechaIng,$hash,0,$correo]);

  j(['ok'=>true,'id'=>$db->lastInsertId(),'estado'=>'pendiente']);
}

case 'admin_usuarios_pendientes':
case 'usuarios_pendientes':
case 'admin_usuarios_listar_pendientes':
case 'usuarios_listar_pendientes':
case 'listar_usuarios_pendientes': {
  $t = authOrFail($db); if($t['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
  $tbl = tableExists($db,'residente') ? 'residente' : (tableExists($db,'Residente')?'Residente':null);
  if(!$tbl) j(['ok'=>true,'rows'=>[]]);

  // Alias para que el front entienda: id, nombre, email, fecha
  $st = $db->query("SELECT
      id_Residente AS id,
      CONCAT(Nombre,' ',Apellido) AS nombre,
      Correo AS email,
      fecha_registro AS fecha,
      estado_aprobacion
    FROM `$tbl`
    WHERE estado_aprobacion=0
    ORDER BY fecha_registro DESC");
  j(['ok'=>true,'rows'=>$st->fetchAll()]);
}

case 'admin_usuarios_aprobar':
case 'usuarios_aprobar':
case 'aprobar_usuario': {
  $t = authOrFail($db); if($t['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
  $b = req();
  $id = (int)($b['id'] ?? $b['id_usuario'] ?? $b['ID'] ?? 0);
  if(!$id) j(['ok'=>false,'error'=>'BAD_INPUT'],422);
  $tbl = tableExists($db,'residente') ? 'residente' : (tableExists($db,'Residente')?'Residente':null);
  if(!$tbl) j(['ok'=>false,'error'=>'tabla_residente_inexistente'],500);

  $db->prepare("UPDATE `$tbl` SET estado_aprobacion=1 WHERE id_Residente=?")->execute([$id]);
  j(['ok'=>true]);
}

case 'admin_usuarios_rechazar':
case 'usuarios_rechazar':
case 'rechazar_usuario': {
  $t = authOrFail($db); if($t['user_role']!=='admin') j(['ok'=>false,'error'=>'forbidden'],403);
  $b = req();
  $id = (int)($b['id'] ?? $b['id_usuario'] ?? $b['ID'] ?? 0);
  if(!$id) j(['ok'=>false,'error'=>'BAD_INPUT'],422);
  $tbl = tableExists($db,'residente') ? 'residente' : (tableExists($db,'Residente')?'Residente':null);
  if(!$tbl) j(['ok'=>false,'error'=>'tabla_residente_inexistente'],500);

  // Marcá como rechazado (-1) o eliminá, como prefieras:
  if(isset($b['eliminar']) && (int)$b['eliminar']===1){
    $db->prepare("DELETE FROM `$tbl` WHERE id_Residente=?")->execute([$id]);
  } else {
    $db->prepare("UPDATE `$tbl` SET estado_aprobacion=-1 WHERE id_Residente=?")->execute([$id]);
  }
  j(['ok'=>true]);
}

default: j(["ok"=>true,"pong"=>true]);
}} catch(Throwable $e){ j(["ok"=>false,"error"=>"DB","detail"=>$e->getMessage()],500); }