// ══════════════════════════════════════════════════════════════════
// KIONGOZI AI — popup.js  v6
// Bulletproof caching: results persist across popup open/close
// ══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {

  let cfg = {
    lang: 'Swahili', readingLevel: 1, fontSize: 2,
    backendUrl: 'http://127.0.0.1:5001',
    highContrast: true, largeFont: false, dyslexia: false,
    simplifyUI: true, onboardingDone: false,
  };

  let lastResult = null;
  let originalText = '';
  let speaking = false;

  const stored = await chrome.storage.sync.get('kiongoziCfg');
  if (stored.kiongoziCfg) cfg = { ...cfg, ...stored.kiongoziCfg };
  const save = () => chrome.storage.sync.set({ kiongoziCfg: cfg });

  // ══════════════════════════════════════════════════════════════
  // RESULT CACHE (chrome.storage.session — survives popup close)
  // ══════════════════════════════════════════════════════════════
  const CACHE_KEY = 'kiongoziCache';

  async function getCache() {
    try {
      const s = await chrome.storage.session.get(CACHE_KEY);
      return s[CACHE_KEY] || {};
    } catch { return {}; }
  }

  async function setCache(cache) {
    try { await chrome.storage.session.set({ [CACHE_KEY]: cache }); } catch {}
  }

  async function getCachedResult(url, type) {
    const cache = await getCache();
    const entry = cache[`${url}__${type}`];
    if (!entry) return null;
    // Cache expires after 30 minutes
    if (Date.now() - entry.timestamp > 30 * 60 * 1000) return null;
    return entry;
  }

  async function setCachedResult(url, type, data) {
    const cache = await getCache();
    // Limit cache to 15 entries
    const keys = Object.keys(cache);
    if (keys.length >= 15) {
      // Remove oldest entry
      const oldest = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp)[0];
      delete cache[oldest];
    }
    cache[`${url}__${type}`] = { data, type, timestamp: Date.now() };
    await setCache(cache);
  }

  async function clearCache() {
    await setCache({});
  }

  // ── Helpers ─────────────────────────────────────────────────────

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
  }

  function setStatus(msg) { const el = document.getElementById('status-text'); if (el) el.textContent = msg; }
  function setLoadingMsg(msg) { const el = document.getElementById('loading-msg'); if (el) el.textContent = msg; }
  function setHeaderStatus(msg) { const el = document.getElementById('header-status'); if (el) el.textContent = msg; }
  function escapeHTML(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  async function getTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function sendToPage(action, data = {}) {
    const tab = await getTab();
    try {
      return await chrome.tabs.sendMessage(tab.id, { action, ...data });
    } catch {
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        return await chrome.tabs.sendMessage(tab.id, { action, ...data });
      } catch { return null; }
    }
  }

  function updateTranslateBtns() {
    const titleEl = document.getElementById('translate-title');
    const subEl   = document.getElementById('translate-sub');
    if (titleEl) titleEl.textContent = 'Translate';
    if (subEl)   subEl.textContent   = `to ${cfg.lang}`;
  }

  function syncMainToggles() {
    document.getElementById('toggle-ui')?.classList.toggle('on', cfg.simplifyUI);
    document.getElementById('toggle-contrast')?.classList.toggle('on', cfg.highContrast);
    document.getElementById('toggle-font')?.classList.toggle('on', cfg.largeFont);
    document.getElementById('toggle-dyslexia')?.classList.toggle('on', cfg.dyslexia);
  }

  function syncSettingsToggles() {
    document.getElementById('settings-toggle-contrast')?.classList.toggle('on', cfg.highContrast);
    document.getElementById('settings-toggle-dyslexia')?.classList.toggle('on', cfg.dyslexia);
  }

  // ── Display result in popup ─────────────────────────────────────
  function displayResult({ type, label, tag, content, keyPoints = [] }) {
    lastResult = { type, content, keyPoints };
    document.getElementById('result-label').textContent = label;
    document.getElementById('result-tag').textContent = tag;
    document.getElementById('result-content').textContent = content;

    const kpEl   = document.getElementById('result-keypoints');
    const kpList = document.getElementById('keypoints-list');
    if (keyPoints.length) {
      kpEl.style.display = 'block';
      kpList.innerHTML = keyPoints.map(pt =>
        `<div class="kp-item"><span class="kp-bullet">•</span><span>${escapeHTML(pt)}</span></div>`
      ).join('');
    } else {
      kpEl.style.display = 'none';
    }

    // Show cache indicator if result came from cache
    const cacheEl = document.getElementById('result-cache-tag');
    if (cacheEl) {
      cacheEl.style.display = lastResult._fromCache ? 'inline-block' : 'none';
    }

    stopSpeaking();
    show('screen-result');
  }

  // ── Boot ─────────────────────────────────────────────────────────
  if (cfg.onboardingDone) {
    show('screen-main');
    syncMainToggles(); updateTranslateBtns();
    sendToPage('simplifyUI', { enabled: cfg.simplifyUI });
    sendToPage('applyVisual', { settings: cfg });
    setHeaderStatus(cfg.simplifyUI ? 'Simplified View is ON' : 'Web accessibility for everyone');

    // ── Restore last result for current tab ──────────────────────
    const tab = await getTab();
    if (tab?.url) {
      // Check all types for a cached result on this URL
      for (const type of ['simplify', 'translate', 'caption']) {
        const cached = await getCachedResult(tab.url, type);
        if (cached) {
          const labels = {
            simplify: { label: 'Page simplified · Kiongozi AI', tag: '✨ Simplified' },
            translate: { label: `Translated to ${cfg.lang} · Kiongozi AI`, tag: `🌍 ${cfg.lang}` },
            caption: { label: 'Images described · Kiongozi AI', tag: '🖼️ Descriptions' },
          };
          lastResult = { ...cached.data, type, _fromCache: true };
          // Show restored result notification without switching screen
          setStatus(`Last result restored (${type}) ✓`);
          break;
        }
      }
    }
  } else {
    show('screen-ob1');
  }

  // ══════════════════════════════════════════════════════════════
  // ONBOARDING
  // ══════════════════════════════════════════════════════════════
  document.getElementById('ob1-next')?.addEventListener('click', () => show('screen-ob2'));
  document.getElementById('ob1-skip')?.addEventListener('click', finishOnboarding);

  document.querySelectorAll('.font-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.font-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      const s = opt.dataset.size;
      cfg.fontSize = s === 'normal' ? 1 : s === 'large' ? 2 : 3;
      cfg.largeFont = cfg.fontSize >= 2;
    });
  });

  document.getElementById('ob2-next')?.addEventListener('click', () => show('screen-ob3'));
  document.getElementById('ob2-skip')?.addEventListener('click', finishOnboarding);
  document.getElementById('ob3-start')?.addEventListener('click', finishOnboarding);

  async function finishOnboarding() {
    cfg.onboardingDone = true;
    await save();
    show('screen-main');
    syncMainToggles(); updateTranslateBtns();
    await sendToPage('simplifyUI', { enabled: cfg.simplifyUI });
    await sendToPage('applyVisual', { settings: cfg });
    setHeaderStatus(cfg.simplifyUI ? 'Simplified View is ON' : 'Web accessibility for everyone');
  }

  // ══════════════════════════════════════════════════════════════
  // MAIN TOGGLES
  // ══════════════════════════════════════════════════════════════
  document.getElementById('toggle-ui')?.addEventListener('click', async () => {
    cfg.simplifyUI = !cfg.simplifyUI; syncMainToggles(); await save();
    await sendToPage('simplifyUI', { enabled: cfg.simplifyUI });
    setHeaderStatus(cfg.simplifyUI ? 'Simplified View is ON' : 'Web accessibility for everyone');
    setStatus(cfg.simplifyUI ? 'Simplified View on ✓' : 'Simplified View off');
  });

  document.getElementById('toggle-contrast')?.addEventListener('click', async () => {
    cfg.highContrast = !cfg.highContrast; syncMainToggles(); await save();
    await sendToPage('applyVisual', { settings: cfg });
    setStatus(cfg.highContrast ? 'High contrast on' : 'High contrast off');
  });

  document.getElementById('toggle-font')?.addEventListener('click', async () => {
    cfg.largeFont = !cfg.largeFont; syncMainToggles(); await save();
    await sendToPage('applyVisual', { settings: cfg });
    setStatus(cfg.largeFont ? 'Large font on' : 'Large font off');
  });

  document.getElementById('toggle-dyslexia')?.addEventListener('click', async () => {
    cfg.dyslexia = !cfg.dyslexia; syncMainToggles(); await save();
    await sendToPage('applyVisual', { settings: cfg });
    setStatus(cfg.dyslexia ? 'Dyslexia font on' : 'Dyslexia font off');
  });

  // ══════════════════════════════════════════════════════════════
  // NAVIGATION
  // ══════════════════════════════════════════════════════════════
  document.getElementById('btn-open-settings')?.addEventListener('click', () => {
    populateSettingsUI(); show('screen-settings');
  });
  document.getElementById('btn-close-settings')?.addEventListener('click', () => show('screen-main'));
  document.getElementById('btn-back')?.addEventListener('click', () => { stopSpeaking(); show('screen-main'); });
  document.getElementById('btn-replay-onboarding')?.addEventListener('click', () => show('screen-ob1'));

  // ── Show result on full page panel ───────────────────────────────
  document.getElementById('btn-inject')?.addEventListener('click', async () => {
    if (!lastResult) return;
    await sendToPage('showResult', {
      type: lastResult.type,
      content: lastResult.content,
      keyPoints: lastResult.keyPoints || [],
    });
    setStatus('Shown on page ✓');
    show('screen-main');
  });

  // ── View original ────────────────────────────────────────────────
  document.getElementById('btn-view-original')?.addEventListener('click', async () => {
    if (!originalText) return;
    await sendToPage('showResult', {
      type: 'original',
      content: originalText.slice(0, 1200) + (originalText.length > 1200 ? '…' : ''),
      keyPoints: [],
    });
    setStatus('Showing original ✓');
    show('screen-main');
  });

  // ── Copy ──────────────────────────────────────────────────────────
  document.getElementById('btn-copy')?.addEventListener('click', async () => {
    if (!lastResult) return;
    try {
      await navigator.clipboard.writeText(lastResult.content);
      setStatus('Copied to clipboard ✓');
      const btn = document.getElementById('btn-copy');
      btn.textContent = '✅';
      setTimeout(() => { btn.textContent = '📋'; }, 2000);
    } catch { setStatus('Copy failed — try again'); }
  });

  // ── Speak aloud ───────────────────────────────────────────────────
  document.getElementById('btn-speak')?.addEventListener('click', () => {
    if (!lastResult) return;
    if (speaking) { stopSpeaking(); return; }
    const utterance = new SpeechSynthesisUtterance(lastResult.content);
    utterance.lang = cfg.lang === 'Swahili' ? 'sw' : 'en';
    utterance.rate = 0.9;
    utterance.onend = () => {
      speaking = false;
      const btn = document.getElementById('btn-speak');
      if (btn) btn.textContent = '🔊';
    };
    speechSynthesis.speak(utterance);
    speaking = true;
    const btn = document.getElementById('btn-speak');
    if (btn) btn.textContent = '⏹️';
  });

  function stopSpeaking() {
    speechSynthesis.cancel();
    speaking = false;
    const btn = document.getElementById('btn-speak');
    if (btn) btn.textContent = '🔊';
  }

  // ══════════════════════════════════════════════════════════════
  // BACKEND + CACHE LOGIC
  // ══════════════════════════════════════════════════════════════
  async function callBackend(endpoint, body) {
    const resp = await fetch(`${cfg.backendUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`Server error ${resp.status}`);
    return resp.json();
  }

  // ── Simplify ──────────────────────────────────────────────────────
  document.getElementById('btn-simplify')?.addEventListener('click', async () => {
    const tab = await getTab();

    // Check cache first
    const cached = await getCachedResult(tab.url, 'simplify');
    if (cached) {
      displayResult({
        type: 'simplify',
        label: 'Page simplified · Kiongozi AI',
        tag: '✨ Simplified (cached)',
        content: cached.data.result,
        keyPoints: cached.data.key_points || [],
      });
      lastResult._fromCache = true;
      setStatus('Loaded from cache ✓');
      return;
    }

    show('screen-loading'); setLoadingMsg('Reading the page…');
    try {
      const page = await sendToPage('getPageText');
      if (!page?.text) throw new Error('Refresh this tab, then try again');
      originalText = page.text;
      setLoadingMsg('Simplifying your page…');
      const data = await callBackend('/simplify', {
        text: page.text, url: page.url, reading_level: cfg.readingLevel,
      });
      // Save to cache
      await setCachedResult(tab.url, 'simplify', data);
      displayResult({
        type: 'simplify',
        label: 'Page simplified · Kiongozi AI',
        tag: '✨ Simplified',
        content: data.result,
        keyPoints: data.key_points || [],
      });
      setStatus('Page simplified ✓');
    } catch (err) { show('screen-main'); setStatus('Error: ' + (err.message || 'Check Flask server')); }
  });

  // ── Translate ─────────────────────────────────────────────────────
  document.getElementById('btn-translate')?.addEventListener('click', async () => {
    const tab = await getTab();
    const cacheType = `translate_${cfg.lang}`;

    // Check cache
    const cached = await getCachedResult(tab.url, cacheType);
    if (cached) {
      displayResult({
        type: 'translate',
        label: `Translated to ${cfg.lang} · Kiongozi AI`,
        tag: `🌍 ${cfg.lang} (cached)`,
        content: cached.data.result,
      });
      lastResult._fromCache = true;
      setStatus('Loaded from cache ✓');
      return;
    }

    show('screen-loading'); setLoadingMsg('Reading the page…');
    try {
      const page = await sendToPage('getPageText');
      if (!page?.text) throw new Error('Refresh this tab, then try again');
      setLoadingMsg(`Translating to ${cfg.lang}…`);
      const data = await callBackend('/translate', { text: page.text, language: cfg.lang });
      // Save to cache
      await setCachedResult(tab.url, cacheType, data);
      displayResult({
        type: 'translate',
        label: `Translated to ${cfg.lang} · Kiongozi AI`,
        tag: `🌍 ${cfg.lang}`,
        content: data.result,
      });
      setStatus(`Translated to ${cfg.lang} ✓`);
    } catch (err) { show('screen-main'); setStatus('Error: ' + (err.message || 'Check Flask server')); }
  });

  // ── Describe Images ───────────────────────────────────────────────
  document.getElementById('btn-describe')?.addEventListener('click', async () => {
    const tab = await getTab();

    // Check cache
    const cached = await getCachedResult(tab.url, 'caption');
    if (cached) {
      displayResult({
        type: 'caption',
        label: 'Images described · Kiongozi AI',
        tag: '🖼️ Descriptions (cached)',
        content: cached.data.result,
      });
      // Re-inject captions on page too
      if (cached.data.captions) {
        await sendToPage('injectImageCaptions', { captions: cached.data.captions });
      }
      lastResult._fromCache = true;
      setStatus('Loaded from cache ✓');
      return;
    }

    show('screen-loading'); setLoadingMsg('Finding images on page…');
    try {
      const imgData = await sendToPage('getImages');
      const images = imgData?.images || [];
      if (!images.length) { show('screen-main'); setStatus('No images found on this page.'); return; }

      setLoadingMsg(`Describing ${images.length} image(s)…`);
      const results = [];

      for (const img of images.slice(0, 6)) {
        setLoadingMsg(`Describing image ${results.length + 1} of ${Math.min(images.length, 6)}…`);
        try {
          const data = await callBackend('/caption', { image_url: img.src });
          results.push({ src: img.src, alt: img.alt, caption: data.result });
        } catch {
          results.push({ src: img.src, alt: img.alt, caption: 'Could not describe this image.' });
        }
      }

      // Inject captions on page
      await sendToPage('injectImageCaptions', { captions: results });

      const summary = results.map((r, i) =>
        `Image ${i + 1}${r.alt ? ` — "${r.alt}"` : ''}:\n${r.caption}`
      ).join('\n\n');

      const cacheData = { result: summary, captions: results };
      await setCachedResult(tab.url, 'caption', cacheData);

      displayResult({
        type: 'caption',
        label: `${results.length} image(s) described · Kiongozi AI`,
        tag: '🖼️ Image Descriptions',
        content: summary,
      });
      setStatus(`${results.length} image(s) described ✓`);
    } catch (err) { show('screen-main'); setStatus('Error: ' + (err.message || 'Check Flask server')); }
  });

  // ══════════════════════════════════════════════════════════════
  // SETTINGS
  // ══════════════════════════════════════════════════════════════
  const readingLabels = { 1: 'Simple (Grade 3)', 2: 'Standard (Grade 6)', 3: 'Detailed (Full)' };

  function populateSettingsUI() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === cfg.lang);
    });
    const rSlider = document.getElementById('slider-reading');
    if (rSlider) rSlider.value = cfg.readingLevel;
    updateReadingLabel(cfg.readingLevel);
    const fSlider = document.getElementById('slider-font');
    if (fSlider) fSlider.value = cfg.fontSize;
    syncSettingsToggles();
    const be = document.getElementById('input-backend');
    if (be) be.value = cfg.backendUrl;
  }

  function updateReadingLabel(v) {
    const el = document.getElementById('reading-level-label');
    if (el) el.textContent = readingLabels[v] || 'Simple (Grade 3)';
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      cfg.lang = btn.dataset.lang;
      updateTranslateBtns();
    });
  });

  document.getElementById('slider-reading')?.addEventListener('input', e => {
    cfg.readingLevel = parseInt(e.target.value);
    updateReadingLabel(cfg.readingLevel);
  });

  document.getElementById('slider-font')?.addEventListener('input', e => {
    cfg.fontSize = parseInt(e.target.value);
    cfg.largeFont = cfg.fontSize >= 2;
    syncMainToggles();
  });

  document.getElementById('settings-toggle-contrast')?.addEventListener('click', () => {
    cfg.highContrast = !cfg.highContrast; syncSettingsToggles(); syncMainToggles();
  });

  document.getElementById('settings-toggle-dyslexia')?.addEventListener('click', () => {
    cfg.dyslexia = !cfg.dyslexia; syncSettingsToggles(); syncMainToggles();
  });

  // ── Clear cache button ────────────────────────────────────────────
  document.getElementById('btn-clear-cache')?.addEventListener('click', async () => {
    await clearCache();
    lastResult = null;
    originalText = '';
    setStatus('Cache cleared — results will be fresh ✓');
    show('screen-main');
  });

  document.getElementById('btn-save-settings')?.addEventListener('click', async () => {
    const be = document.getElementById('input-backend');
    if (be) cfg.backendUrl = be.value.trim().replace(/\/$/, '');
    await save();
    await sendToPage('simplifyUI', { enabled: cfg.simplifyUI });
    await sendToPage('applyVisual', { settings: cfg });
    show('screen-main'); syncMainToggles(); updateTranslateBtns();
    setStatus('Settings saved ✓');
  });

});
