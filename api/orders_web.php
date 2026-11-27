<?php
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
require_once __DIR__ . '/../config/database.php';

function ordersReply($ok, $message, $data = [], $code = 200) {
    http_response_code($code);
    echo json_encode(['status'=>$ok, 'message'=>$message, 'data'=>$data], JSON_UNESCAPED_UNICODE);
    exit;
}
if (empty($_SESSION['user']['id_akun'])) ordersReply(false, 'Silakan masuk terlebih dahulu.', [], 401);
$user = $_SESSION['user'];
$create = "CREATE TABLE IF NOT EXISTS pesanan_web (
    id_pesanan BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nomor_pesanan VARCHAR(32) NOT NULL UNIQUE,
    id_akun INT UNSIGNED NOT NULL,
    nama_pemesan VARCHAR(120) NOT NULL,
    telepon VARCHAR(30) NOT NULL,
    nama_penerima VARCHAR(120) NOT NULL,
    alamat TEXT NOT NULL,
    tanggal_pengiriman DATE NOT NULL,
    metode_pengiriman VARCHAR(40) NOT NULL,
    ongkir DECIMAL(12,2) NOT NULL DEFAULT 0,
    metode_pembayaran VARCHAR(80) NOT NULL,
    status_pembayaran VARCHAR(40) NOT NULL DEFAULT 'Menunggu Pembayaran',
    status_pesanan VARCHAR(40) NOT NULL DEFAULT 'Menunggu Pembayaran',
    subtotal DECIMAL(12,2) NOT NULL,
    diskon DECIMAL(12,2) NOT NULL DEFAULT 0,
    kode_promo VARCHAR(32) NULL,
    total DECIMAL(12,2) NOT NULL,
    pesan_kartu TEXT NULL,
    items_json LONGTEXT NOT NULL,
    nama_kurir VARCHAR(120) NULL,
    telepon_kurir VARCHAR(30) NULL,
    catatan_pengiriman TEXT NULL,
    dibuat_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    diperbarui_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_akun (id_akun)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
if (!$conn->query($create)) ordersReply(false, 'Tabel pesanan belum dapat disiapkan.', [], 500);

// Tambahkan kolom yang diperlukan ke database lama tanpa menghapus pesanan.
$existingColumns = [];
$columnResult = $conn->query('SHOW COLUMNS FROM pesanan_web');
if (!$columnResult) ordersReply(false, 'Struktur tabel pesanan tidak dapat diperiksa.', [], 500);
while ($column = $columnResult->fetch_assoc()) $existingColumns[$column['Field']] = true;
$courierColumns = [
    'nama_kurir' => 'VARCHAR(120) NULL',
    'telepon_kurir' => 'VARCHAR(30) NULL',
    'catatan_pengiriman' => 'TEXT NULL'
];
$courierColumns['diskon'] = 'DECIMAL(12,2) NOT NULL DEFAULT 0';
$courierColumns['kode_promo'] = 'VARCHAR(32) NULL';
foreach ($courierColumns as $column => $definition) {
    if (!isset($existingColumns[$column]) && !$conn->query("ALTER TABLE pesanan_web ADD COLUMN `$column` $definition")) {
        ordersReply(false, 'Struktur kolom pesanan belum dapat diperbarui.', [], 500);
    }
}
$shippingFee = 15000;
$allowedPaymentMethods = ['QRIS / E-Wallet','COD'];
$settingsTable = $conn->query("SHOW TABLES LIKE 'pengaturan_toko'");
if ($settingsTable && $settingsTable->num_rows) { $feeRow=$conn->query("SELECT nilai FROM pengaturan_toko WHERE kunci='biaya_kurir'"); if($feeRow&&($setting=$feeRow->fetch_assoc()))$shippingFee=max(0,(float)$setting['nilai']); }
$conn->query("CREATE TABLE IF NOT EXISTS sinkronisasi_pesanan_erp (id_pesanan BIGINT UNSIGNED PRIMARY KEY, stok_diperbarui TIMESTAMP DEFAULT CURRENT_TIMESTAMP, keuangan_diperbarui TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
function syncPaidOrderToErp($conn, $orderId, $orderNumber, $total, $itemsJson) {
    $check=$conn->prepare('SELECT id_pesanan FROM sinkronisasi_pesanan_erp WHERE id_pesanan=?');$check->bind_param('i',$orderId);$check->execute();$done=$check->get_result()->num_rows>0;$check->close();if($done)return;
    $items=json_decode($itemsJson,true)?:[];
    foreach($items as $item){$id=(string)($item['id']??'');$qty=max(1,(int)($item['jumlah']??1));if(ctype_digit($id)&&(int)$id>0){$s=$conn->prepare('UPDATE produk SET stok=GREATEST(0,stok-?) WHERE id_produk=?');$s->bind_param('ii',$qty,$id);$s->execute();}}
    $stateTable=$conn->query("SHOW TABLES LIKE 'erp_state_store'");
    if($stateTable&&$stateTable->num_rows){
        $state=[];$rs=$conn->query("SELECT state_key,state_json FROM erp_state_store WHERE state_key IN ('inventory','bom')");
        if($rs)while($row=$rs->fetch_assoc())$state[$row['state_key']]=json_decode($row['state_json'],true)?:[];
        $inventory=$state['inventory']??[];$bom=$state['bom']??[];
        $movement=$conn->query("CREATE TABLE IF NOT EXISTS erp_stock_movements(id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,id_pesanan BIGINT UNSIGNED NOT NULL,product_id VARCHAR(80) NOT NULL,material_id VARCHAR(40) NOT NULL,material_name VARCHAR(150) NOT NULL,requested DECIMAL(12,2) NOT NULL,used DECIMAL(12,2) NOT NULL,stock_before DECIMAL(12,2) NOT NULL,stock_after DECIMAL(12,2) NOT NULL,dibuat_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX(id_pesanan)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        if($movement){
            foreach($items as $sale){
                $detail=$sale['detail']??[];$flowerId=(string)($detail['flower_id']??'');
                $components=[];$productId=(string)($sale['id']??'');
                if($flowerId!==''){
                    $components=[['CUSTOM:'.$flowerId,max(1,(int)($detail['jumlah_batang']??1))],['CUSTOM:WRAP:'.(string)($detail['wrap_id']??''),1],['CUSTOM:RIBBON:'.(string)($detail['pita']??''),1]];
                }elseif(ctype_digit($productId))$components=[[$productId,max(1,(int)($sale['jumlah']??1))]];
                foreach($components as [$recipeProductId,$sold])foreach($bom as $recipe){
                    if((string)($recipe['productId']??'')!==$recipeProductId)continue;
                    foreach($inventory as &$material){
                        if((string)($material['id']??'')!==(string)($recipe['materialId']??''))continue;
                        $requested=max(0,(float)($recipe['qty']??0))*$sold;$before=max(0,(float)($material['qty']??0));$used=min($before,$requested);$material['qty']=$before-$used;
                        $materialId=(string)$material['id'];$materialName=(string)($material['name']??'Bahan baku');$after=(float)$material['qty'];
                        $log=$conn->prepare('INSERT INTO erp_stock_movements(id_pesanan,product_id,material_id,material_name,requested,used,stock_before,stock_after) VALUES(?,?,?,?,?,?,?,?)');
                        $log->bind_param('isssdddd',$orderId,$recipeProductId,$materialId,$materialName,$requested,$used,$before,$after);$log->execute();break;
                    }
                    unset($material);
                }
            }
            if(isset($state['inventory'])){$json=json_encode($inventory,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);$s=$conn->prepare("UPDATE erp_state_store SET state_json=? WHERE state_key='inventory'");$s->bind_param('s',$json);$s->execute();}
        }
    }
    $conn->query("CREATE TABLE IF NOT EXISTS jurnal_pesanan_web (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, id_pesanan BIGINT UNSIGNED NOT NULL UNIQUE, tanggal DATE NOT NULL, nomor_referensi VARCHAR(50) NOT NULL, keterangan VARCHAR(255) NOT NULL, pendapatan DECIMAL(14,2) NOT NULL DEFAULT 0, INDEX(tanggal)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $date=date('Y-m-d');$label='Penerimaan pesanan '.$orderNumber;$s=$conn->prepare('INSERT INTO jurnal_pesanan_web(id_pesanan,tanggal,nomor_referensi,keterangan,pendapatan) VALUES(?,?,?,?,?)');$s->bind_param('isssd',$orderId,$date,$orderNumber,$label,$total);$s->execute();
    $s=$conn->prepare('INSERT IGNORE INTO sinkronisasi_pesanan_erp(id_pesanan) VALUES(?)');$s->bind_param('i',$orderId);$s->execute();
}

$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $body['action'] ?? '';

if ($method === 'GET') {
    $isAdmin = ($user['peran'] ?? '') === 'admin';
    $sql = "SELECT * FROM pesanan_web" . ($isAdmin ? '' : ' WHERE id_akun=?') . ' ORDER BY id_pesanan DESC';
    $stmt = $conn->prepare($sql);
    if (!$isAdmin) $stmt->bind_param('i', $user['id_akun']);
    $stmt->execute(); $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC); $stmt->close();
    foreach ($rows as &$row) { $row['items'] = json_decode($row['items_json'], true) ?: []; unset($row['items_json']); }
    unset($row);
    ordersReply(true, 'Daftar pesanan.', ['orders'=>$rows]);
}

if ($method !== 'POST') ordersReply(false, 'Metode tidak didukung.', [], 405);

if ($action === 'admin_assign_courier') {
    if (($user['peran'] ?? '') !== 'admin') ordersReply(false, 'Hanya admin yang dapat mengatur kurir.', [], 403);
    $id = (int)($body['id_pesanan'] ?? 0);
    $name = trim($body['nama_kurir'] ?? '');
    $phone = trim($body['telepon_kurir'] ?? '');
    $note = trim($body['catatan_pengiriman'] ?? '');
    if ($id <= 0 || strlen($name) > 120 || strlen($phone) > 30 || strlen($note) > 2000) ordersReply(false, 'Data kurir tidak valid atau terlalu panjang.', [], 422);
    if (($name === '') !== ($phone === '')) ordersReply(false, 'Isi nama dan nomor telepon kurir, atau kosongkan keduanya untuk menghapus penugasan.', [], 422);
    if ($phone !== '' && !preg_match('/^[0-9+()\-\s]{8,30}$/', $phone)) ordersReply(false, 'Format nomor telepon kurir tidak valid.', [], 422);

    $check = $conn->prepare('SELECT metode_pengiriman, status_pesanan FROM pesanan_web WHERE id_pesanan=? LIMIT 1');
    $check->bind_param('i', $id); $check->execute(); $order = $check->get_result()->fetch_assoc(); $check->close();
    if (!$order) ordersReply(false, 'Pesanan tidak ditemukan.', [], 404);
    if ($order['metode_pengiriman'] === 'Ambil Sendiri') ordersReply(false, 'Pesanan ambil sendiri tidak memerlukan penugasan kurir.', [], 422);
    if ($name === '' && in_array($order['status_pesanan'], ['Dikirim','Selesai'], true)) ordersReply(false, 'Penugasan kurir tidak dapat dihapus setelah pesanan dikirim.', [], 409);

    $nameValue = $name === '' ? null : $name;
    $phoneValue = $phone === '' ? null : $phone;
    $noteValue = $note === '' ? null : $note;
    $stmt = $conn->prepare('UPDATE pesanan_web SET nama_kurir=?, telepon_kurir=?, catatan_pengiriman=? WHERE id_pesanan=?');
    $stmt->bind_param('sssi', $nameValue, $phoneValue, $noteValue, $id);
    if (!$stmt->execute()) ordersReply(false, 'Penugasan kurir gagal disimpan.', [], 500);
    $stmt->close();
    ordersReply(true, $name === '' ? 'Penugasan kurir dihapus.' : 'Kurir berhasil ditugaskan.', ['id_pesanan'=>$id, 'nama_kurir'=>$nameValue, 'telepon_kurir'=>$phoneValue, 'catatan_pengiriman'=>$noteValue]);
}

if ($action === 'demo_pay') {
    ordersReply(false, 'Pembayaran hanya tersedia melalui QRIS atau COD. Pembayaran QRIS harus diperiksa admin.', [], 422);
}

if ($action === 'admin_update') {
    if (($user['peran'] ?? '') !== 'admin') ordersReply(false, 'Hanya admin yang dapat memperbarui pesanan.', [], 403);
    $id = (int)($body['id_pesanan'] ?? 0);
    $payment = trim($body['status_pembayaran'] ?? '');
    $orderStatus = trim($body['status_pesanan'] ?? '');
    $allowedPayment = ['Menunggu Pembayaran','Lunas','Belum Lunas'];
    $allowedOrder = ['Menunggu Pembayaran','Menunggu Diproses','Dirangkai','Siap Diambil','Dikirim','Selesai','Dibatalkan'];
    if ($id <= 0 || !in_array($payment, $allowedPayment, true) || !in_array($orderStatus, $allowedOrder, true)) ordersReply(false, 'Status pesanan tidak valid.', [], 422);
    $check = $conn->prepare('SELECT metode_pengiriman, status_pesanan, nama_kurir, telepon_kurir, status_pembayaran, nomor_pesanan, total, items_json FROM pesanan_web WHERE id_pesanan=? LIMIT 1');
    $check->bind_param('i', $id); $check->execute(); $current = $check->get_result()->fetch_assoc(); $check->close();
    if (!$current) ordersReply(false, 'Pesanan tidak ditemukan.', [], 404);
    if ($orderStatus === 'Dikirim' && $current['metode_pengiriman'] === 'Ambil Sendiri') ordersReply(false, 'Pesanan ambil sendiri tidak dapat diubah menjadi Dikirim.', [], 422);
    if ($orderStatus === 'Dikirim' && (empty($current['nama_kurir']) || empty($current['telepon_kurir']))) ordersReply(false, 'Tetapkan nama dan nomor kurir sebelum mengubah status menjadi Dikirim.', [], 422);
    if ($orderStatus === 'Selesai' && $current['status_pesanan'] !== 'Selesai') {
        $expectedPrevious = $current['metode_pengiriman'] === 'Ambil Sendiri' ? 'Siap Diambil' : 'Dikirim';
        if ($current['status_pesanan'] !== $expectedPrevious) ordersReply(false, 'Perbarui status ke ' . ($expectedPrevious === 'Dikirim' ? 'Dikirim' : 'Siap') . ' sebelum menandai pesanan Selesai.', [], 409);
    }
    $stmt = $conn->prepare('UPDATE pesanan_web SET status_pembayaran=?, status_pesanan=? WHERE id_pesanan=?');
    $stmt->bind_param('ssi', $payment, $orderStatus, $id); $stmt->execute(); $stmt->close();
    if($payment==='Lunas' && $current['status_pembayaran']!=='Lunas') syncPaidOrderToErp($conn,$id,$current['nomor_pesanan'],$current['total'],$current['items_json']);
    ordersReply(true, 'Status pesanan berhasil diperbarui.');
}

if ($action === 'admin_reset_orders') {
    if (($user['peran'] ?? '') !== 'admin') ordersReply(false, 'Hanya admin yang dapat menghapus seluruh pesanan.', [], 403);

    if (($body['confirmation'] ?? '') !== 'HAPUS SEMUA PESANAN') {
        ordersReply(false, 'Konfirmasi penghapusan tidak valid.', [], 422);
    }

    if (!$conn->query('DELETE FROM pesanan_web')) {
        ordersReply(false, 'Pesanan gagal dihapus: ' . $conn->error, [], 500);
    }

    ordersReply(true, 'Seluruh pesanan berhasil dihapus.', ['deleted' => $conn->affected_rows]);
}

if ($action === 'admin_create') {
    if (($user['peran'] ?? '') !== 'admin') ordersReply(false, 'Hanya admin yang dapat mencatat penjualan POS.', [], 403);

    $name = trim((string)($body['nama_pemesan'] ?? ''));
    $phone = trim((string)($body['telepon'] ?? ''));
    $recipient = trim((string)($body['nama_penerima'] ?? $name));
    $address = trim((string)($body['alamat'] ?? 'Pesanan langsung di toko'));
    $date = trim((string)($body['tanggal_pengiriman'] ?? ''));
    $delivery = trim((string)($body['metode_pengiriman'] ?? ''));
    $payment = trim((string)($body['metode_pembayaran'] ?? ''));
    $paymentStatus = trim((string)($body['status_pembayaran'] ?? 'Menunggu Pembayaran'));
    $items = $body['items'] ?? [];

    if ($name === '' || $date === '' || !is_array($items) || !$items || !in_array($delivery, ['Kurir Toko', 'Ambil Sendiri'], true) || !in_array($payment, $allowedPaymentMethods, true)) {
        ordersReply(false, 'Lengkapi pelanggan, tanggal, pengiriman, pembayaran, dan item POS.', [], 422);
    }
    if (!in_array($paymentStatus, ['Menunggu Pembayaran', 'Belum Lunas', 'Lunas'], true)) {
        ordersReply(false, 'Status pembayaran POS tidak valid.', [], 422);
    }

    $normalized = [];
    $subtotal = 0;
    $hpp = 0;
    foreach ($items as $item) {
        $productId = trim((string)($item['id'] ?? ''));
        $itemName = trim((string)($item['nama'] ?? ''));
        $price = (float)($item['harga'] ?? 0);
        $itemHpp = (float)($item['hpp'] ?? 0);
        if ($itemName === '' || $price < 0 || $itemHpp < 0) ordersReply(false, 'Item POS tidak valid.', [], 422);
        $normalizedItem=['nama'=>$itemName,'harga'=>$price,'jumlah'=>1];
        if(ctype_digit($productId)&&(int)$productId>0){$stockCheck=$conn->prepare('SELECT stok FROM produk WHERE id_produk=? AND status=\'Aktif\' LIMIT 1');$stockCheck->bind_param('i',$productId);$stockCheck->execute();$available=$stockCheck->get_result()->fetch_assoc();if(!$available)ordersReply(false,'Produk POS tidak ditemukan.',[],422);if((int)$available['stok']<1)ordersReply(false,'Stok produk POS habis.',[],409);$normalizedItem['id']=$productId;}
        $normalized[] = $normalizedItem;
        $subtotal += $price;
        $hpp += $itemHpp;
    }

    $shipping = $delivery === 'Kurir Toko' ? $shippingFee : 0;
    $total = $subtotal + $shipping;
    $number = 'POS-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
    $itemsJson = json_encode($normalized, JSON_UNESCAPED_UNICODE);
    $card = trim((string)($body['pesan_kartu'] ?? ''));
    $accountId = (int)$user['id_akun'];
    $stmt = $conn->prepare("INSERT INTO pesanan_web (nomor_pesanan,id_akun,nama_pemesan,telepon,nama_penerima,alamat,tanggal_pengiriman,metode_pengiriman,ongkir,metode_pembayaran,status_pembayaran,status_pesanan,subtotal,diskon,kode_promo,total,pesan_kartu,items_json) VALUES (?,?,?,?,?,?,?,?,?,?,?, 'Menunggu Diproses',?,0,NULL,?,?,?)");
    $stmt->bind_param('sissssssdssddss', $number, $accountId, $name, $phone, $recipient, $address, $date, $delivery, $shipping, $payment, $paymentStatus, $subtotal, $total, $card, $itemsJson);
    if (!$stmt->execute()) ordersReply(false, 'Penjualan POS gagal disimpan: ' . $stmt->error, [], 500);
    $id = $stmt->insert_id;
    $stmt->close();
    if($paymentStatus==='Lunas') syncPaidOrderToErp($conn,$id,$number,$total,$itemsJson);
    ordersReply(true, 'Penjualan POS berhasil disimpan.', ['id_pesanan' => $id, 'nomor_pesanan' => $number, 'total' => $total, 'hpp' => $hpp], 201);
}

if ($action !== 'create') ordersReply(false, 'Aksi tidak dikenal.', [], 400);
if (($user['peran'] ?? '') !== 'pelanggan') ordersReply(false, 'Checkout hanya dapat dilakukan oleh pelanggan.', [], 403);
$items = $body['items'] ?? [];
$phone = trim($body['telepon'] ?? ''); $recipient = trim($body['nama_penerima'] ?? ''); $address = trim($body['alamat'] ?? '');
$date = trim($body['tanggal_pengiriman'] ?? ''); $delivery = trim($body['metode_pengiriman'] ?? '');
$payment = trim($body['metode_pembayaran'] ?? '');
if (!$items || $phone === '' || $recipient === '' || $address === '' || $date === '' || !in_array($delivery, ['Kurir Toko','Ambil Sendiri'], true) || !in_array($payment, $allowedPaymentMethods, true)) ordersReply(false, 'Lengkapi detail pesanan, pengiriman, dan metode pembayaran yang tersedia.', [], 422);
$subtotal = 0; $normalized = [];
foreach ($items as $item) {
    $itemId = trim((string)($item['id'] ?? ''));
    $qty = max(1, min(50, (int)($item['jumlah'] ?? 1)));
    $custom = $item['custom'] ?? null;
    if (is_array($custom)) {
        $qty = 1;
        $flowers = ['F1'=>['Mawar Merah',15000], 'F2'=>['Mawar Putih',16000], 'F3'=>['Mawar Pink',16000]];
        $wraps = ['W1'=>['Soft Pink',20000], 'W2'=>['Classic White',18000], 'W3'=>['Elegant Black',22000]];
        $ribbons = ['Satin Pink'=>15000, 'Satin Putih'=>15000, 'Tali Rami Vintage'=>10000, 'Pita Emas Premium'=>25000, 'Tanpa Pita'=>0];
        $flowerId = (string)($custom['flowerId'] ?? ''); $wrapId = (string)($custom['wrapId'] ?? '');
        $stemCount = max(1, min(50, (int)($custom['qty'] ?? 1)));
        $ribbonName = (string)($custom['ribbonName'] ?? '');
        if (!isset($flowers[$flowerId], $wraps[$wrapId], $ribbons[$ribbonName])) ordersReply(false, 'Pilihan buket kustom tidak valid.', [], 422);
        $name = 'Custom: Buket ' . $flowers[$flowerId][0];
        $price = $flowers[$flowerId][1] * $stemCount + $wraps[$wrapId][1] + $ribbons[$ribbonName] + 35000;
        $normalized[] = ['id'=>$itemId, 'nama'=>$name, 'harga'=>$price, 'jumlah'=>1, 'detail'=>['flower_id'=>$flowerId,'jumlah_batang'=>$stemCount,'wrap_id'=>$wrapId,'wrapping'=>$wraps[$wrapId][0],'pita'=>$ribbonName]];
    } else {
        if (!ctype_digit($itemId) || (int)$itemId <= 0) ordersReply(false, 'Produk tidak valid. Silakan muat ulang katalog.', [], 422);
        $productId = (int)$itemId;
        $productStmt = $conn->prepare("SELECT nama_produk, harga, stok FROM produk WHERE id_produk=? AND status='Aktif' LIMIT 1");
        $productStmt->bind_param('i', $productId); $productStmt->execute(); $product = $productStmt->get_result()->fetch_assoc(); $productStmt->close();
        if (!$product) ordersReply(false, 'Produk sudah tidak tersedia. Silakan muat ulang katalog.', [], 422);
        if ((int)$product['stok'] < $qty) ordersReply(false, 'Stok produk tidak mencukupi. Silakan kurangi jumlah atau pilih produk lain.', [], 409);
        $name = $product['nama_produk']; $price = (float)$product['harga'];
        $normalized[] = ['id'=>(string)$productId, 'nama'=>$name, 'harga'=>$price, 'jumlah'=>$qty];
    }
    $subtotal += $price * $qty;
}
$promoCode = strtoupper(trim((string)($body['kode_promo'] ?? '')));
$discount = 0;
if ($promoCode !== '') {
    $promoStmt = $conn->prepare('SELECT judul, diskon_persen, minimal_belanja, maksimal_diskon FROM promosi_banner WHERE kode_promo=? AND aktif=1 LIMIT 1');
    if (!$promoStmt) ordersReply(false, 'Aturan promo belum tersedia. Buka toko sekali untuk menyiapkan data demo.', [], 500);
    $promoStmt->bind_param('s', $promoCode);
    $promoStmt->execute();
    $promo = $promoStmt->get_result()->fetch_assoc();
    $promoStmt->close();
    if (!$promo) ordersReply(false, 'Kode promo tidak ditemukan atau sudah tidak berlaku.', [], 422);
    $minimumSpend = (float)$promo['minimal_belanja'];
    if ($subtotal < $minimumSpend) ordersReply(false, 'Promo ' . $promoCode . ' berlaku untuk subtotal minimal Rp ' . number_format($minimumSpend, 0, ',', '.') . '.', [], 422);
    $discount = (int)round($subtotal * ((float)$promo['diskon_persen'] / 100));
    $maxDiscount = (float)$promo['maksimal_diskon'];
    if ($maxDiscount > 0) $discount = min($discount, (int)$maxDiscount);
} else { $promoCode = null; }
$shipping = $delivery === 'Kurir Toko' ? $shippingFee : 0;
$total = max(0, $subtotal - $discount) + $shipping;
$number = 'RF-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
$itemsJson = json_encode($normalized, JSON_UNESCAPED_UNICODE);
$card = trim($body['pesan_kartu'] ?? '');
$accountId = (int)$user['id_akun'];
$accountName = (string)$user['nama'];
$stmt = $conn->prepare("INSERT INTO pesanan_web (nomor_pesanan,id_akun,nama_pemesan,telepon,nama_penerima,alamat,tanggal_pengiriman,metode_pengiriman,ongkir,metode_pembayaran,status_pembayaran,status_pesanan,subtotal,diskon,kode_promo,total,pesan_kartu,items_json) VALUES (?,?,?,?,?,?,?,?,?,?, 'Menunggu Pembayaran','Menunggu Pembayaran',?,?,?,?,?,?)");
$stmt->bind_param('sissssssdsddsdss', $number, $accountId, $accountName, $phone, $recipient, $address, $date, $delivery, $shipping, $payment, $subtotal, $discount, $promoCode, $total, $card, $itemsJson);
if (!$stmt->execute()) ordersReply(false, 'Pesanan gagal disimpan: ' . $stmt->error, [], 500);
$id = $stmt->insert_id; $stmt->close();
ordersReply(true, 'Pesanan berhasil dibuat.', ['id_pesanan'=>$id, 'nomor_pesanan'=>$number, 'subtotal'=>$subtotal, 'diskon'=>$discount, 'kode_promo'=>$promoCode, 'ongkir'=>$shipping, 'total'=>$total, 'status_pembayaran'=>'Menunggu Pembayaran', 'status_pesanan'=>'Menunggu Pembayaran'], 201);
