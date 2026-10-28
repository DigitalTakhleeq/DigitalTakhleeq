<?php
/**
 * Digital Takhleeq - contact form configuration (TEMPLATE).
 *
 * HOW TO USE
 *   1. Copy this file to  config.php  (same folder) on the SERVER only.
 *      Even better: put it OUTSIDE the public web folder, at
 *          ../dt-config/config.php      (one level above public_html)
 *      The form finds it automatically.
 *   2. Fill in the values marked  <-- FILL IN.
 *   3. NEVER commit config.php to GitHub and never put the password in index.html or JS.
 *
 * GMAIL: you cannot use your normal Gmail password. Turn on 2-Step Verification for
 * digitaltakhleeq@gmail.com, then create an "App password" (Google Account > Security >
 * 2-Step Verification > App passwords). Paste the 16 characters below (spaces optional).
 */
return [
    // --- Where the form mail is sent -------------------------------------------------
    'to_email'   => 'digitaltakhleeq@gmail.com',      // inbox that receives new enquiries
    'to_name'    => 'Digital Takhleeq',

    // --- SMTP account used to SEND (Gmail example) -----------------------------------
    'smtp_host'   => 'smtp.gmail.com',
    'smtp_port'   => 465,                              // 465 = SSL (recommended), 587 = STARTTLS
    'smtp_secure' => 'ssl',                            // 'ssl' | 'tls' | 'none'
    'smtp_user'   => 'digitaltakhleeq@gmail.com',
    'smtp_pass'   => 'PASTE-16-CHAR-APP-PASSWORD',     // <-- FILL IN (server only)

    // From address. With Gmail this is always the Gmail account itself.
    // On a domain mailbox (e.g. contact@digitaltakhleeq.com) set it to that address.
    'from_email' => 'digitaltakhleeq@gmail.com',
    'from_name'  => 'Digital Takhleeq Website',

    // --- Website ---------------------------------------------------------------------
    'site_name'  => 'Digital Takhleeq',
    'site_url'   => 'https://digitaltakhleeq.com',     // <-- confirm your final domain
    // Extra hostnames allowed to post the form (your own domain is always allowed).
    'allowed_hosts' => ['digitaltakhleeq.com', 'www.digitaltakhleeq.com'],

    // --- Behaviour -------------------------------------------------------------------
    'autoreply'          => true,    // send the visitor a short "we received it" email
    'rate_limit_per_hour'=> 5,       // max submissions per IP per hour
    'min_fill_seconds'   => 3,       // faster than this = bot
    'trust_cf_header'    => false,   // true only if the site sits behind Cloudflare
    'timezone'           => 'Asia/Karachi',

    // --- Storage (backup log + rate-limit files) -------------------------------------
    // Leave null to use ../dt-storage (outside the web folder) or api/storage as fallback.
    'storage_dir' => null,

    // Package prices file. Leave null to use assets/data/pricing.js in the site folder.
    'pricing_file' => null,

    // --- Advanced / testing ----------------------------------------------------------
    'smtp_verify_peer' => true,      // keep true in production
    'smtp_timeout'     => 15,
    'debug'            => false,     // true = include error detail in JSON (never in production)
];
