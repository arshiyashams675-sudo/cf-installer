# 🚀 CF Installer

### نصب یک‌کلیکی پنل‌های VPN روی Cloudflare Worker

[![v3.2.0](https://img.shields.io/badge/version-v3.2.0-00e5a0?style=flat-square)](https://arshiyashams675-sudo.github.io/cf-installer/)
[![Panels](https://img.shields.io/badge/پنل‌ها-6_عدد-blue?style=flat-square)](#-پنل‌های-پشتیبانی-شده)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](#)
[![GitHub Pages](https://img.shields.io/badge/زبان-فارسی-purple?style=flat-square)](https://arshiyashams675-sudo.github.io/cf-installer/)

<p align="center">
  <a href="https://arshiyashams675-sudo.github.io/cf-installer/">
    <img src="https://img.shields.io/badge/🔥_اکنون_استفاده_کن-آبی?style=for-the-badge" alt="CF Installer">
  </a>
</p>

---

## 🎯 این چیه؟

یه ابزار ساده و رایگان که باهاش **پنل‌های VPN** رو فقط با **یک API Token** روی **Cloudflare Worker** نصب کنی.

**بدون نیاز به سرور، بدون هزینه، فقط Cloudflare!**

---

## ✨ چرا CF Installer؟

- ⚡ **سریع** — نصب پنل در کمتر از یک دقیقه
- 🎲 **امن** — اسامی Worker رندوم هستن (جلوگیری از فیلتر)
- 🔗 **ساده** — لینک‌های مستقیم با دکمه کپی
- 🎨 **زیبا** — رابط کاربری مدرن و موبایل‌فرندلی
- 💰 **رایگان** — فقط API Token Cloudflare لازمه
- 🌍 **فارسی** — کاملاً فارسی و راست‌چین

---

## 📦 پنل‌های پشتیبانی شده

| پنل | ⭐ ستاره | Storage | Variable | مسیر پنل |
|:---:|:---:|:---:|:---:|:---:|
| 🌙 **Nahan** | 3k+ | D1 | — | `/sync/dash` |
| ⚡ **EdgeTunnel** | 41.5k+ | KV | `ADMIN` | `/admin` |
| 🆕 **Cfnew** | 14.6k+ | KV | `u` (UUID) | `/{UUID}` |
| 🚀 **Nova** | 3.1k+ | D1 + KV | `ADMIN` | `/admin` |
| 🌐 **EDtunnel** | 2.9k+ | — | `UUID` | `/{UUID}` |
| ⚡ **Zeus Panel** | 813+ | D1 | — | `/login` |

> 💡 همه چیز **خودکار** ساخته میشه — D1، KV، UUID، رمز عبور!

---

## 🖼️ اسکرین‌شات

<p align="center">
  <img src="https://img.shields.io/badge/📱_به_وبسایت_مراجعه_کنید-grey?style=for-the-badge&link=https://arshiyashams675-sudo.github.io/cf-installer/" alt="Live Demo">
</p>

---

## 🚀 چطوری استفاده کنم؟

### مرحله ۱: ساخت API Token
1. برید به [CF Installer](https://arshiyashams675-sudo.github.io/cf-installer/)
2. روی **🔑 ساخت API Token** بزنید (مجوزها خودکار انتخاب شده)
3. توکن رو کپی کنید

### مرحله ۲: نصب پنل
1. توکن رو وارد کنید
2. یکی از ۶ پنل رو انتخاب کنید
3. روی **نصب** بزنید — تمام! 🎉

### مرحله ۳: اتصال
- لینک VLESS/Trojan رو از نتیجه کپی کنید
- توی **V2rayNG** یا **Hiddify** وارد کنید
- **لذت ببرید!** 🚀

---

## 🏗️ معماری

```
┌─────────────────────┐
│   Installer (HTML)   │  ← GitHub Pages
│   رابط کاربری فارسی   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Backend Worker (CF) │  ← Cloudflare Worker
│  پروکسی API + دانلود  │
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
┌────────┐ ┌────────┐
│ GitHub  │ │Cloudflare│
│  API    │ │   API   │
│دانلود کد│ │ساخت Worker│
└────────┘ └────────┘
```

> 🔒 **امنیت:** API Token فقط بین مرورگر و Backend Worker رد و بدل میشه — هیچ جایی ذخیره نمیشه!

---

## 📋 جدول Storage و Variable

| پنل | D1 | KV | Variable |
|:---:|:---:|:---:|:---:|
| Nahan | `IOT_DB` | — | — |
| EdgeTunnel | — | `KV` | `ADMIN=admin` |
| Cfnew | — | `C` | `u=UUID` |
| Nova | `DB` | `KV` | `ADMIN=admin` |
| EDtunnel | — | — | `UUID` |
| Zeus | `DB` | — | — |

---

## 📝 تغییرات

<details>
<summary><b>v3.2.0</b> — آخرین نسخه</summary>

- ✅ اضافه شدن **EDtunnel** (VLESS/Trojan — 2.9k ⭐)
- ✅ اضافه شدن **Zeus Panel** (مدیریت کاربران — 813 ⭐)
- ✅ لینک‌های مستقیم مسیرها با دکمه کپی
- ✅ UUID خودکار برای EDtunnel و Cfnew
- ✅ رمز عبور خودکار برای Edge و Nova

</details>

<details>
<summary><b>v3.0.0</b></summary>

- ✅ بازنویسی کامل با Backend Worker
- ✅ دور زدن محدودیت‌های اینترنت ایران
- ✅ اسامی رندوم Worker (جلوگیری از فیلتر)

</details>

<details>
<summary><b>v2.0.0</b></summary>

- ✅ طراحی Glassmorphism جدید
- ✅ انیمیشن‌های نرم

</details>

---

## ⚠️ نکات مهم

- 💡 API Token فقط نیاز به دسترسی **Workers**, **KV**, **D1** داره
- 💡 اسامی Worker **رندوم** هستن (مثلاً `srv-qr0gpz838`)
- 💡 **چند دقیقه صبر کنید** تا Worker فعال بشه
- 💡 کد هر پنل **مستقیم از GitHub** دانلود میشه (آخرین نسخه)

---

## 🔗 لینک‌ها

| لینک | آدرس |
|:---:|:---:|
| 🌐 **Installer** | [arshiyashams675-sudo.github.io/cf-installer](https://arshiyashams675-sudo.github.io/cf-installer/) |
| 📦 **GitHub Repo** | [arshiyashams675-sudo/cf-installer](https://github.com/arshiyashams675-sudo/cf-installer) |
| ⚙️ **Backend Worker** | [cf-installer-backend.bldj.workers.dev](https://cf-installer-backend.bldj.workers.dev) |
| 🔑 **ساخت API Token** | [dash.cloudflare.com](https://dash.cloudflare.com/profile/api-tokens) |

---

## 🛠️ مشارکت

اگه میخوای کمک کنی:

1. Fork کن 🔱
2. Branch بساز 🌿
3. Commit کن 📝
4. Pull Request بزن 🚀

---

## 📄 لایسنس

MIT License — آزاد و رایگان برای همه! 🎉

---

<p align="center">
  ساخته شده با ❤️ توسط <a href="https://github.com/arshiyashams675-sudo">Arshia</a>
</p>
