# Roos & Fleur

Demo toko bunga untuk tugas mata kuliah **Rekayasa E-Bisnis** dan **ERP**.

## Menjalankan demo

1. Jalankan modul **Apache** dan **MySQL** di XAMPP.
2. Pastikan database `roos_fleur` dan tabel yang digunakan project tersedia. Koneksi saat ini memakai `root` tanpa kata sandi, sesuai konfigurasi XAMPP lokal pada [config/database.php](config/database.php).
3. Buka `http://localhost/roos-fleur/`.
4. Untuk pertama kali, buka **Portal Admin** dan buat admin awal menggunakan email dan kata sandi minimal 12 karakter. Setup admin pertama dibatasi ke komputer server.
5. Setelah masuk, gunakan menu admin untuk demo dashboard, katalog, POS, produksi, inventaris, pembelian, CRM, dan keuangan.

> Data pesanan web, akun, katalog, inventaris, supplier, CRM, keuangan, pembelian, dan resep BOM disimpan melalui API di MySQL. Data operasional ERP disinkronkan antarperangkat admin; `localStorage` hanya dipakai sebagai cache sementara pada browser.

## Fitur tambahan

- Toko publik menyediakan Tentang Kami, Kontak dengan formulir dan peta (alamat dapat diatur admin), FAQ, syarat dan ketentuan, kebijakan privasi, wishlist, ulasan pelanggan, artikel blog, promo, pelacakan pesanan, serta pengajuan pengembalian/penukaran untuk pesanan selesai.
- Akun pelanggan dapat mengubah profil, kata sandi, preferensi notifikasi, melihat riwayat pesanan, dan mengajukan pengembalian/penukaran. Status pesanan dapat dilacak dengan nomor pesanan dan nomor telepon pemesan.
- Menu **Layanan & Pengaturan** mengelola permintaan layanan, moderasi ulasan, artikel, kategori, akun dan hak akses, kontak toko, logo/favicon, metode pembayaran, ongkos kirim, serta ringkasan pengunjung, penjualan lunas, dan produk terlaris.
- Pembayaran toko hanya menyediakan QRIS dan COD. QRIS menunggu pemeriksaan admin; pembayaran COD dicatat setelah diterima dan diverifikasi admin. Saat pembayaran pesanan ditandai lunas, stok produk katalog diperbarui dan penjualan dicatat pada jurnal pesanan web.
- Admin dapat menyimpan resep BOM per produk. Saat pesanan lunas, aplikasi mengurangi stok bahan sesuai resep dan mencatat mutasi stok; jika stok aktual kurang, pemakaian dibatasi pada stok yang tersedia.
- CRM menyatukan akun pelanggan dan pemesan dari pesanan ke daftar pelanggan, sambil menyimpan prospek, agenda, dan riwayat interaksi di penyimpanan ERP bersama. PO supplier baru masuk ke pengeluaran saat ditandai diterima.

Sebagian besar tabel layanan dibuat otomatis saat API pertama kali dipanggil. Pastikan `pesanan_web` dan tabel katalog tersedia dari database project. Ulasan publik perlu disetujui admin sebelum tampil.

## Alur demo yang disarankan

1. Tampilkan katalog toko dan filter kategori.
2. Rakit buket kustom, lalu tambahkan produk ke keranjang.
3. Masuk atau daftarkan akun pelanggan, buat pesanan, dan tunjukkan pilihan pembayaran QRIS atau COD serta status pesanannya.
4. Masuk sebagai admin untuk mengelola katalog dan memperbarui alur pesanan.
5. Tunjukkan modul ERP: inventaris dan resep BOM, supplier dan PO, pelanggan CRM, pesanan dan pengiriman, serta laporan keuangan dan statistik. Data operasional tersimpan bersama di MySQL.

Pembayaran QRIS menggunakan kode yang ditampilkan dan diverifikasi admin secara manual; COD dibayar saat pesanan diterima. Jangan gunakan informasi pelanggan sungguhan untuk presentasi.

## Konsistensi data demo

Referensi produk menetapkan kategori **Duka Cita** untuk *Buket Simpati Putih*. Jika produk pada database lokal masih berkategori lain, jalankan `database/demo-data-fixes.sql` pada database `roos_fleur` untuk memperbaikinya. Script tersebut aman dijalankan berulang kali.

Tombol **Reset Demo** menghapus data simulasi yang tersimpan di browser. Penghapusan pesanan server adalah aksi terpisah di dashboard dan tidak dapat dibatalkan.
