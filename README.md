# CF Installer ⚡

> نصب خودکار پنل‌های VPN روی Cloudflare Worker

![Version](https://img.shields.io/badge/version-3.0.3-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-orange)

</p>

<p align="center">
  <a href="https://arshiyashams675-sudo.github.io/cf-installer/">🚀 اجرای آنلاین</a>
</p>

---

## ✨ ویژگی‌ها

- 🎯 **نصب خودکار** پنل‌ها با یک کلیک
- 🔑 **ساخت API Token** با لینک مستقیم
- 💾 **ایجاد D1/KV** به صورت خودکار
- 🌐 **فعال‌سازی workers.dev** خودکار
- 📱 **ریسپانسیو** — کار میکنه روی موبایل و دسکتاپ
- 🎨 **رابط کاربری زیبا** با تم تاریک و فونت Vazirmatn
- 🖥️ **Backend Worker** — دانلود کد از سرور (سازگار با ایران)

---

## 📋 پنل‌های پشتیبانی شده

| پنل | توضیح | Storage |
|------|--------|---------|
| 🌙 **Nahan Panel** | پنل سبک و سریع | D1 |
| ⚡ **EdgeTunnel** | پنل حرفه‌ای و محبوب | KV |
| 🆕 **Cfnew Panel** | پنل مدرن با GrainTCP | KV |
| 🚀 **Nova Proxy** | پنل پیشرفته | D1 + KV |

---

## 🔧 چطور کار میکنه؟

### ساختار

```
GitHub Pages (index.html)
         │
         ▼ درخواست REST
Backend Worker (cf-installer-backend.bldj.workers.dev)
         │
         ├── 📥 دانلود کد از GitHub/jsDelivr
         ├── 🔐 اعتبارسنجی توکن Cloudflare
         ├── 💾 ایجاد D1/KV Binding
         ├── 🚀 استقرار Worker
         └── 🌐 فعال‌سازی workers.dev
```

### مراحل نصب

1. **انتخاب پنل** — یکی از ۴ پنل موجود را انتخاب کنید
2. **وارد کردن API Token** — توکن Cloudflare خود را وارد کنید
3. **انتخاب پنل و نام Worker** — نوع پنل و نام دلخواه را مشخص کنید
4. **نصب و فعال‌سازی** — دکمه نصب را بزنید و منتظر بمانید
5. **تمام!** — آدرس پنل نمایش داده میشود

### Backend Worker

برای سازگاری با ایران (که GitHub مسدود است)، تمام عملیات از طریق یک **Backend Worker** انجام میشود:

- **اعتبارسنجی توکن** → مستقیم از Cloudflare API
- **دانلود کد** → از طریق jsDelivr CDN
- **استقرار Worker** → مستقیم از Cloudflare API
- **فعال‌سازی** → مستقیم از Cloudflare API

---

## 🚀 راه‌اندازی

### روش ۱: استفاده آنلاین (پیشنهادی)

به [این آدرس](https://arshiyashams675-sudo.github.io/cf-installer/) بروید و مراحل را دنبال کنید.

### روش ۲: راه‌اندازی Backend

اگر می‌خواهید Backend خودتان را راه‌اندازی کنید:

1. فایل `worker-backend.js` را دانلود کنید
2. در Cloudflare Dashboard > Workers > Create Worker آپلود کنید
3. آدرس Worker خود را در `index.html` در خط `const BACKEND=...` تغییر دهید

---

## 📁 ساختار پروژه

```
cf-installer/
├── index.html              ← صفحه اصلی installer
├── worker-backend.js       ← کد Backend Worker
├── README.md               ← این فایل
├── proxy-worker.js         ← Worker پروکسی (legacy)
├── app.py                  ← نسخه Flask (legacy)
├── Dockerfile              ← Docker config (legacy)
├── requirements.txt        ← Python deps (legacy)
└── templates/
    └── index.html          ← قالب Flask (legacy)
```

---

## 🔐 امنیت

- ✅ توکن API ذخیره **نمیشود**
- ✅ تمام عملیات از طریق **Cloudflare Worker** انجام میشود
- ✅ **HTTPS** روی تمام ارتباطات
- ✅ توکن فقط برای **یک بار** استفاده میشود

---

## 🛠️ API Reference

Backend Worker اندپوینت‌های زیر را پشتیبانی می‌کند:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | بررسی سلامت Worker |
| POST | `/deploy` | استقرار کامل پنل |
| GET | `/github` | دانلود کد از GitHub |

### POST /deploy

```json
{
  "token": "cfut_xxxxx",
  "panelType": "edge|nahan|cfnew|nova",
  "workerName": "my-panel"
}
```

**پاسخ:**

```json
{
  "success": true,
  "panelURL": "https://my-panel.xxx.workers.dev",
  "workerName": "my-panel",
  "panelType": "edge",
  "logs": ["▸ شروع...", "✅ نصب شد"]
}
```

---

## 📄 License

MIT License — استفاده آزاد ✅

---

<p align="center">ساخته شده با ❤️ توسط <a href="https://github.com/arshiyashams675-sudo">Arshia</a></p>
