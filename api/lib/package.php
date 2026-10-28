<?php
declare(strict_types=1);

/* Package quotes: prices come from assets/data/pricing.js on the server.
 * The browser only sends item and tier ids; amounts sent by the browser are never trusted. */

function dt_money(string $currency, int $n): string
{
    return $currency . ' ' . number_format($n, 0, '.', ',');
}

function dt_load_pricing(array $cfg): ?array
{
    $file = !empty($cfg['pricing_file']) ? (string) $cfg['pricing_file'] : dt_site_root() . '/assets/data/pricing.js';
    if (!is_file($file)) {
        return null;
    }
    $raw = (string) file_get_contents($file);
    $a = strpos($raw, '{');
    $b = strrpos($raw, '}');
    if ($a === false || $b === false || $b < $a) {
        return null;
    }
    $data = json_decode(substr($raw, $a, $b - $a + 1), true);   // the file is "window.DT_PRICING = {json};"

    return is_array($data) && !empty($data['items']) ? $data : null;
}

/**
 * @return array{lines: array, once: int, monthly: int}|null  null when the selection is invalid or empty
 */
function dt_price_package(array $pricing, string $raw): ?array
{
    $sel = json_decode($raw, true);
    if (!is_array($sel) || !$sel || count($sel) > 16) {
        return null;
    }
    $chosen = [];
    foreach ($sel as $row) {
        if (!is_array($row) || !isset($row['id'], $row['tier']) || !is_string($row['id']) || !is_string($row['tier'])) {
            return null;
        }
        $chosen[$row['id']] = $row['tier'];         // one tier per item; the last one wins
    }
    $lines = [];
    $once = 0;
    $monthly = 0;
    foreach ($pricing['items'] as $item) {          // keep the order from pricing.js
        if (!isset($chosen[$item['id']])) {
            continue;
        }
        $tier = null;
        foreach ($item['tiers'] as $t) {
            if ($t['id'] === $chosen[$item['id']]) {
                $tier = $t;
            }
        }
        if (!$tier) {
            return null;
        }
        $isMonthly = ($item['billing'] ?? 'once') === 'monthly';
        $lines[] = [
            'id' => $item['id'], 'name' => $item['name'], 'tier' => $tier['name'], 'tier_id' => $tier['id'],
            'price' => (int) $tier['price'], 'monthly' => $isMonthly, 'detail' => $tier['detail'] ?? '',
        ];
        if ($isMonthly) {
            $monthly += (int) $tier['price'];
        } else {
            $once += (int) $tier['price'];
        }
    }
    if (count($lines) !== count($chosen)) {
        return null;                                // an id that does not exist in pricing.js
    }
    return ['lines' => $lines, 'once' => $once, 'monthly' => $monthly];
}

/** The itemised block used in both the owner email and the visitor's copy. */
function dt_package_block(array $pricing, array $pkg): array
{
    $cur = (string) ($pricing['currency'] ?? 'PKR');
    $out = ['Selected scope'];
    foreach ($pkg['lines'] as $i => $l) {
        $out[] = ($i + 1) . '. ' . $l['name'] . ' (' . $l['tier'] . '): ' . dt_money($cur, $l['price']) . ($l['monthly'] ? ' / month' : '');
        if ($l['detail'] !== '') {
            $out[] = '   ' . $l['detail'];
        }
    }
    $out[] = '';
    if ($pkg['once'] > 0) {
        $out[] = 'One-time total, starting from:  ' . dt_money($cur, $pkg['once']);
    }
    if ($pkg['monthly'] > 0) {
        $out[] = 'Monthly total, starting from:   ' . dt_money($cur, $pkg['monthly']) . ' / month';
    }
    $out[] = '';
    $terms = [];
    if ($pkg['once'] > 0 && !empty($pricing['milestones'])) {
        $terms[] = 'One-time work is paid in milestones: ' . $pricing['milestones'] . '.';
    }
    $terms[] = 'These are starting figures. A fixed quote follows a short discovery call.';
    if (!empty($pricing['exclusions'])) {
        $terms[] = $pricing['exclusions'];
    }
    $out[] = implode(' ', $terms);
    return $out;
}

function dt_package_subject_figure(array $pricing, array $pkg): string
{
    $cur = (string) ($pricing['currency'] ?? 'PKR');
    $parts = [];
    if ($pkg['once'] > 0) {
        $parts[] = dt_money($cur, $pkg['once']) . '+';
    }
    if ($pkg['monthly'] > 0) {
        $parts[] = dt_money($cur, $pkg['monthly']) . '+ per month';
    }
    return implode(' and ', $parts);
}
