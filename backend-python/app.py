"""
Digital Takhleeq - contact form API (Python / Flask alternative to api/contact.php).

Same contract as the PHP version:
  POST /api/contact  (form-encoded)  ->  {"ok": true} | {"ok": false, "errors": {...}, "message": "..."}

Run locally:   pip install -r requirements.txt && cp .env.sample .env && flask --app app run
Production:    gunicorn -w 2 -b 127.0.0.1:8000 app:app   (behind Nginx / Cloudflare / your host's Python app manager)
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import smtplib
import ssl
import threading
import time
from datetime import datetime, timezone
from email.message import EmailMessage
from email.headerregistry import Address
from email.utils import formatdate, make_msgid
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from flask import Flask, jsonify, redirect, request

try:  # optional: load .env during local development
    from dotenv import load_dotenv
    load_dotenv()
except Exception:  # pragma: no cover
    pass


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def env_bool(name: str, default: bool) -> bool:
    v = os.environ.get(name)
    return default if v is None else v.strip().lower() in {"1", "true", "yes", "on"}


CFG = {
    "to_email": env("DT_TO_EMAIL", "digitaltakhleeq@gmail.com"),
    "to_name": env("DT_TO_NAME", "Digital Takhleeq"),
    "smtp_host": env("DT_SMTP_HOST", "smtp.gmail.com"),
    "smtp_port": int(env("DT_SMTP_PORT", "465")),
    "smtp_secure": env("DT_SMTP_SECURE", "ssl"),          # ssl | tls | none
    "smtp_user": env("DT_SMTP_USER", "digitaltakhleeq@gmail.com"),
    "smtp_pass": env("DT_SMTP_PASS", ""),                  # Gmail App Password
    "from_email": env("DT_FROM_EMAIL", "") or env("DT_SMTP_USER", "digitaltakhleeq@gmail.com"),
    "from_name": env("DT_FROM_NAME", "Digital Takhleeq Website"),
    "site_name": env("DT_SITE_NAME", "Digital Takhleeq"),
    "site_url": env("DT_SITE_URL", "https://digitaltakhleeq.com"),
    "allowed_hosts": [h.strip().lower() for h in env("DT_ALLOWED_HOSTS", "digitaltakhleeq.com,www.digitaltakhleeq.com").split(",") if h.strip()],
    "autoreply": env_bool("DT_AUTOREPLY", True),
    "rate_per_hour": int(env("DT_RATE_PER_HOUR", "5")),
    "min_fill_seconds": float(env("DT_MIN_FILL_SECONDS", "3")),
    "trust_proxy_header": env("DT_TRUST_PROXY_HEADER", ""),   # e.g. CF-Connecting-IP or X-Forwarded-For (only if you trust the proxy)
    "tz": env("DT_TIMEZONE", "Asia/Karachi"),
    "storage": Path(env("DT_STORAGE_DIR", str(Path(__file__).resolve().parent / "storage"))),
    "verify_peer": env_bool("DT_SMTP_VERIFY_PEER", True),
    "timeout": int(env("DT_SMTP_TIMEOUT", "15")),
    "debug": env_bool("DT_DEBUG", False),
}

SERVICES = ["Websites", "Digital growth", "Social media", "Advertising", "Automation", "Custom systems"]
BUDGETS = ["Under PKR 50k", "PKR 50k to 100k", "PKR 100k to 250k", "PKR 250k to 500k", "PKR 500k+", "USD or EUR project"]
TIMELINES = ["1 to 2 weeks", "2 to 4 weeks", "1 to 2 months", "Flexible"]

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 60_000
_lock = threading.Lock()


# ----------------------------------------------------------------------------- helpers
def clean_line(v, n: int) -> str:
    v = re.sub(r"[\x00-\x1f\x7f]+", " ", str(v or ""))
    return re.sub(r"\s{2,}", " ", v).strip()[:n]


def clean_text(v, n: int) -> str:
    v = str(v or "").replace("\r\n", "\n").replace("\r", "\n")
    v = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", v)
    return re.sub(r"\n{3,}", "\n\n", v).strip()[:n]


EMAIL_RE = re.compile(r"^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$")
PHONE_RE = re.compile(r"^[+0-9()\-\s]{7,20}$")


def client_ip() -> str:
    h = CFG["trust_proxy_header"]
    if h and request.headers.get(h):
        return request.headers[h].split(",")[0].strip()
    return request.remote_addr or "0.0.0.0"


def origin_ok() -> bool:
    src = request.headers.get("Origin") or request.headers.get("Referer") or ""
    if not src:
        return True
    host = (urlparse(src).hostname or "").lower()
    if not host:
        return False
    own = request.host.split(":")[0].lower()
    return host in CFG["allowed_hosts"] or host == own


def rate_ok(key: str, limit: int, window: int) -> bool:
    d: Path = CFG["storage"] / "ratelimit"
    try:
        d.mkdir(parents=True, exist_ok=True)
    except OSError:
        return True  # fail open rather than losing real leads
    f = d / (hashlib.sha256(key.encode()).hexdigest() + ".json")
    now = time.time()
    with _lock:
        try:
            hits = [t for t in json.loads(f.read_text()) if t > now - window]
        except Exception:
            hits = []
        allowed = len(hits) < limit
        if allowed:
            hits.append(now)
        try:
            f.write_text(json.dumps(hits))
        except OSError:
            pass
    return allowed


def backup(rec: dict) -> None:
    try:
        CFG["storage"].mkdir(parents=True, exist_ok=True)
        with _lock, open(CFG["storage"] / f"leads-{datetime.now():%Y-%m}.jsonl", "a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except OSError:
        pass


def respond(status: int, payload: dict, query: str = ""):
    wants_json = "application/json" in request.headers.get("Accept", "") or request.headers.get("X-Requested-With") == "XMLHttpRequest"
    if wants_json:
        r = jsonify(payload)
        r.status_code = status
        r.headers["Cache-Control"] = "no-store"
        return r
    return redirect("/" + (f"?{query}" if query else "") + "#contact", code=303)


def send_mail(msg: EmailMessage, rcpt: str) -> None:
    host, port, secure = CFG["smtp_host"], CFG["smtp_port"], CFG["smtp_secure"]
    ctx = ssl.create_default_context()
    if not CFG["verify_peer"]:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    if secure == "ssl":
        s = smtplib.SMTP_SSL(host, port, timeout=CFG["timeout"], context=ctx)
    else:
        s = smtplib.SMTP(host, port, timeout=CFG["timeout"])
    with s:
        s.ehlo()
        if secure == "tls":
            s.starttls(context=ctx)
            s.ehlo()
        if CFG["smtp_user"]:
            if secure == "none":
                raise RuntimeError("refusing to authenticate without TLS")
            s.login(CFG["smtp_user"], CFG["smtp_pass"])
        s.send_message(msg, from_addr=CFG["from_email"], to_addrs=[rcpt])


def make_msg(subject: str, to: tuple[str, str], body: str, reply_to: tuple[str, str] | None = None, extra: dict | None = None) -> EmailMessage:
    def addr(name: str, email: str) -> Address:
        user, _, domain = email.rpartition("@")
        return Address(display_name=name, username=user, domain=domain)

    m = EmailMessage()
    m["Date"] = formatdate(localtime=True)
    m["From"] = addr(CFG["from_name"], CFG["from_email"])
    m["To"] = addr(*to)
    if reply_to:
        m["Reply-To"] = addr(*reply_to)
    m["Subject"] = subject
    m["Message-ID"] = make_msgid(domain=CFG["from_email"].rpartition("@")[2])
    m["X-Mailer"] = "DigitalTakhleeq-Contact/1.0"
    for k, v in (extra or {}).items():
        m[k] = v
    m.set_content(body, charset="utf-8", cte="base64")
    return m


# ----------------------------------------------------------------------------- route
@app.post("/api/contact")
@app.post("/api/contact.php")  # lets the unchanged front-end work with either backend
def contact():
    if not CFG["to_email"] or (not CFG["smtp_pass"] and CFG["smtp_secure"] != "none"):
        app.logger.error("SMTP settings missing")
        return respond(500, {"ok": False, "message": "The form is not configured yet."}, "error=1")
    if not origin_ok():
        return respond(403, {"ok": False, "message": "Request not allowed."}, "error=1")

    f = request.form
    if f.get("website", "").strip():
        return respond(200, {"ok": True})  # honeypot: pretend success
    try:
        ts = int(f.get("ts", "0") or 0)
    except ValueError:
        ts = 0
    if ts > 0:
        elapsed = time.time() - ts / 1000
        if 0 <= elapsed < CFG["min_fill_seconds"] and elapsed < 86400:
            return respond(200, {"ok": True})

    name = clean_line(f.get("name"), 100)
    email = clean_line(f.get("email"), 254)
    phone = clean_line(f.get("phone"), 40)
    company = clean_line(f.get("company"), 140)
    message = clean_text(f.get("message"), 4000)
    services = [s for s in dict.fromkeys(clean_line(x, 60) for x in f.getlist("services[]")) if s in SERVICES]
    budget = clean_line(f.get("budget"), 40)
    timeline = clean_line(f.get("timeline"), 40)
    budget = budget if budget in BUDGETS else ""
    timeline = timeline if timeline in TIMELINES else ""

    errors = {}
    if len(name) < 2:
        errors["name"] = "Please enter your name."
    if not EMAIL_RE.match(email):
        errors["email"] = "Please enter a valid email address."
    if phone and not PHONE_RE.match(phone):
        errors["phone"] = "Use digits, spaces, + or - only."
    if len(message) < 10:
        errors["message"] = "Tell us a little more, at least a sentence."
    elif len(re.findall(r"https?://", message, re.I)) > 3:
        errors["message"] = "Please keep links to a maximum of three."
    if not f.get("consent"):
        errors["consent"] = "Please agree so we can reply to you."
    if errors:
        return respond(422, {"ok": False, "errors": errors, "message": "Please check the highlighted fields."}, "error=1")

    ip = client_ip()
    if not rate_ok("ip:" + ip, CFG["rate_per_hour"], 3600):
        r = respond(429, {"ok": False, "message": "Too many messages from this connection. Please try again later."}, "error=1")
        r.headers["Retry-After"] = "3600"
        return r

    now = datetime.now(ZoneInfo(CFG["tz"]))
    ref = secrets.token_hex(3).upper()
    body = "\n".join([
        f"New project inquiry  [#{ref}]", "-" * 44,
        f"Name:      {name}", f"Email:     {email}", f"Phone:     {phone or '-'}", f"Company:   {company or '-'}",
        f"Services:  {', '.join(services) or '-'}", f"Budget:    {budget or '-'}", f"Timeline:  {timeline or '-'}",
        "", "Message:", message, "", "-" * 44,
        f"Received:  {now:%a, %d %b %Y %H:%M} ({now.tzname()})", f"IP:        {ip}",
        "Reply to this email to answer the visitor directly.",
    ])
    subject = f"New inquiry [#{ref}] from {name}" + (f" ({company})" if company else "")

    backup({"ref": ref, "at": now.isoformat(), "ip": ip, "name": name, "email": email, "phone": phone, "company": company,
            "services": services, "budget": budget, "timeline": timeline, "message": message})
    try:
        send_mail(make_msg(subject, (CFG["to_name"], CFG["to_email"]), body, reply_to=(name, email)), CFG["to_email"])
    except Exception as e:  # noqa: BLE001
        app.logger.error("SMTP failure for #%s: %s", ref, e)
        out = {"ok": False, "message": "We could not send your message right now."}
        if CFG["debug"]:
            out["debug"] = str(e)
        return respond(502, out, "error=1")

    if CFG["autoreply"] and rate_ok("reply:" + email.lower(), 1, 86400):
        try:
            first = name.split(" ")[0]
            text = "\n".join([
                f"Hi {first},", "",
                f"Thank you for contacting {CFG['site_name']}. We have received your inquiry (reference #{ref}).",
                "We read every request personally and will reply within 24 hours with the next step.", "",
                "If it is urgent, message us on WhatsApp: +92 345 5052261", "",
                "Regards,", CFG["site_name"], CFG["site_url"], "",
                "You are receiving this because this address was used on our contact form. If that was not you, ignore this email.",
            ])
            send_mail(make_msg(f"We received your inquiry [#{ref}]", (name, email), text,
                               reply_to=(CFG["to_name"], CFG["to_email"]), extra={"Auto-Submitted": "auto-replied"}), email)
        except Exception as e:  # noqa: BLE001
            app.logger.error("autoreply failed for #%s: %s", ref, e)

    return respond(200, {"ok": True, "ref": ref}, "sent=1")


@app.errorhandler(413)
def too_big(_e):
    return respond(413, {"ok": False, "message": "Message too large."}, "error=1")


@app.errorhandler(405)
def not_allowed(_e):
    r = respond(405, {"ok": False, "message": "Method not allowed."}, "error=1")
    r.headers["Allow"] = "POST"
    return r


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(env("PORT", "8000")), debug=False)
