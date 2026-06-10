# Google Stitch Design Brief: Sydney

Design from the repository as the source of truth. Do not invent product names, claims, labels, sample data, or placeholder sections. If a phrase, value, status, field, or feature does not appear in this repo, it should not appear in the design.

## Product Purpose

Sydney is a mobile-first Flutter frontend for an AI delegation messaging app.

Use the README description as the primary product framing:

- Product name: Sydney
- README lead: "Mobile-first Flutter frontend scaffold for Sydney, an AI delegation messaging app."
- Pubspec description: "Mobile-first AI delegation messaging app frontend."
- In-app sign-in tagline: "Delegate work through conversations with agents you trust."

The product is not a generic chatbot, landing page, or dashboard. It is a conversation-first agent inbox where users create agents from one sentence, approve connectors later, and receive structured agent outputs inside message threads.

## Repository Goals and Constraints

Use these repo-defined goals as design constraints:

- Frontend only.
- Backend APIs are assumed to exist over REST and WebSocket.
- The app stores only the Sydney session token in `flutter_secure_storage`.
- Connector OAuth is initiated in-app, but connector tokens must remain backend-owned.
- Agent outputs are rendered as structured messages.
- Android should be treated as the first target.

Do not show backend administration, analytics dashboards, pricing, generic marketing testimonials, or broad AI automation claims. The existing product intent is lightweight, mobile-first delegation through messages.

## Critical Files

Read these files before designing:

- `README.md`: product scope, setup, security and connector constraints.
- `pubspec.yaml`: app metadata and dependencies.
- `lib/app.dart`: app title, auth gate, route errors, loading state.
- `lib/design/tokens.dart`: canonical colors, typography, radius, spacing, and Material theme.
- `lib/config/routes.dart`: app screens and route names.
- `lib/config/env.dart`: runtime config names and mock-data behavior.
- `lib/models/agent.dart`: agent fields, availability states, inbox sorting.
- `lib/models/message.dart`: sender, delivery state, content template, preview behavior.
- `lib/models/connector.dart`: connector status model and approved scopes.
- `lib/services/agent_service.dart`: mock agents, API paths, creation behavior, error copy.
- `lib/services/message_service.dart`: mock threads, structured message content, API paths.
- `lib/services/connector_service.dart`: mock connectors, OAuth behavior, backend-owned token model.
- `lib/screens/inbox/inbox_screen.dart`: primary screen, top actions, empty/warm invitation, FAB.
- `lib/screens/thread/thread_screen.dart`: conversation layout and live-update behavior.
- `lib/screens/create/create_screen.dart`: one-sentence agent creation flow and shortcut labels.
- `lib/screens/create/confirm_screen.dart`: review flow and connector approval copy.
- `lib/screens/connectors/connectors_screen.dart`: connector approval UI and status labels.
- `lib/screens/settings/settings_screen.dart`: settings actions and privacy copy.
- `lib/widgets/thread/message_bubble.dart`: template router and bubble layout.
- `lib/widgets/templates/*.dart`: structured message templates.

## Native Product Shape

Organize the design around the app's native structure:

1. Inbox of agents.
2. Conversation thread.
3. One-sentence agent creation.
4. Confirmation/review.
5. Connectors and settings.

The README leads with "AI delegation messaging app", so the conversation and agent inbox must dominate the first screen. Supporting content should explain or expose connector approval, session storage, and structured message outputs only after the messaging surface is established.

## Primary Screen Direction

Start with the Sydney inbox, not a marketing hero.

The primary screen should show:

- App bar title: "Sydney"
- Top actions: "Connectors" and "Settings" as icon actions.
- FAB label: "New"
- Agent rows using real mock agents:
  - Assistant, initials S, "Your home base for delegation.", "I can help you turn a sentence into a useful agent."
  - Ops Watch, initials OW, "Tracks deadlines and flags anything slipping.", "Two items need attention before Friday."
  - Research Scout, initials RS, "Collects weekly market notes.", "I summarized the latest category shifts."
- Empty/warm invitation copy when needed:
  - "Start with one sentence"
  - "Create an agent for something you want watched, summarized, or prepared."

Use unread count, pinned assistant priority, timestamps, avatar initials, and agent accent colors as meaningful interface signals.

## Core Flows and Copy

Use only repo-backed copy and terminology.

Authentication:

- "Sydney"
- "Delegate work through conversations with agents you trust."
- "Email"
- "Password"
- "Sign in"
- "Create an account"
- "Create your Sydney account"
- "Your agents stay in conversation threads. Connectors are approved later, one by one."

Create agent:

- "New agent"
- "What should this agent handle?"
- "Use one direct sentence. You can adjust details before creating it."
- Hint: "Watch my customer escalations and brief me each morning."
- Error: "Write one sentence before continuing."
- Button: "Review agent"
- Shortcuts: "Summarize", "Track progress", "Flag urgency", "Checklist"
- Shortcut guidance:
  - "Best for digesting emails, notes, channels, or recurring updates."
  - "Best for projects, deadlines, approvals, and recurring check-ins."
  - "Best for priority lists, escalations, risks, and fast triage."
  - "Best for repeatable routines where every step should be visible."

Confirm agent:

- "Confirm"
- "This agent will start simple"
- "You can add connectors after it exists. Sydney only asks for access when it is needed."
- "What it does"
- "When it runs"
- "When new approved context arrives, plus whenever you message it."
- "What it needs"
- "Create agent"
- "Edit sentence"

Thread:

- Availability labels: "Working", "Ready"
- Reply placeholder: "Message agent"
- System copy: "Assistant is pinned so you always have a place to start."
- Assistant copy: "Tell me what you want watched, summarized, reminded, or prepared. One sentence is enough."

Connectors:

- "Connectors"
- "Connectors are approved here, but tokens stay with the backend."
- Status labels: "Connected", "Not connected", "Needs review", "Opening OAuth"
- Actions: "Link", "Opening..."
- Real connectors:
  - Gmail: "Let agents read approved mailbox context through the backend."
  - Google Calendar: "Use availability and upcoming events when you approve it."
  - Slack: "Watch selected channels and prepare concise updates."
- Real scopes:
  - "Read selected email metadata"
  - "Draft replies"
  - "Read events"
  - "Create reminders"
  - "Read selected channels"
  - "Post drafts for approval"

Settings:

- "Settings"
- "Push notifications"
- "Enable message and agent status alerts."
- "Connectors"
- "Review accounts approved for backend access."
- "Session storage"
- "This app stores only your Sydney session token on device."
- "Sign out"

## Structured Message Templates

Show structured agent outputs as message content, not as independent dashboard widgets.

Supported templates from `lib/models/message.dart` and `lib/widgets/templates`:

- `plain_text`: text/body message content.
- `progress_tracker`: title, progress bar, "$current of $total complete", steps with done states.
- `urgency_list`: title, urgency dots, item label, optional due date.
- `data_summary`: title, summary, metric pills with label/value.
- `checklist`: title, checked/unchecked items.
- `streak_counter`: label, count, unit, caption.
- `system`: centered system update.

Use real mock message content:

- "Agent setup guide"
- "2 of 4 complete"
- "Describe the job"
- "Review the plan"
- "Connect tools"
- "Start receiving updates"
- "Needs attention"
- "Approve vendor renewal"
- "Send launch notes to support"
- "Today"
- "Tomorrow"
- "Launch handoff"
- "Draft owner notes"
- "Confirm support coverage"
- "Share customer list"
- "Market pulse"
- "Demand is shifting toward lighter setup and clearer privacy controls."
- "Sources checked" / "18"
- "Strong signals" / "5"
- "Noise filtered" / "42%"
- "Delegation streak"
- "3 days"
- "Small, steady handoffs build trust."

## Visual Identity

Inherit the existing design system from `lib/design/tokens.dart`.

Colors:

- Ink: `#17201C`
- Muted ink: `#66736D`
- Subtle ink: `#8B9691`
- Surface: `#FCFCFA`
- Warm surface: `#F6F2EA`
- Raised surface: `#FFFFFF`
- Line: `#E7E4DD`
- Primary: `#1D7A5C`
- Primary soft: `#E4F3EC`
- Agent bubble: `#FFFFFF`
- User bubble: `#DDF4E8`
- System bubble: `#F1EEE8`
- Danger: `#C84A3D`
- Danger soft: `#FCE9E6`
- Warning: `#C07A22`
- Warning soft: `#FFF3D8`
- Info: `#356C91`
- Info soft: `#E5F1F7`

Typography:

- Font family: Roboto.
- Display small: 30px, 700, 1.12 line height.
- Headline small: 22px, 700, 1.2 line height.
- Title large: 18px, 700, 1.25 line height.
- Title medium: 16px, 700, 1.28 line height.
- Body large: 16px, 400, 1.45 line height.
- Body medium: 14px, 400, 1.4 line height.
- Body small: 12px, 500, 1.35 line height.
- Label large: 14px, 700, 1.2 line height.
- Label medium: 12px, 700, 1.2 line height.

Spacing:

- `xxs`: 2
- `xs`: 4
- `sm`: 8
- `md`: 12
- `lg`: 16
- `xl`: 24
- `xxl`: 32
- `page`: 20

Radius:

- `xs`: 6
- `sm`: 8
- `md`: 14
- `lg`: 20
- `full`: 999
- Agent and user bubbles use asymmetric rounded corners, with the tail-side bottom corner reduced to 6.

Component patterns:

- Mobile-first Material 3.
- Warm off-white app background.
- Raised white cards with thin `#E7E4DD` borders.
- Green primary filled actions.
- Rounded text inputs with white fill and focused green border.
- Choice chips with soft green selected state.
- Agent/user bubbles with structured content inside.
- System messages as compact centered pills.
- Icon buttons for Connectors, Settings, send, and navigation actions.

## Layout Requirements

Prioritize a realistic mobile app composition:

- Portrait-first layout.
- Use safe-area spacing.
- Use an inbox list rather than card-heavy marketing sections.
- Show message bubbles at no more than roughly 82% of screen width.
- Keep the reply bar fixed to the bottom of the thread.
- Keep connector tokens/backend ownership visible in copy but not over-explained.
- Make structured message templates legible inside bubbles.
- Use chips only for shortcuts and connector scopes.

## What Not To Show

Do not show:

- Placeholder names like "Jane Doe", "Acme", or "Lorem ipsum".
- Product claims not in the repo.
- A website landing page as the first screen.
- Pricing, testimonials, enterprise logos, or generic AI feature grids.
- Backend token storage UI, since connector tokens stay backend-owned.
- Generic web manifest copy such as "A new Flutter project."
- Any unsupported message template types.

## Design Goal

Create a polished mobile-first Sydney interface that feels like a quiet, trustworthy delegation inbox. The first impression should communicate: open Sydney, see your agents, read structured updates, and create a new agent from one direct sentence.
