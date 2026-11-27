<?php

header("Content-Type: application/json; charset=UTF-8");
require_once __DIR__ . '/../config/admin_guard.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

/*
|--------------------------------------------------------------------------
| DATABASE
|--------------------------------------------------------------------------
*/
require_once __DIR__ . '/../config/database.php';

/*
|--------------------------------------------------------------------------
| CEK KONEKSI
|--------------------------------------------------------------------------
*/
if (!isset($conn) || !$conn) {
    echo json_encode([
        "status" => false,
        "message" => "Koneksi database tidak ditemukan."
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

/*
|--------------------------------------------------------------------------
| HELPER RESPONSE
|--------------------------------------------------------------------------
*/
function responseJson($status, $message, $data = [], $httpCode = 200)
{
    http_response_code($httpCode);

    echo json_encode([
        "status" => $status,
        "message" => $message,
        "jumlah" => is_array($data) ? count($data) : 0,
        "data" => $data
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    exit;
}

/*
|--------------------------------------------------------------------------
| METHOD
|--------------------------------------------------------------------------
*/
$method = $_SERVER['REQUEST_METHOD'];

/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
| GET /api/pesanan.php
| GET /api/pesanan.php?id=1
|--------------------------------------------------------------------------
*/
if ($method === 'GET') {

    /*
    |----------------------------------------------------------------------
    | GET DETAIL
    |----------------------------------------------------------------------
    */
    if (isset($_GET['id']) && $_GET['id'] !== '') {

        $id = (int) $_GET['id'];

        $sql = "
            SELECT
                id_pesanan,
                nomor_pesanan,
                id_pelanggan,
                tanggal_pesanan,
                tanggal_pengiriman,
                metode_pengiriman,
                alamat_pengiriman,
                ucapan_kartu,
                status,
                status_pembayaran,
                metode_pembayaran,
                subtotal,
                ongkir,
                total,
                hpp,
                created_at,
                updated_at
            FROM pesanan
            WHERE id_pesanan = ?
            LIMIT 1
        ";

        $stmt = mysqli_prepare($conn, $sql);

        if (!$stmt) {
            responseJson(
                false,
                "Query gagal disiapkan.",
                [],
                500
            );
        }

        mysqli_stmt_bind_param($stmt, "i", $id);

        if (!mysqli_stmt_execute($stmt)) {
            responseJson(
                false,
                "Query gagal dijalankan.",
                [],
                500
            );
        }

        $result = mysqli_stmt_get_result($stmt);
        $data = [];

        while ($row = mysqli_fetch_assoc($result)) {
            $data[] = $row;
        }

        mysqli_stmt_close($stmt);

        if (count($data) === 0) {
            responseJson(
                false,
                "Data pesanan tidak ditemukan.",
                [],
                404
            );
        }

        responseJson(
            true,
            "Data pesanan berhasil diambil.",
            $data
        );
    }

    /*
    |----------------------------------------------------------------------
    | GET SEMUA DATA
    |----------------------------------------------------------------------
    */
    $sql = "
        SELECT
            id_pesanan,
            nomor_pesanan,
            id_pelanggan,
            tanggal_pesanan,
            tanggal_pengiriman,
            metode_pengiriman,
            alamat_pengiriman,
            ucapan_kartu,
            status,
            status_pembayaran,
            metode_pembayaran,
            subtotal,
            ongkir,
            total,
            hpp,
            created_at,
            updated_at
        FROM pesanan
        ORDER BY id_pesanan DESC
    ";

    $result = mysqli_query($conn, $sql);

    if (!$result) {
        responseJson(
            false,
            "Gagal mengambil data pesanan.",
            [],
            500
        );
    }

    $data = [];

    while ($row = mysqli_fetch_assoc($result)) {
        $data[] = $row;
    }

    responseJson(
        true,
        "Data pesanan berhasil diambil.",
        $data
    );
}


/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
| Tambah pesanan
|--------------------------------------------------------------------------
*/
if ($method === 'POST') {

    $input = json_decode(file_get_contents("php://input"), true);

    if (!is_array($input)) {
        $input = $_POST;
    }

    /*
    |----------------------------------------------------------------------
    | AMBIL DATA
    |----------------------------------------------------------------------
    */

    $nomor_pesanan       = trim($input['nomor_pesanan'] ?? '');
    $id_pelanggan        = isset($input['id_pelanggan']) && $input['id_pelanggan'] !== ''
                            ? (int) $input['id_pelanggan']
                            : null;

    $tanggal_pesanan     = trim($input['tanggal_pesanan'] ?? '');
    $tanggal_pengiriman  = trim($input['tanggal_pengiriman'] ?? '');

    $metode_pengiriman   = trim($input['metode_pengiriman'] ?? '');
    $alamat_pengiriman   = trim($input['alamat_pengiriman'] ?? '');
    $ucapan_kartu        = trim($input['ucapan_kartu'] ?? '');

    $status              = trim($input['status'] ?? 'Pending');
    $status_pembayaran   = trim($input['status_pembayaran'] ?? 'Belum Lunas');
    $metode_pembayaran   = trim($input['metode_pembayaran'] ?? '');
    if ($metode_pembayaran !== '' && !in_array($metode_pembayaran, ['QRIS / E-Wallet', 'COD'], true)) {
        responseJson(false, 'Metode pembayaran hanya mendukung QRIS atau COD.', [], 422);
    }

    $subtotal            = isset($input['subtotal']) ? (float) $input['subtotal'] : 0;
    $ongkir              = isset($input['ongkir']) ? (float) $input['ongkir'] : 0;
    $total               = isset($input['total']) ? (float) $input['total'] : ($subtotal + $ongkir);
    $hpp                 = isset($input['hpp']) ? (float) $input['hpp'] : 0;

    /*
    |----------------------------------------------------------------------
    | VALIDASI
    |----------------------------------------------------------------------
    */

    if ($nomor_pesanan === '') {
        responseJson(
            false,
            "nomor_pesanan wajib diisi.",
            [],
            422
        );
    }

    if ($tanggal_pesanan === '') {
        $tanggal_pesanan = date('Y-m-d H:i:s');
    }

    if ($tanggal_pengiriman === '') {
        $tanggal_pengiriman = null;
    }

    if ($metode_pengiriman === '') {
        $metode_pengiriman = null;
    }

    if ($alamat_pengiriman === '') {
        $alamat_pengiriman = null;
    }

    if ($ucapan_kartu === '') {
        $ucapan_kartu = null;
    }

    if ($metode_pembayaran === '') {
        $metode_pembayaran = null;
    }

    /*
    |----------------------------------------------------------------------
    | INSERT
    |----------------------------------------------------------------------
    */

    $sql = "
        INSERT INTO pesanan (
            nomor_pesanan,
            id_pelanggan,
            tanggal_pesanan,
            tanggal_pengiriman,
            metode_pengiriman,
            alamat_pengiriman,
            ucapan_kartu,
            status,
            status_pembayaran,
            metode_pembayaran,
            subtotal,
            ongkir,
            total,
            hpp
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ";

    $stmt = mysqli_prepare($conn, $sql);

    if (!$stmt) {
        responseJson(
            false,
            "Gagal menyiapkan query tambah pesanan.",
            [],
            500
        );
    }

    mysqli_stmt_bind_param(
        $stmt,
        "sissssssssdddd",
        $nomor_pesanan,
        $id_pelanggan,
        $tanggal_pesanan,
        $tanggal_pengiriman,
        $metode_pengiriman,
        $alamat_pengiriman,
        $ucapan_kartu,
        $status,
        $status_pembayaran,
        $metode_pembayaran,
        $subtotal,
        $ongkir,
        $total,
        $hpp
    );

    if (!mysqli_stmt_execute($stmt)) {

        $error = mysqli_stmt_error($stmt);

        mysqli_stmt_close($stmt);

        responseJson(
            false,
            "Gagal menambahkan pesanan.",
            [
                "error" => $error
            ],
            500
        );
    }

    $newId = mysqli_insert_id($conn);

    mysqli_stmt_close($stmt);

    /*
    |----------------------------------------------------------------------
    | AMBIL DATA YANG BARU DIBUAT
    |----------------------------------------------------------------------
    */

    $stmt = mysqli_prepare(
        $conn,
        "
        SELECT
            id_pesanan,
            nomor_pesanan,
            id_pelanggan,
            tanggal_pesanan,
            tanggal_pengiriman,
            metode_pengiriman,
            alamat_pengiriman,
            ucapan_kartu,
            status,
            status_pembayaran,
            metode_pembayaran,
            subtotal,
            ongkir,
            total,
            hpp,
            created_at,
            updated_at
        FROM pesanan
        WHERE id_pesanan = ?
        LIMIT 1
        "
    );

    mysqli_stmt_bind_param($stmt, "i", $newId);
    mysqli_stmt_execute($stmt);

    $result = mysqli_stmt_get_result($stmt);
    $data = [];

    while ($row = mysqli_fetch_assoc($result)) {
        $data[] = $row;
    }

    mysqli_stmt_close($stmt);

    responseJson(
        true,
        "Pesanan berhasil ditambahkan.",
        $data,
        201
    );
}


/*
|--------------------------------------------------------------------------
| PUT
|--------------------------------------------------------------------------
| Update pesanan
|--------------------------------------------------------------------------
*/
if ($method === 'PUT') {

    $input = json_decode(file_get_contents("php://input"), true);

    if (!is_array($input)) {
        responseJson(
            false,
            "Data JSON tidak valid.",
            [],
            400
        );
    }

    $id = isset($input['id_pesanan'])
        ? (int) $input['id_pesanan']
        : 0;

    if ($id <= 0) {
        responseJson(
            false,
            "id_pesanan wajib diisi.",
            [],
            422
        );
    }

    /*
    |----------------------------------------------------------------------
    | CEK DATA
    |----------------------------------------------------------------------
    */

    $check = mysqli_prepare(
        $conn,
        "SELECT id_pesanan FROM pesanan WHERE id_pesanan = ? LIMIT 1"
    );

    mysqli_stmt_bind_param($check, "i", $id);
    mysqli_stmt_execute($check);

    $checkResult = mysqli_stmt_get_result($check);

    if (mysqli_num_rows($checkResult) === 0) {

        mysqli_stmt_close($check);

        responseJson(
            false,
            "Pesanan tidak ditemukan.",
            [],
            404
        );
    }

    mysqli_stmt_close($check);

    /*
    |----------------------------------------------------------------------
    | DATA UPDATE
    |----------------------------------------------------------------------
    */

    $nomor_pesanan       = trim($input['nomor_pesanan'] ?? '');
    $id_pelanggan        = isset($input['id_pelanggan']) && $input['id_pelanggan'] !== ''
                            ? (int) $input['id_pelanggan']
                            : null;

    $tanggal_pesanan     = trim($input['tanggal_pesanan'] ?? '');
    $tanggal_pengiriman  = trim($input['tanggal_pengiriman'] ?? '');

    $metode_pengiriman   = trim($input['metode_pengiriman'] ?? '');
    $alamat_pengiriman   = trim($input['alamat_pengiriman'] ?? '');
    $ucapan_kartu        = trim($input['ucapan_kartu'] ?? '');

    $status              = trim($input['status'] ?? 'Pending');
    $status_pembayaran   = trim($input['status_pembayaran'] ?? 'Belum Lunas');
    $metode_pembayaran   = trim($input['metode_pembayaran'] ?? '');
    if ($metode_pembayaran !== '' && !in_array($metode_pembayaran, ['QRIS / E-Wallet', 'COD'], true)) {
        responseJson(false, 'Metode pembayaran hanya mendukung QRIS atau COD.', [], 422);
    }

    $subtotal            = isset($input['subtotal']) ? (float) $input['subtotal'] : 0;
    $ongkir              = isset($input['ongkir']) ? (float) $input['ongkir'] : 0;
    $total               = isset($input['total']) ? (float) $input['total'] : ($subtotal + $ongkir);
    $hpp                 = isset($input['hpp']) ? (float) $input['hpp'] : 0;

    if ($tanggal_pesanan === '') {
        $tanggal_pesanan = date('Y-m-d H:i:s');
    }

    if ($tanggal_pengiriman === '') {
        $tanggal_pengiriman = null;
    }

    if ($metode_pengiriman === '') {
        $metode_pengiriman = null;
    }

    if ($alamat_pengiriman === '') {
        $alamat_pengiriman = null;
    }

    if ($ucapan_kartu === '') {
        $ucapan_kartu = null;
    }

    if ($metode_pembayaran === '') {
        $metode_pembayaran = null;
    }

    /*
    |----------------------------------------------------------------------
    | UPDATE
    |----------------------------------------------------------------------
    */

    $sql = "
        UPDATE pesanan SET
            nomor_pesanan = ?,
            id_pelanggan = ?,
            tanggal_pesanan = ?,
            tanggal_pengiriman = ?,
            metode_pengiriman = ?,
            alamat_pengiriman = ?,
            ucapan_kartu = ?,
            status = ?,
            status_pembayaran = ?,
            metode_pembayaran = ?,
            subtotal = ?,
            ongkir = ?,
            total = ?,
            hpp = ?
        WHERE id_pesanan = ?
    ";

    $stmt = mysqli_prepare($conn, $sql);

    if (!$stmt) {
        responseJson(
            false,
            "Gagal menyiapkan query update.",
            [],
            500
        );
    }

    mysqli_stmt_bind_param(
        $stmt,
        "sissssssssddddi",
        $nomor_pesanan,
        $id_pelanggan,
        $tanggal_pesanan,
        $tanggal_pengiriman,
        $metode_pengiriman,
        $alamat_pengiriman,
        $ucapan_kartu,
        $status,
        $status_pembayaran,
        $metode_pembayaran,
        $subtotal,
        $ongkir,
        $total,
        $hpp,
        $id
    );

    if (!mysqli_stmt_execute($stmt)) {

        $error = mysqli_stmt_error($stmt);

        mysqli_stmt_close($stmt);

        responseJson(
            false,
            "Gagal mengupdate pesanan.",
            [
                "error" => $error
            ],
            500
        );
    }

    mysqli_stmt_close($stmt);

    responseJson(
        true,
        "Pesanan berhasil diupdate.",
        []
    );
}


/*
|--------------------------------------------------------------------------
| DELETE
|--------------------------------------------------------------------------
| DELETE /api/pesanan.php?id=1
|--------------------------------------------------------------------------
*/
if ($method === 'DELETE') {

    $id = isset($_GET['id'])
        ? (int) $_GET['id']
        : 0;

    if ($id <= 0) {
        $input = json_decode(file_get_contents("php://input"), true);

        if (is_array($input) && isset($input['id_pesanan'])) {
            $id = (int) $input['id_pesanan'];
        }
    }

    if ($id <= 0) {
        responseJson(
            false,
            "id_pesanan wajib diisi.",
            [],
            422
        );
    }

    /*
    |----------------------------------------------------------------------
    | CEK DATA
    |----------------------------------------------------------------------
    */

    $check = mysqli_prepare(
        $conn,
        "SELECT id_pesanan FROM pesanan WHERE id_pesanan = ? LIMIT 1"
    );

    mysqli_stmt_bind_param($check, "i", $id);
    mysqli_stmt_execute($check);

    $result = mysqli_stmt_get_result($check);

    if (mysqli_num_rows($result) === 0) {

        mysqli_stmt_close($check);

        responseJson(
            false,
            "Pesanan tidak ditemukan.",
            [],
            404
        );
    }

    mysqli_stmt_close($check);

    /*
    |----------------------------------------------------------------------
    | DELETE
    |----------------------------------------------------------------------
    */

    $stmt = mysqli_prepare(
        $conn,
        "DELETE FROM pesanan WHERE id_pesanan = ?"
    );

    if (!$stmt) {
        responseJson(
            false,
            "Gagal menyiapkan query hapus.",
            [],
            500
        );
    }

    mysqli_stmt_bind_param($stmt, "i", $id);

    if (!mysqli_stmt_execute($stmt)) {

        $error = mysqli_stmt_error($stmt);

        mysqli_stmt_close($stmt);

        responseJson(
            false,
            "Gagal menghapus pesanan.",
            [
                "error" => $error
            ],
            500
        );
    }

    mysqli_stmt_close($stmt);

    responseJson(
        true,
        "Pesanan berhasil dihapus.",
        []
    );
}


/*
|--------------------------------------------------------------------------
| METHOD TIDAK DIDUKUNG
|--------------------------------------------------------------------------
*/

responseJson(
    false,
    "Method tidak didukung.",
    [],
    405
);
