<?php

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
require_once __DIR__ . '/../config/database.php';

function promotionReply($status, $message, $data = [], $code = 200) {
    http_response_code($code);
    echo json_encode(['status' => $status, 'message' => $message, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

$tableCheck = $conn->query("SHOW TABLES LIKE 'promosi_banner'");
$promotionTableExists = $tableCheck && $tableCheck->num_rows > 0;
$createTable = "CREATE TABLE IF NOT EXISTS promosi_banner (
    id_promosi INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    judul VARCHAR(160) NOT NULL,
    deskripsi TEXT NOT NULL,
    kode_promo VARCHAR(32) NOT NULL,
    diskon_persen DECIMAL(5,2) NOT NULL DEFAULT 0,
    minimal_belanja DECIMAL(12,2) NOT NULL DEFAULT 0,
    maksimal_diskon DECIMAL(12,2) NOT NULL DEFAULT 0,
    teks_tombol VARCHAR(80) NOT NULL DEFAULT 'Pilih Buket Sekarang',
    gambar_url VARCHAR(500) NOT NULL,
    aktif TINYINT(1) NOT NULL DEFAULT 1,
    dibuat_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    diperbarui_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
if (!$conn->query($createTable)) promotionReply(false, 'Tabel promosi tidak dapat disiapkan.', [], 500);

// Upgrade tabel demo yang sudah pernah dibuat tanpa menghapus promosi lama.
$columns = [];
$columnResult = $conn->query('SHOW COLUMNS FROM promosi_banner');
if (!$columnResult) promotionReply(false, 'Struktur tabel promosi tidak dapat diperiksa.', [], 500);
while ($column = $columnResult->fetch_assoc()) $columns[$column['Field']] = true;
$needsLegacyPromoUpgrade = !isset($columns['diskon_persen']);
$newColumns = [
    'diskon_persen' => 'DECIMAL(5,2) NOT NULL DEFAULT 0',
    'minimal_belanja' => 'DECIMAL(12,2) NOT NULL DEFAULT 0',
    'maksimal_diskon' => 'DECIMAL(12,2) NOT NULL DEFAULT 0'
];
foreach ($newColumns as $column => $definition) {
    if (!isset($columns[$column]) && !$conn->query("ALTER TABLE promosi_banner ADD COLUMN `$column` $definition")) {
        promotionReply(false, 'Kolom pengaturan diskon belum dapat disiapkan.', [], 500);
    }
}

$countResult = $conn->query('SELECT COUNT(*) AS total FROM promosi_banner');
$count = (int)($countResult->fetch_assoc()['total'] ?? 0);
if ($count === 0 && !$promotionTableExists) {
    $defaults = [
        ['Hemat 10% untuk buket pilihanmu.', 'Gunakan kode promo saat checkout untuk pesanan minimal Rp100.000.', 'FLEUR10', 10, 100000, 50000, 'Pilih Buket Sekarang', 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=80']
    ];
    $insert = $conn->prepare('INSERT INTO promosi_banner (judul, deskripsi, kode_promo, diskon_persen, minimal_belanja, maksimal_diskon, teks_tombol, gambar_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($defaults as $promotion) {
        [$title, $description, $code, $percent, $minimum, $maximum, $buttonText, $imageUrl] = $promotion;
        $insert->bind_param('sssdddss', $title, $description, $code, $percent, $minimum, $maximum, $buttonText, $imageUrl);
        $insert->execute();
    }
    $insert->close();
}

// Existing demo banner predates configurable discounts; preserve its code and
// initialize the matching checkout rule once.
if ($needsLegacyPromoUpgrade) {
    $conn->query("UPDATE promosi_banner SET diskon_persen=10, minimal_belanja=100000, maksimal_diskon=50000 WHERE kode_promo='FLEUR10'");
    $conn->query("UPDATE promosi_banner SET aktif=0 WHERE kode_promo<>'FLEUR10'");
}

// One-time demo seed: add a second, distinct promotion without recreating it
// on later requests if an admin chooses to remove it.
$migrationTable = "CREATE TABLE IF NOT EXISTS roos_fleur_migrations (
    migration_key VARCHAR(100) NOT NULL PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
if (!$conn->query($migrationTable)) promotionReply(false, 'Penyiapan data demo promo gagal.', [], 500);
$migrationKey = 'seed_second_promo_sunny15_v1';
$migrationCheck = $conn->prepare('SELECT migration_key FROM roos_fleur_migrations WHERE migration_key=? LIMIT 1');
$migrationCheck->bind_param('s', $migrationKey);
$migrationCheck->execute();
$migrationDone = (bool)$migrationCheck->get_result()->fetch_assoc();
$migrationCheck->close();
if (!$migrationDone) {
    $sunnyCode = 'SUNNY15';
    $existingSunny = $conn->prepare('SELECT id_promosi FROM promosi_banner WHERE kode_promo=? LIMIT 1');
    $existingSunny->bind_param('s', $sunnyCode);
    $existingSunny->execute();
    $sunnyExists = (bool)$existingSunny->get_result()->fetch_assoc();
    $existingSunny->close();
    if (!$sunnyExists) {
        $title = 'Diskon 15% Buket Ceria';
        $description = 'Pakai kode SUNNY15 untuk diskon 15% dengan minimum belanja Rp150.000. Maksimum diskon Rp35.000.';
        $percent = 15;
        $minimum = 150000;
        $maximum = 35000;
        $buttonText = 'Lihat Buket Ceria';
        $imageUrl = '/roos-fleur/uploads/promosi/promo_sunshine_demo.jpg';
        $insert = $conn->prepare('INSERT INTO promosi_banner (judul, deskripsi, kode_promo, diskon_persen, minimal_belanja, maksimal_diskon, teks_tombol, gambar_url, aktif) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)');
        if (!$insert) promotionReply(false, 'Promo kedua belum dapat disiapkan.', [], 500);
        $insert->bind_param('sssdddss', $title, $description, $sunnyCode, $percent, $minimum, $maximum, $buttonText, $imageUrl);
        if (!$insert->execute()) promotionReply(false, 'Promo kedua gagal disimpan.', [], 500);
        $insert->close();
    }
    $mark = $conn->prepare('INSERT INTO roos_fleur_migrations (migration_key) VALUES (?)');
    $mark->bind_param('s', $migrationKey);
    if (!$mark->execute()) promotionReply(false, 'Status penyiapan promo kedua gagal disimpan.', [], 500);
    $mark->close();
}

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'GET') {
    $isAdmin = (($_SESSION['user']['peran'] ?? '') === 'admin');
    $query = 'SELECT * FROM promosi_banner' . ($isAdmin ? '' : ' WHERE aktif=1') . ' ORDER BY id_promosi DESC';
    $result = $conn->query($query);
    promotionReply(true, 'Daftar promosi berhasil diambil.', ['promosi' => $result->fetch_all(MYSQLI_ASSOC)]);
}

if (($_SESSION['user']['peran'] ?? '') !== 'admin') promotionReply(false, 'Hanya admin yang dapat mengatur promosi.', [], 403);
$input = $_POST ?: (json_decode(file_get_contents('php://input'), true) ?: []);

function savePromotionImage($file) {
    if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return null;
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) promotionReply(false, 'Upload foto banner gagal.', [], 400);
    if (($file['size'] ?? 0) > 5 * 1024 * 1024) promotionReply(false, 'Ukuran foto banner maksimal 5 MB.', [], 400);
    $tmp = $file['tmp_name'] ?? '';
    if (!$tmp || !is_uploaded_file($tmp) || getimagesize($tmp) === false) promotionReply(false, 'File yang dipilih bukan gambar yang valid.', [], 400);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($tmp);
    $extensions = ['image/jpeg'=>'jpg', 'image/png'=>'png', 'image/webp'=>'webp'];
    if (!isset($extensions[$mime])) promotionReply(false, 'Format foto harus JPG, PNG, atau WEBP.', [], 400);
    $directory = __DIR__ . '/../uploads/promosi/';
    if (!is_dir($directory) && !mkdir($directory, 0775, true)) promotionReply(false, 'Folder foto banner tidak dapat dibuat.', [], 500);
    $filename = 'promo_' . date('YmdHis') . '_' . bin2hex(random_bytes(5)) . '.' . $extensions[$mime];
    if (!move_uploaded_file($tmp, $directory . $filename)) promotionReply(false, 'Foto banner gagal disimpan.', [], 500);
    return '/roos-fleur/uploads/promosi/' . $filename;
}

if ($method === 'POST') {
    $id = (int)($input['id_promosi'] ?? 0);
    $judul = trim((string)($input['judul'] ?? ''));
    $deskripsi = trim((string)($input['deskripsi'] ?? ''));
    $kode = strtoupper(trim((string)($input['kode_promo'] ?? '')));
    $percent = (float)($input['diskon_persen'] ?? 0);
    $minimum = (float)($input['minimal_belanja'] ?? 0);
    $maximum = (float)($input['maksimal_diskon'] ?? 0);
    $tombol = trim((string)($input['teks_tombol'] ?? 'Pilih Buket Sekarang'));
    $gambar = trim((string)($input['gambar_url'] ?? ''));
    $imageFile = $_FILES['foto_banner'] ?? null;
    $hasImageFile = $imageFile && ($imageFile['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
    $aktif = !empty($input['aktif']) ? 1 : 0;
    $validImagePath = strpos($gambar, '/roos-fleur/uploads/') === 0 && strpos($gambar, '..') === false;
    $validImageUrl = filter_var($gambar, FILTER_VALIDATE_URL) !== false;
    if ($judul === '' || $deskripsi === '' || !preg_match('/^[A-Z0-9_-]{3,32}$/', $kode) || (!$hasImageFile && $gambar === '') || ($gambar !== '' && !$validImageUrl && !$validImagePath) || $percent < 0 || $percent > 100 || $minimum < 0 || $maximum < 0) {
        promotionReply(false, 'Periksa judul, deskripsi, kode (3-32 karakter), foto, dan nilai diskon.', [], 422);
    }
    $duplicate = $conn->prepare('SELECT id_promosi FROM promosi_banner WHERE kode_promo=? AND id_promosi<>? LIMIT 1');
    $duplicate->bind_param('si', $kode, $id);
    $duplicate->execute();
    if ($duplicate->get_result()->fetch_assoc()) promotionReply(false, 'Kode promo sudah digunakan.', [], 409);
    $duplicate->close();
    $uploadedImage = savePromotionImage($imageFile);
    if ($uploadedImage !== null) $gambar = $uploadedImage;
    if ($id > 0) {
        $stmt = $conn->prepare('UPDATE promosi_banner SET judul=?, deskripsi=?, kode_promo=?, diskon_persen=?, minimal_belanja=?, maksimal_diskon=?, teks_tombol=?, gambar_url=?, aktif=? WHERE id_promosi=?');
        $stmt->bind_param('sssdddssii', $judul, $deskripsi, $kode, $percent, $minimum, $maximum, $tombol, $gambar, $aktif, $id);
        if (!$stmt->execute()) promotionReply(false, 'Promosi gagal diperbarui.', [], 500);
        $stmt->close();
        promotionReply(true, 'Promosi berhasil diperbarui.', ['gambar_url' => $gambar]);
    }
    $stmt = $conn->prepare('INSERT INTO promosi_banner (judul, deskripsi, kode_promo, diskon_persen, minimal_belanja, maksimal_diskon, teks_tombol, gambar_url, aktif) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->bind_param('sssdddssi', $judul, $deskripsi, $kode, $percent, $minimum, $maximum, $tombol, $gambar, $aktif);
    if (!$stmt->execute()) promotionReply(false, 'Promosi gagal ditambahkan.', [], 500);
    $newId = $stmt->insert_id;
    $stmt->close();
    promotionReply(true, 'Promosi berhasil ditambahkan.', ['id_promosi' => $newId, 'gambar_url' => $gambar], 201);
}

if ($method === 'DELETE') {
    $id = (int)($input['id_promosi'] ?? 0);
    if ($id <= 0) promotionReply(false, 'Promosi tidak valid.', [], 422);
    $stmt = $conn->prepare('DELETE FROM promosi_banner WHERE id_promosi=?');
    $stmt->bind_param('i', $id);
    if (!$stmt->execute()) promotionReply(false, 'Promosi gagal dihapus.', [], 500);
    $deleted = $stmt->affected_rows;
    $stmt->close();
    if (!$deleted) promotionReply(false, 'Promosi tidak ditemukan.', [], 404);
    promotionReply(true, 'Promosi berhasil dihapus.');
}

promotionReply(false, 'Metode tidak didukung.', [], 405);
