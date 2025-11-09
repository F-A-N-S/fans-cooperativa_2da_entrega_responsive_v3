<?php
// backend/api/lib/http.php

function json_input(): array {
  static $cache = null;
  if ($cache !== null) return $cache;
  $raw  = file_get_contents('php://input') ?: '';
  $data = json_decode($raw, true);
  return $cache = (is_array($data) ? $data : []);
}

function inparam(string $key, $default='') {
  $j = json_input();
  if (array_key_exists($key, $_POST)) return $_POST[$key];
  if (array_key_exists($key, $j))      return $j[$key];
  if (array_key_exists($key, $_GET))   return $_GET[$key];
  return $default;
}

function out_json(array $payload, int $code=200): void {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

function bad_request(string $msg='Faltan campos'): void {
  out_json(['ok'=>false,'error'=>'BAD_REQUEST','message'=>$msg], 400);
}

function require_fields(array $fields): array {
  $out = [];
  foreach ($fields as $alias => $name) {
    $val = '';
    foreach (explode('|', $alias) as $k) {
      $v = trim((string) inparam($k, ''));
      if ($v !== '') { $val = $v; break; }
    }
    if ($val === '') bad_request("Falta campo: $name");
    $out[$name] = $val;
  }
  return $out;
}