<?php

require_once __DIR__ . "/../config/database.php";

class Produk
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function getAll()
    {
        $sql = "
            SELECT 
                p.id_produk,
                p.kode_produk,
                p.id_kategori,
                p.nama_produk,
                p.deskripsi,
                p.harga,
                p.hpp,
                p.gambar,
                p.tag,
                p.status,
                p.created_at,
                p.updated_at,
                k.nama_kategori
            FROM produk_buket p
            LEFT JOIN kategori k
                ON p.id_kategori = k.id_kategori
            ORDER BY p.id_produk ASC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}