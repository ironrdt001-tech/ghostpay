# GhostPay Design System & Architecture Specification

## 1. Concept & Brand Manifesto
- **One-line Concept:** Privacy-first peer-to-peer and shielded nodal escrow payments for India, delivering bank-grade settlement with zero personal identity or account exposure.
- **Brand Personality:** Restrained, Shielded, Authoritative. No decorative fluff, no gradients, no emoji-heavy fintech tropes. Depth is achieved purely through hairline borders and calibrated surface luminance.

## 2. Color Tokens (9-Step Neutral Scale + Scarce Signal Accent)
Defined strictly as CSS Custom Properties in `src/index.css`.

### Dark Mode (`[data-theme="dark"]` / Default Carbon)
- `--bg-canvas`: `#0B0C0E` (Deep carbon bedrock, zero blue haze)
- `--bg-surface`: `#121418` (Primary card and panel surface)
- `--bg-elevated`: `#181B20` (Modals, popovers, dropdown menus)
- `--bg-inset`: `#0E1014` (Recessed inputs, code badges, chart tracks)
- `--border-subtle`: `#22262E` (1px structural hairlines)
- `--border-strong`: `#313742` (Active boundaries, focus states)
- `--text-primary`: `#F3F4F6` (High-contrast primary typography)
- `--text-secondary`: `#9CA3AF` (Secondary labels, supporting notes)
- `--text-muted`: `#6B7280` (Micro-labels, timestamps, captions)

### Light Mode (`[data-theme="light"]` / Warm Alabaster Stone)
- `--bg-canvas`: `#F5F4F0` (Warm alabaster stone, zero pure #FFFFFF canvas glare)
- `--bg-surface`: `#FFFFFF` (Crisp contrast card surface)
- `--bg-elevated`: `#FAF9F6` (Elevated modal and popover surface)
- `--bg-inset`: `#ECEAE4` (Recessed input containers and chips)
- `--border-subtle`: `#E2DFD7` (1px hairlines)
- `--border-strong`: `#CBC7BC` (Input borders, dividers)
- `--text-primary`: `#111315` (Near-black authoritative text)
- `--text-secondary`: `#525860` (Neutral dark gray secondary text)
- `--text-muted`: `#7C828D` (Quiet metadata and helper text)

### Accent & Semantic Signal Tokens
Accent is never used as decorative wallpaper; it is preserved strictly for primary calls-to-action and active selection rings.
- `--accent-primary`: `#1D4ED8` (Deep Cobalt primary CTA)
- `--accent-hover`: `#1E40AF` (Deep Cobalt hover)
- `--accent-subtle`: `rgba(29, 78, 216, 0.12)` (Active pill tint)
- `--semantic-credit`: `#0D9488` (Teal credit signal)
- `--semantic-credit-text`: `#10B981` (Bright mint credit readout)
- `--semantic-credit-tint`: `rgba(16, 185, 129, 0.11)`
- `--semantic-debit`: `#E11D48` (Rose debit signal)
- `--semantic-debit-text`: `#F43F5E` (Vibrant rose debit readout)
- `--semantic-debit-tint`: `rgba(244, 63, 94, 0.11)`

## 3. Font Pair, Scale & Revolut Weight Discipline
- **Display & UI Font:** `Onest`, system-ui, -apple-system, sans-serif. Modern geometric-humanist counters, crisp Indian Rupee (`₹` U+20B9) glyph support.
- **Monospace Font:** `JetBrains Mono`, monospace. Used for UTR references, 12-digit transaction hashes, `@handles`, and shielded URLs.
- **Weight Discipline (Confident Medium):**
  - Headings (`h1`, `h2`, `h3`) strictly use weight `500` (or `600` maximum for micro-labels).
  - Authority is established through optical scale and negative letter-spacing (`-0.02em` to `-0.03em`), never through heavy 700/800 bold weights.
  - Body text uses weight `400` with line-height `1.45`.
  - Buttons and interactive triggers use weight `500`.

### Type Scale
- **Money Hero (Balance & Checkout Amount):** `clamp(36px, 5vw, 48px)`, weight `500`, tracking `-0.03em`, line-height `1.05`.
- **Page Title:** `26px`, weight `500`, tracking `-0.02em`, line-height `1.15`.
- **Section Title:** `19px`, weight `500`, tracking `-0.015em`, line-height `1.25`.
- **Body & Inputs:** `16px`, weight `400`, line-height `1.45`.
- **Secondary Text:** `14px`, weight `400`, line-height `1.4`.
- **Caption / Metadata:** `12px`, weight `500`, line-height `1.35` (strictly no text under `12px`).
- **Numeric Rule:** `font-variant-numeric: tabular-nums lining-nums` enforced on every amount, balance, chart bar, timestamp, and UTR ID.

## 4. Spacing, Radius & Flat Surface Rules
- **Spacing Scale (8px Grid):** `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`.
- **Radius Scale:**
  - `--radius-pill`: `9999px` (buttons, quick chips, segmented tabs)
  - `--radius-input`: `12px` (input controls, search fields)
  - `--radius-card`: `16px` (main surface containers)
  - `--radius-sheet`: `24px` (modals, bottom sheets)
- **Shadow Rule:**
  - Absolute zero drop shadows on standard cards and buttons (`box-shadow: none`).
  - Spatial depth is defined through luminance elevation (`--bg-canvas` -> `--bg-surface` -> `--bg-elevated`) and `1px solid var(--border-subtle)` structural hairlines.
  - Light scrim overlays (`rgba(0, 0, 0, 0.6)`) and subtle elevation borders are used only for modal focus traps.

## 5. Icon Approach
- No Lucide sprawl, no emojis, no unicode icons in UI.
- Unified 1.75px stroke inline SVGs styled with `currentColor` matching the design token color.
- Custom payment glyphs: Shield, Rupee, Scan/QR, Incoming (`↙`), Outgoing (`↗`), Eye, Eye-off, Camera, Device Gallery, Check, Copy, Download, Share, Lock, Search, Close (`X`).

## 6. Motion Rules
- Standard easing: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Duration: `180ms` for interactions, `240ms` for sheet entry.
- Motion is strictly functional: state changes, tab sliding indicator, toast reveals, modal entry.
- Full support for `@media (prefers-reduced-motion: reduce)` with zero transitions.

## 7. Copy Voice
- Restrained, clear, concrete, sentence case.
- Zero fintech hype words (no "transform", "revolutionize", "supercharge", "effortless", "ecosystem").
- Zero exclamation marks (`!`), "Oops!", or "Let's get started".
- Actionable primary buttons that state exact amount and counterparty:
  - `Send ₹500.00 to @handle`
  - `Pay ₹250.00 to @handle`
- Authentic Indian financial formatting: `₹1,23,450.00` in Indian numbering system (Lakh/Crore) with IST timestamps (`23:24 IST`).

## 8. Signature Brand Element: The Shielded Escrow Pass & Split-Decimal Balance Header
- **Split-Decimal Balance Header:**
  - High-visibility balance display rendering `₹` at `0.62em` (`opacity: 0.75`), integer digits in dominant weight `500`, and `.00` decimals at `0.65em` (`opacity: 0.5`).
  - Eye toggle hides digits to `₹••••••` persisted in `localStorage`.
  - Integrated `Add money` pill action and copyable shielded handle link in one seamless surface.
- **Shielded Escrow Pass:**
  - Authentic QR card with cryptographic verification indicator, counterparty handle, optional requested amount chip, and mobile-safe GPU stage export for 1-tap sharing.
