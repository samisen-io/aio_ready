# AIO Ready — Improvement Tasks

## 1. AI/Web Standards Updates
- [ ] Add `/llms.txt` check to the audit (score and recommend it)
- [ ] Expand `robots.txt` check to detect AI-specific bot directives (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Googlebot-Extended`)
- [ ] Add check for `noai` / `noimageai` meta tags

## 2. Dependency Updates
- [x] Replace `url-parse` with native `URL` API throughout `server.js`
- [x] Replace `node-fetch` v2 in `anthropicClient.js` with native `fetch` (via `@anthropic-ai/sdk`)
- [x] Update Chrome user agent strings in `fetchPageContent` to current versions (Chrome 134)
- [x] Replace manual Anthropic REST calls in `anthropicClient.js` with `@anthropic-ai/sdk`

## 3. Security Fixes
- [x] Lock down CORS to production domain instead of wildcard (via `ALLOWED_ORIGINS` env var)
- [x] Replace in-memory rate limiter with `express-rate-limit`
- [x] Remove `unsafe-inline` from Content Security Policy (moved inline script to `audit.js` + data attributes)

## 4. New Features
- [ ] Add audit history / persistence so users can track progress over time
- [ ] Add PDF export of audit results
- [ ] Add side-by-side audit comparison (before vs. after)
- [ ] Connect Audit and LLM Optimizer — one-click schema generation from audit results

## 5. Code Quality
- [ ] Move Anthropic model name to a named constant or env var
- [ ] Create `tests/` folder and add unit tests for audit analysis functions
