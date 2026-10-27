# Digital Takhleeq website: setup and go-live guide

Everything below is in order. Steps 1 to 4 make the contact form send real email. Time needed: about 30 minutes.

## What is in the folder

| Path | Purpose |
|---|---|
| `index.html`, `privacy.html`, `terms.html`, `404.html` | The site (plain HTML, CSS, JS; no build step) |
| `assets/` | CSS, JS, logo and icons, project screenshots |
| `api/contact.php` | **PHP mail endpoint** (recommended) |
| `api/config.sample.php` | Settings template. Copy it, fill it, keep it on the server only |
| `backend-python/` | Same endpoint in Python/Flask (use only if your host runs Python, not PHP) |
| `.htaccess` | HTTPS redirect, security headers, caching, protection of private files |

## Which backend should I use?

Use **PHP**. Almost every shared host (cPanel, Hostinger, Namecheap, local Pakistani hosts) runs PHP, so the website and the form live on one host with no extra service.

**GitHub Pages cannot run PHP or Python.** If you stay on GitHub Pages for the site, the form has nowhere to run. Your options: (a) host on cPanel/PHP hosting (recommended), or (b) keep Pages for the site and run `backend-python` on a small separate host, then set `endpoint` at the top of `assets/js/main.js` to that URL and add your site domain to `DT_ALLOWED_HOSTS`.

## Step 1. Create the Gmail App Password (5 min)

Gmail will not accept your normal password from a website. You need an App Password.

1. Sign in to `digitaltakhleeq@gmail.com` and open **Google Account > Security**.
2. Turn on **2-Step Verification** (required).
3. Search "App passwords", create one named `Website form`, and copy the 16 characters.
4. Keep it private. Never paste it into the website files, chat, or GitHub.

## Step 2. Upload the site (cPanel, 5 min)

1. cPanel > **File Manager** > `public_html`. Upload and extract the zip so `index.html` sits directly in `public_html`.
2. Turn on SSL: cPanel > **SSL/TLS Status** > run AutoSSL for your domain.
3. Check PHP: cPanel > **Select PHP Version**, choose 8.1 or newer. Make sure the `mbstring` and `openssl` extensions are ticked.

## Step 3. Add the mail settings (5 min)

Best (config outside the public folder):

1. In File Manager, go to the folder **above** `public_html` (your home folder) and create `dt-config`.
2. Upload `api/config.sample.php` into it and rename it `config.php`.
3. Edit it: paste the App Password into `smtp_pass`, confirm your domain in `site_url` and `allowed_hosts`.

Also acceptable: copy `api/config.sample.php` to `api/config.php` inside `public_html`. The included `.htaccess` blocks web access to it.

Create one more folder above `public_html` called `dt-storage` (permissions 750). The form keeps a backup of every enquiry there, so a mail outage never loses a lead. If you skip it, `api/storage/` is used instead.

## Step 4. Test it

1. Open your site, fill the form, send.
2. You should see the "Thank you" panel. Within a minute `digitaltakhleeq@gmail.com` receives **New inquiry [#REF]**, and the sender receives a confirmation.
3. Press **Reply** on the email. It goes to the visitor, not to yourself.
4. If the form says "We could not send that just now": set `'debug' => true` in config, resubmit, open `https://yourdomain/api/contact.php` network response to read the reason, then set it back to `false`. Common causes:
   - `535` authentication error: App Password wrong, or 2-Step Verification is off.
   - `connect failed`: the host blocks outbound port 465. Try `smtp_port` 587 with `smtp_secure` `tls`, or ask the host to open it.
   - Mail lands in Spam: see "Deliverability" below.

## Gmail limits and a better long-term setup

- Gmail sending limit is about 500 messages/day. A contact form will stay far below this.
- The visible From address is always `digitaltakhleeq@gmail.com` when sending through Gmail.
- Recommended once the domain is live: create `contact@digitaltakhleeq.com` in cPanel > Email Accounts and use its SMTP details (host `mail.digitaltakhleeq.com`, port 465, SSL). Your host usually sets up SPF and DKIM automatically, which improves inbox placement.

## Deliverability checklist

- Keep `from_email` equal to the authenticated mailbox (the default).
- On a domain mailbox, make sure SPF and DKIM show as valid in cPanel > **Email Deliverability**.
- Add a DMARC record `_dmarc` TXT: `v=DMARC1; p=none; rua=mailto:digitaltakhleeq@gmail.com`.

## Before launch: things only you can confirm

| Item | Where | Current value |
|---|---|---|
| Final domain | `index.html` (canonical, og:url), `sitemap.xml`, `robots.txt`, `privacy.html`, `terms.html`, config | `digitaltakhleeq.com` |
| LinkedIn path | footer links, JSON-LD in `index.html` | `/company/digitaltakhleeq` |
| GitHub username | footer, JSON-LD | `digitaltakhleeq` |
| Starting price | pricing section, FAQ | Website from PKR 55,000 |
| "Reply within 24 hours" promise | hero, contact, autoreply | keep only if you can honour it |
| Legal pages | `privacy.html`, `terms.html` | drafts: have them reviewed |

Search and replace `digitaltakhleeq.com` across the folder if your domain differs.

## Adding project screenshots

Save two 1280x800 images as `assets/projects/dairyandco.jpg` and `assets/projects/bbc-academy.jpg`. They appear automatically. Until then a clean placeholder is shown.

## The "next project" slot

In `index.html`, search for `In progress`. When your next project is ready, copy one of the delivered project cards above it, replace the name, link, tags and image, and delete the dashed slot (or keep it for the following project).

## Showing the team later

Search `TEAM` in `index.html`: a commented-out block is ready. Uncomment it and add real names, roles and photos.

## Python (Flask) alternative

```
cd backend-python
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.sample .env        # then fill DT_SMTP_PASS
flask --app app run        # local test on http://127.0.0.1:8000
gunicorn -w 2 -b 127.0.0.1:8000 app:app   # production
```

It exposes the same `POST /api/contact` contract, so the front-end needs no change when both are served from the same domain.

## Security built in

- Honeypot field and minimum fill time to stop bots, without a CAPTCHA.
- Per-IP limit (5 per hour) and one auto-reply per address per day.
- All input is trimmed and checked; newline characters are stripped so email headers cannot be injected.
- Visitor's email goes in `Reply-To` only; the sender is always your own mailbox.
- Origin check, request size limit, TLS certificate verification for mail, credentials refused over unencrypted connections.
- Secrets live only in `config.php` / `.env`, which are blocked from the web and ignored by git.
