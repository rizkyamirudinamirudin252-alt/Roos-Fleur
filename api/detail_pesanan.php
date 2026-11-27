<?php

// ======================================================
// DEBUG
// ======================================================
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);


// ======================================================
// RESPONSE JSON
// ======================================================
header('Content-Type: application/json; charset=utf-8');


// ======================================================
// CORS
// ======================================================
require_once __DIR__ . '/../config/admin_guard.php';


// ======================================================
// REQUEST OPTIONS
// ======================================================
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}


// ======================================================
// HANYA GET
// ======================================================
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {

    http_response_code(405);

    echo json_encode([
        'status' => false,
        'message' => 'Method tidak diperbolehkan. Gunakan GET.'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ======================================================
// KONEKSI DATABASE
// ======================================================
//
// Struktur:
//
// roos-fleur/
// ├── api/
// │   └── detail_pesanan.php
// │
// └── config/
//     └── database.php
//
// Karena detail_pesanan.php ada di folder api,
// maka untuk menuju config/database.php:
//
// ../config/database.php
// ======================================================

$connectionFile = __DIR__ . '/../config/database.php';


// ======================================================
// CEK FILE DATABASE
// ======================================================
if (!file_exists($connectionFile)) {

    http_response_code(500);

    echo json_encode([
        'status' => false,
        'message' => 'File database.php tidak ditemukan.',
        'path_dicari' => $connectionFile
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ======================================================
// LOAD DATABASE
// ======================================================
require_once $connectionFile;


// ======================================================
// CEK KONEKSI
// ======================================================
//
// database.php kamu membuat:
//
// $conn = mysqli_connect(...);
//
// Jadi kita gunakan $conn.
// ======================================================

if (!isset($conn)) {

    http_response_code(500);

    echo json_encode([
        'status' => false,
        'message' => 'Variabel koneksi $conn tidak ditemukan.'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


if (!($conn instanceof mysqli)) {

    http_response_code(500);

    echo json_encode([
        'status' => false,
        'message' => 'Variabel $conn bukan koneksi mysqli.'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ======================================================
// CEK ERROR DATABASE
// ======================================================
if ($conn->connect_errno) {

    http_response_code(500);

    echo json_encode([
        'status' => false,
        'message' => 'Koneksi database gagal.',
        'error' => $conn->connect_error
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ======================================================
// AMBIL ID PESANAN
// ======================================================
//
// Bisa:
//
// detail_pesanan.php?id_pesanan=1
//
// atau:
//
// detail_pesanan.php?id=1
// ======================================================

$id_pesanan = null;

if (isset($_GET['id_pesanan'])) {

    $id_pesanan = $_GET['id_pesanan'];

} elseif (isset($_GET['id'])) {

    $id_pesanan = $_GET['id'];
}


// ======================================================
// VALIDASI ID
// ======================================================
if ($id_pesanan === null || $id_pesanan === '') {

    http_response_code(400);

    echo json_encode([
        'status' => false,
        'message' => 'ID pesanan wajib dikirim.',
        'contoh' => 'detail_pesanan.php?id_pesanan=1'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ======================================================
// ID HARUS ANGKA
// ======================================================
if (!ctype_digit((string) $id_pesanan)) {

    http_response_code(400);

    echo json_encode([
        'status' => false,
        'message' => 'ID pesanan harus berupa angka.'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


$id_pesanan = (int) $id_pesanan;


// ======================================================
// QUERY PESANAN
// ======================================================

$sqlPesanan = "
    SELECT *
    FROM pesanan
    WHERE id_pesanan = ?
    LIMIT 1
";

$stmtPesanan = $conn->prepare($sqlPesanan);


// ======================================================
// CEK PREPARE
// ======================================================
if (!$stmtPesanan) {

    http_response_code(500);

    echo json_encode([
        'status' => false,
        'message' => 'Gagal menyiapkan query pesanan.',
        'error' => $conn->error
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ======================================================
// BIND
// ======================================================
$stmtPesanan->bind_param(
    'i',
    $id_pesanan
);


// ======================================================
// EXECUTE
// ======================================================
if (!$stmtPesanan->execute()) {

    http_response_code(500);

    echo json_encode([
        'status' => false,
        'message' => 'Gagal mengambil data pesanan.',
        'error' => $stmtPesanan->error
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ======================================================
// HASIL PESANAN
// ======================================================
$resultPesanan = $stmtPesanan->get_result();


// ======================================================
// PESANAN TIDAK DITEMUKAN
// ======================================================
if ($resultPesanan->num_rows === 0) {

    http_response_code(404);

    echo json_encode([
        'status' => false,
        'message' => 'Pesanan tidak ditemukan.',
        'id_pesanan' => $id_pesanan
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


$pesanan = $resultPesanan->fetch_assoc();


// ======================================================
// QUERY DETAIL PESANAN
// ======================================================

$sqlDetail = "
    SELECT *
    FROM detail_pesanan
    WHERE id_pesanan = ?
";

$stmtDetail = $conn->prepare($sqlDetail);


// ======================================================
// CEK PREPARE DETAIL
// ======================================================
if (!$stmtDetail) {

    http_response_code(500);

    echo json_encode([
        'status' => false,
        'message' => 'Gagal menyiapkan query detail pesanan.',
        'error' => $conn->error
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ======================================================
// BIND DETAIL
// ======================================================
$stmtDetail->bind_param(
    'i',
    $id_pesanan
);


// ======================================================
// EXECUTE DETAIL
// ======================================================
if (!$stmtDetail->execute()) {

    http_response_code(500);

    echo json_encode([
        'status' => false,
        'message' => 'Gagal mengambil detail pesanan.',
        'error' => $stmtDetail->error
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ======================================================
// HASIL DETAIL
// ======================================================
$resultDetail = $stmtDetail->get_result();


// ======================================================
// MASUKKAN DETAIL KE ARRAY
// ======================================================
$detail = [];

while ($row = $resultDetail->fetch_assoc()) {

    $detail[] = $row;
}


// ======================================================
// RESPONSE BERHASIL
// ======================================================
http_response_code(200);

echo json_encode([
    'status' => true,
    'message' => 'Pesanan berhasil diambil.',
    'data' => [
        'pesanan' => $pesanan,
        'detail' => $detail
    ]
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);


// ======================================================
// TUTUP
// ======================================================
$stmtPesanan->close();
$stmtDetail->close();
$conn->close();

?>
