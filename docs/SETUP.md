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
4. Open `https://yourdomain/api/contact.php?ping=1`. It should show `"ready":true`. When it does, the **Send quote by email** button appears by itself in the package builder (see below).
5. If the form says "We could not send that just now": set `'debug' => true` in config, resubmit, open your browser's Network tab and read the `debug` text in the response, then set it back to `false`. Common causes:
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
| Package prices | `assets/data/pricing.js` | see "Package builder and prices" below |
| "Reply within 24 hours" promise | hero, contact, autoreply | keep only if you can honour it |
| Legal pages | `privacy.html`, `terms.html` | drafts: have them reviewed |

Search and replace `digitaltakhleeq.com` across the folder if your domain differs.

## Package builder and prices

Prices live in one file: `assets/data/pricing.js`. The website shows them and the mail backend reads the same file, so the numbers in the email always match the page. Each capability has three tiers; `"billing": "once"` is a one-time project and `"monthly"` is a retainer. Change a number, save, upload. Nothing else needs editing. Keep the file valid: the part after `window.DT_PRICING =` is plain JSON.

**How the buttons behave**

| Situation | What the client sees in "Build your package" |
|---|---|
| Backend not deployed or not configured | One button: **Get quote on WhatsApp**. It opens WhatsApp with the whole package written out (items, tiers, prices, totals). |
| Backend live (`?ping=1` says `ready:true`) | **Get quote on WhatsApp** and **Send quote by email**. The email button opens a short form (name, email, phone, note). Your inbox gets a formatted quote and the client gets a copy. |
| Email send fails for any reason | A panel with the same message ready for WhatsApp or the client's email app. |

The contact form at the bottom stays the formal route. If it cannot send, it shows the same WhatsApp and email options with the form details already written as a message.

To force a behaviour, change `backend` at the top of `assets/js/main.js`: `'auto'` (default), `'on'` or `'off'` (WhatsApp only).

The server recalculates every price from `pricing.js`. The browser only sends item and tier names, so a client cannot change a price by editing the page.

**Where the starting prices come from.** They are positioned inside current Pakistan market ranges, and you should adjust them to your own costs and positioning.

| Service | Market range found (PKR) | Source | Your tiers |
|---|---|---|---|
| Business website | 25,000 to 100,000 (small), 100,000 to 350,000 (advanced) | GoDaddy Pakistan guide | 55,000 / 95,000 / 175,000 |
| E-commerce | 50,000 to 200,000 (small to medium), 200,000 to 500,000 (large); 120,000 to 280,000 | GoDaddy; SoftVirtue | 120,000 / 220,000 / 380,000 |
| SEO | 10,000 to 100,000 per month | GoDaddy | 30,000 / 55,000 / 90,000 per month |
| Social media | 15,000 to 100,000 per month | Digital Pakistan | 25,000 / 45,000 / 75,000 per month |
| Custom software | 80,000 to 150,000 single module; 150,000 to 400,000 multi-module; 400,000 to 600,000+ enterprise | SoftVirtue | 120,000 / 250,000 / 450,000 |
| Content | 5,000 to 20,000 per page set (one-time) | HosterPK | 20,000 / 35,000 / 60,000 per month (estimate) |
| Paid ads management | No public fee data found | none | 25,000 / 40,000 / 70,000 per month (estimate) |
| Automation | No public fee data found | none | 45,000 / 95,000 / 180,000 (estimate) |

Content, ads management and automation are my estimates, not sourced figures. Check them against what you actually charge before launch.

**Testing locally.** You can double-click `index.html` to look at the page. The package prices and WhatsApp quote work that way. Email sending needs the PHP backend, so use `php -S localhost:8000` inside the site folder to test the form.

## Adding project screenshots

The two delivered projects already have their screenshots in `assets/projects/`. To replace one, save a 1280x800 image over the same file name.

For a new project, add `assets/projects/your-name.jpg` and copy a delivered project card in `index.html` (see the next section).

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
