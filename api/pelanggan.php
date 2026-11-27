<?php

header("Content-Type: application/json; charset=UTF-8");
require_once __DIR__ . '/../config/admin_guard.php';

require_once __DIR__ . "/../config/database.php";

// Pastikan koneksi tersedia
if (!isset($conn) || !$conn) {
    http_response_code(500);

    echo json_encode([
        "status" => false,
        "message" => "Koneksi database tidak ditemukan.",
        "error" => "Variabel \$conn tidak tersedia dari config/database.php"
    ], JSON_PRETTY_PRINT);

    exit;
}

try {

    /*
    |--------------------------------------------------------------------------
    | GET - Ambil semua data pelanggan
    |--------------------------------------------------------------------------
    */

    if ($_SERVER["REQUEST_METHOD"] === "GET") {

        $sql = "
            SELECT
                id_pelanggan,
                kode_pelanggan,
                nama,
                no_whatsapp,
                jenis_acara,
                tanggal_acara,
                poin,
                total_belanja,
                alamat,
                created_at
            FROM pelanggan
            ORDER BY id_pelanggan ASC
        ";

        $result = $conn->query($sql);

        if (!$result) {
            throw new Exception($conn->error);
        }

        $data = [];

        while ($row = $result->fetch_assoc()) {
            $data[] = $row;
        }

        echo json_encode([
            "status" => true,
            "message" => "Data pelanggan berhasil diambil.",
            "jumlah" => count($data),
            "data" => $data
        ], JSON_PRETTY_PRINT);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | POST - Tambah pelanggan
    |--------------------------------------------------------------------------
    */

    if ($_SERVER["REQUEST_METHOD"] === "POST") {

        $input = json_decode(file_get_contents("php://input"), true);

        if (!$input) {
            http_response_code(400);

            echo json_encode([
                "status" => false,
                "message" => "Data JSON tidak valid."
            ], JSON_PRETTY_PRINT);

            exit;
        }

        $kode_pelanggan = $input["kode_pelanggan"] ?? "";
        $nama = $input["nama"] ?? "";
        $no_whatsapp = $input["no_whatsapp"] ?? "";
        $jenis_acara = $input["jenis_acara"] ?? "";
        $tanggal_acara = $input["tanggal_acara"] ?? null;
        $poin = $input["poin"] ?? 0;
        $total_belanja = $input["total_belanja"] ?? 0;
        $alamat = $input["alamat"] ?? "";

        if ($nama === "") {
            http_response_code(400);

            echo json_encode([
                "status" => false,
                "message" => "Nama pelanggan wajib diisi."
            ], JSON_PRETTY_PRINT);

            exit;
        }

        $stmt = $conn->prepare("
            INSERT INTO pelanggan
            (
                kode_pelanggan,
                nama,
                no_whatsapp,
                jenis_acara,
                tanggal_acara,
                poin,
                total_belanja,
                alamat
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->bind_param(
            "ssssssds",
            $kode_pelanggan,
            $nama,
            $no_whatsapp,
            $jenis_acara,
            $tanggal_acara,
            $poin,
            $total_belanja,
            $alamat
        );

        if (!$stmt->execute()) {
            throw new Exception($stmt->error);
        }

        echo json_encode([
            "status" => true,
            "message" => "Pelanggan berhasil ditambahkan.",
            "id_pelanggan" => $conn->insert_id
        ], JSON_PRETTY_PRINT);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | PUT - Update pelanggan
    |--------------------------------------------------------------------------
    */

    if ($_SERVER["REQUEST_METHOD"] === "PUT") {

        $input = json_decode(file_get_contents("php://input"), true);

        $id_pelanggan = $input["id_pelanggan"] ?? null;

        if (!$id_pelanggan) {
            http_response_code(400);

            echo json_encode([
                "status" => false,
                "message" => "id_pelanggan wajib diisi."
            ], JSON_PRETTY_PRINT);

            exit;
        }

        $kode_pelanggan = $input["kode_pelanggan"] ?? "";
        $nama = $input["nama"] ?? "";
        $no_whatsapp = $input["no_whatsapp"] ?? "";
        $jenis_acara = $input["jenis_acara"] ?? "";
        $tanggal_acara = $input["tanggal_acara"] ?? null;
        $poin = $input["poin"] ?? 0;
        $total_belanja = $input["total_belanja"] ?? 0;
        $alamat = $input["alamat"] ?? "";

        $stmt = $conn->prepare("
            UPDATE pelanggan SET
                kode_pelanggan = ?,
                nama = ?,
                no_whatsapp = ?,
                jenis_acara = ?,
                tanggal_acara = ?,
                poin = ?,
                total_belanja = ?,
                alamat = ?
            WHERE id_pelanggan = ?
        ");

        $stmt->bind_param(
            "ssssssdsd",
            $kode_pelanggan,
            $nama,
            $no_whatsapp,
            $jenis_acara,
            $tanggal_acara,
            $poin,
            $total_belanja,
            $alamat,
            $id_pelanggan
        );

        if (!$stmt->execute()) {
            throw new Exception($stmt->error);
        }

        echo json_encode([
            "status" => true,
            "message" => "Data pelanggan berhasil diperbarui."
        ], JSON_PRETTY_PRINT);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | DELETE - Hapus pelanggan
    |--------------------------------------------------------------------------
    */

    if ($_SERVER["REQUEST_METHOD"] === "DELETE") {

        $input = json_decode(file_get_contents("php://input"), true);

        $id_pelanggan = $input["id_pelanggan"] ?? null;

        if (!$id_pelanggan) {
            http_response_code(400);

            echo json_encode([
                "status" => false,
                "message" => "id_pelanggan wajib diisi."
            ], JSON_PRETTY_PRINT);

            exit;
        }

        $stmt = $conn->prepare("
            DELETE FROM pelanggan
            WHERE id_pelanggan = ?
        ");

        $stmt->bind_param("i", $id_pelanggan);

        if (!$stmt->execute()) {
            throw new Exception($stmt->error);
        }

        echo json_encode([
            "status" => true,
            "message" => "Data pelanggan berhasil dihapus."
        ], JSON_PRETTY_PRINT);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Method tidak tersedia
    |--------------------------------------------------------------------------
    */

    http_response_code(405);

    echo json_encode([
        "status" => false,
        "message" => "Method tidak diizinkan."
    ], JSON_PRETTY_PRINT);


} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "status" => false,
        "message" => "Terjadi kesalahan pada server.",
        "error" => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
