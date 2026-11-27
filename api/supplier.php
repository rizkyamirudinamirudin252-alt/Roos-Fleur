<?php

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config/admin_guard.php';

require_once __DIR__ . '/../config/database.php';


/*
|--------------------------------------------------------------------------
| HANDLE PREFLIGHT OPTIONS
|--------------------------------------------------------------------------
*/

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}


/*
|--------------------------------------------------------------------------
| CEK KONEKSI DATABASE
|--------------------------------------------------------------------------
*/

if (!isset($conn) || !$conn) {
    http_response_code(500);

    echo json_encode([
        'status' => false,
        'message' => 'Koneksi database tidak ditemukan.',
        'error' => 'Variabel $conn tidak tersedia dari config/database.php'
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

    exit;
}


/*
|--------------------------------------------------------------------------
| FUNGSI RESPONSE
|--------------------------------------------------------------------------
*/

function responseJson(
    bool $status,
    string $message,
    array $data = [],
    ?string $error = null,
    int $httpCode = 200
) {
    http_response_code($httpCode);

    $response = [
        'status' => $status,
        'message' => $message,
        'jumlah' => count($data),
        'data' => $data
    ];

    if ($error !== null) {
        $response['error'] = $error;
    }

    echo json_encode(
        $response,
        JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE
    );

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
| Ambil semua data supplier
|--------------------------------------------------------------------------
*/

if ($method === 'GET') {

    $sql = "
        SELECT
            id_supplier,
            kode_supplier,
            nama_supplier,
            kota,
            lead_time,
            item_disediakan,
            rating,
            telepon,
            alamat,
            created_at
        FROM supplier
        ORDER BY id_supplier DESC
    ";

    $result = mysqli_query($conn, $sql);

    if (!$result) {

        responseJson(
            false,
            'Gagal mengambil data supplier.',
            [],
            mysqli_error($conn),
            500
        );
    }

    $data = [];

    while ($row = mysqli_fetch_assoc($result)) {
        $data[] = $row;
    }

    responseJson(
        true,
        'Data supplier berhasil diambil.',
        $data
    );
}


/*
|--------------------------------------------------------------------------
| POST
| Tambah supplier
|--------------------------------------------------------------------------
*/

if ($method === 'POST') {

    $input = json_decode(
        file_get_contents('php://input'),
        true
    );

    if (!is_array($input)) {
        $input = $_POST;
    }


    /*
    |--------------------------------------------------------------------------
    | AMBIL DATA
    |--------------------------------------------------------------------------
    */

    $kode_supplier = trim($input['kode_supplier'] ?? '');
    $nama_supplier = trim($input['nama_supplier'] ?? '');
    $kota = trim($input['kota'] ?? '');
    $lead_time = trim($input['lead_time'] ?? '');
    $item_disediakan = trim($input['item_disediakan'] ?? '');
    $rating = $input['rating'] ?? null;
    $telepon = trim($input['telepon'] ?? '');
    $alamat = trim($input['alamat'] ?? '');


    /*
    |--------------------------------------------------------------------------
    | VALIDASI
    |--------------------------------------------------------------------------
    */

    if ($kode_supplier === '') {

        responseJson(
            false,
            'Kode supplier wajib diisi.',
            [],
            null,
            400
        );
    }

    if ($nama_supplier === '') {

        responseJson(
            false,
            'Nama supplier wajib diisi.',
            [],
            null,
            400
        );
    }


    /*
    |--------------------------------------------------------------------------
    | CEK KODE SUPPLIER
    |--------------------------------------------------------------------------
    */

    $check = mysqli_prepare(
        $conn,
        "SELECT id_supplier
         FROM supplier
         WHERE kode_supplier = ?
         LIMIT 1"
    );

    if (!$check) {

        responseJson(
            false,
            'Gagal menyiapkan pengecekan kode supplier.',
            [],
            mysqli_error($conn),
            500
        );
    }

    mysqli_stmt_bind_param(
        $check,
        "s",
        $kode_supplier
    );

    mysqli_stmt_execute($check);

    $checkResult = mysqli_stmt_get_result($check);

    if ($checkResult && mysqli_num_rows($checkResult) > 0) {

        responseJson(
            false,
            'Kode supplier sudah digunakan.',
            [],
            null,
            409
        );
    }


    /*
    |--------------------------------------------------------------------------
    | INSERT
    |--------------------------------------------------------------------------
    */

    $stmt = mysqli_prepare(
        $conn,
        "INSERT INTO supplier
        (
            kode_supplier,
            nama_supplier,
            kota,
            lead_time,
            item_disediakan,
            rating,
            telepon,
            alamat
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );

    if (!$stmt) {

        responseJson(
            false,
            'Gagal menyiapkan query insert supplier.',
            [],
            mysqli_error($conn),
            500
        );
    }


    mysqli_stmt_bind_param(
        $stmt,
        "sssssdss",
        $kode_supplier,
        $nama_supplier,
        $kota,
        $lead_time,
        $item_disediakan,
        $rating,
        $telepon,
        $alamat
    );


    if (!mysqli_stmt_execute($stmt)) {

        responseJson(
            false,
            'Gagal menambahkan supplier.',
            [],
            mysqli_stmt_error($stmt),
            500
        );
    }


    $id_supplier = mysqli_insert_id($conn);


    /*
    |--------------------------------------------------------------------------
    | AMBIL DATA YANG BARU DIBUAT
    |--------------------------------------------------------------------------
    */

    $newData = mysqli_query(
        $conn,
        "SELECT
            id_supplier,
            kode_supplier,
            nama_supplier,
            kota,
            lead_time,
            item_disediakan,
            rating,
            telepon,
            alamat,
            created_at
         FROM supplier
         WHERE id_supplier = $id_supplier"
    );


    $data = [];

    if ($newData) {
        $data[] = mysqli_fetch_assoc($newData);
    }


    responseJson(
        true,
        'Supplier berhasil ditambahkan.',
        $data,
        null,
        201
    );
}


/*
|--------------------------------------------------------------------------
| PUT
| Update supplier
|--------------------------------------------------------------------------
*/

if ($method === 'PUT') {

    $input = json_decode(
        file_get_contents('php://input'),
        true
    );

    if (!is_array($input)) {

        responseJson(
            false,
            'Data JSON tidak valid.',
            [],
            null,
            400
        );
    }


    /*
    |--------------------------------------------------------------------------
    | ID
    |--------------------------------------------------------------------------
    */

    $id_supplier = $input['id_supplier'] ?? null;

    if (!$id_supplier) {

        responseJson(
            false,
            'id_supplier wajib diisi.',
            [],
            null,
            400
        );
    }


    /*
    |--------------------------------------------------------------------------
    | DATA
    |--------------------------------------------------------------------------
    */

    $kode_supplier = trim($input['kode_supplier'] ?? '');
    $nama_supplier = trim($input['nama_supplier'] ?? '');
    $kota = trim($input['kota'] ?? '');
    $lead_time = trim($input['lead_time'] ?? '');
    $item_disediakan = trim($input['item_disediakan'] ?? '');
    $rating = $input['rating'] ?? null;
    $telepon = trim($input['telepon'] ?? '');
    $alamat = trim($input['alamat'] ?? '');


    /*
    |--------------------------------------------------------------------------
    | VALIDASI
    |--------------------------------------------------------------------------
    */

    if ($kode_supplier === '') {

        responseJson(
            false,
            'Kode supplier wajib diisi.',
            [],
            null,
            400
        );
    }

    if ($nama_supplier === '') {

        responseJson(
            false,
            'Nama supplier wajib diisi.',
            [],
            null,
            400
        );
    }


    /*
    |--------------------------------------------------------------------------
    | CEK SUPPLIER
    |--------------------------------------------------------------------------
    */

    $check = mysqli_prepare(
        $conn,
        "SELECT id_supplier
         FROM supplier
         WHERE id_supplier = ?
         LIMIT 1"
    );

    if (!$check) {

        responseJson(
            false,
            'Gagal menyiapkan pengecekan supplier.',
            [],
            mysqli_error($conn),
            500
        );
    }

    mysqli_stmt_bind_param(
        $check,
        "i",
        $id_supplier
    );

    mysqli_stmt_execute($check);

    $checkResult = mysqli_stmt_get_result($check);

    if (!$checkResult || mysqli_num_rows($checkResult) === 0) {

        responseJson(
            false,
            'Supplier tidak ditemukan.',
            [],
            null,
            404
        );
    }


    /*
    |--------------------------------------------------------------------------
    | UPDATE
    |--------------------------------------------------------------------------
    */

    $stmt = mysqli_prepare(
        $conn,
        "UPDATE supplier SET
            kode_supplier = ?,
            nama_supplier = ?,
            kota = ?,
            lead_time = ?,
            item_disediakan = ?,
            rating = ?,
            telepon = ?,
            alamat = ?
        WHERE id_supplier = ?"
    );

    if (!$stmt) {

        responseJson(
            false,
            'Gagal menyiapkan query update supplier.',
            [],
            mysqli_error($conn),
            500
        );
    }


    mysqli_stmt_bind_param(
        $stmt,
        "sssssdssi",
        $kode_supplier,
        $nama_supplier,
        $kota,
        $lead_time,
        $item_disediakan,
        $rating,
        $telepon,
        $alamat,
        $id_supplier
    );


    if (!mysqli_stmt_execute($stmt)) {

        responseJson(
            false,
            'Gagal memperbarui supplier.',
            [],
            mysqli_stmt_error($stmt),
            500
        );
    }


    /*
    |--------------------------------------------------------------------------
    | AMBIL DATA TERBARU
    |--------------------------------------------------------------------------
    */

    $result = mysqli_query(
        $conn,
        "SELECT
            id_supplier,
            kode_supplier,
            nama_supplier,
            kota,
            lead_time,
            item_disediakan,
            rating,
            telepon,
            alamat,
            created_at
         FROM supplier
         WHERE id_supplier = $id_supplier"
    );


    $data = [];

    if ($result) {
        $data[] = mysqli_fetch_assoc($result);
    }


    responseJson(
        true,
        'Supplier berhasil diperbarui.',
        $data
    );
}


/*
|--------------------------------------------------------------------------
| DELETE
| Hapus supplier
|--------------------------------------------------------------------------
*/

if ($method === 'DELETE') {

    $input = json_decode(
        file_get_contents('php://input'),
        true
    );

    if (!is_array($input)) {
        $input = [];
    }


    $id_supplier =
        $input['id_supplier']
        ?? ($_GET['id_supplier'] ?? null);


    if (!$id_supplier) {

        responseJson(
            false,
            'id_supplier wajib diisi.',
            [],
            null,
            400
        );
    }


    /*
    |--------------------------------------------------------------------------
    | CEK SUPPLIER
    |--------------------------------------------------------------------------
    */

    $check = mysqli_prepare(
        $conn,
        "SELECT id_supplier
         FROM supplier
         WHERE id_supplier = ?
         LIMIT 1"
    );

    if (!$check) {

        responseJson(
            false,
            'Gagal menyiapkan pengecekan supplier.',
            [],
            mysqli_error($conn),
            500
        );
    }

    mysqli_stmt_bind_param(
        $check,
        "i",
        $id_supplier
    );

    mysqli_stmt_execute($check);

    $checkResult = mysqli_stmt_get_result($check);

    if (!$checkResult || mysqli_num_rows($checkResult) === 0) {

        responseJson(
            false,
            'Supplier tidak ditemukan.',
            [],
            null,
            404
        );
    }


    /*
    |--------------------------------------------------------------------------
    | DELETE
    |--------------------------------------------------------------------------
    */

    $stmt = mysqli_prepare(
        $conn,
        "DELETE FROM supplier
         WHERE id_supplier = ?"
    );

    if (!$stmt) {

        responseJson(
            false,
            'Gagal menyiapkan query delete supplier.',
            [],
            mysqli_error($conn),
            500
        );
    }


    mysqli_stmt_bind_param(
        $stmt,
        "i",
        $id_supplier
    );


    if (!mysqli_stmt_execute($stmt)) {

        responseJson(
            false,
            'Gagal menghapus supplier.',
            [],
            mysqli_stmt_error($stmt),
            500
        );
    }


    responseJson(
        true,
        'Supplier berhasil dihapus.',
        [
            [
                'id_supplier' => $id_supplier
            ]
        ]
    );
}


/*
|--------------------------------------------------------------------------
| METHOD TIDAK DIDUKUNG
|--------------------------------------------------------------------------
*/

responseJson(
    false,
    'Method tidak didukung.',
    [],
    'Gunakan GET, POST, PUT, atau DELETE.',
    405
);
