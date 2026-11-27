<?php

header("Content-Type: application/json; charset=UTF-8");
if (session_status() !== PHP_SESSION_ACTIVE) session_start();

require_once __DIR__ . "/../config/database.php";


/*
|--------------------------------------------------------------------------
| RESPONSE DEFAULT
|--------------------------------------------------------------------------
*/

$response = [
    "status"  => false,
    "message" => "",
    "data"    => []
];


/*
|--------------------------------------------------------------------------
| HELPER RESPONSE
|--------------------------------------------------------------------------
*/

function sendResponse(
    bool $status,
    string $message,
    array $data = [],
    int $httpCode = 200
) {
    http_response_code($httpCode);

    echo json_encode(
        [
            "status"  => $status,
            "message" => $message,
            "data"    => $data
        ],
        JSON_PRETTY_PRINT |
        JSON_UNESCAPED_UNICODE
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| HELPER URL FOTO
|--------------------------------------------------------------------------
|
| SEMUA FOTO PRODUK LOKAL DISIMPAN DI:
|
| roos-fleur/uploads/
|
*/

function getFotoUrl($foto)
{
    if (empty($foto)) {
        return null;
    }

    /*
     * Kalau sudah berupa URL lengkap,
     * langsung gunakan.
     */
    if (
        filter_var(
            $foto,
            FILTER_VALIDATE_URL
        )
    ) {
        return $foto;
    }

    /*
     * Kalau sudah berupa path /roos-fleur/...
     */
    if (
        strpos($foto, "/roos-fleur/") === 0
    ) {
        return $foto;
    }

    /*
     * Foto lokal.
     */
    return "/roos-fleur/uploads/" . basename($foto);
}


/*
|--------------------------------------------------------------------------
| HELPER HAPUS FOTO LOKAL
|--------------------------------------------------------------------------
*/

function deleteLocalPhoto($foto)
{
    if (empty($foto)) {
        return;
    }

    /*
     * Jangan hapus URL eksternal.
     */
    if (
        filter_var(
            $foto,
            FILTER_VALIDATE_URL
        )
    ) {
        return;
    }

    /*
     * basename() mencegah path traversal.
     */
    $filename = basename($foto);

    if ($filename === "") {
        return;
    }

    $fotoPath =
        __DIR__ .
        "/../uploads/" .
        $filename;

    if (
        file_exists($fotoPath) &&
        is_file($fotoPath)
    ) {
        @unlink($fotoPath);
    }
}


/*
|--------------------------------------------------------------------------
| HELPER UPLOAD FOTO
|--------------------------------------------------------------------------
|
| Return:
| - nama file jika berhasil
| - null jika tidak ada file
|
*/

function uploadProductPhoto()
{
    /*
     * Tidak ada file baru.
     */
    if (
        !isset($_FILES["foto"]) ||
        $_FILES["foto"]["error"] === UPLOAD_ERR_NO_FILE
    ) {
        return null;
    }


    /*
     * Error upload.
     */
    if (
        $_FILES["foto"]["error"] !== UPLOAD_ERR_OK
    ) {
        throw new Exception(
            "Upload foto gagal. Kode error: " .
            $_FILES["foto"]["error"]
        );
    }


    /*
     * Maksimal 5 MB.
     */
    $maxSize = 5 * 1024 * 1024;

    if (
        $_FILES["foto"]["size"] > $maxSize
    ) {
        throw new Exception(
            "Ukuran foto maksimal 5 MB."
        );
    }


    /*
     * Pastikan file benar-benar ada.
     */
    $tmpFile =
        $_FILES["foto"]["tmp_name"];

    if (
        !is_uploaded_file($tmpFile)
    ) {
        throw new Exception(
            "File foto tidak valid."
        );
    }


    /*
     * Validasi MIME menggunakan server.
     */
    $mimeType =
        mime_content_type($tmpFile);


    $allowedTypes = [
        "image/jpeg" => "jpg",
        "image/png"  => "png",
        "image/webp" => "webp"
    ];


    if (
        !isset(
            $allowedTypes[$mimeType]
        )
    ) {
        throw new Exception(
            "Format foto harus JPG, PNG, atau WEBP."
        );
    }


    /*
     * Folder upload:
     *
     * /roos-fleur/uploads/
     */
    $uploadDir =
        __DIR__ .
        "/../uploads/";


    /*
     * Buat folder jika belum ada.
     */
    if (
        !is_dir($uploadDir)
    ) {
        if (
            !mkdir(
                $uploadDir,
                0777,
                true
            )
        ) {
            throw new Exception(
                "Folder uploads tidak dapat dibuat."
            );
        }
    }


    /*
     * Cek izin tulis.
     */
    if (
        !is_writable($uploadDir)
    ) {
        throw new Exception(
            "Folder uploads tidak memiliki izin tulis."
        );
    }


    /*
     * Nama file unik.
     */
    $extension =
        $allowedTypes[$mimeType];

    $namaFoto =
        "produk_" .
        date("YmdHis") .
        "_" .
        uniqid() .
        "." .
        $extension;


    $destination =
        $uploadDir .
        $namaFoto;


    /*
     * Pindahkan file.
     */
    if (
        !move_uploaded_file(
            $tmpFile,
            $destination
        )
    ) {
        throw new Exception(
            "Foto gagal disimpan ke server."
        );
    }


    return $namaFoto;
}


/*
|--------------------------------------------------------------------------
| CEK DATABASE
|--------------------------------------------------------------------------
*/

try {

    // Katalog tetap dapat dibaca publik, tetapi semua perubahan hanya untuk admin.
    if ($_SERVER["REQUEST_METHOD"] !== "GET" && (($_SESSION['user']['peran'] ?? '') !== 'admin')) {
        sendResponse(false, "Silakan masuk sebagai admin untuk mengelola produk.", [], 401);
    }

    if (
        !isset($conn) ||
        !$conn
    ) {
        throw new Exception(
            "Koneksi database tidak ditemukan."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | GET
    |--------------------------------------------------------------------------
    | Mengambil semua produk.
    */

    if (
        $_SERVER["REQUEST_METHOD"] === "GET"
    ) {

        $sql = "
            SELECT
                id_produk,
                kode_produk,
                nama_produk,
                kategori,
                deskripsi,
                harga,
                hpp,
                stok,
                satuan,
                foto,
                status,
                created_at,
                updated_at
            FROM produk
            ORDER BY id_produk DESC
        ";


        $result =
            mysqli_query(
                $conn,
                $sql
            );


        if (!$result) {
            throw new Exception(
                mysqli_error($conn)
            );
        }


        $produk = [];


        while (
            $row =
                mysqli_fetch_assoc($result)
        ) {

            /*
             * Tambahkan URL foto.
             */
            $row["foto_url"] =
                getFotoUrl(
                    $row["foto"] ?? null
                );


            $produk[] = $row;
        }


        sendResponse(
            true,
            "Data produk berhasil diambil.",
            [
                "jumlah" => count($produk),
                "produk" => $produk
            ]
        );
    }


    /*
    |--------------------------------------------------------------------------
    | POST
    |--------------------------------------------------------------------------
    |
    | Ada dua mode:
    |
    | 1. POST biasa
    |    => tambah produk
    |
    | 2. POST action=update
    |    => edit produk
    |
    |
    | PENTING:
    | action=update diperiksa LEBIH DULU.
    */

    if (
        $_SERVER["REQUEST_METHOD"] === "POST" &&
        (
            ($_POST["action"] ?? "") === "update"
        )
    ) {

        /*
        |--------------------------------------------------------------------------
        | UPDATE PRODUK
        |--------------------------------------------------------------------------
        */

        $id_produk =
            (int)(
                $_POST["id_produk"] ?? 0
            );


        if (
            $id_produk <= 0
        ) {
            throw new Exception(
                "ID produk tidak valid."
            );
        }


        /*
        |--------------------------------------------------------------------------
        | AMBIL DATA
        |--------------------------------------------------------------------------
        */

        $kode_produk =
            trim(
                $_POST["kode_produk"] ?? ""
            );

        $nama_produk =
            trim(
                $_POST["nama_produk"] ?? ""
            );

        $kategori =
            trim(
                $_POST["kategori"] ?? ""
            );

        $deskripsi =
            trim(
                $_POST["deskripsi"] ?? ""
            );

        $harga =
            $_POST["harga"] ?? 0;

        $hpp =
            $_POST["hpp"] ?? 0;

        $stok =
            $_POST["stok"] ?? 0;

        $satuan =
            trim(
                $_POST["satuan"] ?? ""
            );

        $status =
            trim(
                $_POST["status"] ?? "Aktif"
            );


        /*
        |--------------------------------------------------------------------------
        | VALIDASI
        |--------------------------------------------------------------------------
        */

        if (
            $kode_produk === ""
        ) {
            throw new Exception(
                "Kode produk wajib diisi."
            );
        }


        if (
            $nama_produk === ""
        ) {
            throw new Exception(
                "Nama produk wajib diisi."
            );
        }


        if (
            $kategori === ""
        ) {
            throw new Exception(
                "Kategori produk wajib diisi."
            );
        }


        if (
            !is_numeric($harga) ||
            $harga <= 0
        ) {
            throw new Exception(
                "Harga produk tidak valid."
            );
        }


        if (
            !is_numeric($hpp) ||
            $hpp < 0
        ) {
            throw new Exception(
                "HPP produk tidak valid."
            );
        }


        if (
            !is_numeric($stok) ||
            $stok < 0
        ) {
            throw new Exception(
                "Stok produk tidak valid."
            );
        }


        if (
            $satuan === ""
        ) {
            $satuan = "pcs";
        }


        /*
        |--------------------------------------------------------------------------
        | AMBIL DATA PRODUK LAMA
        |--------------------------------------------------------------------------
        */

        $sqlOld = "
            SELECT
                id_produk,
                foto
            FROM produk
            WHERE id_produk = ?
            LIMIT 1
        ";


        $stmtOld =
            mysqli_prepare(
                $conn,
                $sqlOld
            );


        if (!$stmtOld) {
            throw new Exception(
                mysqli_error($conn)
            );
        }


        mysqli_stmt_bind_param(
            $stmtOld,
            "i",
            $id_produk
        );


        if (
            !mysqli_stmt_execute(
                $stmtOld
            )
        ) {
            throw new Exception(
                mysqli_stmt_error(
                    $stmtOld
                )
            );
        }


        $resultOld =
            mysqli_stmt_get_result(
                $stmtOld
            );


        $produkLama =
            mysqli_fetch_assoc(
                $resultOld
            );


        mysqli_stmt_close(
            $stmtOld
        );


        if (
            !$produkLama
        ) {
            throw new Exception(
                "Produk tidak ditemukan."
            );
        }


        $fotoLama =
            $produkLama["foto"] ?? null;


        /*
        |--------------------------------------------------------------------------
        | FOTO BARU
        |--------------------------------------------------------------------------
        |
        | Kalau tidak upload foto:
        | foto lama tetap dipakai.
        |
        */

        $fotoBaru =
            uploadProductPhoto();


        /*
        |--------------------------------------------------------------------------
        | TENTUKAN FOTO YANG DISIMPAN
        |--------------------------------------------------------------------------
        */

        $fotoUntukDatabase =
            $fotoBaru !== null
                ? $fotoBaru
                : $fotoLama;


        /*
        |--------------------------------------------------------------------------
        | UPDATE DATABASE
        |--------------------------------------------------------------------------
        */

        $sqlUpdate = "
            UPDATE produk
            SET
                kode_produk = ?,
                nama_produk = ?,
                kategori = ?,
                deskripsi = ?,
                harga = ?,
                hpp = ?,
                stok = ?,
                satuan = ?,
                foto = ?,
                status = ?
            WHERE id_produk = ?
        ";


        $stmtUpdate =
            mysqli_prepare(
                $conn,
                $sqlUpdate
            );


        if (!$stmtUpdate) {

            /*
             * Kalau database gagal disiapkan
             * dan foto baru sudah terupload,
             * hapus foto baru.
             */
            if (
                $fotoBaru !== null
            ) {
                deleteLocalPhoto(
                    $fotoBaru
                );
            }

            throw new Exception(
                mysqli_error($conn)
            );
        }


        /*
         * s = string
         * d = decimal
         * i = integer
         *
         * 11 parameter:
         *
         * kode       s
         * nama       s
         * kategori   s
         * deskripsi  s
         * harga      d
         * hpp        d
         * stok       i
         * satuan     s
         * foto       s
         * status     s
         * id         i
         */
        mysqli_stmt_bind_param(
            $stmtUpdate,
            "ssssddisssi",
            $kode_produk,
            $nama_produk,
            $kategori,
            $deskripsi,
            $harga,
            $hpp,
            $stok,
            $satuan,
            $fotoUntukDatabase,
            $status,
            $id_produk
        );


        if (
            !mysqli_stmt_execute(
                $stmtUpdate
            )
        ) {

            /*
             * Database gagal.
             * Foto baru jangan dibiarkan.
             */
            if (
                $fotoBaru !== null
            ) {
                deleteLocalPhoto(
                    $fotoBaru
                );
            }


            $error =
                mysqli_stmt_error(
                    $stmtUpdate
                );


            mysqli_stmt_close(
                $stmtUpdate
            );


            throw new Exception(
                $error
            );
        }


        mysqli_stmt_close(
            $stmtUpdate
        );


        /*
        |--------------------------------------------------------------------------
        | HAPUS FOTO LAMA
        |--------------------------------------------------------------------------
        |
        | Hanya jika:
        |
        | - foto baru berhasil disimpan
        | - database berhasil di-update
        |
        | Jadi foto lama tidak hilang
        | kalau proses gagal.
        */

        if (
            $fotoBaru !== null &&
            !empty($fotoLama) &&
            $fotoLama !== $fotoBaru
        ) {

            deleteLocalPhoto(
                $fotoLama
            );
        }


        /*
        |--------------------------------------------------------------------------
        | RESPONSE UPDATE
        |--------------------------------------------------------------------------
        */

        sendResponse(
            true,
            "Produk berhasil diperbarui.",
            [
                "id_produk" =>
                    $id_produk,

                "kode_produk" =>
                    $kode_produk,

                "nama_produk" =>
                    $nama_produk,

                "foto" =>
                    $fotoUntukDatabase,

                "foto_url" =>
                    getFotoUrl(
                        $fotoUntukDatabase
                    )
            ]
        );
    }


    /*
    |--------------------------------------------------------------------------
    | POST BIASA
    |--------------------------------------------------------------------------
    | TAMBAH PRODUK BARU
    */

    if (
        $_SERVER["REQUEST_METHOD"] === "POST"
    ) {

        /*
        |--------------------------------------------------------------------------
        | AMBIL DATA
        |--------------------------------------------------------------------------
        */

        $kode_produk =
            trim(
                $_POST["kode_produk"] ?? ""
            );

        $nama_produk =
            trim(
                $_POST["nama_produk"] ?? ""
            );

        $kategori =
            trim(
                $_POST["kategori"] ?? ""
            );

        $deskripsi =
            trim(
                $_POST["deskripsi"] ?? ""
            );

        $harga =
            $_POST["harga"] ?? 0;

        $hpp =
            $_POST["hpp"] ?? 0;

        $stok =
            $_POST["stok"] ?? 0;

        $satuan =
            trim(
                $_POST["satuan"] ?? ""
            );

        $status =
            trim(
                $_POST["status"] ?? "Aktif"
            );


        /*
        |--------------------------------------------------------------------------
        | VALIDASI
        |--------------------------------------------------------------------------
        */

        if (
            $kode_produk === ""
        ) {
            throw new Exception(
                "Kode produk wajib diisi."
            );
        }


        if (
            $nama_produk === ""
        ) {
            throw new Exception(
                "Nama produk wajib diisi."
            );
        }


        if (
            $kategori === ""
        ) {
            throw new Exception(
                "Kategori produk wajib diisi."
            );
        }


        if (
            !is_numeric($harga) ||
            $harga <= 0
        ) {
            throw new Exception(
                "Harga produk tidak valid."
            );
        }


        if (
            !is_numeric($hpp) ||
            $hpp < 0
        ) {
            throw new Exception(
                "HPP produk tidak valid."
            );
        }


        if (
            !is_numeric($stok) ||
            $stok < 0
        ) {
            throw new Exception(
                "Stok produk tidak valid."
            );
        }


        if (
            $satuan === ""
        ) {
            $satuan = "pcs";
        }


        /*
        |--------------------------------------------------------------------------
        | CEK KODE PRODUK DUPLIKAT
        |--------------------------------------------------------------------------
        */

        $sqlCheck = "
            SELECT id_produk
            FROM produk
            WHERE kode_produk = ?
            LIMIT 1
        ";


        $stmtCheck =
            mysqli_prepare(
                $conn,
                $sqlCheck
            );


        if (!$stmtCheck) {
            throw new Exception(
                mysqli_error($conn)
            );
        }


        mysqli_stmt_bind_param(
            $stmtCheck,
            "s",
            $kode_produk
        );


        mysqli_stmt_execute(
            $stmtCheck
        );


        $resultCheck =
            mysqli_stmt_get_result(
                $stmtCheck
            );


        $existingProduct =
            mysqli_fetch_assoc(
                $resultCheck
            );


        mysqli_stmt_close(
            $stmtCheck
        );


        if (
            $existingProduct
        ) {
            throw new Exception(
                "Kode produk sudah digunakan."
            );
        }


        /*
        |--------------------------------------------------------------------------
        | UPLOAD FOTO
        |--------------------------------------------------------------------------
        */

        $namaFoto =
            uploadProductPhoto();

        if ($namaFoto === null && !empty($_POST['foto_url'])) {
            $externalPhoto = filter_var(trim($_POST['foto_url']), FILTER_VALIDATE_URL);
            if (!$externalPhoto || !in_array(parse_url($externalPhoto, PHP_URL_SCHEME), ['http', 'https'], true)) {
                throw new Exception('URL foto harus menggunakan alamat HTTP atau HTTPS yang valid.');
            }
            $namaFoto = $externalPhoto;
        }


        /*
        |--------------------------------------------------------------------------
        | INSERT DATABASE
        |--------------------------------------------------------------------------
        */

        $sqlInsert = "
            INSERT INTO produk
            (
                kode_produk,
                nama_produk,
                kategori,
                deskripsi,
                harga,
                hpp,
                stok,
                satuan,
                foto,
                status
            )
            VALUES
            (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        ";


        $stmtInsert =
            mysqli_prepare(
                $conn,
                $sqlInsert
            );


        if (!$stmtInsert) {

            /*
             * Kalau prepare database gagal,
             * hapus foto yang baru diupload.
             */
            if (
                $namaFoto !== null
            ) {
                deleteLocalPhoto(
                    $namaFoto
                );
            }


            throw new Exception(
                mysqli_error($conn)
            );
        }


        mysqli_stmt_bind_param(
            $stmtInsert,
            "ssssddisss",
            $kode_produk,
            $nama_produk,
            $kategori,
            $deskripsi,
            $harga,
            $hpp,
            $stok,
            $satuan,
            $namaFoto,
            $status
        );


        /*
        |--------------------------------------------------------------------------
        | EXECUTE
        |--------------------------------------------------------------------------
        */

        if (
            !mysqli_stmt_execute(
                $stmtInsert
            )
        ) {

            /*
             * Database gagal.
             * Hapus foto yang sudah terupload.
             */
            if (
                $namaFoto !== null
            ) {
                deleteLocalPhoto(
                    $namaFoto
                );
            }


            $error =
                mysqli_stmt_error(
                    $stmtInsert
                );


            mysqli_stmt_close(
                $stmtInsert
            );


            throw new Exception(
                $error
            );
        }


        /*
        |--------------------------------------------------------------------------
        | ID PRODUK
        |--------------------------------------------------------------------------
        */

        $idProduk =
            mysqli_insert_id(
                $conn
            );


        mysqli_stmt_close(
            $stmtInsert
        );


        /*
        |--------------------------------------------------------------------------
        | RESPONSE
        |--------------------------------------------------------------------------
        */

        sendResponse(
            true,
            "Produk berhasil disimpan.",
            [
                "id_produk" =>
                    $idProduk,

                "kode_produk" =>
                    $kode_produk,

                "nama_produk" =>
                    $nama_produk,

                "foto" =>
                    $namaFoto,

                "foto_url" =>
                    getFotoUrl(
                        $namaFoto
                    )
            ]
        );
    }


    /*
    |--------------------------------------------------------------------------
    | DELETE
    |--------------------------------------------------------------------------
    */

    if (
        $_SERVER["REQUEST_METHOD"] === "DELETE"
    ) {

        /*
        |--------------------------------------------------------------------------
        | AMBIL ID
        |--------------------------------------------------------------------------
        */

        $id_produk =
            $_GET["id_produk"] ?? "";


        $id_produk =
            (int)$id_produk;


        if (
            $id_produk <= 0
        ) {
            throw new Exception(
                "ID produk tidak valid."
            );
        }


        /*
        |--------------------------------------------------------------------------
        | CARI PRODUK
        |--------------------------------------------------------------------------
        */

        $sqlFind = "
            SELECT
                id_produk,
                foto
            FROM produk
            WHERE id_produk = ?
            LIMIT 1
        ";


        $stmtFind =
            mysqli_prepare(
                $conn,
                $sqlFind
            );


        if (!$stmtFind) {
            throw new Exception(
                mysqli_error($conn)
            );
        }


        mysqli_stmt_bind_param(
            $stmtFind,
            "i",
            $id_produk
        );


        if (
            !mysqli_stmt_execute(
                $stmtFind
            )
        ) {
            throw new Exception(
                mysqli_stmt_error(
                    $stmtFind
                )
            );
        }


        $resultFind =
            mysqli_stmt_get_result(
                $stmtFind
            );


        $produk =
            mysqli_fetch_assoc(
                $resultFind
            );


        mysqli_stmt_close(
            $stmtFind
        );


        if (
            !$produk
        ) {
            throw new Exception(
                "Produk tidak ditemukan."
            );
        }


        $fotoProduk =
            $produk["foto"] ?? null;


        /*
        |--------------------------------------------------------------------------
        | HAPUS DATABASE
        |--------------------------------------------------------------------------
        */

        $sqlDelete = "
            DELETE FROM produk
            WHERE id_produk = ?
        ";


        $stmtDelete =
            mysqli_prepare(
                $conn,
                $sqlDelete
            );


        if (!$stmtDelete) {
            throw new Exception(
                mysqli_error($conn)
            );
        }


        mysqli_stmt_bind_param(
            $stmtDelete,
            "i",
            $id_produk
        );


        if (
            !mysqli_stmt_execute(
                $stmtDelete
            )
        ) {

            $error =
                mysqli_stmt_error(
                    $stmtDelete
                );


            mysqli_stmt_close(
                $stmtDelete
            );


            throw new Exception(
                $error
            );
        }


        mysqli_stmt_close(
            $stmtDelete
        );


        /*
        |--------------------------------------------------------------------------
        | HAPUS FOTO
        |--------------------------------------------------------------------------
        */

        if (
            !empty($fotoProduk)
        ) {

            deleteLocalPhoto(
                $fotoProduk
            );
        }


        /*
        |--------------------------------------------------------------------------
        | RESPONSE
        |--------------------------------------------------------------------------
        */

        sendResponse(
            true,
            "Produk berhasil dihapus.",
            [
                "id_produk" =>
                    $id_produk
            ]
        );
    }


    /*
    |--------------------------------------------------------------------------
    | METHOD TIDAK DIDUKUNG
    |--------------------------------------------------------------------------
    */

    sendResponse(
        false,
        "Method tidak diperbolehkan.",
        [],
        405
    );


} catch (Throwable $e) {

    /*
    |--------------------------------------------------------------------------
    | ERROR HANDLER
    |--------------------------------------------------------------------------
    */

    http_response_code(500);

    echo json_encode(
        [
            "status"  => false,
            "message" => $e->getMessage(),
            "data"    => []
        ],
        JSON_PRETTY_PRINT |
        JSON_UNESCAPED_UNICODE
    );

    exit;
}
