# CODING_RULES.md — AI Review Generator

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Functions | camelCase | `generateReviews`, `loadPrompt` |
| Classes | PascalCase | `LLMAdapter`, `MockAdapter` |
| Constants | UPPER_SNAKE_CASE | `MIN_POOL_SIZE`, `REQUIRED_KEYS` |
| Files (server) | camelCase | `llmService.js`, `configService.js` |
| Files (frontend) | kebab-case or lowercase | `app.js`, `style.css` |
| Prompt files | `{category_id}_{language_code}.txt` | `new_glasses_en.txt` |
| Fallback files | `{category_id}_{language_code}.json` | `fast_service_mr.json` |
| CSS classes | kebab-case BEM-inspired | `review-card__copy-btn` |
| CSS variables | `--kebab-case` | `--color-primary` |

## Module Pattern

- All server modules use **ES6 named exports** (`export function`, `export class`)
- No default exports except for Express routers
- Frontend modules are **IIFE-based singletons** (no bundler needed)
- No circular dependencies between services

## Error Handling Rules

1. **Always throw descriptive `Error` objects** — include the module name in brackets: `throw new Error('[configService] Missing key: backend')`
2. **Never swallow errors silently** in server code — log and re-throw or return a structured error response
3. **Frontend errors** that affect UX must dispatch `'ERROR'` to the StateMachine
4. **localStorage failures** (private browsing, quota exceeded) are the only acceptable silent failures — wrap in try/catch and continue
5. **HTTP errors** from adapters must include the status code in the message

## API Response Shapes

All API responses are JSON. Success responses use `200`. Errors use appropriate HTTP status codes with `{ error: string }` body.

```js
// Success
{ reviews: [{id, text}], backend: string, fallback: boolean }

// Client error
{ error: "Missing required field: category" }  // 400

// Server error
{ error: "All backends unavailable..." }  // 503
```

## Frontend Rules

- **No external JS dependencies** in the frontend — pure ES6, no CDN scripts
- **No inline styles** — all styling via `style.css` and CSS custom properties
- **No inline event handlers** — all events wired in JS via `addEventListener`
- **All text content** must come from config or API — no hardcoded strings in UIRenderer
- **Devanagari text** must use the `.lang-mr` class for correct font rendering

## Backend Rules

- **API keys never leave the server** — `GET /api/config` must never include `openai.apiKey` or `gemini.apiKey`
- **Config is read-only** — `configService` exposes only `get()` and `getAll()`, never a setter
- **Adapters are stateless** — no mutable state outside the constructor
- **Prompt templates are cached** after first read — never re-read from disk on every request

## Prompt Template Rules

- File naming: `{category_id}_{language_code}.txt` — all lowercase, underscore separator
- Required placeholders: `{{shopName}}`, `{{tone}}`, `{{seed}}`, `{{minWords}}`, `{{maxWords}}`
- Output instruction must be the last line: "Output only the review text, nothing else."
- Marathi templates must explicitly instruct the LLM to respond in Devanagari script

## Testing Rules

- Property tests use `fast-check` with a minimum of 100 iterations
- Unit tests cover all pure functions in services and frontend modules
- Integration tests use `backend: "mock"` — never make live LLM calls in CI
- Test files live in `tests/` directory
