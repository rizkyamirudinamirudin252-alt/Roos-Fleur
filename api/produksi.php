<?php

header("Content-Type: application/json; charset=UTF-8");
require_once __DIR__ . '/../config/admin_guard.php';

require_once __DIR__ . "/../config/database.php";

try {

    if (!isset($conn) || !$conn) {
        throw new Exception("Koneksi database tidak ditemukan.");
    }

    $sql = "SELECT * FROM produksi_buket ORDER BY id_produksi DESC";

    $result = mysqli_query($conn, $sql);

    if (!$result) {
        throw new Exception(mysqli_error($conn));
    }

    $data = [];

    while ($row = mysqli_fetch_assoc($result)) {
        $data[] = $row;
    }

    echo json_encode([
        "status" => true,
        "message" => "Data produksi berhasil diambil.",
        "jumlah" => count($data),
        "data" => $data
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "status" => false,
        "message" => "Gagal mengambil data produksi.",
        "jumlah" => 0,
        "data" => [],
        "error" => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
