<?php
// GANTI nilai ini dengan detail database dari InfinityFree.
// Atau pulihkan config/database.php yang sudah dicadangkan dari hosting lama.
$host = "ISI_HOST_MYSQL_INFINITYFREE";
$username = "ISI_USERNAME_DATABASE";
$password = "ISI_PASSWORD_DATABASE";
$database = "ISI_NAMA_DATABASE";

$conn = mysqli_connect($host, $username, $password, $database);
if (!$conn) {
    http_response_code(500);
    die("Koneksi database gagal. Periksa config/database.php hosting.");
}
mysqli_set_charset($conn, "utf8mb4");
