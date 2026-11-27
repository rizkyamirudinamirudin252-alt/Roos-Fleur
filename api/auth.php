<?php
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
require_once __DIR__ . '/../config/database.php';

function authReply($ok, $message, $data = [], $code = 200) {
    http_response_code($code);
    echo json_encode(['status' => $ok, 'message' => $message, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

// Tabel akun dibuat otomatis agar pemasangan awal tidak memerlukan migrasi manual.
$create = "CREATE TABLE IF NOT EXISTS akun_pengguna (
    id_akun INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    telepon VARCHAR(30) NULL,
    password_hash VARCHAR(255) NOT NULL,
    peran ENUM('admin','pelanggan') NOT NULL DEFAULT 'pelanggan',
    dibuat_pada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
if (!$conn->query($create)) authReply(false, 'Tabel akun belum dapat disiapkan.', [], 500);

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$action = $input['action'] ?? $_GET['action'] ?? 'me';

if ($action === 'me') {
    authReply(true, 'Status akun.', ['user' => $_SESSION['user'] ?? null, 'admin_setup_required' => (int)$conn->query("SELECT COUNT(*) n FROM akun_pengguna WHERE peran='admin'")->fetch_assoc()['n'] === 0]);
}
if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) { $p = session_get_cookie_params(); setcookie(session_name(), '', time()-42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']); }
    session_destroy();
    authReply(true, 'Anda sudah keluar.');
}
if ($action === 'login') {
    $email = strtolower(trim($input['email'] ?? ''));
    $password = (string)($input['password'] ?? '');
    $stmt = $conn->prepare('SELECT id_akun,nama,email,telepon,password_hash,peran FROM akun_pengguna WHERE email=? LIMIT 1');
    $stmt->bind_param('s', $email); $stmt->execute(); $user = $stmt->get_result()->fetch_assoc(); $stmt->close();
    if (!$user || !password_verify($password, $user['password_hash'])) authReply(false, 'Email atau kata sandi salah.', [], 401);
    unset($user['password_hash']); session_regenerate_id(true); $_SESSION['user'] = $user;
    authReply(true, 'Berhasil masuk.', ['user' => $user]);
}
if ($action === 'register') {
    $name = trim($input['nama'] ?? ''); $email = strtolower(trim($input['email'] ?? '')); $phone = trim($input['telepon'] ?? ''); $password = (string)($input['password'] ?? '');
    if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) authReply(false, 'Nama, email valid, dan kata sandi minimal 8 karakter wajib diisi.', [], 422);
    $stmt = $conn->prepare('INSERT INTO akun_pengguna (nama,email,telepon,password_hash,peran) VALUES (?,?,?,?,\'pelanggan\')');
    $hash = password_hash($password, PASSWORD_DEFAULT); $stmt->bind_param('ssss', $name, $email, $phone, $hash);
    if (!$stmt->execute()) authReply(false, $conn->errno === 1062 ? 'Email sudah terdaftar.' : 'Akun gagal dibuat.', [], $conn->errno === 1062 ? 409 : 500);
    $user = ['id_akun' => $stmt->insert_id, 'nama' => $name, 'email' => $email, 'telepon' => $phone, 'peran' => 'pelanggan']; $stmt->close();
    session_regenerate_id(true); $_SESSION['user'] = $user; authReply(true, 'Akun pelanggan berhasil dibuat.', ['user' => $user]);
}
if ($action === 'profile_update' || $action === 'password_update') {
    if (empty($_SESSION['user']['id_akun'])) authReply(false, 'Silakan masuk terlebih dahulu.', [], 401);
    $id=(int)$_SESSION['user']['id_akun'];
    if($action==='profile_update') { $name=trim($input['nama']??'');$email=strtolower(trim($input['email']??''));$phone=trim($input['telepon']??'');if($name===''||!filter_var($email,FILTER_VALIDATE_EMAIL))authReply(false,'Nama dan email valid wajib diisi.',[],422);$stmt=$conn->prepare('UPDATE akun_pengguna SET nama=?,email=?,telepon=? WHERE id_akun=?');$stmt->bind_param('sssi',$name,$email,$phone,$id);if(!$stmt->execute())authReply(false,$conn->errno===1062?'Email sudah digunakan.':'Profil gagal disimpan.',[],409);$_SESSION['user']['nama']=$name;$_SESSION['user']['email']=$email;$_SESSION['user']['telepon']=$phone;authReply(true,'Profil berhasil diperbarui.',['user'=>$_SESSION['user']]); }
    $old=(string)($input['password_lama']??'');$new=(string)($input['password_baru']??'');$stmt=$conn->prepare('SELECT password_hash FROM akun_pengguna WHERE id_akun=?');$stmt->bind_param('i',$id);$stmt->execute();$row=$stmt->get_result()->fetch_assoc();if(!$row||!password_verify($old,$row['password_hash']))authReply(false,'Kata sandi saat ini tidak cocok.',[],403);if(strlen($new)<8)authReply(false,'Kata sandi baru minimal 8 karakter.',[],422);$hash=password_hash($new,PASSWORD_DEFAULT);$stmt=$conn->prepare('UPDATE akun_pengguna SET password_hash=? WHERE id_akun=?');$stmt->bind_param('si',$hash,$id);$stmt->execute();authReply(true,'Kata sandi berhasil diganti.');
}
if ($action === 'admin_users') { if(($_SESSION['user']['peran']??'')!=='admin')authReply(false,'Hanya admin.',[],403);$rows=$conn->query('SELECT id_akun,nama,email,telepon,peran,dibuat_pada FROM akun_pengguna ORDER BY id_akun DESC')->fetch_all(MYSQLI_ASSOC);authReply(true,'Daftar akun.',['users'=>$rows]); }
if ($action === 'admin_user_save') { if(($_SESSION['user']['peran']??'')!=='admin')authReply(false,'Hanya admin.',[],403);$id=(int)($input['id_akun']??0);$name=trim($input['nama']??'');$email=strtolower(trim($input['email']??''));$phone=trim($input['telepon']??'');$role=$input['peran']??'pelanggan';$password=(string)($input['password']??'');if($name===''||!filter_var($email,FILTER_VALIDATE_EMAIL)||!in_array($role,['admin','pelanggan'],true))authReply(false,'Data pengguna tidak valid.',[],422);if($id){$stmt=$conn->prepare('UPDATE akun_pengguna SET nama=?,email=?,telepon=?,peran=? WHERE id_akun=?');$stmt->bind_param('ssssi',$name,$email,$phone,$role,$id);}else{if(strlen($password)<8)authReply(false,'Kata sandi awal minimal 8 karakter.',[],422);$hash=password_hash($password,PASSWORD_DEFAULT);$stmt=$conn->prepare('INSERT INTO akun_pengguna(nama,email,telepon,peran,password_hash) VALUES(?,?,?,?,?)');$stmt->bind_param('sssss',$name,$email,$phone,$role,$hash);}if(!$stmt->execute())authReply(false,$conn->errno===1062?'Email sudah digunakan.':'Pengguna gagal disimpan.',[],409);authReply(true,'Pengguna berhasil disimpan.'); }
if ($action === 'admin_user_delete') { if(($_SESSION['user']['peran']??'')!=='admin')authReply(false,'Hanya admin.',[],403);$id=(int)($input['id_akun']??0);if($id===(int)($_SESSION['user']['id_akun']??0))authReply(false,'Admin tidak dapat menghapus akun yang sedang digunakan.',[],409);$stmt=$conn->prepare('DELETE FROM akun_pengguna WHERE id_akun=?');$stmt->bind_param('i',$id);$stmt->execute();authReply(true,'Pengguna dihapus.'); }
if ($action === 'setup_admin') {
    // First-admin bootstrap is only available from the same machine as this
    // XAMPP installation; a public visitor must not be able to claim it.
    $remoteAddress = $_SERVER['REMOTE_ADDR'] ?? '';
    if (!in_array($remoteAddress, ['127.0.0.1', '::1'], true)) authReply(false, 'Pembuatan admin pertama hanya dapat dilakukan dari komputer server.', [], 403);
    $lock = $conn->query("SELECT GET_LOCK('roos_fleur_first_admin', 10) AS acquired");
    if (!$lock || (int)$lock->fetch_assoc()['acquired'] !== 1) authReply(false, 'Setup admin sedang digunakan. Coba kembali.', [], 409);
    $count = (int)$conn->query("SELECT COUNT(*) n FROM akun_pengguna WHERE peran='admin'")->fetch_assoc()['n'];
    if ($count > 0) authReply(false, 'Admin awal sudah dibuat. Silakan masuk.', [], 403);
    $name = trim($input['nama'] ?? 'Administrator'); $email = strtolower(trim($input['email'] ?? '')); $password = (string)($input['password'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 12) authReply(false, 'Email valid dan kata sandi admin minimal 12 karakter wajib diisi.', [], 422);
    $stmt = $conn->prepare("INSERT INTO akun_pengguna (nama,email,password_hash,peran) VALUES (?,?,?,'admin')"); $hash = password_hash($password, PASSWORD_DEFAULT); $stmt->bind_param('sss', $name, $email, $hash);
    if (!$stmt->execute()) authReply(false, 'Admin gagal dibuat. Pastikan email belum dipakai.', [], 409);
    $user = ['id_akun' => $stmt->insert_id, 'nama' => $name, 'email' => $email, 'peran' => 'admin']; $stmt->close(); session_regenerate_id(true); $_SESSION['user'] = $user;
    authReply(true, 'Akun admin pertama berhasil dibuat.', ['user' => $user]);
}
authReply(false, 'Aksi tidak dikenal.', [], 400);
