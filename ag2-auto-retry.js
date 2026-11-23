const http = require('http');
const crypto = require('crypto');

const DEBUG_PORT = 9222;
const RUN_ONCE = process.argv.includes('--once');

const INJECT_SCRIPT = `
(function() {
  const existingPill = document.getElementById('agq-retry-pill');
  if (existingPill) {
    existingPill.remove();
  }

  if (window.__agq20Active === undefined) {
    window.__agq20Active = true;
  }
  if (window.__agq20RetryCount === undefined) {
    window.__agq20RetryCount = 0;
  }

  const EXACT_LABELS = ['retry', 'try again', 'resume', 'try again…', 'retry…', '重试', '再试一次'];
  const MIN_CLICK_INTERVAL = 5000;
  let lastClickTime = 0;
  let checkScheduled = false;

  const RETRY_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>';

  function createPill() {
    if (document.getElementById('agq-retry-pill')) return;
    const btn = document.createElement('button');
    btn.id = 'agq-retry-pill';
    btn.type = 'button';
    btn.style.cssText = [
      'position: fixed',
      'bottom: 31px',
      'right: 20px',
      'width: 28px',
      'height: 28px',
      'padding: 0',
      'border-radius: 50%',
      'z-index: 999999',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'cursor: pointer',
      'user-select: none',
      'outline: none',
      'transition: all 0.2s ease',
      '-webkit-app-region: no-drag'
    ].join(';');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.__agq20Active = !window.__agq20Active;
      updatePill();
    });

    document.body.appendChild(btn);
    updatePill();
  }

  function updatePill() {
    const btn = document.getElementById('agq-retry-pill');
    if (!btn) return;
    const count = window.__agq20RetryCount || 0;
    const badgeHtml = count > 0
      ? '<span style="position:absolute;top:-4px;right:-4px;min-width:14px;height:14px;padding:0 3px;border-radius:999px;background:#ef4444;color:#fff;font-size:9px;font-weight:700;line-height:14px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.3);">' + count + '</span>'
      : '';

    if (window.__agq20Active) {
      btn.style.background = '#16a34a';
      btn.style.color = '#ffffff';
      btn.style.border = 'none';
      btn.style.boxShadow = '0 2px 6px rgba(22, 163, 74, 0.35)';
      btn.innerHTML = RETRY_SVG + badgeHtml;
      btn.title = 'Auto-Retry: ON' + (count > 0 ? ' (已自动重试 ' + count + ' 次)' : '') + ' · 点击关闭';
    } else {
      btn.style.background = 'rgba(107, 114, 128, 0.22)';
      btn.style.color = '#6b7280';
      btn.style.border = '1px solid rgba(107, 114, 128, 0.25)';
      btn.style.boxShadow = 'none';
      btn.innerHTML = RETRY_SVG + badgeHtml;
      btn.title = 'Auto-Retry: OFF · 点击开启';
    }
  }

  function checkForRetryButton() {
    checkScheduled = false;
    if (!window.__agq20Active) return;
    if (!document.hasFocus()) return;

    const now = Date.now();
    if (now - lastClickTime < MIN_CLICK_INTERVAL) return;

    const buttons = document.querySelectorAll('button, [role="button"]');
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      if (btn.id === 'agq-retry-pill') continue;
      const rawText = (btn.textContent || '').trim();
      if (!rawText || rawText.length > 30) continue;

      const text = rawText.toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase().trim();

      if (EXACT_LABELS.includes(text) || EXACT_LABELS.includes(ariaLabel)) {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && !btn.disabled) {
          console.log('[AGQ Auto-Retry] Clicking:', rawText);
          btn.click();
          lastClickTime = now;
          window.__agq20RetryCount++;
          updatePill();
          return;
        }
      }
    }
  }

  function scheduleCheck() {
    if (checkScheduled) return;
    checkScheduled = true;
    requestAnimationFrame(checkForRetryButton);
  }

  createPill();

  if (!window.__agq20ObserverAttached) {
    window.__agq20ObserverAttached = true;
    new MutationObserver(scheduleCheck).observe(document.body, { childList: true, subtree: true });
    setInterval(checkForRetryButton, 8000);
    setTimeout(checkForRetryButton, 500);
  }
  return 'updated_circle_ok';
})();
`;

function getTargets() {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${DEBUG_PORT}/json`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function evalViaCdp(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString('base64');
    const req = http.request({
      hostname: u.hostname,
      port: parseInt(u.port, 10),
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        Upgrade: 'websocket',
        Connection: 'Upgrade',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Version': '13'
      }
    });

    req.on('upgrade', (_res, socket) => {
      let buf = Buffer.alloc(0);
      const sendFrame = (msg) => {
        const payload = Buffer.from(msg, 'utf8');
        const mask = crypto.randomBytes(4);
        let header;
        if (payload.length < 126) {
          header = Buffer.alloc(6);
          header[0] = 0x81;
          header[1] = 0x80 | payload.length;
          mask.copy(header, 2);
        } else if (payload.length < 65536) {
          header = Buffer.alloc(8);
          header[0] = 0x81;
          header[1] = 0x80 | 126;
          header.writeUInt16BE(payload.length, 2);
          mask.copy(header, 4);
        } else {
          header = Buffer.alloc(14);
          header[0] = 0x81;
          header[1] = 0x80 | 127;
          header.writeUInt32BE(0, 2);
          header.writeUInt32BE(payload.length, 6);
          mask.copy(header, 10);
        }
        const masked = Buffer.alloc(payload.length);
        for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
        socket.write(Buffer.concat([header, masked]));
      };

      socket.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 2) {
          const opcode = buf[0] & 0x0f;
          let len = buf[1] & 0x7f;
          let off = 2;
          if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
          else if (len === 127) { if (buf.length < 10) break; len = buf.readUInt32BE(6); off = 10; }
          if (buf.length < off + len) break;
          const payload = buf.subarray(off, off + len);
          buf = buf.subarray(off + len);
          if (opcode === 0x01) {
            try {
              const msg = JSON.parse(payload.toString('utf8'));
              if (msg.id === 1) {
                socket.destroy();
                resolve(msg.result?.result?.value);
              }
            } catch {}
          }
        }
      });

      socket.on('error', reject);
      sendFrame(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression } }));
    });

    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('ws timeout')); });
    req.end();
  });
}

async function run() {
  try {
    const targets = await getTargets();
    const appTargets = targets.filter(t =>
      t.type === 'page' &&
      t.webSocketDebuggerUrl &&
      t.url &&
      t.url.startsWith('https://127.0.0.1')
    );

    for (const t of appTargets) {
      const res = await evalViaCdp(t.webSocketDebuggerUrl, INJECT_SCRIPT);
      console.log(`[${new Date().toLocaleTimeString()}] ${t.title} -> ${res}`);
    }
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] Error:`, err.message);
  }
}

(async () => {
  await run();
  if (!RUN_ONCE) {
    console.log('Watching Antigravity 2.0 on CDP port 9222...');
    setInterval(run, 10000);
  }
})();
