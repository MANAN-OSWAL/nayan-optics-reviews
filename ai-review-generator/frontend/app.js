/**
 * app.js — Nayan Optics AI Review Generator Frontend
 * Pure ES6 modules, no build step required.
 *
 * Modules:
 *   ConfigLoader       — fetches /api/config once and caches it
 *   APIClient          — wraps fetch calls to the backend
 *   HistoryManager     — localStorage review history with FIFO cap
 *   DeduplicationEngine — Jaccard bigram similarity deduplication
 *   ClipboardManager   — Clipboard API with textarea fallback
 *   StateMachine       — explicit state transitions
 *   UIRenderer         — renders each state into #app
 */

// ─────────────────────────────────────────────
// ConfigLoader
// ─────────────────────────────────────────────
const ConfigLoader = (() => {
  let _cache = null;

  async function init() {
    if (_cache) return _cache;
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error(`[ConfigLoader] Failed to load config: ${res.status}`);
    _cache = await res.json();
    return _cache;
  }

  function get(key) {
    if (!_cache) throw new Error('[ConfigLoader] Config not loaded yet. Call init() first.');
    return _cache[key];
  }

  function getAll() {
    if (!_cache) throw new Error('[ConfigLoader] Config not loaded yet. Call init() first.');
    return _cache;
  }

  return { init, get, getAll };
})();

// ─────────────────────────────────────────────
// APIClient
// ─────────────────────────────────────────────
const APIClient = (() => {
  async function generateReviews({ category, language, tone, seed, count }) {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, language, tone, seed, count }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async function checkHealth() {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error(`[APIClient] Health check failed: ${res.status}`);
    return res.json();
  }

  return { generateReviews, checkHealth };
})();

// ─────────────────────────────────────────────
// HistoryManager
// ─────────────────────────────────────────────
const HistoryManager = (() => {
  const MAX_ENTRIES = 50;

  function _key(category, language) {
    return `nayan_history_${category}_${language}`;
  }

  function getHistory(category, language) {
    try {
      const raw = localStorage.getItem(_key(category, language));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function addEntry(category, language, entry) {
    const history = getHistory(category, language);
    history.push(entry);
    // FIFO eviction — remove oldest when cap exceeded
    while (history.length > MAX_ENTRIES) {
      history.shift();
    }
    try {
      localStorage.setItem(_key(category, language), JSON.stringify(history));
    } catch {
      // localStorage may be unavailable (private browsing) — fail silently
    }
  }

  function clearHistory(category, language) {
    try {
      localStorage.removeItem(_key(category, language));
    } catch {
      // fail silently
    }
  }

  return { getHistory, addEntry, clearHistory };
})();

// ─────────────────────────────────────────────
// DeduplicationEngine
// ─────────────────────────────────────────────
const DeduplicationEngine = (() => {
  /**
   * Build a Set of consecutive word-pair bigrams from a text string.
   * @param {string} text
   * @returns {Set<string>}
   */
  function bigramSet(text) {
    const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const bigrams = new Set();
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.add(`${words[i]} ${words[i + 1]}`);
    }
    return bigrams;
  }

  /**
   * Compute Jaccard similarity between two texts using word bigrams.
   * Returns a float in [0, 1]. 1.0 = identical, 0.0 = completely different.
   * @param {string} textA
   * @param {string} textB
   * @returns {number}
   */
  function jaccardSimilarity(textA, textB) {
    const setA = bigramSet(textA);
    const setB = bigramSet(textB);

    if (setA.size === 0 && setB.size === 0) return 1.0;
    if (setA.size === 0 || setB.size === 0) return 0.0;

    let intersectionSize = 0;
    for (const bigram of setA) {
      if (setB.has(bigram)) intersectionSize++;
    }

    const unionSize = setA.size + setB.size - intersectionSize;
    return intersectionSize / unionSize;
  }

  /**
   * Check if a new review text is a duplicate of any entry in the history.
   * @param {string} newText
   * @param {{ text: string }[]} historyEntries
   * @param {number} threshold - Similarity threshold (e.g. 0.80)
   * @returns {boolean}
   */
  function isDuplicate(newText, historyEntries, threshold) {
    for (const entry of historyEntries) {
      if (jaccardSimilarity(newText, entry.text) > threshold) {
        return true;
      }
    }
    return false;
  }

  return { bigramSet, jaccardSimilarity, isDuplicate };
})();

// ─────────────────────────────────────────────
// ClipboardManager
// ─────────────────────────────────────────────
const ClipboardManager = (() => {
  /**
   * Copy text to clipboard. Uses Clipboard API if available, falls back to
   * rendering a selectable textarea.
   * @param {string} text
   * @returns {Promise<boolean>} true if copied via API, false if manual fallback shown
   */
  async function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback: execCommand (deprecated but widely supported)
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  }

  return { copy };
})();

// ─────────────────────────────────────────────
// SVG Icons
// ─────────────────────────────────────────────
const Icons = {
  glasses: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M2.5 13L5 7c.7-1.3 1.4-2 3-2"/><path d="M21.5 13L19 7c-.7-1.3-1.5-2-3-2"/></svg>`,
  zap: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  eye: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  sun: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  sparkles: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
  chevronRight: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`,
  copy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  refresh: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`,
  star: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  bigGlasses: `<svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M2.5 13L5 7c.7-1.3 1.4-2 3-2"/><path d="M21.5 13L19 7c-.7-1.3-1.5-2-3-2"/></svg>`,
};

// ─────────────────────────────────────────────
// UIRenderer
// ─────────────────────────────────────────────
const UIRenderer = (() => {
  const STATES = {
    IDLE: 'IDLE',
    LANGUAGE_SELECTED: 'LANGUAGE_SELECTED',
    TONE_SELECTED: 'TONE_SELECTED',
    GENERATING: 'GENERATING',
    REVIEWS_READY: 'REVIEWS_READY',
    FALLBACK_DISPLAYED: 'FALLBACK_DISPLAYED',
    COPIED: 'COPIED',
    ERROR: 'ERROR',
  };

  function _stars() {
    return `<div class="review-card__stars">${Icons.star.repeat(5)}</div>`;
  }

  function _header(shopName) {
    return `
      <header class="app-header">
        <div class="app-header__bg-icon">${Icons.bigGlasses}</div>
        <h1 class="app-header__title">${shopName}</h1>
        <p class="app-header__subtitle">AI Review Generator</p>
      </header>`;
  }

  function _footer(shopName) {
    return `<footer class="app-footer">Thank you for choosing ${shopName}</footer>`;
  }

  function renderIdle(config, dispatch) {
    const { shopName, languages } = config;
    const app = document.getElementById('app');

    app.innerHTML = `
      ${_header(shopName)}
      <main class="app-main animate-fade-in">
        <h2 class="section-title">Choose your language</h2>
        <p class="section-subtitle">Select the language for your review.</p>
        <div class="language-grid" id="language-grid"></div>
      </main>
      ${_footer(shopName)}`;

    const grid = document.getElementById('language-grid');
    languages.forEach((lang) => {
      const btn = document.createElement('button');
      btn.className = 'language-btn';
      btn.textContent = lang.label;
      btn.setAttribute('data-lang', lang.code);
      btn.addEventListener('click', () => dispatch('SELECT_LANGUAGE', lang));
      grid.appendChild(btn);
    });
  }

  function renderCategorySelect(config, selectedLanguage, dispatch) {
    const { shopName, categories } = config;
    const app = document.getElementById('app');
    const isMarathi = selectedLanguage.code === 'mr';

    app.innerHTML = `
      ${_header(shopName)}
      <main class="app-main animate-fade-in">
        <div class="breadcrumb">
          <button class="breadcrumb-lang-btn" id="change-lang-btn">${selectedLanguage.label} ▾</button>
          <span class="breadcrumb__sep">›</span>
          <span>Service</span>
        </div>
        <h2 class="section-title">${isMarathi ? 'तुमची भेट कशी होती?' : 'How was your visit?'}</h2>
        <p class="section-subtitle">${isMarathi ? 'सेवा निवडा — त्वरित रिव्ह्यू मिळवा.' : 'Select a service to get your review instantly.'}</p>
        <div class="category-list" id="category-list"></div>
      </main>
      ${_footer(shopName)}`;

    document.getElementById('change-lang-btn').addEventListener('click', () => {
      dispatch('INIT');
    });

    const list = document.getElementById('category-list');
    categories.forEach((cat) => {
      const label = isMarathi && cat.labelMr ? cat.labelMr : cat.label;

      const wrapper = document.createElement('div');
      wrapper.className = 'category-row';

      // Main category button — goes to tone selection
      const btn = document.createElement('button');
      btn.className = 'category-btn';
      btn.innerHTML = `
        <div class="category-btn__left">
          <div class="category-btn__icon icon-${cat.color}">${Icons[cat.icon] || Icons.sparkles}</div>
          <span class="category-btn__label${isMarathi ? ' lang-mr' : ''}">${label}</span>
        </div>
        <span class="category-btn__chevron">${Icons.chevronRight}</span>`;
      btn.addEventListener('click', () => dispatch('SELECT_CATEGORY', cat));

      // Quick Review button — skips tone, generates immediately
      const quickBtn = document.createElement('button');
      quickBtn.className = 'quick-review-btn';
      quickBtn.title = isMarathi ? 'त्वरित रिव्ह्यू' : 'Quick Review';
      quickBtn.innerHTML = `${Icons.zap}<span>${isMarathi ? 'झटपट' : 'Quick'}</span>`;
      quickBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dispatch('QUICK_REVIEW', cat);
      });

      wrapper.appendChild(btn);
      wrapper.appendChild(quickBtn);
      list.appendChild(wrapper);
    });
  }

  function renderToneSelect(config, { selectedLanguage, selectedCategory }, dispatch) {
    const { shopName, tones, defaultTone } = config;
    const app = document.getElementById('app');
    const isMarathi = selectedLanguage.code === 'mr';
    const catLabel = isMarathi && selectedCategory.labelMr ? selectedCategory.labelMr : selectedCategory.label;

    app.innerHTML = `
      ${_header(shopName)}
      <main class="app-main animate-fade-in">
        <div class="breadcrumb">
          <span>${selectedLanguage.label}</span>
          <span class="breadcrumb__sep">›</span>
          <span class="${isMarathi ? 'lang-mr' : ''}">${catLabel}</span>
          <span class="breadcrumb__sep">›</span>
          <span>Tone</span>
        </div>
        <h2 class="section-title">Choose a tone</h2>
        <p class="section-subtitle">How would you like your review to sound?</p>
        <div class="tone-grid" id="tone-grid"></div>
        <button class="generate-btn" id="generate-btn">
          ${Icons.sparkles} Generate Reviews
        </button>
      </main>
      ${_footer(shopName)}`;

    let selectedTone = defaultTone || tones[0]?.id;

    const grid = document.getElementById('tone-grid');
    tones.forEach((tone) => {
      const btn = document.createElement('button');
      btn.className = `tone-btn${tone.id === selectedTone ? ' selected' : ''}`;
      btn.textContent = tone.label;
      btn.dataset.toneId = tone.id;
      btn.addEventListener('click', () => {
        selectedTone = tone.id;
        grid.querySelectorAll('.tone-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      grid.appendChild(btn);
    });

    document.getElementById('generate-btn').addEventListener('click', () => {
      dispatch('GENERATE', { tone: selectedTone });
    });
  }

  function renderGenerating(config) {
    const { shopName } = config;
    const app = document.getElementById('app');

    app.innerHTML = `
      ${_header(shopName)}
      <main class="app-main">
        <div class="loading-container animate-fade-in">
          <div class="loading-spinner-wrap">
            <div class="loading-spinner"></div>
            <div class="loading-spinner-icon">${Icons.sparkles}</div>
          </div>
          <h3 class="loading-title" id="loading-title">Generating your reviews…</h3>
          <p class="loading-subtitle" id="loading-subtitle">Writing unique feedback based on your visit.</p>
        </div>
      </main>
      ${_footer(shopName)}`;

    // Update message after 10 seconds
    setTimeout(() => {
      const title = document.getElementById('loading-title');
      const subtitle = document.getElementById('loading-subtitle');
      if (title) title.textContent = 'Taking longer than expected…';
      if (subtitle) subtitle.textContent = 'Almost there, please wait.';
    }, 10000);
  }

  function renderReviews(config, { reviews, fallback, selectedLanguage, selectedCategory, selectedTone }, dispatch) {
    const { shopName, googleMapsLink, history: historyConfig } = config;
    const app = document.getElementById('app');
    const isMarathi = selectedLanguage.code === 'mr';
    const catLabel = isMarathi && selectedCategory.labelMr ? selectedCategory.labelMr : selectedCategory.label;

    // Deduplicate against history
    const historyEntries = HistoryManager.getHistory(selectedCategory.id, selectedLanguage.code);
    const threshold = historyConfig?.similarityThreshold ?? 0.80;
    const uniqueReviews = reviews.filter(
      (r) => !DeduplicationEngine.isDuplicate(r.text, historyEntries, threshold)
    );
    const displayReviews = uniqueReviews.length > 0 ? uniqueReviews : reviews;

    app.innerHTML = `
      ${_header(shopName)}
      <main class="app-main animate-slide-up">
        <div class="reviews-header">
          <h2 class="section-title">Tap to Select</h2>
          <div class="reviews-nav">
            <button class="back-btn" id="back-to-tone-btn">← Change Tone</button>
            <button class="back-btn" id="back-to-category-btn">← Change Service</button>
            <button class="back-btn back-btn--home" id="back-to-home-btn">⌂ Home</button>
          </div>
        </div>
        ${fallback ? `
          <div class="fallback-banner">
            ${Icons.warning}
            AI generation unavailable — showing curated reviews.
          </div>` : ''}
        <p class="reviews-hint">
          ${Icons.check} Tap a review to copy it and open Google Maps.
        </p>
        <div class="review-list" id="review-list"></div>
      </main>
      ${_footer(shopName)}
      <div class="generate-new-wrap">
        <button class="generate-new-btn" id="generate-new-btn">
          ${Icons.refresh} Generate New Reviews
        </button>
      </div>`;

    const list = document.getElementById('review-list');

    displayReviews.forEach((review, idx) => {
      const card = document.createElement('div');
      card.className = 'review-card';
      card.id = `review-card-${idx}`;
      card.innerHTML = `
        ${_stars()}
        <p class="review-card__text${isMarathi ? ' lang-mr' : ''}">"${review.text}"</p>
        <button class="review-card__copy-btn default" id="copy-btn-${idx}">
          ${Icons.copy} Post This Review
        </button>`;

      card.querySelector(`#copy-btn-${idx}`).addEventListener('click', async () => {
        const copied = await ClipboardManager.copy(review.text);

        if (copied) {
          // Visual confirmation
          card.classList.add('copied');
          const badge = document.createElement('div');
          badge.className = 'review-card__badge';
          badge.innerHTML = `${Icons.check} COPIED`;
          card.appendChild(badge);

          const copyBtn = card.querySelector(`#copy-btn-${idx}`);
          copyBtn.className = 'review-card__copy-btn success';
          copyBtn.innerHTML = `${Icons.check} Opening Maps…`;

          // Add to history
          HistoryManager.addEntry(selectedCategory.id, selectedLanguage.code, {
            id: review.id,
            text: review.text,
            tone: selectedTone,
            timestamp: Date.now(),
          });

          // Open Google Maps after 1 second
          setTimeout(() => {
            window.open(googleMapsLink, '_blank');
          }, 1000);
        } else {
          // Manual copy fallback
          const textArea = document.createElement('textarea');
          textArea.className = 'manual-copy-area';
          textArea.value = review.text;
          textArea.rows = 4;
          textArea.readOnly = true;
          const hint = document.createElement('p');
          hint.style.cssText = 'font-size:0.8125rem;color:#64748b;margin-bottom:8px;';
          hint.textContent = 'Please copy the text above, then tap the button below.';
          const openBtn = document.createElement('button');
          openBtn.className = 'review-card__copy-btn default';
          openBtn.innerHTML = `${Icons.chevronRight} Open Google Maps`;
          openBtn.addEventListener('click', () => window.open(googleMapsLink, '_blank'));
          card.innerHTML = '';
          card.appendChild(textArea);
          card.appendChild(hint);
          card.appendChild(openBtn);
        }
      });

      list.appendChild(card);
    });

    document.getElementById('back-to-tone-btn').addEventListener('click', () => {
      dispatch('BACK_TO_TONE');
    });
    document.getElementById('back-to-category-btn').addEventListener('click', () => {
      dispatch('BACK_TO_CATEGORY');
    });
    document.getElementById('back-to-home-btn').addEventListener('click', () => {
      dispatch('INIT');
    });

    document.getElementById('generate-new-btn').addEventListener('click', () => {
      dispatch('GENERATE_NEW');
    });
  }

  function renderError(config, errorMessage, dispatch) {
    const { shopName } = config;
    const app = document.getElementById('app');

    app.innerHTML = `
      ${_header(shopName)}
      <main class="app-main animate-fade-in">
        <div class="empty-state">
          <div class="empty-state__icon">😕</div>
          <h3 class="empty-state__title">Something went wrong</h3>
          <p class="empty-state__text">${errorMessage}</p>
          <button class="generate-btn" id="retry-btn" style="margin-top:24px;">
            Try Again
          </button>
        </div>
      </main>
      ${_footer(shopName)}`;

    document.getElementById('retry-btn').addEventListener('click', () => {
      dispatch('RETRY');
    });
  }

  return {
    STATES,
    renderIdle,
    renderCategorySelect,
    renderToneSelect,
    renderGenerating,
    renderReviews,
    renderError,
  };
})();

// ─────────────────────────────────────────────
// StateMachine
// ─────────────────────────────────────────────
const StateMachine = (() => {
  let _state = UIRenderer.STATES.IDLE;
  let _context = {};

  function dispatch(action, payload = {}) {
    const config = ConfigLoader.getAll();

    switch (action) {
      case 'INIT':
        _state = UIRenderer.STATES.IDLE;
        _context = {};
        UIRenderer.renderIdle(config, dispatch);
        break;

      case 'SELECT_LANGUAGE':
        _state = UIRenderer.STATES.LANGUAGE_SELECTED;
        _context.selectedLanguage = payload;
        UIRenderer.renderCategorySelect(config, payload, dispatch);
        break;

      // Auto-detected from browser — skip language screen, go straight to categories
      case 'AUTO_LANGUAGE':
        _state = UIRenderer.STATES.LANGUAGE_SELECTED;
        _context.selectedLanguage = payload;
        UIRenderer.renderCategorySelect(config, payload, dispatch);
        break;

      case 'SELECT_CATEGORY':
        _context.selectedCategory = payload;
        UIRenderer.renderToneSelect(config, _context, dispatch);
        break;

      // Quick Review — skip tone selection, use default tone, generate immediately
      case 'QUICK_REVIEW':
        _context.selectedCategory = payload;
        _context.selectedTone = config.defaultTone || 'enthusiastic';
        _context._freshSeed = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
        _state = UIRenderer.STATES.GENERATING;
        UIRenderer.renderGenerating(config);
        _doGenerate();
        break;

      case 'GENERATE':
        _context.selectedTone = payload.tone;
        _state = UIRenderer.STATES.GENERATING;
        UIRenderer.renderGenerating(config);
        _doGenerate();
        break;

      case 'GENERATE_NEW':
        // Force a fresh seed so the fallback pool re-shuffles and LLM gets new variation
        _context._freshSeed = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
        _state = UIRenderer.STATES.GENERATING;
        UIRenderer.renderGenerating(config);
        _doGenerate();
        break;

      case 'BACK_TO_TONE':
        UIRenderer.renderToneSelect(config, _context, dispatch);
        break;

      case 'BACK_TO_CATEGORY':
        UIRenderer.renderCategorySelect(config, _context.selectedLanguage, dispatch);
        break;

      case 'REVIEWS_READY':
        _state = payload.fallback
          ? UIRenderer.STATES.FALLBACK_DISPLAYED
          : UIRenderer.STATES.REVIEWS_READY;
        UIRenderer.renderReviews(config, { ...payload, ..._context }, dispatch);
        break;

      case 'ERROR':
        _state = UIRenderer.STATES.ERROR;
        UIRenderer.renderError(config, payload.message, dispatch);
        break;

      case 'RETRY':
        dispatch('INIT');
        break;

      default:
        console.warn(`[StateMachine] Unknown action: ${action}`);
    }
  }

  async function _doGenerate() {
    const { selectedCategory, selectedLanguage, selectedTone, _freshSeed } = _context;
    // Clear the seed after use so next GENERATE_NEW gets a new one
    delete _context._freshSeed;
    try {
      const result = await APIClient.generateReviews({
        category: selectedCategory.id,
        language: selectedLanguage.code,
        tone: selectedTone,
        seed: _freshSeed || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
        count: 5,
      });
      dispatch('REVIEWS_READY', {
        reviews: result.reviews,
        fallback: result.fallback,
      });
    } catch (err) {
      dispatch('ERROR', { message: err.message || 'Failed to generate reviews. Please try again.' });
    }
  }

  return { dispatch };
})();

// ─────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await ConfigLoader.init();

    // Auto-detect browser language and pre-select if it matches a supported language.
    // The customer can still change it on the language screen.
    const browserLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    const supportedLanguages = ConfigLoader.get('languages') || [];

    // Match "mr", "mr-IN", "mr-in" etc. to the "mr" code
    const detectedLang = supportedLanguages.find((l) =>
      browserLang.startsWith(l.code.toLowerCase())
    );

    if (detectedLang) {
      // Skip the language screen and go straight to category selection.
      // A "Change Language" link on the category screen lets them go back.
      StateMachine.dispatch('AUTO_LANGUAGE', detectedLang);
    } else {
      StateMachine.dispatch('INIT');
    }
  } catch (err) {
    console.error('[Bootstrap] Failed to initialise:', err);
    document.getElementById('app').innerHTML = `
      <div style="padding:32px;text-align:center;color:#ef4444;">
        <p style="font-size:1.125rem;font-weight:600;">Failed to load configuration</p>
        <p style="font-size:0.875rem;margin-top:8px;color:#64748b;">${err.message}</p>
        <button onclick="location.reload()" style="margin-top:16px;padding:10px 20px;background:#2563eb;color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.875rem;">
          Retry
        </button>
      </div>`;
  }
});
