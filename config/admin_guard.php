<?php
// All legacy ERP endpoints are internal admin APIs. Keep them same-origin and
// require the authenticated admin session before reading or changing records.
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

if (($_SESSION['user']['peran'] ?? '') !== 'admin') {
    http_response_code(401);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'status' => false,
        'message' => 'Silakan masuk sebagai admin untuk mengakses data ini.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
