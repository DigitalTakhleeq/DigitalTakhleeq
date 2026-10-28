<?php
declare(strict_types=1);

/**
 * Digital Takhleeq - contact form endpoint.
 * Contact form (type omitted): name, email, phone, company, services[], budget, timeline, message, consent, website (honeypot), ts
 * Package quote (type=package):  name, email, phone, message (optional), consent, package (JSON [{id, tier}]), website, ts
 * Health check: GET ?ping=1  ->  {ok, service:"dt-contact", ready:bool}   (the website uses it to show the email button)
 * Response (JSON when requested by the site's JavaScript): {ok:bool, message?:string, errors?:{field:msg}}
 */

require __DIR__ . '/lib/helpers.php';
require __DIR__ . '/lib/Smtp.php';
require __DIR__ . '/lib/package.php';

mb_internal_encoding('UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');
ini_set('display_errors', '0');

$cfg = dt_load_config();
if ($cfg) {
    date_default_timezone_set((string) $cfg['timezone']);
}

dt_cors($cfg);
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && isset($_GET['ping'])) {
    $ready = $cfg && !empty($cfg['to_email']) && !empty($cfg['smtp_host'])
        && (($cfg['smtp_user'] ?? '') === '' || (($cfg['smtp_pass'] ?? '') !== '' && stripos((string) $cfg['smtp_pass'], 'PASTE-') !== 0));
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['ok' => true, 'service' => 'dt-contact', 'ready' => (bool) $ready]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    dt_respond(405, ['ok' => false, 'message' => 'Method not allowed.'], 'error=1');
}

if (!$cfg || empty($cfg['to_email']) || empty($cfg['smtp_host'])) {
    error_log('[digitaltakhleeq] config.php missing or incomplete');
    dt_respond(500, ['ok' => false, 'message' => 'The form is not configured yet.'], 'error=1');
}

if (!dt_origin_ok($cfg)) {
    dt_respond(403, ['ok' => false, 'message' => 'Request not allowed.'], 'error=1');
}

// Body size guard (the form is tiny; anything huge is abuse)
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 60000) {
    dt_respond(413, ['ok' => false, 'message' => 'Message too large.'], 'error=1');
}

/* ---- bot traps: pretend success so bots learn nothing ---- */
if (trim((string) ($_POST['website'] ?? '')) !== '') {
    dt_respond(200, ['ok' => true]);
}
$ts = (int) ($_POST['ts'] ?? 0);              // milliseconds, set by the page when it loaded
if ($ts > 0) {
    $elapsed = microtime(true) - $ts / 1000;
    $minFill = (float) $cfg['min_fill_seconds'];
    if ($elapsed >= 0 && $elapsed < $minFill && $elapsed < 86400) {
        dt_respond(200, ['ok' => true]);
    }
}

/* ---- sanitise ---- */
$services_allowed = ['Websites', 'Digital growth', 'Social media', 'Advertising', 'Automation', 'Custom systems'];
$budget_allowed   = ['Under PKR 50k', 'PKR 50k to 100k', 'PKR 100k to 250k', 'PKR 250k to 500k', 'PKR 500k+', 'USD or EUR project'];
$timeline_allowed = ['1 to 2 weeks', '2 to 4 weeks', '1 to 2 months', 'Flexible'];

$name     = dt_clean_line($_POST['name'] ?? '', 100);
$email    = dt_clean_line($_POST['email'] ?? '', 254);
$phone    = dt_clean_line($_POST['phone'] ?? '', 40);
$company  = dt_clean_line($_POST['company'] ?? '', 140);
$message  = dt_clean_text($_POST['message'] ?? '', 4000);
$services = dt_clean_list($_POST['services'] ?? [], $services_allowed);
$budget   = dt_clean_line($_POST['budget'] ?? '', 40);
$timeline = dt_clean_line($_POST['timeline'] ?? '', 40);
$budget   = in_array($budget, $budget_allowed, true) ? $budget : '';
$timeline = in_array($timeline, $timeline_allowed, true) ? $timeline : '';
$consent  = ($_POST['consent'] ?? '') !== '';
$type     = (($_POST['type'] ?? '') === 'package') ? 'package' : 'contact';
$pricing  = null;
$pkg      = null;
if ($type === 'package') {
    $message  = dt_clean_text($_POST['message'] ?? '', 2000);      // optional note
    $pricing  = dt_load_pricing($cfg);
    $pkg      = $pricing ? dt_price_package($pricing, (string) ($_POST['package'] ?? '')) : null;
}

/* ---- validate ---- */
$errors = [];
if (mb_strlen($name) < 2) {
    $errors['name'] = 'Please enter your name.';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || preg_match('/[\s<>,;]/', $email)) {
    $errors['email'] = 'Please enter a valid email address.';
}
if ($phone !== '' && !preg_match('/^[+0-9()\-\s]{7,20}$/', $phone)) {
    $errors['phone'] = 'Use digits, spaces, + or - only.';
}
if ($type === 'contact' && mb_strlen($message) < 10) {
    $errors['message'] = 'Tell us a little more, at least a sentence.';
}
if ($type === 'package' && !$pkg) {
    $errors['package'] = 'Please choose at least one capability.';
}
if (!$consent) {
    $errors['consent'] = 'Please agree so we can reply to you.';
}
if (preg_match_all('#https?://#i', $message) > 3) {
    $errors['message'] = 'Please keep links to a maximum of three.';
}
if ($errors) {
    dt_respond(422, ['ok' => false, 'errors' => $errors, 'message' => $errors['package'] ?? 'Please check the highlighted fields.'], 'error=1');
}

/* ---- rate limit ---- */
$storage = dt_storage_dir($cfg);
dt_rate_gc($storage);
$ip = dt_client_ip($cfg);
if (!dt_rate_ok($storage, 'ip:' . $ip, (int) $cfg['rate_limit_per_hour'], 3600)) {
    header('Retry-After: 3600');
    dt_respond(429, ['ok' => false, 'message' => 'Too many messages from this connection. Please try again later.'], 'error=1');
}

/* ---- compose ---- */
$now      = new DateTimeImmutable('now');
$stamp    = $now->format('D, d M Y H:i') . ' (' . $now->format('T') . ')';
$ref      = strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
$siteName = (string) $cfg['site_name'];
$fromMail = (string) ($cfg['from_email'] ?: $cfg['smtp_user']);
$domain   = dt_domain_of($fromMail);

if ($type === 'package') {
    $lines = array_merge([
        "New package quote request  [#$ref]",
        str_repeat('-', 44),
        "Name:      $name",
        "Email:     $email",
        'Phone:     ' . ($phone ?: '-'),
        '',
    ], dt_package_block($pricing, $pkg), [
        '',
        'Visitor note:',
        $message !== '' ? $message : '-',
        '',
        str_repeat('-', 44),
        "Received:  $stamp",
        "IP:        $ip",
        'Reply to this email to answer the visitor directly.',
    ]);
    $subject = "New package quote [#$ref] from $name | " . dt_package_subject_figure($pricing, $pkg);
} else {
    $lines = [
        "New project inquiry  [#$ref]",
        str_repeat('-', 44),
        "Name:      $name",
        "Email:     $email",
        'Phone:     ' . ($phone ?: '-'),
        'Company:   ' . ($company ?: '-'),
        'Services:  ' . ($services ? implode(', ', $services) : '-'),
        'Budget:    ' . ($budget ?: '-'),
        'Timeline:  ' . ($timeline ?: '-'),
        '',
        'Message:',
        $message,
        '',
        str_repeat('-', 44),
        "Received:  $stamp",
        "IP:        $ip",
        'Reply to this email to answer the visitor directly.',
    ];
    $subject = "New inquiry [#$ref] from $name" . ($company ? " ($company)" : '');
}
$bodyOwner = implode("\n", $lines);

$ownerMsg = dt_build_message([
    'Date'       => $now->format('r'),
    'From'       => dt_addr($fromMail, (string) $cfg['from_name']),
    'To'         => dt_addr((string) $cfg['to_email'], (string) $cfg['to_name']),
    'Reply-To'   => dt_addr($email, $name),
    'Subject'    => dt_encode_header($subject),
    'Message-ID' => '<' . bin2hex(random_bytes(12)) . '@' . $domain . '>',
    'X-Mailer'   => 'DigitalTakhleeq-Contact/1.0',
], $bodyOwner);

/* ---- always keep a backup of the lead first (so a mail outage never loses it) ---- */
dt_backup($storage, [
    'type' => $type, 'ref' => $ref, 'at' => $now->format(DATE_ATOM), 'ip' => $ip,
    'name' => $name, 'email' => $email, 'phone' => $phone, 'company' => $company,
    'services' => $services, 'budget' => $budget, 'timeline' => $timeline, 'message' => $message,
    'package' => $pkg,
]);

/* ---- send ---- */
try {
    $smtp = new Smtp($cfg);
    $smtp->send($fromMail, [(string) $cfg['to_email']], $ownerMsg);
} catch (Throwable $e) {
    error_log('[digitaltakhleeq] SMTP failure for #' . $ref . ': ' . $e->getMessage());
    $out = ['ok' => false, 'message' => 'We could not send your message right now.'];
    if (!empty($cfg['debug'])) {
        $out['debug'] = $e->getMessage();
    }
    dt_respond(502, $out, 'error=1');
}

/* ---- optional auto-reply (limited to one per address per day; failure never affects the result) ---- */
if (!empty($cfg['autoreply']) && dt_rate_ok($storage, 'reply:' . $type . ':' . strtolower($email), 1, 86400)) {
    try {
        $first = explode(' ', $name)[0];
        $copy = [];
        if ($type === 'package') {
            $copy = array_merge(['Here is a copy of the package you selected:', ''], dt_package_block($pricing, $pkg), ['']);
        }
        $reply = implode("\n", array_merge([
            "Hi $first,",
            '',
            "Thank you for contacting $siteName. We have received your " . ($type === 'package' ? 'package request' : 'inquiry') . " (reference #$ref).",
            'We read every request personally and will reply within 24 hours with the next step.',
            '',
        ], $copy, [
            'If it is urgent, message us on WhatsApp: +92 345 5052261',
            '',
            'Regards,',
            "$siteName",
            (string) $cfg['site_url'],
            '',
            'You are receiving this because this address was used on our website. If that was not you, ignore this email.',
        ]));
        $replyMsg = dt_build_message([
            'Date'       => $now->format('r'),
            'From'       => dt_addr($fromMail, $siteName),
            'To'         => dt_addr($email, $name),
            'Reply-To'   => dt_addr((string) $cfg['to_email'], (string) $cfg['to_name']),
            'Subject'    => dt_encode_header(($type === 'package' ? "We received your package request [#$ref]" : "We received your inquiry [#$ref]")),
            'Message-ID' => '<' . bin2hex(random_bytes(12)) . '@' . $domain . '>',
            'Auto-Submitted' => 'auto-replied',
            'X-Mailer'   => 'DigitalTakhleeq-Contact/1.0',
        ], $reply);
        (new Smtp($cfg))->send($fromMail, [$email], $replyMsg);
    } catch (Throwable $e) {
        error_log('[digitaltakhleeq] autoreply failed for #' . $ref . ': ' . $e->getMessage());
    }
}

dt_respond(200, ['ok' => true, 'ref' => $ref], 'sent=1');
