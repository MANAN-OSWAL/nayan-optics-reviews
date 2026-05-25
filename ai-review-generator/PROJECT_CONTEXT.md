# PROJECT_CONTEXT.md — AI Review Generator

## Purpose

Replaces the static review generator (shop2.html / index.html) for Nayan Optics optical shop with a fully dynamic, LLM-powered system. Customers select a service category, language, and tone, then receive five freshly generated, unique review texts to copy and post on Google Maps.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS (ES6 modules), HTML5, CSS3 — no build step |
| Backend | Node.js 18+, Express 4.18 |
| LLM (primary) | Ollama (local) |
| LLM (secondary) | OpenAI Chat Completions API / Google Gemini API |
| LLM (dev/test) | Mock adapter (instant, no network) |
| Deduplication | Jaccard bigram similarity (pure JS, no dependencies) |
| History | Browser localStorage |
| Config | config.json (single source of truth) |
| Testing | fast-check (property-based), Jest |

## Key Data Flows

### Happy Path (Ollama running)
```
Customer → selects language + category + tone
         → POST /api/generate {category, language, tone, seed}
         → promptLoader loads prompts/{category}_{language}.txt
         → interpolate() fills {{placeholders}}
         → OllamaAdapter.generate(prompt)
         → validate word count [40–300]
         → return [{id, text}] × 5
         → frontend deduplicates against localStorage history
         → display review cards
         → customer taps → ClipboardManager.copy()
         → add to history → open Google Maps
```

### Fallback Path (Ollama down)
```
POST /api/generate
  → llmService.checkHealth() → Ollama fails
  → try cloud adapter (if apiKey configured) → also fails
  → fallbackService.getReviews(category, language, 5)
  → return {reviews, fallback: true}
  → frontend shows "AI unavailable" banner
  → same copy + redirect flow
```

## External Dependencies

| Package | Version | Role |
|---|---|---|
| express | 4.18.2 | HTTP server |
| node-fetch | 3.3.2 | HTTP client for LLM APIs |
| uuid | 9.0.0 | Unique IDs for reviews and variation seeds |
| fast-check | 3.19.0 | Property-based testing (devDependency) |
| jest | 29.7.0 | Test runner (devDependency) |

## Environment Requirements

- Node.js >= 18.0.0 (for native `fetch` and `--watch` flag)
- Ollama installed locally for AI generation (optional — mock mode works without it)
- No database required — all state is in localStorage and flat files

## Configuration Entry Point

`config.json` at the project root is the single source of truth. Change `backend` to switch LLM providers. Add entries to `categories`, `languages`, or `tones` to extend the UI without code changes.
