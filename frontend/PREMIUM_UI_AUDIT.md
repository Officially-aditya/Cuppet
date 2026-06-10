# Sydney Frontend Premium UI Audit

Date: 2026-06-11
Audience: Product design, visual design, frontend engineering.
Scope: Flutter frontend visual quality, interaction polish, and product feel.

This audit focuses on the "premium feel" layer: consistency, restraint, button language, corners, spacing, hierarchy, trust, and the small details that make the app feel intentional rather than scaffolded.

It does not replace the backend/product gap audit. This document is specifically about the frontend presentation and interaction quality.

## How To Read This As A Designer

You do not need to know Dart or Flutter to use this document.

When you see file paths like `frontend/lib/screens/inbox/inbox_screen.dart`, treat them as implementation notes for engineers. The design issue is explained in normal language before or after each reference.

For design review, focus on these questions:

- Does the screen look like a polished messaging app?
- Is there one clear primary action?
- Are buttons, corners, spacing, icons, and text styles consistent?
- Does the screen feel calm and trustworthy?
- Is anything visible that looks fake, unfinished, or overly technical?
- Would a non-technical user understand what to do within 10 seconds?

The sections marked P0 and P1 are the most important for design quality. P2 and P3 are polish and release-readiness improvements.

## Plain-Language Summary For Design

Sydney should feel like a quiet, premium messaging app where agents are contacts. Right now the app has the right structure, but several details make it feel like a working prototype:

- Some screens use cards where a messaging app would use clean list rows.
- Buttons change shape from screen to screen without a clear reason.
- Some icons are visible but do nothing.
- Some screens still show fake user data.
- The same UI object sometimes has two different designs.
- Loading, empty, and error states are functional but not yet carefully designed.
- The visual system exists, but it does not yet enforce a strong style.

The design goal is not to make the app flashy. The goal is to make it feel intentional, calm, consistent, and trustworthy.

## Basic Design Principles To Apply

These are the simple rules the whole frontend should follow.

| Area | Basic rule | Why it matters |
|---|---|---|
| Visual hierarchy | One screen should have one main action and one clear reading order. | Users should not have to decide what matters. |
| Consistency | The same type of thing should look the same everywhere. | Consistency creates trust and makes the app feel mature. |
| Spacing | Use a predictable spacing rhythm between sections, rows, and controls. | Uneven spacing makes a UI feel accidental. |
| Corners | Rounded corners should have a rule, not be chosen randomly. | Corner consistency is one of the fastest ways to make an app feel premium. |
| Buttons | Button shape, size, and color should communicate importance. | Users learn what is primary, secondary, dangerous, or status-only. |
| Typography | Titles, labels, body text, timestamps, and metadata need distinct roles. | Text hierarchy makes screens scannable. |
| Color | Color should mostly signal action, state, or status. | Too much decorative color weakens the product. |
| Icons | Icons should be familiar, consistent, and functional. | Unclear or dead icons reduce trust. |
| Empty states | Empty screens should guide the user gently. | A blank or generic empty state feels unfinished. |
| Loading states | Loading should match the shape of final content. | Users should feel the app is working, not broken. |
| Error states | Errors should be human, specific, and actionable. | Technical errors make the product feel unsafe. |
| Touch targets | Tappable controls should be large enough to hit comfortably. | Small controls feel cheap and frustrate users. |
| Motion | Motion should explain change, not decorate. | Subtle motion makes the app feel native and alive. |

## Designer Glossary

These terms appear throughout the audit.

| Term | Meaning |
|---|---|
| Component | A reusable piece of UI, like a button, message bubble, input field, or list row. |
| Token | A shared design value, like a color, spacing size, text style, or corner radius. |
| Radius | The roundness of a corner. For example, cards may have 12px corners and pills may be fully rounded. |
| Pill | A fully rounded shape, usually used for chips, compact statuses, or small actions. |
| FAB | Floating Action Button. In this app it is the `New` button floating over the inbox. |
| Skeleton | A placeholder shape shown while content is loading. |
| Empty state | What users see when there is no data yet. |
| Error state | What users see when something fails. |
| Visual grammar | The set of repeated rules that teach users what each shape, color, and layout means. |
| Affordance | A visual clue that something can be tapped, edited, opened, or changed. |
| Chrome | Interface controls around the content, such as app bars, nav bars, borders, and tool buttons. |
| Density | How much content appears in a given area. Messaging apps need enough density to scan conversations. |

## Flutter Terms Translated For Designers

Some findings mention current Flutter component names so engineers can find the issue quickly. Designers can read them as plain UI objects.

| Flutter/code term | Designer translation |
|---|---|
| `FilledButton` | A filled primary-style button. |
| `OutlinedButton` | A secondary button with an outline. |
| `TextButton` | A low-emphasis text-only action. |
| `IconButton` | A tappable icon. |
| `FloatingActionButton` or `FAB` | The floating `New` button. |
| `FilterChip` | A selectable shortcut chip. |
| `SurfaceCard` | A bordered card or panel. |
| `AgentListItem` | The current heavy inbox card row. |
| `AgentTile` | The lighter messaging-style inbox row. |
| `MessageCard` | The current message bubble renderer. |
| `MessageBubble` | An older/alternate message bubble renderer. |
| `SydneyColors` | The shared color palette. |
| `SydneyRadius` | The shared corner-radius scale. |
| `SydneySpacing` | The shared spacing scale. |
| `SydneyTypography` | The shared text style scale. |

## What "Premium" Means For Sydney

For Sydney, premium does not mean glossy, decorative, dark, gradient-heavy, or complicated.

Premium means:

- The app feels quiet and confident.
- The user always knows what to do.
- The UI gets out of the way of the messages.
- No visible element looks fake or unfinished.
- Every repeated pattern has a clear rule.
- The app feels native on Android.
- The messaging model is obvious from the first screen.
- Permission and settings screens feel trustworthy.
- Agent replies and structured messages feel carefully presented.

## Quick Visual Checklist

Use this checklist during a design pass or screenshot review.

- Are all primary buttons the same height and corner radius?
- Are secondary buttons visually quieter than primary buttons?
- Are there any buttons or icons that do nothing?
- Are cards used only where framing adds meaning?
- Does the inbox look like a contact list, not a dashboard?
- Do message bubbles use the same padding, width, and corner logic everywhere?
- Do app bars have consistent title placement and icon treatment?
- Does every screen have one clear first thing to look at?
- Are fake names, fake emails, fake security claims, or placeholder copy gone?
- Do loading states resemble the final layout?
- Do errors tell users what happened and what to do next?
- Are text sizes readable on a small Android phone?
- Are tap targets comfortable?
- Is color being used for action/status rather than decoration?
- Does the app still feel good in grayscale?

## Executive Summary

The Flutter app has the right high-level shape: inbox, threads, create flow, confirmation, connectors, settings, tokens, and message templates. The problem is that the visual system is not strict enough yet. Screens are making local styling decisions instead of using a small set of mature, reusable product components.

The result is a UI that works, but does not yet feel premium.

The biggest issues are:

- Buttons do not follow one visual language.
- Corner radii are chosen case by case instead of semantically.
- Inbox is too card-heavy for a messaging app.
- Multiple duplicate components exist for the same concept.
- Some controls are dead, unclear, or prototype-only.
- Typography is functional but not refined.
- Color usage is calm, but flat and occasionally inconsistent.
- Settings and some copy still expose placeholder/prototype state.
- Loading, empty, error, and motion states are not designed to the product bar.

The fix is not to decorate the app. The fix is to tighten the design system and then refactor screens to use it.

## Reference Product Bar

The product docs define Sydney as a mobile-first agent messaging app, not a dashboard.

Important product principles from the docs:

- The app should feel like WhatsApp, iMessage, Telegram, ChatGPT, Claude, and Gmail in quality.
- The user manages contacts, not automations.
- Minimal chrome, maximum content.
- Agents are contacts.
- Agent output is a message.
- Users should never see infrastructure concepts.
- Every screen should have one primary action.
- Errors should be human and actionable.
- Empty states should be warm.
- Loading states should look designed, not broken.

Relevant source documents:

- `sydney_product.md`
- `sydney_design.md`
- `consumer_agent_delegation_design_doc_v5.md`
- `frontend/.stitch/DESIGN.md`

## Current Strengths

These pieces are worth preserving:

- The app already has centralized colors, spacing, radii, typography, and theme files.
- The core navigation shape exists.
- The thread layout has left agent messages, right user messages, and a fixed reply bar.
- Skeleton loading states exist instead of raw spinners.
- Message template routing exists for several structured output types.
- The palette is mostly calm and restrained.
- The app is already mobile-first and safe-area aware in the main screens.

The issue is consistency and refinement, not a complete lack of direction.

## Severity Guide

- P0: Damages trust or makes the product feel unfinished immediately.
- P1: Creates visible inconsistency or weakens premium feel.
- P2: Polish gap that should be handled before public release.
- P3: Later design refinement.

## P0 Findings

### 1. Button System Is Not Uniform

Current state:

- Global `FilledButton` and `OutlinedButton` use `SydneyRadius.md`.
- Confirm screen overrides primary and secondary buttons to full pill shape.
- Create screen uses a rounded rectangle primary button.
- Reply send button is a circle.
- Connector actions are small pills.
- FAB is a rounded rectangle.
- Text buttons are used for actions that are not always real or primary.

References:

- `frontend/lib/design/app_theme.dart:71`
- `frontend/lib/screens/create/confirm_screen.dart:151`
- `frontend/lib/screens/create/create_screen.dart:183`
- `frontend/lib/widgets/thread/reply_bar.dart:68`
- `frontend/lib/widgets/connectors/connector_list_item.dart:142`
- `frontend/lib/screens/inbox/inbox_screen.dart:62`

Why this hurts premium feel:

Premium interfaces create a predictable visual grammar. A user should subconsciously learn: this shape means primary action, this shape means secondary action, this shape means icon-only utility, this shape means status. Right now, the button shape varies because each screen decided locally.

Recommended system:

| Component | Shape | Height | Use |
|---|---:|---:|---|
| Primary button | 14 radius | 52 | Main screen action |
| Secondary button | 14 radius | 52 | Secondary action |
| Destructive button | 14 radius | 52 | Sign out, delete |
| Icon button | Circle | 44 or 48 | App bar and tools |
| Reply send button | Circle | 48 | Send message only |
| Small status/action pill | Full pill | 36 | Connector state, compact inline actions |
| FAB | 16 radius or circular, choose one | 56 | New agent only |

Rules:

- Do not override button radius at screen level unless it is a semantic component.
- Use full-pill only for compact status or chat-like chips.
- Use one primary action per screen.
- Do not show dead buttons.

### 2. Dead Controls Make The App Feel Like A Prototype

Current state:

- Inbox menu button has no behavior.
- Create screen "More" button has no behavior.
- Confirm screen "More" button has no behavior.
- Create screen "Agent settings > Edit" has no behavior.
- Connectors screen "Connector hub" icon has no behavior.

References:

- `frontend/lib/screens/inbox/inbox_screen.dart:20`
- `frontend/lib/screens/create/create_screen.dart:65`
- `frontend/lib/screens/create/create_screen.dart:157`
- `frontend/lib/screens/create/confirm_screen.dart:39`
- `frontend/lib/screens/connectors/connectors_screen.dart:30`

Why this hurts premium feel:

Dead controls are one of the fastest ways to make a mobile product feel unfinished. A premium product either makes controls work or does not show them.

Recommendation:

- Remove all nonfunctional actions immediately.
- Add actions back only when wired.
- If future placement needs to be reserved, use no visible affordance.

### 3. Settings Contains Placeholder Identity And Fake Trust Signals

Current state:

- Settings shows `John Doe`.
- Settings shows hardcoded email `elementary221b@gmail.com`.
- Settings shows hardcoded initials `EL`.
- Footer says `Sydney Agent v1.2.4` and `Encryption active`.

References:

- `frontend/lib/screens/settings/settings_screen.dart:19`
- `frontend/lib/screens/settings/settings_screen.dart:51`
- `frontend/lib/screens/settings/settings_screen.dart:133`

Why this hurts premium feel:

Trust is central to this app. A settings screen with fake identity and fake operational claims makes the product feel less trustworthy.

Recommendation:

- Bind identity to authenticated user state.
- Remove fake version text until the version comes from app metadata.
- Replace `Encryption active` with truthful copy or remove it.
- Keep settings quiet and factual.

### 4. Inbox Is Too Card-Heavy For A Messaging Product

Current state:

- Inbox uses `AgentListItem`, a bordered card component.
- A better messaging-style `AgentTile` exists but is not used.
- Current card rows show name, preview, description, pin, and large avatar in a framed surface.

References:

- `frontend/lib/screens/inbox/inbox_screen.dart:114`
- `frontend/lib/widgets/inbox/agent_list_item.dart:16`
- `frontend/lib/widgets/inbox/agent_tile.dart:16`

Why this hurts premium feel:

The docs say Sydney should feel like a messaging app, not a productivity dashboard. Messaging apps generally use list rows, separators, timestamps, unread badges, and clear previews. Large bordered cards make the inbox feel like a CRM or dashboard.

Recommendation:

- Use a single inbox row component.
- Prefer `AgentTile` style over `AgentListItem`.
- Include timestamp and unread badge.
- Remove secondary description from default rows unless it is needed for empty/setup state.
- Use subtle row separators instead of card borders.
- Keep Assistant pinned with a small pin/status treatment, not a separate heavy card style.

## P1 Findings

### 5. Radius Tokens Exist But Are Not Semantic Enough

Current state:

Available radii:

- `xs = 4`
- `sm = 8`
- `md = 12`
- `lg = 16`
- `xl = 20`
- `xxl = 28`
- `full = 999`

References:

- `frontend/lib/design/radius.dart:6`
- `frontend/lib/widgets/surface_card.dart:23`
- `frontend/lib/design/app_theme.dart:51`
- `frontend/lib/screens/create/create_screen.dart:276`

Why this hurts premium feel:

Having many radius values is not enough. The design needs semantic radius rules. Without those rules, the app accumulates arbitrary shapes.

Recommended radius language:

| Semantic surface | Radius |
|---|---:|
| Message bubble | 18 with 6 tail corner |
| App card or settings group | 12 |
| Input field | 16 |
| Primary/secondary button | 14 |
| Compact pill | Full |
| Avatar | Circle |
| Icon button touch surface | Circle |
| Bottom nav selected state | Circle or 16, pick one |
| Large illustrative glyph | 20, not 28 unless intentionally soft |

Recommended code direction:

- Replace generic `xs/sm/md/lg` usage in product widgets with semantic names:
  - `SydneyRadius.card`
  - `SydneyRadius.button`
  - `SydneyRadius.input`
  - `SydneyRadius.bubbleAgent`
  - `SydneyRadius.bubbleUser`
  - `SydneyRadius.pill`
  - `SydneyRadius.iconButton`

### 6. Duplicate Message Components Create Visual Drift

Current state:

- `MessageCard` exists and is used by the thread screen.
- `MessageBubble` also exists and has a different style.
- Padding, border, max width, shadow, and system message treatment differ.

References:

- `frontend/lib/screens/thread/thread_screen.dart:119`
- `frontend/lib/widgets/thread/message_card.dart:43`
- `frontend/lib/widgets/thread/message_bubble.dart:46`

Why this hurts premium feel:

The same product object should have one visual treatment. Duplicate implementations create small differences that users feel even if they cannot name them.

Recommendation:

- Choose one message component.
- Delete or retire the other.
- Put template routing inside the chosen message component.
- Define one system-message style.
- Define one bubble max width rule.
- Define one bubble padding rule.

### 7. Duplicate Inbox Components Create Product Ambiguity

Current state:

- `AgentListItem` is a card.
- `AgentTile` is closer to a native messaging row.
- The current inbox uses `AgentListItem`, while the docs point toward `AgentTile`.

References:

- `frontend/lib/widgets/inbox/agent_list_item.dart:16`
- `frontend/lib/widgets/inbox/agent_tile.dart:16`

Recommendation:

- Keep one inbox item component.
- Use the messaging-list style.
- Include timestamp and unread badge.
- Remove heavy borders and card background for normal rows.
- Reserve cards for modals, confirmation, or rich repeated objects where framing is necessary.

### 8. User Bubble Color Token Is Not Consistently Used

Current state:

- `SydneyColors.userBubble` is defined as a soft green.
- `MessageCard` uses `SydneyColors.primary` for user messages instead.

References:

- `frontend/lib/design/colors.dart:33`
- `frontend/lib/widgets/thread/message_card.dart:47`

Why this hurts premium feel:

When tokens are defined but not used, the system loses authority. It also creates a mismatch between design intent and implementation.

Recommendation:

- Decide whether user bubbles are solid primary or soft green.
- If solid primary is correct, change the token.
- If soft green is correct, update `MessageCard`.
- Use token names that express role:
  - `bubbleUser`
  - `bubbleAgent`
  - `bubbleSystem`
  - `bubbleUserText`
  - `bubbleAgentText`

### 9. Typography Is Functional But Not Refined

Current state:

- App uses Roboto.
- Titles are often bold.
- `titleMedium` is 17/700.
- `titleSmall` is 14/700.
- `labelSmall` is 10/700.
- Message body is 14/400.

References:

- `frontend/lib/design/typography.dart:8`
- `frontend/lib/design/typography.dart:29`
- `frontend/lib/design/typography.dart:35`
- `frontend/lib/design/typography.dart:47`
- `frontend/lib/design/typography.dart:71`

Why this hurts premium feel:

Roboto is safe, but the current hierarchy is more utilitarian than premium. Too many bold labels make screens feel heavy. Very small labels can feel cramped and less accessible.

Recommendation:

- Keep Roboto for now unless we intentionally add another font.
- Reduce boldness in dense rows.
- Increase message body to 15 if screenshots show it feeling small.
- Avoid 10px labels except tiny metadata.
- Add semantic text styles:
  - `agentName`
  - `messagePreview`
  - `timestamp`
  - `messageBody`
  - `sectionLabel`
  - `buttonLabel`
  - `metadata`

### 10. App Bar Hierarchy Is Inconsistent

Current state:

- Inbox title is `Inbox`, but docs say primary app title should be `Sydney`.
- Connectors screen has an app bar title and then repeats `Connectors` as a large display heading.
- Thread app bar uses avatar/name/status, which is appropriate.
- Some app bars are centered, others are not.

References:

- `frontend/lib/screens/inbox/inbox_screen.dart:25`
- `frontend/lib/screens/connectors/connectors_screen.dart:24`
- `frontend/lib/screens/connectors/connectors_screen.dart:63`
- `frontend/lib/screens/thread/thread_screen.dart:40`

Recommendation:

- Define a `SydneyAppBar` pattern.
- Inbox: title `Sydney`, actions only.
- Thread: contact identity app bar.
- Form/detail screens: centered title only if modal-like.
- Avoid duplicating page title below app bar unless the screen is intentionally content-led.

### 11. The Connector Screen Feels More Like A Settings Page Than A Premium Flow

Current state:

- The screen starts with a large `Connectors` heading after the app bar.
- Connector rows are cards with icons and button states.
- Status labels differ from the copy in the design doc.
- `Review`, `Opening`, and `Link` are visually similar but semantically different.

References:

- `frontend/lib/screens/connectors/connectors_screen.dart:63`
- `frontend/lib/widgets/connectors/connector_list_item.dart:44`
- `frontend/lib/widgets/connectors/connector_list_item.dart:121`

Why this hurts premium feel:

Connector approval should feel trustworthy and precise. Right now it is serviceable, but it lacks the calm, security-oriented finish the product needs.

Recommendation:

- Treat each connector as a permission row.
- Use consistent status language:
  - Connected
  - Not connected
  - Needs review
  - Opening...
- Show scopes only when expanded or during approval.
- Use one status pill style.
- Remove nonfunctional connector hub action.

### 12. Reply Bar Is Close But Needs Polish

Current state:

- Reply input is full pill with a separate circular send button.
- Send button is 40x40.
- Loading state uses `more_horiz`.

References:

- `frontend/lib/widgets/thread/reply_bar.dart:42`
- `frontend/lib/widgets/thread/reply_bar.dart:68`
- `frontend/lib/widgets/thread/reply_bar.dart:77`

Why this hurts premium feel:

The reply bar is one of the most-used surfaces in the product. It should feel extremely deliberate.

Recommendation:

- Make send button 48x48 for touch target consistency.
- Use a clear loading affordance, not `more_horiz`.
- Consider disabled send state when input is empty.
- Add subtle input focus state.
- Keep visual weight low so thread content remains dominant.

### 13. Bottom Navigation Is Prototype-Like

Current state:

- Bottom nav has fixed icons.
- One tab routes to `Research Scout` fallback.
- The selected state is a soft circle.
- Tab semantics are not clearly aligned to the product's core model.

References:

- `frontend/lib/widgets/app_bottom_nav.dart:21`
- `frontend/lib/screens/inbox/inbox_screen.dart:78`

Why this hurts premium feel:

Messaging apps often do not need a full bottom nav if the main model is an inbox and threads. A bottom nav with fake tabs makes the app feel scaffolded.

Recommendation:

- Re-evaluate whether bottom nav is needed for MVP.
- If retained, make tabs real:
  - Inbox
  - Activity or Runs
  - Connectors
  - Settings
- Remove Research Scout fallback.
- Use consistent selected treatment with the rest of the icon button system.

## P2 Findings

### 14. SurfaceCard Is Too Generic

Current state:

- `SurfaceCard` uses `SydneyRadius.sm`.
- It has a border but no shadow/elevation distinction.
- Tappable and non-tappable cards look mostly identical.

References:

- `frontend/lib/widgets/surface_card.dart:5`
- `frontend/lib/widgets/surface_card.dart:23`

Why this matters:

Premium interfaces use depth sparingly but clearly. A card should communicate why it is framed. Right now `SurfaceCard` is used broadly, which makes pages feel boxed.

Recommendation:

- Split into semantic components:
  - `SydneyCard`
  - `SydneyActionCard`
  - `SydneySettingsGroup`
  - `SydneyListRow`
  - `SydneyConfirmationPanel`
- Use cards only when framing adds meaning.

### 15. Loading States Are Designed But Too Static

Current state:

- Inbox and thread use static skeleton blocks.
- App loading uses a linear progress indicator.
- No shimmer or subtle content-aware placeholder motion.

References:

- `frontend/lib/screens/inbox/inbox_screen.dart:156`
- `frontend/lib/screens/thread/thread_screen.dart:157`
- `frontend/lib/app.dart:158`

Recommendation:

- Use lightweight skeleton shimmer or fade pulse.
- Match skeleton shapes to final components.
- Avoid progress bars unless there is real progress.

### 16. Error States Need Product-Level Treatment

Current state:

- Several screens render `error.toString()`.
- Error screens are sparse and not visually unified.

References:

- `frontend/lib/screens/inbox/inbox_screen.dart:55`
- `frontend/lib/screens/thread/thread_screen.dart:123`
- `frontend/lib/screens/connectors/connectors_screen.dart:43`
- `frontend/lib/screens/create/confirm_screen.dart:201`

Recommendation:

- Create one `SydneyErrorState`.
- Accept a human message, optional detail, and retry action.
- Do not render raw exceptions.
- Use calm, specific copy.

### 17. Empty States Are Not Warm Enough

Current state:

- If agents are empty, inbox shows Assistant fallback.
- There is no strong warm invitation matching the design doc.

References:

- `frontend/lib/screens/inbox/inbox_screen.dart:102`

Recommendation:

- Add an empty state below Assistant:
  - Title: `Start with one sentence`
  - Body: `Create an agent for something you want watched, summarized, or prepared.`
  - Action: `New`
- Keep it quiet and uncarded.

### 18. Motion System Is Underused

Current state:

- `FadeSlideIn` exists.
- Most route transitions use default `MaterialPageRoute`.
- Most list updates appear without custom motion.

References:

- `frontend/lib/design/animations.dart:19`
- `frontend/lib/app.dart:73`

Recommendation:

- Define route transitions for:
  - Inbox to thread
  - Create to confirm
  - Confirm to new thread
- Animate new messages into thread.
- Animate realtime inbox updates subtly.
- Keep all durations under 360ms.

### 19. Icon Language Is Not Fully Consistent

Current state:

- Icons are mostly Material icons.
- Similar actions use different concepts:
  - Connectors is sometimes hub, sometimes shield.
  - Settings is gear or info depending on screen.
  - More buttons exist without purpose.

References:

- `frontend/lib/screens/inbox/inbox_screen.dart:35`
- `frontend/lib/screens/thread/thread_screen.dart:86`
- `frontend/lib/screens/thread/thread_screen.dart:92`
- `frontend/lib/screens/connectors/connectors_screen.dart:33`

Recommendation:

- Create an icon map:
  - Connectors: one icon everywhere.
  - Settings: one icon everywhere.
  - Agent info: separate icon if needed.
  - Security/permissions: shield only where the action is truly permissions-related.

### 20. Create Screen Feels Like A Form, Not A Magical One-Sentence Flow

Current state:

- Default prompt is long and calendar-specific.
- Large robot glyph is playful but generic.
- Capability chips append text directly to the prompt.
- Agent settings card includes static lines and dead edit button.

References:

- `frontend/lib/screens/create/create_screen.dart:27`
- `frontend/lib/screens/create/create_screen.dart:83`
- `frontend/lib/screens/create/create_screen.dart:132`
- `frontend/lib/screens/create/create_screen.dart:226`

Recommendation:

- Start with an empty prompt or a subtle example.
- Use template shortcuts as prompt starters, not text append hacks.
- Remove static settings card until it reflects parsed backend intent.
- Make review feel like a clean confirmation, not a form step.

### 21. Confirmation Screen Feels Generic And Static

Current state:

- Shows hardcoded Sydney avatar and name.
- Shows hardcoded calendar bullets.
- Shows hardcoded Calendar/Notes access.
- Uses two full-width pill buttons.

References:

- `frontend/lib/screens/create/confirm_screen.dart:57`
- `frontend/lib/screens/create/confirm_screen.dart:90`
- `frontend/lib/screens/create/confirm_screen.dart:114`
- `frontend/lib/screens/create/confirm_screen.dart:151`

Recommendation:

- Use backend parsed intent:
  - Agent name
  - Avatar/icon
  - Runs
  - Does
  - Needs
  - Sends
- Use one primary button and one quieter secondary action.
- Avoid showing unsupported permissions.

## P3 Findings

### 22. Palette Needs More Semantic Roles

Current state:

- Palette is calm but mostly neutral/green.
- Some colors are role-based, some are Material-derived.

References:

- `frontend/lib/design/colors.dart:6`

Recommendation:

Add semantic roles:

- `backgroundApp`
- `backgroundElevated`
- `borderSubtle`
- `borderStrong`
- `textPrimary`
- `textSecondary`
- `textTertiary`
- `actionPrimary`
- `actionPrimaryPressed`
- `statusSuccess`
- `statusWarning`
- `statusDanger`
- `statusInfo`
- `bubbleUser`
- `bubbleAgent`
- `bubbleSystem`

Then update widgets to use semantic colors rather than raw role guesses.

### 23. Visual Depth Is Too Flat

Current state:

- Cards use borders but no consistent shadow.
- Bubbles use a very subtle shadow in `MessageCard`.
- Other surfaces do not share a depth language.

References:

- `frontend/lib/widgets/thread/message_card.dart:51`
- `frontend/lib/widgets/surface_card.dart:27`

Recommendation:

- Use depth sparingly:
  - Normal list rows: no shadow.
  - Cards: border only or tiny shadow, not both everywhere.
  - FAB: shadow allowed.
  - Bottom bars: top border, no heavy shadow.
- Add `SydneyShadows` tokens if shadows are used.

### 24. Accessibility And Touch Targets Need A Pass

Current state:

- Reply send button is 40x40.
- Some tiny labels are 10px.
- Some icon buttons are visible but not meaningful.

References:

- `frontend/lib/widgets/thread/reply_bar.dart:68`
- `frontend/lib/design/typography.dart:71`

Recommendation:

- Minimum touch target should generally be 44 to 48.
- Avoid text below 11 to 12 except rare metadata.
- Make tooltips and semantics meaningful.
- Disable or hide unavailable actions.

## Screen-By-Screen Polish Notes

### Inbox

Main problems:

- Title says `Inbox`, not `Sydney`.
- Menu icon is dead.
- Rows are heavy cards.
- Current row does not show timestamp.
- Current row shows both last message and description, making the row noisy.
- FAB and bottom nav compete for attention.

Recommended direction:

- App bar: `Sydney`, connectors icon, settings icon.
- Rows: avatar, agent name, timestamp, last message, unread badge.
- Assistant pinned but visually integrated.
- Remove bottom nav unless every tab is real.
- Use row separators, not cards.

### Thread

Main problems:

- Message component duplication.
- Send button is undersized.
- Loading/error states are not premium.
- Thread does not visually distinguish agent status changes beyond app bar text.
- No timestamp rendering on messages yet.

Recommended direction:

- One message bubble component.
- Add timestamps or grouped timestamp separators.
- Add incoming message animation.
- Use a 48x48 send button.
- Add consistent system message style.

### Create Agent

Main problems:

- Feels form-like.
- Default text is too specific.
- Settings card is static and not useful.
- Capability chips mutate prompt text directly.
- More/Edit controls are dead.

Recommended direction:

- Empty text field with strong example prompt.
- Shortcut chips fill prompt or set draft metadata.
- No static settings card.
- Continue button only after meaningful input.
- Review screen should be generated from parsed backend intent.

### Confirm Agent

Main problems:

- Static content.
- Wrong agent identity.
- Wrong permissions.
- Button styles inconsistent.

Recommended direction:

- Dynamic confirmation card:
  - Name
  - Runs
  - Does
  - Needs
  - Sends
- Use one primary action.
- Use secondary text or outlined action with the same radius system.

### Connectors

Main problems:

- Repeated heading.
- Nonfunctional hub action.
- Status copy inconsistent with docs.
- Permission details are not presented with enough precision.

Recommended direction:

- Security-oriented permission list.
- One status pill system.
- Expandable details for scopes.
- No action icon unless it works.

### Settings

Main problems:

- Placeholder user info.
- Fake version/security text.
- Push toggle looks functional even though Firebase is postponed.

Recommended direction:

- Real user profile data.
- Disable or hide push setting until configured.
- Honest build/version metadata only.
- Keep layout quiet and factual.

## Recommended Component System

Create these components before deeper screen polish:

### `SydneyPrimaryButton`

Use for one primary action on a screen.

Rules:

- Height 52.
- Radius 14.
- Primary green fill.
- White text.
- Optional leading icon only if it clarifies action.
- Loading state built in.

### `SydneySecondaryButton`

Use for secondary actions.

Rules:

- Height 52.
- Radius 14.
- Transparent or white background.
- Border subtle.
- Primary or ink text.

### `SydneyDestructiveButton`

Use for delete/sign out.

Rules:

- Height 52.
- Radius 14.
- No accidental full red fill unless final confirmation.
- Use danger text or subtle danger background.

### `SydneyIconButton`

Use for app bar and compact tools.

Rules:

- 44 or 48 touch target.
- Circular.
- One color rule.
- Disabled/hidden if unavailable.

### `SydneyListRow`

Use for inbox and settings rows.

Rules:

- No card border by default.
- Optional separator.
- 56 to 72 height depending content.
- Avatar/icon leading area fixed.
- Text hierarchy consistent.
- Optional trailing action/status.

### `SydneyMessageBubble`

Use for all thread messages.

Rules:

- Max width 82 percent.
- Agent and user colors from tokens.
- Tail-side bottom corner reduced.
- Consistent padding.
- Optional timestamp.
- Template content rendered inside.

### `SydneySystemPill`

Use for system messages.

Rules:

- Centered.
- Compact.
- Muted background.
- No heavy card border unless action required.

### `SydneyTextField`

Use for auth, create, reply where possible.

Rules:

- Consistent radius.
- Consistent border/focus state.
- Consistent label/hint behavior.
- Multi-line variant for create prompt.

## Proposed Design Tokens In Designer Terms

This section describes the shared visual rules designers and engineers should agree on. Engineers can translate these into Flutter code after the design rules are approved.

### Corner Radius Rules

The app should not use random corner sizes. Each kind of surface should have a consistent corner shape.

| UI element | Recommended corner | Designer note |
|---|---:|---|
| Message bubble | 18px, with the tail-side bottom corner at 6px | Gives chat bubbles a familiar messaging shape. |
| Cards and settings groups | 12px | Calm, modern, not too soft. |
| Text fields | 16px | Friendly and easy to recognize as input areas. |
| Main buttons | 14px | Premium rounded rectangle, not too pill-like. |
| Compact chips/status pills | Fully rounded | Good for short labels like `Connected` or `Ready`. |
| Avatars | Circle | Contacts should feel like people/agents. |
| App bar icon buttons | Circle | Common mobile pattern. |
| Large decorative glyphs | 20px maximum | Avoid overly soft toy-like shapes. |

Designer decision needed:

- Should Sydney's primary buttons be softly rounded rectangles or full pills? Recommendation: rounded rectangles for main actions, full pills only for compact chips and statuses.

### Spacing Rules

Spacing should feel calm and repeatable. The app should use a clear rhythm instead of one-off margins.

| Spacing use | Recommended value | Designer note |
|---|---:|---|
| Screen left/right padding | 20px | Already feels good on mobile. |
| Small gap between related items | 8px | Example: title to subtitle. |
| Normal gap between controls | 12px | Example: input to helper text. |
| Row internal padding | 16px | Comfortable touch area. |
| Section gap | 24px | Separates major screen groups. |
| Large top/bottom breathing room | 32px | Use sparingly for auth/create screens. |
| App bar height | 64px | Current height is acceptable. |
| Bottom nav/reply area | 72px plus safe area | Should feel stable and easy to tap. |

Basic rule:

- Related things should be close together.
- Unrelated sections need more space.
- Spacing should not change randomly between screens.

### Typography Rules

The app needs named text roles, not just font sizes.

| Text role | Suggested use | Designer note |
|---|---|---|
| App title | `Sydney`, auth title, major page title | Use sparingly. |
| Screen title | Create account, Connectors, Settings | Should not compete with app bar. |
| Agent name | Inbox rows and thread headers | Strong but not oversized. |
| Message body | Chat bubble text | Needs excellent readability. |
| Message preview | Inbox last-message preview | Softer than agent name, easy to scan. |
| Timestamp | Inbox/thread metadata | Small but readable. |
| Section label | Settings groups, connector sections | Use restrained color and weight. |
| Button label | All buttons | Consistent weight and size. |
| Helper/error text | Form hints and validation | Human, direct, not too small. |

Designer decision needed:

- Keep Roboto for now or choose a more distinctive product font later. Recommendation: keep Roboto until the product shape stabilizes, then revisit typography as a brand pass.

### Color Rules

The palette should remain restrained. Color should mostly explain state and action.

| Color role | Use |
|---|---|
| App background | Main screen background. |
| Elevated surface | Cards, input fields, message bubbles. |
| Subtle border | Separators and low-emphasis outlines. |
| Primary action | Main buttons and active states. |
| Primary soft | Selected nav/chip backgrounds. |
| Danger | Delete, failed, destructive warnings. |
| Warning | Needs review, attention required. |
| Info | Neutral system information. |
| User bubble | User messages only. |
| Agent bubble | Agent messages only. |
| System bubble | Internal app messages only. |

Basic rule:

- If everything is green, nothing feels important.
- Use green for primary actions and success-like states.
- Use warm neutral surfaces for calm.
- Use red/yellow/blue only for actual status meaning.

### Shadow And Depth Rules

Sydney should not feel flat, but it also should not look like a stack of floating cards.

| Surface | Depth recommendation |
|---|---|
| Inbox rows | No shadow, subtle separator. |
| Message bubbles | Very subtle shadow only if needed. |
| Confirmation card | Border plus optional soft shadow. |
| FAB | Shadow allowed. |
| Bottom bars | Top border, no heavy shadow. |
| Settings groups | Border or subtle fill, not heavy elevation. |

Basic rule:

- Use depth to show importance or layering.
- Do not use shadows as decoration.

### Component Naming For Engineers

Designers do not need to implement these names, but this is the component set engineering should build from the design rules:

| Design concept | Engineering component |
|---|---|
| Main button | `SydneyPrimaryButton` |
| Secondary button | `SydneySecondaryButton` |
| Icon-only button | `SydneyIconButton` |
| Inbox row | `SydneyListRow` or `AgentRow` |
| Message bubble | `SydneyMessageBubble` |
| System pill | `SydneySystemPill` |
| Text field | `SydneyTextField` |
| Loading placeholder | `SydneySkeleton` |
| Error block | `SydneyErrorState` |

## Implementation Plan

### Phase 1: Stop The Prototype Feel

Goal: remove the obvious unfinished signals.

Tasks:

- Remove all dead app bar/menu/more/edit controls.
- Replace hardcoded settings identity.
- Disable or hide push notifications until Firebase is configured.
- Change inbox title to `Sydney`.
- Remove Research Scout bottom-nav fallback.
- Stop rendering raw `error.toString()` in UI.

Expected result:

The app immediately feels more trustworthy.

### Phase 2: Create The Premium Component Layer

Goal: prevent new inconsistencies.

Tasks:

- Add button components.
- Add semantic radius tokens.
- Add one list-row component.
- Add one message-bubble component.
- Add one error-state component.
- Add one loading/skeleton component.
- Add one system-pill component.

Expected result:

Screens stop inventing their own shapes.

### Phase 3: Refactor The Core Screens

Goal: align the main product loop with the docs.

Tasks:

- Refactor inbox to messaging rows.
- Refactor thread to one bubble system.
- Refactor reply bar touch target and loading state.
- Refactor create screen to remove static settings card.
- Refactor confirm screen to dynamic intent-based UI.

Expected result:

The product starts feeling like an intentional messaging app.

### Phase 4: Add Motion And State Polish

Goal: make the app feel alive without being flashy.

Tasks:

- Add route transitions for inbox-to-thread and create-to-confirm.
- Animate new messages.
- Add subtle skeleton shimmer or pulse.
- Add focused input transitions.
- Add realtime inbox row update animation.

Expected result:

The UI feels smoother and more native.

### Phase 5: Final Pre-Release Polish

Goal: polish details users notice unconsciously.

Tasks:

- Tune typography after emulator screenshots.
- Tune color contrast and surface depth.
- Confirm all touch targets.
- Verify every empty/loading/error state.
- Remove unused duplicate components.
- Run screenshots on small and large Android viewports.

Expected result:

The frontend is ready to be judged as a consumer app, not a development scaffold.

## Acceptance Checklist

Before calling the UI premium enough for MVP:

- No visible dead buttons.
- No placeholder identity.
- No fake claims.
- No raw technical errors.
- Inbox looks like a messaging contact list.
- Assistant is pinned and visually integrated.
- Every button shape has a semantic reason.
- Primary actions are visually consistent.
- Message bubbles use one component.
- Inbox rows use one component.
- Reply send button has a proper touch target.
- Settings has real user/session state.
- Push controls do not appear functional until configured.
- Loading states match final layout shapes.
- Empty states are warm and useful.
- Text does not overflow in common mobile widths.
- No screen has competing primary actions.
- All route transitions feel native and quick.

## Bottom Line

The current frontend is a strong functional scaffold, but not yet a premium app. The main issue is not lack of decoration. It is lack of a strict visual contract.

The next UI push should focus on consistency first:

1. Remove prototype artifacts.
2. Define semantic components.
3. Refactor inbox and thread around those components.
4. Make create/confirm dynamic and trustworthy.
5. Add motion and state polish.

After that, the product will feel much closer to the original Sydney design direction: simple, calm, attractive, and intentionally built around agents as trusted contacts.
