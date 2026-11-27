<?php

error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json; charset=utf-8');
if (session_status() !== PHP_SESSION_ACTIVE) session_start();


// ======================================================
// OPTIONS
// ======================================================

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}


// ======================================================
// HANYA POST
// ======================================================

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    http_response_code(405);

    echo json_encode([
        'status' => false,
        'message' => 'Method tidak diperbolehkan. Gunakan POST.'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

if (($_SESSION['user']['peran'] ?? '') !== 'admin') {
    http_response_code(401);
    echo json_encode(['status' => false, 'message' => 'Silakan masuk sebagai admin untuk mengunggah foto produk.'], JSON_UNESCAPED_UNICODE);
    exit;
}


// ======================================================
// DATABASE
// ======================================================

$connectionFile = __DIR__ . '/../config/database.php';

if (!file_exists($connectionFile)) {

    http_response_code(500);

    echo json_encode([
        'status' => false,
        'message' => 'File config/database.php tidak ditemukan.',
        'path_dicari' => $connectionFile
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

require_once $connectionFile;


// ======================================================
// CEK KONEKSI DATABASE
// ======================================================

if (isset($conn) && $conn instanceof mysqli) {

    $db = $conn;

} elseif (isset($koneksi) && $koneksi instanceof mysqli) {

    $db = $koneksi;

} else {

    http_response_code(500);

    echo json_encode([
        'status' => false,
        'message' => 'Koneksi database tidak ditemukan.',
        'detail' => 'Pastikan database.php membuat $conn atau $koneksi.'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ======================================================
// ID PRODUK
// ======================================================

if (!isset($_POST['id_produk']) || $_POST['id_produk'] === '') {

    http_response_code(400);

    echo json_encode([
        'status' => false,
        'message' => 'id_produk wajib dikirim.'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


$id_produk = $_POST['id_produk'];


// ======================================================
// VALIDASI ID
// ======================================================

if (!ctype_digit((string)$id_produk)) {

    http_response_code(400);

    echo json_encode([
        'status' => false,
        'message' => 'id_produk harus berupa angka.'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

$id_produk = (int)$id_produk;


// ======================================================
// CEK PRODUK
// ======================================================

$sqlCek = "
    SELECT id_produk, foto
    FROM produk
    WHERE id_produk = ?
    LIMIT 1
";

$stmtCek = $db->prepare($sqlCek);

if (!$stmtCek) {

    http_response_code(500);

    echo json_encode([
        'status' => false,
        'message' => 'Gagal menyiapkan query produk.',
        'error' => $db->error
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

$stmtCek->bind_param('i', $id_produk);
$stmtCek->execute();

$resultCek = $stmtCek->get_result();

if ($resultCek->num_rows === 0) {

    $stmtCek->close();

    http_response_code(404);

    echo json_encode([
        'status' => false,
        'message' => 'Produk tidak ditemukan.',
        'id_produk' => $id_produk
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

$produkLama = $resultCek->fetch_assoc();

$stmtCek->close();


// ======================================================
// CEK FILE
// ======================================================

if (!isset($_FILES['foto'])) {

    http_response_code(400);

    echo json_encode([
        'status' => false,
        'message' => 'File foto wajib dikirim dengan nama field "foto".'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


$file = $_FILES['foto'];


// ======================================================
// CEK ERROR UPLOAD
// ======================================================

if ($file['error'] !== UPLOAD_ERR_OK) {

    http_response_code(400);

    echo json_encode([
        'status' => false,
        'message' => 'Upload foto gagal.',
        'upload_error' => $file['error']
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ======================================================
// BATAS UKURAN 5 MB
// ======================================================

$maxSize = 5 * 1024 * 1024;

if ($file['size'] > $maxSize) {

    http_response_code(400);

    echo json_encode([
        'status' => false,
        'message' => 'Ukuran foto maksimal 5 MB.'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ======================================================
// VALIDASI GAMBAR
// ======================================================

$tmpFile = $file['tmp_name'];

$imageInfo = getimagesize($tmpFile);

if ($imageInfo === false) {

    http_response_code(400);

    echo json_encode([
        'status' => false,
        'message' => 'File yang dikirim bukan gambar yang valid.'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ======================================================
// MIME TYPE
// ======================================================

$allowedMime = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp'
];

$finfo = finfo_open(FILEINFO_MIME_TYPE);

$mime = finfo_file($finfo, $tmpFile);

finfo_close($finfo);


if (!isset($allowedMime[$mime])) {

    http_response_code(400);

    echo json_encode([
        'status' => false,
        'message' => 'Format foto tidak diperbolehkan.',
        'format_diperbolehkan' => [
            'JPG',
            'JPEG',
            'PNG',
            'WEBP'
        ]
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ======================================================
// FOLDER UPLOAD
// ======================================================

$uploadDir = __DIR__ . '/../uploads/produk/';


// ======================================================
// BUAT FOLDER JIKA BELUM ADA
// ======================================================

if (!is_dir($uploadDir)) {

    if (!mkdir($uploadDir, 0755, true)) {

        http_response_code(500);

        echo json_encode([
            'status' => false,
            'message' => 'Folder upload produk gagal dibuat.',
            'folder' => $uploadDir
        ], JSON_UNESCAPED_UNICODE);

        exit;
    }
}


// ======================================================
// NAMA FILE UNIK
// ======================================================

$extension = $allowedMime[$mime];

$fileName = 'produk_' . date('YmdHis') . '_' . bin2hex(random_bytes(8)) . '.' . $extension;

$destination = $uploadDir . $fileName;


// ======================================================
// PINDAHKAN FILE
// ======================================================

if (!move_uploaded_file($tmpFile, $destination)) {

    http_response_code(500);

    echo json_encode([
        'status' => false,
        'message' => 'Gagal menyimpan foto produk.'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ======================================================
// PATH DATABASE
// ======================================================

$fotoPath = 'uploads/produk/' . $fileName;


// ======================================================
// UPDATE DATABASE
// ======================================================

$sqlUpdate = "
    UPDATE produk
    SET foto = ?, updated_at = NOW()
    WHERE id_produk = ?
";

$stmtUpdate = $db->prepare($sqlUpdate);


if (!$stmtUpdate) {

    if (file_exists($destination)) {
        unlink($destination);
    }

    http_response_code(500);

    echo json_encode([
        'status' => false,
        'message' => 'Gagal menyiapkan update foto.',
        'error' => $db->error
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


$stmtUpdate->bind_param(
    'si',
    $fotoPath,
    $id_produk
);


// ======================================================
// EKSEKUSI UPDATE
// ======================================================

if (!$stmtUpdate->execute()) {

    if (file_exists($destination)) {
        unlink($destination);
    }

    http_response_code(500);

    echo json_encode([
        'status' => false,
        'message' => 'Gagal menyimpan foto ke database.',
        'error' => $stmtUpdate->error
    ], JSON_UNESCAPED_UNICODE);

    $stmtUpdate->close();
    exit;
}


// ======================================================
// HAPUS FOTO LAMA
// ======================================================

$fotoLama = $produkLama['foto'] ?? '';

if (!empty($fotoLama)) {

    $fotoLama = str_replace('\\', '/', $fotoLama);

    // Kalau database menyimpan:
    // uploads/produk/nama.jpg
    if (strpos($fotoLama, 'uploads/') === 0) {

        $oldFile = __DIR__ . '/../' . $fotoLama;

        if (
            file_exists($oldFile) &&
            realpath($oldFile) !== realpath($destination)
        ) {
            unlink($oldFile);
        }
    }

    // Kalau database lama hanya menyimpan:
    // nama.jpg
    elseif (strpos($fotoLama, '/') === false) {

        $oldFile = $uploadDir . $fotoLama;

        if (
            file_exists($oldFile) &&
            realpath($oldFile) !== realpath($destination)
        ) {
            unlink($oldFile);
        }
    }
}


// ======================================================
// RESPONSE
// ======================================================

$fotoUrl = '/roos-fleur/' . $fotoPath;

http_response_code(200);

echo json_encode([
    'status' => true,
    'message' => 'Foto produk berhasil diupload.',
    'data' => [
        'id_produk' => $id_produk,
        'foto' => $fotoPath,
        'foto_url' => $fotoUrl
    ]
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);


$stmtUpdate->close();
$db->close();

?>
