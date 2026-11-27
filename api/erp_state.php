<?php
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/../config/admin_guard.php';
require_once __DIR__ . '/../config/database.php';

function erpStateReply(bool $ok, string $message, array $data = [], int $code = 200): void {
    http_response_code($code);
    echo json_encode(['status'=>$ok,'message'=>$message,'data'=>$data], JSON_UNESCAPED_UNICODE);
    exit;
}

$create = "CREATE TABLE IF NOT EXISTS erp_state_store (
    state_key VARCHAR(40) NOT NULL PRIMARY KEY,
    state_json LONGTEXT NOT NULL,
    updated_by INT UNSIGNED NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
if (!$conn->query($create)) erpStateReply(false, 'Penyimpanan ERP tidak dapat disiapkan.', [], 500);

$allowed = ['inventory','suppliers','customers','finance','purchases','bom'];
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $result = $conn->query('SELECT state_key,state_json,updated_at FROM erp_state_store');
    if (!$result) erpStateReply(false, 'Data ERP tidak dapat dibaca.', [], 500);
    $state = []; $updated = [];
    while ($row = $result->fetch_assoc()) {
        $state[$row['state_key']] = json_decode($row['state_json'], true) ?: [];
        $updated[$row['state_key']] = $row['updated_at'];
    }
    erpStateReply(true, 'Data ERP berhasil dimuat.', ['state'=>$state,'updated_at'=>$updated]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') erpStateReply(false, 'Metode tidak didukung.', [], 405);
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input) || !is_array($input['state'] ?? null)) erpStateReply(false, 'Data ERP tidak valid.', [], 422);
$userId=(int)($_SESSION['user']['id_akun']??0);
$conn->begin_transaction();
try {
    $stmt=$conn->prepare('INSERT INTO erp_state_store(state_key,state_json,updated_by) VALUES(?,?,?) ON DUPLICATE KEY UPDATE state_json=VALUES(state_json),updated_by=VALUES(updated_by)');
    foreach ($input['state'] as $key=>$value) {
        if (!in_array($key,$allowed,true) || !is_array($value)) continue;
        $json=json_encode(array_values($value), JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
        if ($json===false || strlen($json)>1500000) throw new RuntimeException('Data '.$key.' terlalu besar atau tidak valid.');
        $stmt->bind_param('ssi',$key,$json,$userId);
        if (!$stmt->execute()) throw new RuntimeException('Data '.$key.' gagal disimpan.');
    }
    $stmt->close();
    $conn->commit();
} catch (Throwable $error) {
    $conn->rollback();
    erpStateReply(false, $error->getMessage(), [], 500);
}
erpStateReply(true, 'Perubahan ERP berhasil disimpan.');
