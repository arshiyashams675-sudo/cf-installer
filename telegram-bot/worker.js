export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') return json({ ok: true });

    // Webhook only
    if (request.method !== 'POST' || url.pathname !== '/webhook') {
      return json({ error: 'Not found' }, 404);
    }

    const BOT_TOKEN = env.BOT_TOKEN;
    const tg = 'https://api.telegram.org/bot' + BOT_TOKEN;

    let update;
    try { update = await request.json(); } catch { return json({ ok: false }); }

    // Handle message
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || '').trim();
      const userId = String(chatId);

      if (text === '/start') {
        await send(tg, chatId, 
          '🚀 *CF Installer Bot*\n\n'+
          'این ربات نصب خودکار پنل‌های VPN روی Cloudflare Worker هست.\n\n'+
          'لطفاً توکن API Cloudflare خود را ارسال کنید:\n'+
          '`cfut_xxxxxxxxxxxxxxxx`',
          'Markdown',
          { inline_keyboard: [[
            { text: '🔑 ساخت توکن', url: 'https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22d1%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_settings%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22user_details%22%2C%22type%22%3A%22read%22%7D%5D&accountId=*&zoneId=all&name=CF-Installer-Bot' }
          ]]
          }
        );
        // Set state: waiting for token
        await env.SESSIONS.put('state:' + userId, 'waiting_token', { expirationTtl: 600 });
        return json({ ok: true });
      }

      if (text === '/cancel') {
        await env.SESSIONS.delete('state:' + userId);
        await env.SESSIONS.delete('session:' + userId);
        await send(tg, chatId, '❌ لغو شد. برای شروع مجدد /start بزنید.');
        return json({ ok: true });
      }

      if (text === '/status') {
        const session = await env.SESSIONS.get('session:' + userId, { type: 'json' });
        if (!session || !session.panelURL) {
          await send(tg, chatId, '⚠️ هنوز Workerای نصب نشده.');
        } else {
          await send(tg, chatId,
            '📊 *وضعیت Worker*\n\n'+
            'پنل: `'+session.panelType+'`\n'+
            'آدرس: `'+session.panelURL+'`\n'+
            'Worker: `'+session.workerName+'`',
            'Markdown'
          );
        }
        return json({ ok: true });
      }

      // If waiting for token
      const state = await env.SESSIONS.get('state:' + userId);
      if (state === 'waiting_token') {
        if (!text.startsWith('cfut_')) {
          await send(tg, chatId, '❌ فرمت توکن نامعتبر است.\nتوکن باید با `cfut_` شروع شود.', 'Markdown');
          return json({ ok: true });
        }

        await send(tg, chatId, '🔍 در حال بررسی توکن...');

        // Validate token
        const accs = await cfApi(text, '/accounts');
        if (!accs.success || !accs.result || !accs.result.length) {
          await send(tg, chatId, '❌ توکن نامعتبر: ' + (accs.errors?.[0]?.message || 'حسابی یافت نشد'));
          return json({ ok: true });
        }

        const acc = accs.result[0];
        const session = { token: text, accountId: acc.id, accountName: acc.name || acc.id };
        await env.SESSIONS.put('session:' + userId, JSON.stringify(session), { expirationTtl: 3600 });
        await env.SESSIONS.delete('state:' + userId);

        await send(tg, chatId,
          '✅ توکن معتبر!\n\n'+
          '📋 *حساب:* ' + (acc.name || acc.id) + '\n\n'+
          'یک پنل انتخاب کنید:',
          'Markdown',
          buildPanelKeyboard()
        );
        return json({ ok: true });
      }

      // Default
      await send(tg, chatId, '💡 برای شروع /start بزنید.');
      return json({ ok: true });
    }

    // Handle callback query (inline keyboard)
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const userId = String(chatId);
      const data = cq.data;

      await answerCallback(tg, cq.id);

      if (data === 'cancel') {
        await send(tg, chatId, '❌ لغو شد.');
        return json({ ok: true });
      }

      if (data === 'back_to_panels') {
        const session = await env.SESSIONS.get('session:' + userId, { type: 'json' });
        if (!session) {
          await send(tg, chatId, '⚠️ جلسه منقضی شده. /start بزنید.');
          return json({ ok: true });
        }
        await editMessageText(cq, 'یک پنل انتخاب کنید:', tg, buildPanelKeyboard());
        return json({ ok: true });
      }

      if (data === 'test_connection') {
        const session = await env.SESSIONS.get('session:' + userId, { type: 'json' });
        if (!session || !session.panelURL) {
          await answerCallback(tg, cq.id, '⚠️ Workerای موجود نیست', true);
          return json({ ok: true });
        }
        const t0 = Date.now();
        try {
          const r = await fetch(session.panelURL, { redirect: 'follow' });
          const ms = Date.now() - t0;
          if (r.ok || r.status === 302) {
            await answerCallback(tg, cq.id, '🟢 Worker فعاله ✅ (' + ms + 'ms)');
          } else {
            await answerCallback(tg, cq.id, '🔴 Worker غیرفعاله (HTTP ' + r.status + ')', true);
          }
        } catch (e) {
          await answerCallback(tg, cq.id, '⚠️ خطا در اتصال', true);
        }
        return json({ ok: true });
      }

      if (data === 'delete_worker') {
        const session = await env.SESSIONS.get('session:' + userId, { type: 'json' });
        if (!session || !session.workerName) {
          await answerCallback(tg, cq.id, '⚠️ Workerای موجود نیست', true);
          return json({ ok: true });
        }
        // Confirm with inline keyboard
        const confirmKb = { inline_keyboard: [
          [{ text: '✅ بله حذف شود', callback_data: 'confirm_delete' }, { text: '❌ انصراف', callback_data: 'cancel' }]
        ]};
        await send(tg, chatId,
          '⚠️ *حذف Worker*\n\nآیا مطمئن هستید?\n\n📛 `'+session.workerName+'`\n\n⚠️ این عمل قابل بازگشت نیست!',
          'Markdown', confirmKb
        );
        return json({ ok: true });
      }

      if (data === 'confirm_delete') {
        const session = await env.SESSIONS.get('session:' + userId, { type: 'json' });
        if (!session || !session.workerName || !session.token) {
          await send(tg, chatId, '⚠️ جلسه منقضی شده. /start بزنید.');
          return json({ ok: true });
        }
        await editMessageText(cq, '⏳ در حال حذف Worker...', tg);
        const r = await cfApi(session.token, `/accounts/${session.accountId}/workers/scripts/${session.workerName}`, 'DELETE');
        if (r.success) {
          await env.SESSIONS.delete('session:' + userId);
          await send(tg, chatId, '✅ Worker `'+session.workerName+'` حذف شد.', 'Markdown');
        } else {
          await send(tg, chatId, '❌ خطا در حذف:\n`'+(r.errors?.[0]?.message||'unknown')+'`', 'Markdown');
        }
        return json({ ok: true });
      }

      if (PANELS[data]) {
        const session = await env.SESSIONS.get('session:' + userId, { type: 'json' });
        if (!session || !session.token) {
          await send(tg, chatId, '⚠️ جلسه منقضی شده. /start بزنید.');
          return json({ ok: true });
        }

        const panel = PANELS[data];
        const progMsg = await editMessageText(cq, '📦 *در حال استقرار '+panel.name+'...*\n\n⏳ '+esc('۱ دقیقه صبر کنید...')+' 0%', tg, null);

        // Deploy with progress
        const result = await deployWorker(session, panel, data, env, async (step, pct) => {
          const filled = Math.round(pct / 5);
          const empty = 20 - filled;
          const bar = '█'.repeat(filled) + '░'.repeat(empty);
          try {
            await editMessageText(cq, '📦 *در حال استقرار '+panel.name+'...*\n\n'+bar+' *'+pct+'%*\n'+esc(step), tg, null);
          } catch {}
        });
        
        if (result.success) {
          // Save to session
          session.panelURL = result.panelURL;
          session.workerName = result.workerName;
          session.panelType = data;
          session.panelPath = result.panelPath || '';
          session.uuid = result.uuid || null;
          await env.SESSIONS.put('session:' + userId, JSON.stringify(session), { expirationTtl: 3600 });

          let msg = 
            '✅ *نصب با موفقیت انجام شد!*\n\n'+
            '📋 *پنل:* ' + panel.name + '\n'+
            '📛 *Worker:* `'+result.workerName+'`\n\n';

          // Panel-specific paths
          const base = result.panelURL.replace(/\/[^/]*$/, '/');
          const uuid = result.uuid;

          if (data === 'edge') {
            msg += '🔗 *آدرس پنل:* `'+result.panelURL+'`\n';
            msg += '🔑 *رمز:* `admin`\n';
          } else if (data === 'cfnew') {
            msg += '🔗 *آدرس پنل:* `'+base+uuid+'`\n';
            if (uuid) msg += '🔑 *UUID:* `'+uuid+'`\n';
          } else if (data === 'nova') {
            msg += '🔗 *آدرس پنل:* `'+result.panelURL+'`\n';
            msg += '🔑 *رمز:* `admin`\n';
          } else if (data === 'nahan') {
            msg += '🔗 *آدرس پنل:* `'+result.panelURL+'`\n';
          } else if (data === 'edgtun') {
            const host = new URL(result.panelURL).host;
            const vlessLink = 'vless://'+uuid+'@'+host+'?encryption=none&type=ws#CF-Worker';
            msg += '🔗 *آدرس پنل:* `'+base+uuid+'`\n';
            if (uuid) {
              msg += '🔑 *UUID:* `'+uuid+'`\n';
              msg += '\n📎 *VLESS لینک:*\n`'+vlessLink+'`\n';
            }
          } else if (data === 'fox') {
            const host = new URL(result.panelURL).host;
            const foxSub = base+'sub';
            const foxVless = 'vless://'+uuid+'@'+host+':443?encryption=none&security=tls&sni='+host+'&fp=chrome&type=ws&host='+host+'&path=/ws#CF-Worker';
            msg += '🔗 *آدرس پنل:* `'+result.panelURL+'`\n';
            msg += '📑 *صفحه اشتراک:* `'+foxSub+'`\n';
            if (uuid) {
              msg += '🔑 *UUID:* `'+uuid+'`\n';
              msg += '\n📎 *VLESS لینک:*\n`'+foxVless+'`\n';
            }
          } else if (data === 'amcf') {
            const amcfSub = base+'sub';
            msg += '🔗 *آدرس پنل:* `'+result.panelURL+'`\n';
            msg += '📑 *صفحه اشتراک:* `'+amcfSub+'`\n';
          } else if (data === 'vtpanel') {
            msg += '🔗 *آدرس پنل:* `'+result.panelURL+'`\n';
            msg += '🔑 *رمز:* `admin`\n';
          } else if (data === 'v2ray') {
            msg += '🔗 *پنل ادمین:* `'+result.panelURL+'`\n';
            msg += '📑 *صفحه اشتراک:* `'+result.panelURL+'/s/subscribe`\n';
          } else {
            msg += '🔗 *آدرس:* `'+result.panelURL+'`\n';
          }

          // Dashboard link
          const dashUrl='https://dash.cloudflare.com/'+session.accountId+'/workers-and-pages';
          msg += '\n📋 *داشبورد:* `'+dashUrl+'`\n';

          // If subdomain detection failed, add verification note
          if (result.panelURL.includes('.workers.dev') && !result.panelURL.match(/\.[a-z0-9]+\.workers\.dev/)) {
            msg += '\n⚠️ *آدرس ممکنه نادرست باشه!*\nآدرس صحیح رو از صفحه Workers در داشبورد Cloudflare کپی کنید.';
          }

          await send(tg, chatId, msg, 'Markdown', buildResultKeyboard(result.panelURL));
        } else {
          await send(tg, chatId, '❌ *خطا در استقرار:*\n`'+result.error+'`', 'Markdown',
            [[{ text: '🔄 انتخاب مجدد', callback_data: 'back_to_panels' }]]);
        }
        return json({ ok: true });
      }
    }

    return json({ ok: true });
  }
};

// === Helper functions ===

const PANELS = {
  edge: { name: 'EdgeTunnel', repo: 'cmliu/edgetunnel', file: '_worker.js', kv: ['KV'], vars: { ADMIN: 'admin' }, path: '/admin' },
  cfnew: { name: 'Cfnew', repo: 'byjoey/cfnew', file: 'worker.js', kv: ['C'], vars: { u: () => crypto.randomUUID() }, path: '' },
  nova: { name: 'Nova Proxy', repo: 'IRNova/Nova-Proxy', file: 'worker.js', d1: ['DB'], kv: ['KV'], vars: { ADMIN: 'admin' }, path: '/admin' },
  nahan: { name: 'Nahan', repo: 'itsyebekhe/nahan', file: '_worker.js', d1: ['IOT_DB'], vars: {}, path: '/sync/dash' },
  edgtun: { name: 'EDtunnel', repo: '6Kmfi6HP/EDtunnel', file: '_worker.js', vars: { UUID: () => crypto.randomUUID() }, path: '' },
  fox: { name: 'FoxCloud', repo: 'code3-dev/foxcloud', file: 'worker.js', release: 'v1.0.0', vars: { UUID: () => crypto.randomUUID(), PROXY_IP: '172.66.45.9:443' }, path: '/sub' },
  amcf: { name: 'am-cf', repo: 'amclubs/am-cf-tunnel', file: '_worker.js', kv: ['amclubs'], vars: {}, path: '/' },
  vtpanel: { name: 'VTPanel', repo: 'bayueqi/ZQ-VTPanel', file: '_worker.js', kv: ['VTPanel'], vars: {}, path: '/' },
  v2ray: { name: 'v2ray-worker', repo: 'vfarid/v2ray-worker', file: 'worker.js', release: 'v2.4', kv: ['settings'], vars: {}, path: '/' },
};

function buildPanelKeyboard() {
  const icons = {
    edge: '⚡', cfnew: '🆕', nova: '🚀', nahan: '🌙',
    edgtun: '🌐', fox: '🦊', amcf: '🇨🇳', vtpanel: '🛡️', v2ray: '🔧'
  };
  const rows = [];
  const keys = Object.keys(PANELS);
  for (let i = 0; i < keys.length; i += 2) {
    const row = [];
    const k1 = keys[i];
    row.push({ text: (icons[k1]||'') + ' ' + PANELS[k1].name, callback_data: k1 });
    if (keys[i + 1]) {
      const k2 = keys[i + 1];
      row.push({ text: (icons[k2]||'') + ' ' + PANELS[k2].name, callback_data: k2 });
    }
    rows.push(row);
  }
  rows.push([{ text: '❌ لغو', callback_data: 'cancel' }]);
  return { inline_keyboard: rows };
}

function buildResultKeyboard(url) {
  return {
    inline_keyboard: [
      [{ text: '📊 تست اتصال', callback_data: 'test_connection' }, { text: '🔗 باز کردن پنل', url: url }],
      [{ text: '🗑️ حذف Worker', callback_data: 'delete_worker' }, { text: '🔄 انتخاب مجدد', callback_data: 'back_to_panels' }]
    ]
  };
}

async function send(tg, chatId, text, parseMode, replyMarkup) {
  const body = { chat_id: chatId, text: text };
  if (parseMode) body.parse_mode = parseMode;
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(tg + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function editMessageText(cq, text, tgToken, replyMarkup) {
  const body = {
    chat_id: cq.message.chat.id,
    message_id: cq.message.message_id,
    text: text
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch('https://api.telegram.org/bot' + tgToken + '/editMessageText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function answerCallback(tg, callbackId, text, showAlert) {
  await fetch(tg + '/answerCallbackQuery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text: text || '', show_alert: showAlert || false })
  });
}

async function cfApi(token, path, method = 'GET', body = null) {
  try {
    const opts = { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch('https://api.cloudflare.com/client/v4' + path, opts);
    return await r.json();
  } catch (e) { return { success: false, errors: [{ message: e.message }] }; }
}

async function downloadCode(repo, file, release) {
  const f = encodeURIComponent(file);
  if (release) {
    try {
      const r = await fetch(`https://github.com/${repo}/releases/download/${release}/${f}`);
      if (r.ok) { const t = await r.text(); if (t.length > 200) return t; }
    } catch {}
  }
  const urls = [
    `https://cdn.jsdelivr.net/gh/${repo}@main/${f}`,
    `https://cdn.jsdelivr.net/gh/${repo}@master/${f}`,
    `https://githack.com/${repo}/raw/refs/heads/main/${f}`,
    `https://githack.com/${repo}/raw/refs/heads/master/${f}`,
    `https://raw.githubusercontent.com/${repo}/refs/heads/main/${f}`,
    `https://raw.githubusercontent.com/${repo}/refs/heads/master/${f}`
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (r.ok) { const t = await r.text(); if (t.length > 200) return t; }
    } catch {}
  }
  return null;
}

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
async function deployWorker(session, panelDef, panelKey, env, onProgress) {
  const logs=[];function log(m){logs.push(m)}
  const token = session.token;
  const aid = session.accountId;
  const rnd = Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 1000);
  const workerName = 'srv-' + rnd;
  const p = PANELS[panelKey] || {};
  const prog = onProgress || (async ()=>{});

  // Resolve vars
  const vars = {};
  if (p.vars) {
    for (const [k, v] of Object.entries(p.vars)) {
      vars[k] = typeof v === 'function' ? v() : v;
    }
  }

  await prog('📥 دانلود کد منبع...', 10);
  const code = await downloadCode(p.repo, p.file, p.release);
  if (!code) return { success: false, error: 'کد منبع یافت نشد' };
  await prog('✅ کد دانلود شد', 25);

  // Create D1 databases
  const bindings = [];
  if (p.d1) {
    for (const name of p.d1) {
      await prog('🗄 ساخت D1: ' + name + '...', 30);
      const r = await cfApi(token, `/accounts/${aid}/d1/database`, 'POST', { name: `d1-${rnd}` });
      if (r.success) bindings.push({ name, type: 'd1', id: r.result.uuid });
    }
  }

  // Create KV namespaces
  if (p.kv) {
    for (const name of p.kv) {
      await prog('📂 ساخت KV: ' + name + '...', 35);
      const r = await cfApi(token, `/accounts/${aid}/storage/kv/namespaces`, 'POST', { title: `kv-${rnd}` });
      if (r.success) bindings.push({ name, type: 'kv_namespace', namespace_id: r.result.id });
    }
  }

  // Add vars as bindings
  const bindingsWithVars = [...bindings];
  for (const [k, v] of Object.entries(vars)) {
    bindingsWithVars.push({ name: k, type: 'plain_text', text: v });
  }

  await prog('📦 آپلود Worker...', 50);
  const md = { main_module: 'worker.js', compatibility_date: '2024-09-22', compatibility_flags: ['nodejs_compat'], bindings: bindingsWithVars };
  const boundary = '----CFBoundary' + Math.random().toString(36).slice(2);
  const CRLF = '\r\n';
  const parts = [
    '--' + boundary + CRLF + 'Content-Disposition: form-data; name="metadata"' + CRLF + 'Content-Type: application/json' + CRLF + CRLF + JSON.stringify(md),
    '--' + boundary + CRLF + 'Content-Disposition: form-data; name="worker.js"; filename="worker.js"' + CRLF + 'Content-Type: application/javascript+module' + CRLF + CRLF + code,
    '--' + boundary + '--'
  ].join(CRLF);

  const dr = await fetch(`https://api.cloudflare.com/client/v4/accounts/${aid}/workers/scripts/${workerName}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'multipart/form-data; boundary=' + boundary },
    body: parts
  });
  const dd = await dr.json();
  if (!dd.success) return { success: false, error: dd.errors?.[0]?.message || 'خطای استقرار' };
  await prog('✅ Worker آپلود شد', 70);

  await prog('🔄 فعال‌سازی workers.dev...', 80);
  await fetch(`https://api.cloudflare.com/client/v4/accounts/${aid}/workers/services/${workerName}/environments/production/subdomain`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true })
  });

  await prog('⏳ صبر برای فعال‌سازی...', 90);
  await new Promise(r => setTimeout(r, 3000));

  // Get subdomain from API
  let sub = '';
  const sr = await cfApi(token, `/accounts/${aid}/workers/subdomain`);
  if (sr.success && sr.result?.subdomain && sr.result.subdomain !== 'workers.dev') {
    sub = sr.result.subdomain;
  } else {
    sub = 'workers.dev';
    log('⚠️ سوب‌دامین شناسایی نشد — لطفاً آدرس واقعی رو از داشبورد کپی کنید');
    log(`📋 https://dash.cloudflare.com/${aid}/workers-and-pages`);
  }

  const basePath = `https://${workerName}.${sub}${sub.includes('.') ? '' : '.workers.dev'}`;
  const panelPath = p.path || (vars.u ? '/' + vars.u : '');
  const panelURL = basePath + panelPath;

  await prog('✅ نصب کامل شد!', 100);

  return {
    success: true,
    panelURL,
    workerName,
    panelPath,
    uuid: vars.u || vars.UUID || vars.ID || null
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
