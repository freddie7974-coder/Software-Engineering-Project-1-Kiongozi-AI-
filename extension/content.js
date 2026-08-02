// ══════════════════════════════════════════════════════════════════
// KIONGOZI AI — content.js  v5
// ══════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'getPageText')       { sendResponse(getPageText()); return true; }
  if (msg.action === 'getImages')         { sendResponse(getImages());   return true; }
  if (msg.action === 'showResult')        { showResultPanel(msg.type, msg.content, msg.keyPoints || []); sendResponse({ ok: true }); return true; }
  if (msg.action === 'injectImageCaptions') { injectImageCaptions(msg.captions); sendResponse({ ok: true }); return true; }
  if (msg.action === 'simplifyUI')        { applyUISimplification(msg.enabled); sendResponse({ ok: true }); return true; }
  if (msg.action === 'applyVisual')       { applyVisualSettings(msg.settings); sendResponse({ ok: true }); return true; }
  return true;
});

// ── Get page text ─────────────────────────────────────────────────
function getPageText() {
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('script, style, noscript, svg, iframe, nav, footer').forEach(el => el.remove());
  const text = (clone.innerText || clone.textContent || '')
    .replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 8000);
  return { text, url: location.href, title: document.title };
}

// ── Get images ────────────────────────────────────────────────────
function getImages() {
  const imgs = Array.from(document.images)
    .filter(img => img.src && img.naturalWidth > 60 && img.naturalHeight > 60)
    .slice(0, 8)
    .map(img => ({ src: img.src, alt: img.alt || '', width: img.naturalWidth, height: img.naturalHeight }));
  return { images: imgs };
}

// ── Inject image captions directly on the page ────────────────────
// Professor feedback: "When describing images can it show on the entire page"
function injectImageCaptions(captions) {
  // Remove old caption badges
  document.querySelectorAll('.kiongozi-caption').forEach(el => el.remove());

  captions.forEach(({ src, caption }) => {
    const img = Array.from(document.images).find(i => i.src === src);
    if (!img) return;

    // Wrap image if needed
    const parent = img.parentElement;
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    const badge = document.createElement('div');
    badge.className = 'kiongozi-caption';
    badge.style.cssText = [
      'all:initial',
      'position:absolute',
      'bottom:0', 'left:0', 'right:0',
      'background:rgba(10,61,74,0.88)',
      'color:white',
      'font-family:Inter,system-ui,sans-serif',
      'font-size:13px',
      'line-height:1.5',
      'padding:8px 12px',
      'border-radius:0 0 8px 8px',
      'z-index:2147483640',
      'display:block',
    ].join(';');

    badge.innerHTML = `<strong style="color:#F0A500;font-size:11px;letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:3px;">♿ Kiongozi AI</strong>${escapeHTML(caption)}`;

    // Place badge relative to the image
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;display:inline-block;max-width:100%;';
    img.parentNode.insertBefore(wrapper, img);
    wrapper.appendChild(img);
    wrapper.appendChild(badge);
  });

  // Show a brief notification strip
  showStrip(`🖼️ ${captions.length} image(s) described — captions shown below each image`);
}

// ── Full-page result panel ────────────────────────────────────────
// Improved per professor: "Show on the entire page"
function showResultPanel(type, content, keyPoints) {
  document.getElementById('kiongozi-panel')?.remove();

  const typeLabels = {
    simplify: '✨ Simplified by Kiongozi AI',
    translate: '🌍 Translated by Kiongozi AI',
    caption:  '🖼️ Image Descriptions — Kiongozi AI',
    original: '↩ Original Content',
  };

  const panel = document.createElement('div');
  panel.id = 'kiongozi-panel';
  panel.style.cssText = [
    'all:initial',
    'position:fixed', 'top:0', 'right:0', 'bottom:0',
    'width:420px',
    'background:white',
    'box-shadow:-4px 0 32px rgba(10,61,74,0.22)',
    'z-index:2147483647',
    'display:flex', 'flex-direction:column',
    'font-family:Inter,system-ui,sans-serif',
    'overflow:hidden',
  ].join(';');

  // Key points HTML
  let kpHTML = '';
  if (keyPoints && keyPoints.length) {
    kpHTML = `
      <div style="background:#F4F7F8;border:1.5px solid #C8E6EA;border-radius:12px;padding:14px 18px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#4A7A85;margin-bottom:10px;">Key Points</div>
        ${keyPoints.map(pt => `
          <div style="display:flex;gap:10px;margin-bottom:8px;font-size:14px;color:#1A2E35;line-height:1.55;">
            <span style="color:#F0A500;font-weight:700;flex-shrink:0;">•</span>
            <span>${escapeHTML(pt)}</span>
          </div>`).join('')}
      </div>`;
  }

  panel.innerHTML = `
    <!-- Header -->
    <div style="background:#0A3D4A;padding:18px 20px;flex-shrink:0;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:13px;font-weight:800;color:#F0A500;letter-spacing:1.5px;">KIONGOZI AI</span>
        <button id="kiongozi-close" style="
          all:initial;font-family:Inter,sans-serif;
          background:rgba(255,255,255,0.15);border:none;color:white;
          padding:6px 14px;border-radius:8px;font-size:13px;
          font-weight:600;cursor:pointer;
        ">Close ✕</button>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:26px;height:26px;background:#2ECC71;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700;flex-shrink:0;">✓</div>
        <span style="font-size:14px;font-weight:600;color:white;">${typeLabels[type] || 'Kiongozi AI'}</span>
      </div>
    </div>

    <!-- Content area (scrollable) -->
    <div style="flex:1;overflow-y:auto;padding:20px;">
      <div style="display:inline-block;background:#E8F6F8;color:#0D6E7E;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;margin-bottom:14px;letter-spacing:.4px;text-transform:uppercase;">
        ${typeLabels[type] || 'Result'}
      </div>

      ${kpHTML}

      <div style="
        background:#F8FAFB;border:1.5px solid #C8E6EA;border-radius:12px;
        padding:20px;font-size:16px;color:#1A2E35;line-height:1.85;
        white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;
      ">${escapeHTML(content)}</div>
    </div>

    <!-- Footer actions -->
    <div style="padding:14px 20px;border-top:1px solid #C8E6EA;display:flex;gap:10px;flex-shrink:0;background:white;">
      <button id="kiongozi-copy" style="
        all:initial;font-family:Inter,sans-serif;
        flex:1;padding:11px;background:#F4F7F8;
        border:1.5px solid #C8E6EA;border-radius:10px;
        font-size:14px;font-weight:600;color:#0A3D4A;
        cursor:pointer;text-align:center;
      ">📋 Copy</button>
      <button id="kiongozi-speak" style="
        all:initial;font-family:Inter,sans-serif;
        flex:1;padding:11px;background:#F4F7F8;
        border:1.5px solid #C8E6EA;border-radius:10px;
        font-size:14px;font-weight:600;color:#0A3D4A;
        cursor:pointer;text-align:center;
      ">🔊 Read Aloud</button>
    </div>
  `;

  document.body.appendChild(panel);

  // Push page content left so it's not hidden under panel
  document.body.style.marginRight = '420px';
  document.body.style.transition  = 'margin-right 0.3s';

  // Close
  document.getElementById('kiongozi-close').onclick = () => {
    speechSynthesis?.cancel();
    panel.remove();
    document.body.style.marginRight = '';
  };

  // Copy
  document.getElementById('kiongozi-copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(content);
      document.getElementById('kiongozi-copy').textContent = '✅ Copied!';
      setTimeout(() => { document.getElementById('kiongozi-copy').textContent = '📋 Copy'; }, 2000);
    } catch {}
  };

  // Speak aloud (with proper Swahili lang hint)
  let isSpeaking = false;
  document.getElementById('kiongozi-speak').onclick = () => {
    const btn = document.getElementById('kiongozi-speak');
    if (isSpeaking) {
      speechSynthesis.cancel(); isSpeaking = false;
      btn.textContent = '🔊 Read Aloud'; return;
    }
    const u = new SpeechSynthesisUtterance(content);
    u.lang = type === 'translate' ? 'sw' : 'en';
    u.rate = 0.88;
    u.onend = () => { isSpeaking = false; if (btn) btn.textContent = '🔊 Read Aloud'; };
    speechSynthesis.speak(u);
    isSpeaking = true;
    btn.textContent = '⏹️ Stop';
  };
}

// ── Brief notification strip ──────────────────────────────────────
function showStrip(message) {
  document.getElementById('kiongozi-strip')?.remove();
  const strip = document.createElement('div');
  strip.id = 'kiongozi-strip';
  strip.style.cssText = [
    'all:initial',
    'position:fixed', 'bottom:24px', 'left:50%',
    'transform:translateX(-50%)',
    'background:#0A3D4A', 'color:white',
    'font-family:Inter,system-ui,sans-serif',
    'font-size:13px', 'font-weight:600',
    'padding:10px 20px', 'border-radius:24px',
    'z-index:2147483647',
    'box-shadow:0 4px 16px rgba(10,61,74,0.3)',
    'white-space:nowrap',
  ].join(';');
  strip.textContent = message;
  document.body.appendChild(strip);
  setTimeout(() => strip.remove(), 4000);
}

// ── Escape HTML ───────────────────────────────────────────────────
function escapeHTML(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ══════════════════════════════════════════════════════════════════
// UI SIMPLIFICATION
// ══════════════════════════════════════════════════════════════════
const UI_STYLE_ID = 'kiongozi-ui-simplify';
function applyUISimplification(enabled) {
  document.getElementById(UI_STYLE_ID)?.remove();
  if (!enabled) { document.getElementById('kiongozi-strip')?.remove(); return; }

  const style = document.createElement('style');
  style.id = UI_STYLE_ID;
  style.textContent = `
    aside, [class*="sidebar"], [id*="sidebar"],
    [class*="ad-"], [class*="-ad"], [id*="-ad"],
    [class*="advert"], [class*="advertisement"],
    [class*="promo"], [class*="popup"]:not(#kiongozi-panel),
    [class*="modal"]:not(#kiongozi-panel),
    [class*="cookie"], [id*="cookie"],
    [class*="newsletter"], [class*="subscribe"],
    [class*="social-share"], [class*="share-bar"],
    [class*="related-posts"], [class*="recommended"],
    footer, [role="complementary"] { display:none!important; }

    html, body { max-width:820px!important; margin:0 auto!important; padding:24px 20px 40px!important; background:#F8FAFB!important; }
    p, li, td, th, blockquote { font-size:18px!important; line-height:1.85!important; color:#1A2E35!important; max-width:700px!important; }
    h1 { font-size:32px!important; color:#0A3D4A!important; margin-bottom:16px!important; }
    h2 { font-size:26px!important; color:#0A3D4A!important; margin-bottom:12px!important; }
    h3 { font-size:21px!important; color:#0A3D4A!important; }
    img { border-radius:10px!important; max-width:100%!important; height:auto!important; }
    a { color:#0D6E7E!important; text-decoration:underline!important; }

    body::before {
      content:'♿  Kiongozi AI — Simplified View is active';
      display:block!important; background:#E8F6F8!important; color:#0D6E7E!important;
      font-size:13px!important; font-weight:600!important; padding:8px 24px!important;
      border-bottom:2px solid #C8E6EA!important; margin-bottom:24px!important;
      font-family:Inter,system-ui,sans-serif!important; letter-spacing:.3px!important;
    }
  `;
  document.head.appendChild(style);
}

// ══════════════════════════════════════════════════════════════════
// VISUAL SETTINGS
// ══════════════════════════════════════════════════════════════════
const VISUAL_STYLE_ID = 'kiongozi-visual';
function applyVisualSettings(s) {
  document.getElementById(VISUAL_STYLE_ID)?.remove();
  const rules = [];

  if (s.highContrast) rules.push(`
    body { background:#0A0A0A!important; }
    p, li, span, div, td, h1, h2, h3, h4 { color:#FFD700!important; }
    a { color:#FFD700!important; text-decoration:underline!important; }
  `);

  if (s.largeFont || s.fontSize >= 2) {
    const size = s.fontSize === 3 ? '22px' : '19px';
    rules.push(`
      body, p, li, span, div, td { font-size:${size}!important; line-height:1.9!important; }
      h1 { font-size:36px!important; } h2 { font-size:30px!important; } h3 { font-size:24px!important; }
    `);
  }

  if (s.dyslexia) rules.push(`
    @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;600&display=swap');
    body, p, li, span, div, td, h1, h2, h3 {
      font-family:'Lexend',sans-serif!important;
      letter-spacing:.06em!important; word-spacing:.12em!important;
    }
  `);

  if (!rules.length) return;
  const style = document.createElement('style');
  style.id = VISUAL_STYLE_ID;
  style.textContent = rules.join('\n');
  document.head.appendChild(style);
}

// ── Auto-apply on page load ───────────────────────────────────────
chrome.storage.sync.get('kiongoziCfg', (result) => {
  const s = result.kiongoziCfg;
  if (!s || !s.onboardingDone) return;
  if (s.simplifyUI) applyUISimplification(true);
  applyVisualSettings(s);
});
