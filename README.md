# 🚀 CF Panel Installer

نصب خودکار پنل‌های VPN روی Cloudflare Worker — فقط با یک API Token!

[![GitHub Pages](https://img.shields.io/badge/Live-v3.2.0-green)](https://arshiyashams675-sudo.github.io/cf-installer/)
[![GitHub](https://img.shields.io/badge/Repo-6_Panels-blue)](https://github.com/arshiyashams675-sudo/cf-installer)

---

## ✨ ویژگی‌ها

- 🔑 **اعتبارسنجی API Token** — اتصال خودکار به Cloudflare
- 📦 **۶ پنل محبوب** — انتخاب و نصب با یک کلیک
- ⚙️ **تنظیمات خودکار** — D1, KV, متغیرها همه خودکار ساخته میشن
- 🎲 **اسامی رندوم** — Worker با نام رندوم ساخته میشه (جلوگیری از فیلتر)
- 🔗 **لینک‌های مستقیم** — مسیرهای هر پنل با دکمه کپی
- 🎨 **طراحی مدرن** — Glassmorphism، انیمیشن، موبایل‌فرندلی
- 🔒 **Backend Worker** — دور زدن محدودیت‌های اینترنت ایران

---

## 📦 پنل‌های پشتیبانی شده

| پنل | ⭐ Stars | Storage | متغیرها | مسیر |
|---|---|---|---|---|
| 🌙 **Nahan Panel** | 3k+ | D1 | — | `/sync/dash` |
| ⚡ **EdgeTunnel** | 41.5k+ | KV | `ADMIN` | `/admin` |
| 🆕 **Cfnew Panel** | 14.6k+ | KV | `u` (UUID خودکار) | `/{UUID}` |
| 🚀 **Nova Proxy** | 3.1k+ | D1 + KV | `ADMIN` | `/admin` |
| 🌐 **EDtunnel** | 2.9k+ | — | `UUID` خودکار | `/{UUID}` |
| ⚡ **Zeus Panel** | 813+ | D1 | — | `/login` |

---

## 🏗️ معماری

```
Installer (GitHub Pages)
    ↓
Backend Worker (Cloudflare)
    ↓                    ↓
GitHub API           Cloudflare API
(dانلود کد)          (استقرار Worker)
```

- **Installer**: فایل HTML استاتیک روی GitHub Pages
- **Backend Worker**: پروکسی برای دانلود کد و استقرار روی Cloudflare
- **امنیت**: API Token فقط بین مرورگر و Backend Worker رد و بدل میشه

---

## 🚀 نحوه استفاده

1. برو به [CF Installer](https://arshiyashams675-sudo.github.io/cf-installer/)
2. روی **🔑 ساخت API Token** کلیک کن (مجوزها خودکار انتخاب شده)
3. توکن رو کپی کن و در installer وارد کن
4. پنل مورد نظرت رو انتخاب کن
5. روی **نصب** بزن — تمام!

---

## 📋 پنل‌ها و Storage

| پنل | D1 | KV | Variable |
|---|---|---|---|
| Nahan | `IOT_DB` | — | — |
| EdgeTunnel | — | `KV` | `ADMIN` |
| Cfnew | — | `C` | `u` (UUID) |
| Nova | `DB` | `KV` | `ADMIN` |
| EDtunnel | — | — | `UUID` |
| Zeus | `DB` | — | — |

---

## 📝 تغییرات

### v3.2.0
- ✅ اضافه شدن **EDtunnel** (VLESS/Trojan — 2.9k ⭐)
- ✅ اضافه شدن **Zeus Panel** (مدیریت کاربران — 813 ⭐)
- ✅ لینک‌های مستقیم مسیرها با دکمه کپی
- ✅ UUID خودکار برای EDtunnel و Cfnew
- ✅ رمز عبور خودکار برای Edge و Nova

### v3.0.0
- ✅ بازنویسی کامل با Backend Worker
- ✅ دور زدن محدودیت‌های اینترنت ایران
- ✅ اسامی رندوم Worker (جلوگیری از فیلتر)

### v2.0.0
- ✅ طراحی Glassmorphism جدید
- ✅ انیمیشن‌های نرم

---

## ⚠️ نکات

- API Token فقط نیاز به دسترسی **Workers**, **KV**, **D1** داره
- اسامی Worker **رندوم** هستن (مثلاً `srv-qr0gpz838`)
- **چند دقیقه صبر کنید** تا Worker فعال بشه
- کد هر پنل **مستقیم از GitHub** دانلود میشه (آخرین نسخه)

---

## 🔗 لینک‌ها

- [Installer Live](https://arshiyashams675-sudo.github.io/cf-installer/)
- [GitHub Repo](https://github.com/arshiyashams675-sudo/cf-installer)
- [Backend Worker](https://cf-installer-backend.bldj.workers.dev)
