# Cuppet · Design System

Brand contract for Cuppet marketing surfaces. Open Design–style portable system; Hallmark redesign + UI UX Pro Max checklist applied.

## Product

Persistent AI agents that work across connected accounts, keep a schedule, and deliver results to chat. Private beta · iOS & Android.

## Audience · Use · Tone

- **Audience** — Busy professionals who already live in Gmail, Calendar, Drive, GitHub, Notion.
- **Use** — Join private beta; understand “one sentence → scheduled agent → inbox result.”
- **Tone** — Quiet utility. Editorial restraint with product specificity. Not hype, not neon AI.

## Genre

**Editorial–minimal hybrid** (Hallmark modern-minimal discipline + existing Cuppet voice).

Keep warm paper and forest green. Refuse purple/pink AI gradients, glassmorphism floods, and italic display headers.

## Macrostructure

**Product-led letter** — Hero (copy + live chat surface) · Integrations strip · How it works · Product features · Security · Examples · CTA · Footer.

## Color

| Token | Value | Role |
| --- | --- | --- |
| `--paper` | `#F5F3EE` | Page background |
| `--paper-2` | `#EBE9E2` | Alt band / strip |
| `--paper-3` | `#E0E9DF` | Soft green wash |
| `--ink` | `#171A17` | Primary text |
| `--ink-soft` | `rgba(23, 26, 23, 0.55)` | Body secondary |
| `--ink-faint` | `rgba(23, 26, 23, 0.38)` | Meta / captions |
| `--forest` | `#173C2A` | Primary CTA / dark surfaces |
| `--forest-mid` | `#24583B` | Interactive accent |
| `--forest-deep` | `#153728` | Security band |
| `--leaf` | `#43855B` | Status / success accents |
| `--rule` | `rgba(23, 26, 23, 0.10)` | Hairlines |

No mid-render hex improvisation in new work — use tokens or Tailwind `brand` scale.

## Typography

| Role | Face | Notes |
| --- | --- | --- |
| Display | Instrument Serif | Roman only. No italic headers, with one sanctioned exception: the Hero subhead ("You get a message.") — do not add more. |
| Body | DM Sans | 400–600 for UI |
| Mono meta | `ui-monospace` | Optional, rare — prefer plain captions |

Scale (approx): display `clamp(2.75rem, 6vw, 5.25rem)` · section `clamp(2.25rem, 4vw, 3.5rem)` · body 15–17px · meta 10–12px uppercase tracking.

## Layout

- Max width: `72rem` (`max-w-6xl`)
- Page padding: `1.25rem` / `2rem`
- Section rhythm: `6rem`–`9rem` vertical
- Borders over shadows; elevation only on product demo surfaces
- Mobile: single column; no two-line CTAs; `overflow-x: clip`

## Components

- **Primary CTA** — filled forest, pill (`rounded-full`), light text, hover darken
- **Secondary** — text link or ghost, no competing fill
- **Nav** — floating pill (blur + border) when scrolled
- **Section label** — short uppercase caption + hairline; **no** `01 · CHAPTER` stamps unless content is truly ordinal
- **Cards** — paper on paper-2, 1px rule, radius ~1–1.5rem
- **Focus** — visible ring, forest, instant (no animate-in)

## Motion

- Prefer opacity + transform only
- Duration 150–300ms UI; ~600–700ms section reveals
- `prefers-reduced-motion: reduce` collapses loops and long reveals
- Max 2–3 motion primitives per page

## Copy voice

Declarative. Outcome-first. No invented metrics, logos, or “trusted by N teams.”

## Anti-patterns (do not ship)

- AI purple / pink / cyan default palettes
- Gradient text, aurora blobs, glassmorphism stacks
- Italic display headers (beyond the one Hero exception noted above)
- Fake browser / phone chrome with traffic lights
- Emoji as icons (use Lucide)
- Fabricated social proof

## Checklist (UI UX Pro Max)

- [x] Lucide icons, not emoji
- [x] `cursor-pointer` on interactive controls
- [x] Hover transitions 150–300ms
- [x] Body contrast ≥ 4.5:1 on paper
- [x] Focus-visible rings
- [x] Reduced-motion respected
- [x] Responsive 375 / 768 / 1024 / 1440
