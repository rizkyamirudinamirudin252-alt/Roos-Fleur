<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Katalog Produk - Roos & Fleur</title>

    <style>

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f7f5f2;
            color: #333;
        }

        .container {
            width: 90%;
            max-width: 1200px;
            margin: 40px auto;
        }

        h1 {
            margin-bottom: 25px;
        }

        .form-box {
            background: white;
            padding: 25px;
            border-radius: 15px;
            margin-bottom: 35px;
            box-shadow: 0 4px 15px rgba(0,0,0,.08);
        }

        .form-group {
            margin-bottom: 15px;
        }

        label {
            display: block;
            margin-bottom: 7px;
            font-weight: bold;
        }

        input,
        textarea,
        select {
            width: 100%;
            padding: 11px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 14px;
        }

        textarea {
            min-height: 100px;
            resize: vertical;
        }

        .preview {
            margin-top: 10px;
        }

        .preview img {
            width: 180px;
            height: 180px;
            object-fit: cover;
            border-radius: 10px;
            display: none;
        }

        button {
            border: none;
            padding: 12px 22px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
        }

        .btn-simpan {
            background: #7b4b5a;
            color: white;
        }

        .btn-simpan:hover {
            opacity: .9;
        }

        .produk-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
            gap: 20px;
        }

        .produk-card {
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,.08);
        }

        .produk-card img {
            width: 100%;
            height: 230px;
            object-fit: cover;
            background: #eee;
        }

        .produk-info {
            padding: 18px;
        }

        .produk-info h3 {
            margin-top: 0;
        }

        .harga {
            font-size: 18px;
            font-weight: bold;
            margin-top: 10px;
        }

        .stok {
            color: #777;
            margin-top: 8px;
        }

        .pesan {
            padding: 12px;
            margin-bottom: 15px;
            border-radius: 8px;
            display: none;
        }

        .success {
            background: #dff5e5;
            color: #216e39;
        }

        .error {
            background: #fde2e2;
            color: #9b2226;
        }

    </style>
</head>

<body>

<div class="container">

    <h1>Katalog Produk</h1>


    <!-- ========================================= -->
    <!-- FORM TAMBAH PRODUK -->
    <!-- ========================================= -->

    <div class="form-box">

        <h2>Tambah Produk</h2>

        <div id="pesan" class="pesan"></div>

        <form id="formProduk" enctype="multipart/form-data">

            <div class="form-group">
                <label>Kode Produk</label>

                <input
                    type="text"
                    name="kode_produk"
                    placeholder="Contoh: PRD002"
                    required
                >
            </div>


            <div class="form-group">
                <label>Nama Produk</label>

                <input
                    type="text"
                    name="nama_produk"
                    placeholder="Contoh: Bouquet Mawar Pink"
                    required
                >
            </div>


            <div class="form-group">
                <label>Kategori</label>

                <input
                    type="text"
                    name="kategori"
                    placeholder="Contoh: Bunga"
                >
            </div>


            <div class="form-group">
                <label>Deskripsi</label>

                <textarea
                    name="deskripsi"
                    placeholder="Deskripsi produk..."
                ></textarea>
            </div>


            <div class="form-group">
                <label>Harga</label>

                <input
                    type="number"
                    name="harga"
                    placeholder="285000"
                    min="0"
                    required
                >
            </div>


            <div class="form-group">
                <label>HPP</label>

                <input
                    type="number"
                    name="hpp"
                    placeholder="110000"
                    min="0"
                    required
                >
            </div>


            <div class="form-group">
                <label>Stok</label>

                <input
                    type="number"
                    name="stok"
                    placeholder="10"
                    min="0"
                    required
                >
            </div>


            <div class="form-group">
                <label>Satuan</label>

                <input
                    type="text"
                    name="satuan"
                    placeholder="pcs"
                >
            </div>


            <div class="form-group">
                <label>Status</label>

                <select name="status">

                    <option value="Aktif">
                        Aktif
                    </option>

                    <option value="Nonaktif">
                        Nonaktif
                    </option>

                </select>
            </div>


            <div class="form-group">

                <label>Foto Produk</label>

                <input
                    type="file"
                    id="foto"
                    name="foto"
                    accept="image/jpeg,image/png,image/webp"
                >

                <div class="preview">

                    <img
                        id="previewFoto"
                        alt="Preview foto"
                    >

                </div>

            </div>


            <button
                type="submit"
                class="btn-simpan"
            >
                Simpan Produk
            </button>

        </form>

    </div>


    <!-- ========================================= -->
    <!-- DAFTAR PRODUK -->
    <!-- ========================================= -->

    <h2>Daftar Produk</h2>

    <div
        id="produkGrid"
        class="produk-grid"
    ></div>

</div>


<script>

const API =
    "../api/produk.php";


// ==================================================
// PREVIEW FOTO
// ==================================================

document
    .getElementById("foto")
    .addEventListener("change", function () {

        const file = this.files[0];

        const preview =
            document.getElementById("previewFoto");

        if (!file) {

            preview.style.display = "none";

            return;
        }

        const reader =
            new FileReader();

        reader.onload = function (e) {

            preview.src =
                e.target.result;

            preview.style.display =
                "block";
        };

        reader.readAsDataURL(file);

    });


// ==================================================
// SUBMIT FORM
// ==================================================

document
    .getElementById("formProduk")
    .addEventListener("submit", async function (e) {

        e.preventDefault();

        const form =
            document.getElementById("formProduk");

        const formData =
            new FormData(form);

        const pesan =
            document.getElementById("pesan");


        pesan.style.display = "block";

        pesan.className =
            "pesan";

        pesan.innerHTML =
            "Sedang menyimpan produk...";


        try {

            const response =
                await fetch(API, {

                    method: "POST",

                    body: formData

                });


            const result =
                await response.json();


            if (result.status) {

                pesan.className =
                    "pesan success";

                pesan.innerHTML =
                    result.message;


                form.reset();


                document
                    .getElementById("previewFoto")
                    .style.display = "none";


                loadProduk();


            } else {

                pesan.className =
                    "pesan error";

                pesan.innerHTML =
                    result.message;

            }

        }

        catch (error) {

            console.error(error);

            pesan.className =
                "pesan error";

            pesan.innerHTML =
                "Terjadi kesalahan koneksi ke server.";

        }

    });


// ==================================================
// LOAD PRODUK
// ==================================================

async function loadProduk() {

    const grid =
        document.getElementById("produkGrid");

    grid.innerHTML =
        "Memuat produk...";


    try {

        const response =
            await fetch(API);

        const result =
            await response.json();


        if (!result.status) {

            grid.innerHTML =
                "Gagal mengambil produk.";

            return;
        }


        const produk =
            result.data.produk;


        if (!produk.length) {

            grid.innerHTML =
                "Belum ada produk.";

            return;
        }


        grid.innerHTML =
            "";


        produk.forEach(function (item) {

            let foto;


            if (item.foto_url) {

                foto =
                    item.foto_url;

            } else {

                foto =
                    "https://via.placeholder.com/500x500?text=No+Image";

            }


            const harga =
                Number(item.harga)
                    .toLocaleString("id-ID");


            const card =
                document.createElement("div");


            card.className =
                "produk-card";


            card.innerHTML = `

                <img
                    src="${foto}"
                    alt="${item.nama_produk}"
                >

                <div class="produk-info">

                    <h3>
                        ${item.nama_produk}
                    </h3>

                    <div>
                        ${item.kategori ?? ""}
                    </div>

                    <div class="harga">
                        Rp ${harga}
                    </div>

                    <div class="stok">
                        Stok: ${item.stok}
                        ${item.satuan ?? ""}
                    </div>

                </div>

            `;


            grid.appendChild(card);

        });

    }

    catch (error) {

        console.error(error);

        grid.innerHTML =
            "Gagal menghubungi API.";

    }

}


// ==================================================
// JALANKAN SAAT HALAMAN DIBUKA
// ==================================================

loadProduk();

</script>

</body>
</html>