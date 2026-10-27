<?php
declare(strict_types=1);

/* ---------- configuration ---------- */

function dt_site_root(): string
{
    return dirname(__DIR__);
}

function dt_load_config(): array
{
    $candidates = array_filter([
        getenv('DT_CONFIG') ?: null,
        dirname(dt_site_root()) . '/dt-config/config.php',
        __DIR__ . '/../config.php',
    ]);
    foreach ($candidates as $file) {
        if (is_file($file)) {
            $cfg = require $file;
            if (is_array($cfg)) {
                return $cfg + dt_defaults();
            }
        }
    }
    return [];
}

function dt_defaults(): array
{
    return [
        'to_email' => '', 'to_name' => 'Digital Takhleeq',
        'smtp_host' => 'smtp.gmail.com', 'smtp_port' => 465, 'smtp_secure' => 'ssl',
        'smtp_user' => '', 'smtp_pass' => '', 'from_email' => '', 'from_name' => 'Digital Takhleeq Website',
        'site_name' => 'Digital Takhleeq', 'site_url' => '', 'allowed_hosts' => [],
        'autoreply' => true, 'rate_limit_per_hour' => 5, 'min_fill_seconds' => 3,
        'trust_cf_header' => false, 'timezone' => 'Asia/Karachi', 'storage_dir' => null,
        'smtp_verify_peer' => true, 'smtp_timeout' => 15, 'debug' => false,
    ];
}

function dt_storage_dir(array $cfg): string
{
    $candidates = [];
    if (!empty($cfg['storage_dir'])) {
        $candidates[] = (string) $cfg['storage_dir'];
    }
    $candidates[] = dirname(dt_site_root()) . '/dt-storage';
    $candidates[] = __DIR__ . '/../storage';   // protected by .htaccess
    foreach ($candidates as $dir) {
        if (is_dir($dir) || @mkdir($dir, 0750, true)) {
            if (is_writable($dir)) {
                return rtrim($dir, '/');
            }
        }
    }
    return '';
}

/* ---------- response helpers ---------- */

function dt_wants_json(): bool
{
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    $xhr    = $_SERVER['HTTP_X_REQUESTED_WITH'] ?? '';
    return stripos($accept, 'application/json') !== false || strcasecmp($xhr, 'XMLHttpRequest') === 0;
}

function dt_respond(int $status, array $payload, string $redirectQuery = ''): never
{
    if (dt_wants_json()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } else {
        // plain HTML form post (JavaScript disabled): send the visitor back to the site
        header('Location: /' . ($redirectQuery !== '' ? '?' . $redirectQuery : '') . '#contact', true, 303);
    }
    exit;
}

/* ---------- input ---------- */

function dt_clean_line(?string $v, int $max): string
{
    $v = (string) $v;
    $v = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $v) ?? '';   // strips CR/LF too -> no header injection
    $v = trim(preg_replace('/\s{2,}/u', ' ', $v) ?? '');
    return mb_substr($v, 0, $max);
}

function dt_clean_text(?string $v, int $max): string
{
    $v = str_replace(["\r\n", "\r"], "\n", (string) $v);
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    $v = preg_replace("/\n{3,}/", "\n\n", $v) ?? '';
    return mb_substr(trim($v), 0, $max);
}

function dt_clean_list($v, array $allowed): array
{
    $out = [];
    foreach ((array) $v as $item) {
        $item = dt_clean_line(is_string($item) ? $item : '', 60);
        if ($item !== '' && in_array($item, $allowed, true)) {
            $out[$item] = true;
        }
    }
    return array_keys($out);
}

function dt_client_ip(array $cfg): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    if (!empty($cfg['trust_cf_header']) && !empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        $cand = trim((string) $_SERVER['HTTP_CF_CONNECTING_IP']);
        if (filter_var($cand, FILTER_VALIDATE_IP)) {
            $ip = $cand;
        }
    }
    return $ip;
}

/* ---------- origin check ---------- */

function dt_origin_ok(array $cfg): bool
{
    $src = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if ($src === '') {
        return true;    // some privacy tools strip both headers; other layers still apply
    }
    $host = strtolower((string) parse_url($src, PHP_URL_HOST));
    if ($host === '') {
        return false;
    }
    $self = strtolower(preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
    $allowed = array_map('strtolower', (array) ($cfg['allowed_hosts'] ?? []));
    $allowed[] = $self;
    return in_array($host, $allowed, true);
}

/* ---------- rate limiting (file based) ---------- */

/** Returns true if the action is allowed and records it. */
function dt_rate_ok(string $dir, string $key, int $max, int $windowSeconds): bool
{
    if ($dir === '') {
        return true;    // no writable storage: fail open rather than losing real leads
    }
    $rl = $dir . '/ratelimit';
    if (!is_dir($rl)) {
        @mkdir($rl, 0750, true);
    }
    $file = $rl . '/' . hash('sha256', $key) . '.json';
    $fh = @fopen($file, 'c+');
    if (!$fh) {
        return true;
    }
    flock($fh, LOCK_EX);
    $raw = stream_get_contents($fh);
    $hits = $raw ? (json_decode($raw, true) ?: []) : [];
    $now = time();
    $hits = array_values(array_filter($hits, fn($t) => is_int($t) && $t > $now - $windowSeconds));
    $allowed = count($hits) < $max;
    if ($allowed) {
        $hits[] = $now;
    }
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($hits));
    flock($fh, LOCK_UN);
    fclose($fh);
    return $allowed;
}

/** Housekeeping: remove stale rate-limit files now and then. */
function dt_rate_gc(string $dir): void
{
    if ($dir === '' || random_int(1, 40) !== 1) {
        return;
    }
    foreach (glob($dir . '/ratelimit/*.json') ?: [] as $f) {
        if (@filemtime($f) < time() - 2 * 86400) {
            @unlink($f);
        }
    }
}

/* ---------- backup log ---------- */

function dt_backup(string $dir, array $record): void
{
    if ($dir === '') {
        return;
    }
    $file = $dir . '/leads-' . date('Y-m') . '.jsonl';
    @file_put_contents($file, json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
    @chmod($file, 0640);
}

/* ---------- mail building ---------- */

function dt_encode_header(string $v): string
{
    $v = preg_replace('/[\r\n]+/', ' ', $v) ?? '';
    return preg_match('/[^\x20-\x7E]/', $v) ? mb_encode_mimeheader($v, 'UTF-8', 'B', "\r\n", 0) : $v;
}

function dt_addr(string $email, string $name = ''): string
{
    $email = preg_replace('/[\r\n<>]+/', '', $email) ?? '';
    $name  = trim(preg_replace('/[\r\n"\\\\<>]+/', ' ', $name) ?? '');
    if ($name === '') {
        return '<' . $email . '>';
    }
    $enc = dt_encode_header($name);
    if (!preg_match('/[^\x20-\x7E]/', $name)) {
        $enc = '"' . $enc . '"';
    }
    return $enc . ' <' . $email . '>';
}

function dt_domain_of(string $email): string
{
    $p = strrchr($email, '@');
    return $p ? substr($p, 1) : 'localhost';
}

/** Build a complete UTF-8 plain-text message. */
function dt_build_message(array $h, string $body): string
{
    $headers = [];
    foreach ($h as $k => $v) {
        $headers[] = $k . ': ' . $v;
    }
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'Content-Transfer-Encoding: base64';
    $body = preg_replace("/\r\n|\r|\n/", "\r\n", $body);
    return implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($body), 76, "\r\n");
}
