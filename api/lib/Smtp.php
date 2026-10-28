<?php
declare(strict_types=1);

/**
 * Minimal, dependency-free SMTP client (SSL on connect, STARTTLS, or plain).
 * Supports AUTH LOGIN / AUTH PLAIN. Sends one UTF-8 text message.
 */
final class SmtpException extends RuntimeException {}

final class Smtp
{
    /** @var resource|null */
    private $fp = null;
    private array $cfg;
    public array $log = [];

    public function __construct(array $cfg)
    {
        $this->cfg = $cfg;
    }

    private function rec(string $line): void
    {
        $this->log[] = $line;
    }

    private function open(): void
    {
        $host    = (string) $this->cfg['smtp_host'];
        $port    = (int) $this->cfg['smtp_port'];
        $secure  = (string) ($this->cfg['smtp_secure'] ?? 'ssl');
        $timeout = (int) ($this->cfg['smtp_timeout'] ?? 15);
        $verify  = (bool) ($this->cfg['smtp_verify_peer'] ?? true);

        $ctx = stream_context_create(['ssl' => [
            'verify_peer'       => $verify,
            'verify_peer_name'  => $verify,
            'peer_name'         => $host,
            'SNI_enabled'       => true,
            'allow_self_signed' => !$verify,
        ]]);
        $target = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
        $errno = 0; $errstr = '';
        $fp = @stream_socket_client($target, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $ctx);
        if (!$fp) {
            throw new SmtpException("connect failed: $errstr ($errno)");
        }
        stream_set_timeout($fp, $timeout);
        $this->fp = $fp;
    }

    /** Read a (possibly multi-line) reply; returns [code, text]. */
    private function read(): array
    {
        $text = '';
        $code = 0;
        while (true) {
            $line = fgets($this->fp, 1024);
            if ($line === false) {
                $meta = stream_get_meta_data($this->fp);
                throw new SmtpException($meta['timed_out'] ? 'server timed out' : 'connection closed unexpectedly');
            }
            $this->rec('S: ' . rtrim($line));
            $text .= $line;
            if (strlen($line) < 4 || $line[3] !== '-') {
                $code = (int) substr($line, 0, 3);
                break;
            }
        }
        return [$code, $text];
    }

    private function cmd(string $line, array $expect, bool $secret = false): string
    {
        $this->rec('C: ' . ($secret ? '[hidden]' : $line));
        if (fwrite($this->fp, $line . "\r\n") === false) {
            throw new SmtpException('write failed');
        }
        [$code, $text] = $this->read();
        if (!in_array($code, $expect, true)) {
            throw new SmtpException('unexpected reply to ' . ($secret ? 'credentials' : strtok($line, ' ')) . ': ' . trim($text));
        }
        return $text;
    }

    private static function bareAddress(string $addr): string
    {
        if (preg_match('/[\r\n<>\s,;]/', $addr) || !filter_var($addr, FILTER_VALIDATE_EMAIL)) {
            throw new SmtpException('invalid address');
        }
        return $addr;
    }

    private function ehloName(): string
    {
        $h = $_SERVER['SERVER_NAME'] ?? gethostname() ?: 'localhost';
        $h = preg_replace('/[^A-Za-z0-9.\-]/', '', (string) $h);
        return $h !== '' ? $h : 'localhost';
    }

    /**
     * @param string $rawMessage full RFC 5322 message (headers + body), CRLF line endings
     */
    public function send(string $envelopeFrom, array $recipients, string $rawMessage): void
    {
        $secure = (string) ($this->cfg['smtp_secure'] ?? 'ssl');
        $this->open();
        try {
            [$code, $banner] = $this->read();
            if ($code !== 220) {
                throw new SmtpException('bad greeting: ' . trim($banner));
            }
            $ehlo = $this->cmd('EHLO ' . $this->ehloName(), [250]);

            if ($secure === 'tls') {
                $this->cmd('STARTTLS', [220]);
                $ok = @stream_socket_enable_crypto($this->fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                if ($ok !== true) {
                    throw new SmtpException('STARTTLS handshake failed');
                }
                $ehlo = $this->cmd('EHLO ' . $this->ehloName(), [250]);
            }

            $user = (string) ($this->cfg['smtp_user'] ?? '');
            $pass = (string) ($this->cfg['smtp_pass'] ?? '');
            if ($user !== '' && $secure !== 'none') {
                // never send credentials over an unencrypted channel
                if (stripos($ehlo, 'AUTH') !== false && stripos($ehlo, 'LOGIN') === false && stripos($ehlo, 'PLAIN') !== false) {
                    $this->cmd('AUTH PLAIN ' . base64_encode("\0$user\0$pass"), [235], true);
                } else {
                    $this->cmd('AUTH LOGIN', [334]);
                    $this->cmd(base64_encode($user), [334], true);
                    $this->cmd(base64_encode($pass), [235], true);
                }
            } elseif ($user !== '' && $secure === 'none') {
                throw new SmtpException('refusing to authenticate without TLS');
            }

            $this->cmd('MAIL FROM:<' . self::bareAddress($envelopeFrom) . '>', [250]);
            foreach ($recipients as $r) {
                $this->cmd('RCPT TO:<' . self::bareAddress($r) . '>', [250, 251]);
            }
            $this->cmd('DATA', [354]);

            // normalise line endings and dot-stuff
            $msg = preg_replace("/\r\n|\r|\n/", "\r\n", $rawMessage);
            $msg = preg_replace('/^\./m', '..', $msg);
            if (fwrite($this->fp, $msg . "\r\n.\r\n") === false) {
                throw new SmtpException('write failed (data)');
            }
            $this->rec('C: [message body ' . strlen($msg) . ' bytes]');
            [$code, $text] = $this->read();
            if ($code !== 250) {
                throw new SmtpException('message rejected: ' . trim($text));
            }
            @fwrite($this->fp, "QUIT\r\n");
        } finally {
            if (is_resource($this->fp)) {
                @fclose($this->fp);
            }
            $this->fp = null;
        }
    }
}
