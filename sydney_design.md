# Sydney - Design Document
### Internal alias: Sydney | Version 1.0
### Reference this when designing or building UI. Contains screens, design tokens, template system, and MVP plan.

---

## 7. UI and Design

### 7.1 Design direction
Sydney should feel like a messaging app, not a productivity tool.

Reference: WhatsApp, iMessage, Telegram - calm, fast, familiar, trustworthy.
Not: Notion, Linear, Zapier, or any dashboard-first product.

The user manages contacts, not automations.

### 7.2 Visual language
- clean white or near-white surfaces,
- rounded message bubbles,
- contact avatar per agent (emoji or generated icon),
- large readable typography,
- unread indicators like a messaging app,
- minimal chrome, maximum content,
- restrained color palette - color used only for status signals.

### 7.3 Primary screens

#### Inbox (home screen)
Agent contact list sorted by most recent message. The Assistant contact is always at the top or pinned.

```
┌─────────────────────────────────────────┐
│  Sydney                       + New     │
├─────────────────────────────────────────┤
│ 🤖  Assistant                     now   │
│     Hey! I'm Sydney. Ask me anything…  │
├─────────────────────────────────────────┤
│ 📧  Email Digest                  6:00pm│
│     47 emails today, 6 need att…   ●●  │
├─────────────────────────────────────────┤
│ 📰  Tech News                     7:02am│
│     Morning brief: 8 stories today…    │
├─────────────────────────────────────────┤
│ 💬  Slack Watcher                 2:31pm│
│     Urgent: 2 messages flagged…    ●   │
├─────────────────────────────────────────┤
│ 📄  Drive Summary                 Friday│
│     3 files changed this week…         │
└─────────────────────────────────────────┘
```

#### Assistant contact (pre-installed, always present)
The Assistant contact is pre-installed at sign-up. It sends a welcome message immediately:

```
🤖 Assistant                         just now

Hey! I'm Sydney.

I can chat with you like Claude or
ChatGPT - just ask me anything.

But the real magic is agents. Try:

  "deliver me tech news at 7am daily"

and I'll create an agent that messages
you every morning. ✨

What would you like to do?
```

The Assistant handles:
- general chat (plain AI conversation),
- connected chat (live data from connected services),
- onboarding guidance for new users,
- answering questions about Sydney's capabilities.

When services are connected, the Assistant becomes dramatically more powerful:
```
User:       what important emails did I miss today?
Assistant:  [fetches Gmail via MCP]
            You missed 6 important emails:
            → Alice re: Q3 budget (2hrs ago)
            → Stripe invoice ready
            → Team standup notes from Bob
            → 3 others flagged as important
```

#### Agent chat thread
Tapping any agent opens its chat thread. Agent messages on the left, user replies on the right. Full history of everything the agent has sent and the user has replied.

```
┌─────────────────────────────────────────┐
│ ←  📧 Email Digest           Active  ⋮  │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────────────────────┐   │
│  │ Here's your email digest for    │   │
│  │ Tuesday 13 May.                 │   │
│  │                                 │   │
│  │ 47 emails · 6 need attention    │   │
│  │                                 │   │
│  │ → Alice: Q3 budget review       │   │
│  │ → Team standup notes            │   │
│  │ → Stripe invoice #4521          │   │
│  │   ...and 3 more                 │   │
│  └──────────────────────────────────┘   │
│  6:00 PM                                │
│                                         │
│            Filter out newsletters  ───► │
│                                 6:03PM  │
│  ┌──────────────────────────────────┐   │
│  │ Got it. Excluding newsletters   │   │
│  │ from tomorrow's digest onwards. │   │
│  └──────────────────────────────────┘   │
│  6:03 PM                                │
│                                         │
├─────────────────────────────────────────┤
│  Reply to Email Digest…        [Send]   │
└─────────────────────────────────────────┘
```

#### Agent creation flow
Tapping "+ New" opens a prompt bar. User types what they want. Sydney parses intent and shows a lightweight confirmation card. Templates pre-fill the prompt bar - same flow from there.

```
┌─────────────────────────────────────────┐
│  What should your agent do?             │
│                                         │
│  "deliver tech news at 7am daily"  ✍️  │
│                                         │
│  ── or start from a template ──         │
│                                         │
│  📧 Daily Email Brief                   │
│  📰 Tech News Brief                     │
│  💬 Slack Digest                        │
│  📄 PDF Summarizer                      │
│  📋 EOD Task Report                     │
│  🗓️  Weekly Review                      │
└─────────────────────────────────────────┘
```

After typing or selecting a template, confirmation card:

```
┌─────────────────────────────────────────┐
│  📰 Tech News                           │
│                                         │
│  Runs:    Daily at 7:00 AM             │
│  Does:    Searches and summarizes       │
│           tech news                     │
│  Needs:   Web search (no login needed) │
│  Sends:   Message to your inbox        │
│                                         │
│  [Cancel]              [Create Agent]   │
└─────────────────────────────────────────┘
```

Agent appears in inbox immediately. First message arrives at next scheduled time.

### 7.4 Web version UI

Split-pane layout identical to desktop messaging apps:

```
┌──────────────────┬──────────────────────────────────────────┐
│  Sydney   + New  │  📧 Email Digest                    ⚙️   │
├──────────────────┤                                          │
│ 🤖 Assistant     │  ┌──────────────────────────────────┐    │
│ Ask me anything  │  │ Tuesday 13 May - 6pm Report     │    │
│                  │  │ 47 emails · 6 need attention    │    │
│ 📧 Email Digest  │  │ → Alice: Q3 budget review       │    │
│ 47 emails · 6pm  │  │ → Team standup notes            │    │
│                  │  └──────────────────────────────────┘    │
│ 📰 Tech News     │                                          │
│ 8 stories · 7am  │  ┌──────────────────────────────────┐    │
│                  │  │ Monday 12 May - 6pm Report      │    │
│ 💬 Slack         │  │ 31 emails · newsletters filtered │    │
│ 2 urgent · now   │  └──────────────────────────────────┘    │
│                  │                                          │
│ 🖥️ Coding Agent  │  Reply to Email Digest…      [Send]      │
│ PR ready · 3pm   │                                          │
└──────────────────┴──────────────────────────────────────────┘
```

Coding agent opens an IDE panel instead of a chat thread:

```
┌──────────────────┬──────────────┬──────────────────────────┐
│  Agent Inbox     │  Code Editor │  🖥️ Coding Agent          │
│                  │              │                           │
│  ...             │  # agent.py  │  I've written the script  │
│                  │  import ...  │  and run the tests.       │
│                  │              │  All 12 passing.          │
│                  │  def main(): │                           │
│                  │    ...       │  Want me to refactor the  │
│                  │              │  error handling?          │
│                  ├──────────────┤                           │
│                  │  Terminal    │  [Yes, refactor] [No]     │
│                  │  > pytest    │                           │
│                  │  12 passed   │                           │
└──────────────────┴──────────────┴──────────────────────────┘
```

### 7.5 Interaction model

The core loop:
```
Agent runs → writes message → push notification →
user taps → opens thread → reads message →
optionally replies → agent learns → next run is better
```

Identical to receiving and replying to a WhatsApp message. The familiarity is the product.

**User replies do real things:**
- "only flag emails from my team" → agent updates filter for next run,
- "make this shorter" → agent adjusts output length,
- "run this at 8am instead" → agent reschedules,
- "what was in yesterday's report?" → agent retrieves from its own history.

---

## 7.6 Design system - tokens and constants

Every UI element in Sydney uses a shared design token system. Define once, inherit everywhere. New templates, new screens, new components all pull from the same source of truth.

### Typography
```dart
// lib/design/tokens.dart
class SydneyTypography {
  static const agentName    = TextStyle(fontSize: 15, fontWeight: FontWeight.w600, height: 1.2);
  static const messagePreview = TextStyle(fontSize: 14, fontWeight: FontWeight.w400, height: 1.4, color: SydneyColors.textSecondary);
  static const timestamp    = TextStyle(fontSize: 12, fontWeight: FontWeight.w400, color: SydneyColors.textTertiary);
  static const messageBody  = TextStyle(fontSize: 15, fontWeight: FontWeight.w400, height: 1.6);
  static const sectionLabel = TextStyle(fontSize: 12, fontWeight: FontWeight.w500, letterSpacing: 0.04, color: SydneyColors.textTertiary);
  static const buttonLabel  = TextStyle(fontSize: 14, fontWeight: FontWeight.w500);
}
```

### Color palette
```dart
class SydneyColors {
  // backgrounds
  static const background       = Color(0xFFFFFFFF);
  static const backgroundSecondary = Color(0xFFF7F7F7);
  static const agentBubble      = Color(0xFFF2F2F2);
  static const userBubble       = Color(0xFF007AFF);

  // text
  static const textPrimary      = Color(0xFF0D0D0D);
  static const textSecondary    = Color(0xFF6B6B6B);
  static const textTertiary     = Color(0xFFAAAAAA);
  static const textOnUser       = Color(0xFFFFFFFF);

  // status
  static const onTrack          = Color(0xFF1D9E75);  // green
  static const behind           = Color(0xFFE24B4A);  // red
  static const ahead            = Color(0xFF378ADD);  // blue
  static const warning          = Color(0xFFBA7517);  // amber

  // unread indicator
  static const unreadDot        = Color(0xFF007AFF);

  // borders
  static const border           = Color(0xFFEAEAEA);
  static const borderStrong     = Color(0xFFD0D0D0);
}
```

### Spacing and shape
```dart
class SydneySpacing {
  static const xs  = 4.0;
  static const sm  = 8.0;
  static const md  = 12.0;
  static const lg  = 16.0;
  static const xl  = 24.0;
  static const xxl = 32.0;
}

class SydneyRadius {
  static const message    = 18.0;  // message bubbles
  static const card       = 14.0;  // agent cards
  static const button     = 10.0;  // action buttons
  static const avatar     = 24.0;  // agent avatar circles
  static const progressBar = 6.0;  // progress bars
}
```

### Animation constants
```dart
class SydneyAnimations {
  // thread open - slide up + fade
  static const threadOpen = Duration(milliseconds: 280);
  static const threadOpenCurve = Curves.easeOutCubic;

  // new message arrival - fade + slide from bottom
  static const messageArrive = Duration(milliseconds: 220);
  static const messageArriveCurve = Curves.easeOutQuart;

  // agent typing indicator - pulse
  static const typingPulse = Duration(milliseconds: 600);

  // progress bar fill - animated on first render
  static const progressFill = Duration(milliseconds: 800);
  static const progressFillCurve = Curves.easeOutCubic;

  // confirmation card appear - scale + fade
  static const cardAppear = Duration(milliseconds: 240);
  static const cardAppearCurve = Curves.easeOutBack;
}
```

### The 10-second rule
Every new screen is evaluated against one question before shipping:

> Does a non-technical person understand what to do within 10 seconds, without reading any instructions?

If the answer is no, the screen is redesigned. Not simplified - redesigned. Every screen has one primary action. Every screen has one clear hierarchy. No competing calls to action anywhere.

---

## 7.7 Output template system

This is one of Sydney's core differentiators. Every agent message is rendered using a purpose-built template widget - not a generic text blob. The LLM returns structured JSON. Flutter renders the right widget automatically.

### How it works end to end

**Step 1 - Intent parser assigns a template**

When an agent is created, the intent parser returns a template type alongside the agent definition:

```typescript
// intent parsing response
{
  "intent": "study_plan",
  "connector": null,
  "schedule": "0 8 * * *",
  "output_template": "progress_tracker",
  "template_config": {
    "has_progress_bars": true,
    "has_countdown": true,
    "has_streak": true,
    "has_action_buttons": true,
    "has_checklist": false
  }
}
```

**Step 2 - Agent runtime returns structured JSON**

Every agent execution returns a typed JSON payload, not raw text:

```typescript
// stored in agent_messages.content as JSON string
{
  "template": "progress_tracker",
  "version": "1.0",
  "data": { ... template-specific data ... }
}
```

**Step 3 - Flutter renders the right widget**

```dart
// lib/widgets/agent_message_widget.dart
class AgentMessageWidget extends StatelessWidget {
  final AgentMessage message;

  @override
  Widget build(BuildContext context) {
    final content = jsonDecode(message.content);

    switch (content['template']) {
      case 'progress_tracker':
        return ProgressTrackerTemplate(data: content['data']);
      case 'plain_text':
        return PlainTextTemplate(data: content['data']);
      case 'urgency_list':
        return UrgencyListTemplate(data: content['data']);
      case 'data_summary':
        return DataSummaryTemplate(data: content['data']);
      case 'checklist':
        return ChecklistTemplate(data: content['data']);
      case 'streak_counter':
        return StreakCounterTemplate(data: content['data']);
      case 'comparison':
        return ComparisonTemplate(data: content['data']);
      case 'timeline':
        return TimelineTemplate(data: content['data']);
      case 'system':
        return SystemMessageTemplate(data: content['data']);
      default:
        return PlainTextTemplate(data: content['data']);
    }
  }
}
```

**Step 4 - Interactive elements send replies**

Action buttons inside templates are tappable. Tapping sends a structured reply back to the agent:

```dart
// inside any template widget
ActionButton(
  label: 'Done for today',
  onTap: () => context.read<AgentCubit>().sendReply(
    agentId: message.agentId,
    action: 'mark_done',
    payload: { 'date': DateTime.now().toIso8601String() }
  )
)
```

The backend receives the reply, updates agent state, adjusts next run accordingly. No separate settings screen needed - the message IS the interface.

---

### Template 1 - plain_text

**Used for:** tech news agent, general summaries, assistant chat responses, any agent without structured data.

**JSON payload:**
```json
{
  "template": "plain_text",
  "data": {
    "headline": "Your morning tech brief",
    "body": "8 stories worth reading today...",
    "items": [
      { "title": "OpenAI launches GPT-5", "summary": "...", "source": "TechCrunch", "url": "..." },
      { "title": "Apple acquires startup", "summary": "...", "source": "Bloomberg", "url": "..." }
    ],
    "footer": "Delivered every day at 7am"
  }
}
```

**Renders as:**
```
┌──────────────────────────────────────┐
│ Your morning tech brief              │
│                                      │
│ 1. OpenAI launches GPT-5            │
│    One line summary here.            │
│    TechCrunch ↗                      │
│                                      │
│ 2. Apple acquires startup            │
│    One line summary here.            │
│    Bloomberg ↗                       │
│                                      │
│ + 6 more stories                     │
└──────────────────────────────────────┘
```

**Build order:** Week 3 (first template, built with tech news agent)

---

### Template 2 - progress_tracker

**Used for:** study plan agent, fitness agent, habit agent, project milestone agent, any agent tracking progress toward a goal over time.

**JSON payload:**
```json
{
  "template": "progress_tracker",
  "data": {
    "day_current": 67,
    "day_total": 183,
    "countdown_label": "116 days to JEE",
    "today": {
      "subject": "Physics",
      "topic": "Newton's Laws of Motion",
      "estimated_minutes": 45,
      "context": "Builds on yesterday's Kinematics session"
    },
    "progress_bars": [
      { "label": "Physics",   "percent": 80, "status": "on_track" },
      { "label": "Chemistry", "percent": 50, "status": "on_track" },
      { "label": "Maths",     "percent": 30, "status": "behind"   }
    ],
    "overall": { "percent": 58, "status": "on_track" },
    "streak": 12,
    "message": "You're on track. Keep going.",
    "actions": [
      { "id": "done",      "label": "Done for today", "style": "primary" },
      { "id": "more_time", "label": "Need more time", "style": "secondary" },
      { "id": "skip",      "label": "Skip",            "style": "ghost" }
    ]
  }
}
```

**Renders as:**
```
┌──────────────────────────────────────┐
│ Day 67 of 183           116 days 🎯  │
├──────────────────────────────────────┤
│ Today - Physics                      │
│ Newton's Laws of Motion              │
│ ~45 min · builds on Kinematics       │
├──────────────────────────────────────┤
│ Physics    ████████░░  80%  ✓        │
│ Chemistry  █████░░░░░  50%  ✓        │
│ Maths      ███░░░░░░░  30%  ↓        │
├──────────────────────────────────────┤
│ Overall    ██████░░░░  58% on track  │
│ 🔥 12 day streak                     │
├──────────────────────────────────────┤
│ [Done for today] [Need more time]    │
│              [Skip]                  │
└──────────────────────────────────────┘
```

**Adaptive behaviour:**
- User taps "Need more time" → agent adds 1 extra day to this topic
- User taps "Skip" 3 days in a row → agent sends concern message and asks to adjust plan
- User taps "Done" consistently for 7 days → agent sends encouragement + notes streak
- Progress bar for "Maths" at 30% with exam in 116 days → agent flags as behind, suggests extra sessions

**Build order:** V1.1 (after launch)

---

### Template 3 - urgency_list

**Used for:** Slack watcher, Gmail monitor, keyword alert agent, any agent that surfaces time-sensitive items requiring attention.

**JSON payload:**
```json
{
  "template": "urgency_list",
  "data": {
    "headline": "2 urgent messages flagged",
    "source": "Slack · #product channel",
    "timestamp": "2:31 PM",
    "items": [
      {
        "level": "urgent",
        "from": "Rahul",
        "preview": "The API is returning 500 errors on prod",
        "time": "2:28 PM",
        "channel": "#engineering"
      },
      {
        "level": "mention",
        "from": "Priya",
        "preview": "Hey can you review the PR when you get a chance?",
        "time": "1:15 PM",
        "channel": "#design"
      }
    ],
    "skipped": 47,
    "skipped_label": "47 other messages not flagged"
  }
}
```

**Renders as:**
```
┌──────────────────────────────────────┐
│ ⚡ 2 urgent · Slack · 2:31 PM        │
├──────────────────────────────────────┤
│ 🔴 Rahul · #engineering · 2:28 PM   │
│ "The API is returning 500 errors     │
│  on prod"                            │
├──────────────────────────────────────┤
│ 🔵 Priya mentioned you · 1:15 PM    │
│ "Can you review the PR when you      │
│  get a chance?"                      │
├──────────────────────────────────────┤
│ 47 other messages · not flagged      │
└──────────────────────────────────────┘
```

**Build order:** V1.2

---

### Template 4 - data_summary

**Used for:** email digest, portfolio agent, subscription auditor, analytics agent, any agent that summarizes quantitative or categorical data.

**JSON payload:**
```json
{
  "template": "data_summary",
  "data": {
    "headline": "Your email digest · Tuesday 13 May",
    "stats": [
      { "label": "Received",  "value": "47", "sublabel": "emails today" },
      { "label": "Important", "value": "6",  "sublabel": "need attention" },
      { "label": "Filtered",  "value": "23", "sublabel": "newsletters removed" }
    ],
    "items": [
      { "priority": "high",   "from": "Alice",   "subject": "Q3 budget review", "time": "3:12 PM" },
      { "priority": "high",   "from": "Stripe",  "subject": "Invoice #4521 ready", "time": "1:05 PM" },
      { "priority": "medium", "from": "Bob",     "subject": "Standup notes attached", "time": "10:30 AM" }
    ],
    "more_count": 3,
    "footer": "Newsletters filtered · tap to adjust"
  }
}
```

**Renders as:**
```
┌──────────────────────────────────────┐
│ Email digest · Tuesday 13 May        │
├──────────────────────────────────────┤
│  47          6          23           │
│  received    important  filtered     │
├──────────────────────────────────────┤
│ 🔴 Alice · Q3 budget review          │
│ 🔴 Stripe · Invoice #4521 ready      │
│ 🟡 Bob · Standup notes attached      │
│ + 3 more important                   │
├──────────────────────────────────────┤
│ Newsletters filtered · adjust ↗      │
└──────────────────────────────────────┘
```

**Build order:** V1.1 (with Gmail connector)

---

### Template 5 - checklist

**Used for:** travel agent, pre-exam checklist, weekly review agent, any agent that delivers actionable items the user should complete.

**JSON payload:**
```json
{
  "template": "checklist",
  "data": {
    "headline": "JEE exam eve checklist",
    "subtitle": "Tomorrow is the big day.",
    "message": "Don't study tonight. Your brain is ready.",
    "items": [
      { "id": "1", "label": "Admit card printed",   "checked": false },
      { "id": "2", "label": "Pencils and pens ready", "checked": false },
      { "id": "3", "label": "Alarm set for 6am",    "checked": false },
      { "id": "4", "label": "Dinner eaten",          "checked": false },
      { "id": "5", "label": "Phone charging",        "checked": false }
    ],
    "footer": "You started this 183 days ago. You've got this. 🎯"
  }
}
```

**Renders as:**
```
┌──────────────────────────────────────┐
│ JEE exam eve checklist               │
│ Don't study tonight. Brain is ready. │
├──────────────────────────────────────┤
│ ☐  Admit card printed                │
│ ☐  Pencils and pens ready            │
│ ☐  Alarm set for 6am                 │
│ ☐  Dinner eaten                      │
│ ☐  Phone charging                    │
├──────────────────────────────────────┤
│ You started 183 days ago. 🎯         │
└──────────────────────────────────────┘
```

Checklist items are tappable - checking one sends a reply to the agent which stores completion state.

**Build order:** V1.3

---

### Template 6 - streak_counter

**Used for:** habit agent, learning agent, fitness agent, any agent built around daily consistency and streaks.

**JSON payload:**
```json
{
  "template": "streak_counter",
  "data": {
    "headline": "Daily Spanish word",
    "word": "Madrugada",
    "definition": "The hours between midnight and dawn",
    "example": "Me desperté en la madrugada.",
    "translation": "I woke up in the early hours.",
    "streak": 14,
    "streak_message": "14-day streak intact. The habit is forming.",
    "milestone_next": 21,
    "milestone_label": "21 days = automatic habit",
    "actions": [
      { "id": "learned", "label": "Got it ✓", "style": "primary" },
      { "id": "review",  "label": "Need review", "style": "secondary" }
    ]
  }
}
```

**Renders as:**
```
┌──────────────────────────────────────┐
│ Daily Spanish · Day 14               │
├──────────────────────────────────────┤
│ Madrugada                            │
│ The hours between midnight and dawn  │
│                                      │
│ "Me desperté en la madrugada."       │
│ I woke up in the early hours.        │
├──────────────────────────────────────┤
│ 🔥 14-day streak · 7 days to habit   │
│ ░░░░░░░░░░░░░░█████████████████░░░░  │
│              14 of 21                │
├──────────────────────────────────────┤
│ [Got it ✓]        [Need review]      │
└──────────────────────────────────────┘
```

**Build order:** V1.3

---

### Template 7 - comparison

**Used for:** competitor watcher, market research agent, portfolio comparison agent, any agent that surfaces side-by-side data over time.

**JSON payload:**
```json
{
  "template": "comparison",
  "data": {
    "headline": "Competitor weekly watch",
    "period": "Week of May 12",
    "rows": [
      {
        "label": "Notion",
        "changes": ["Launched AI meeting recorder", "3 blog posts"],
        "sentiment": "active"
      },
      {
        "label": "Linear",
        "changes": ["Shipped new roadmap view"],
        "sentiment": "neutral"
      }
    ],
    "insight": "Notion moving into async meeting space. Worth watching.",
    "trending_narrative": "Both competitors emphasizing async work this week."
  }
}
```

**Build order:** V1.4

---

### Template 8 - system

**Used for:** error messages, token reconnection prompts, agent paused notifications, onboarding messages. Not agent output - internal Sydney communication.

```json
{
  "template": "system",
  "data": {
    "type": "connector_disconnected",
    "icon": "⚠️",
    "message": "I lost access to your Gmail.",
    "detail": "Your token may have expired or been revoked.",
    "action": { "label": "Reconnect Gmail", "type": "reconnect", "connector": "gmail" }
  }
}
```

**Renders as:**
```
┌──────────────────────────────────────┐
│ ⚠️  Lost access to Gmail             │
│ Your token may have expired.         │
│                                      │
│ [Reconnect Gmail]                    │
└──────────────────────────────────────┘
```

System messages use a subtly different visual style - slightly muted background, no agent avatar - so the user immediately knows this is from Sydney itself, not from agent output.

**Build order:** Week 3 (needed from day one for error handling)

---

### Template rollout plan

```
Week 3 (MVP launch)
  plain_text      → tech news, general summaries
  system          → errors, reconnect prompts

V1.1 (post-launch, ~2 weeks after)
  data_summary    → email digest, portfolio
  progress_tracker → study agent

V1.2
  urgency_list    → Slack watcher, Gmail monitor

V1.3
  checklist       → travel, pre-exam
  streak_counter  → habit, learning agents

V1.4
  comparison      → competitor watch, market agents
  timeline        → project agents, roadmap agents
```

### Adding new templates - developer guide

Adding a new template requires changes in exactly three places:

**1. Backend - add to intent parser prompt**
```typescript
// src/agents/intent-parser.ts
// Add new template to the allowed output_template values
// and describe when to use it in the system prompt
```

**2. Backend - add agent runtime output schema**
```typescript
// src/agents/templates/{template_name}.schema.ts
// Define the JSON schema for the template's data payload
// Haiku is prompted to return this exact structure
```

**3. Flutter - add widget**
```dart
// lib/widgets/templates/{template_name}_template.dart
// Implement the StatelessWidget that renders the template
// Must use only SydneyColors, SydneyTypography, SydneySpacing tokens
// Must handle null/missing data gracefully
// Must be testable with mock data
```

That's it. No other files change. The routing in `AgentMessageWidget` uses a switch on the template string - new case added, done.

---

## 7.8 UI quality standard

Sydney's UI is held to the standard of the apps users compare it to unconsciously - WhatsApp, ChatGPT, Claude, Gmail. These apps were designed by world-class teams over years. Sydney must match their *feel*, not their feature set.

### The non-negotiables before any public release

**Typography is handled with care.**
Every font size, weight, and line height is intentional. No default Flutter text styles anywhere in the app. Everything uses `SydneyTypography` tokens.

**Whitespace is generous.**
The inbox breathes. Message bubbles have comfortable padding. Nothing feels cramped. When in doubt, add more space.

**Loading states are designed.**
No raw CircularProgressIndicator anywhere visible to users. Every loading state has a designed skeleton or animation that communicates "working" not "broken."

**Empty states are warm.**
The inbox with no agents shows the Assistant contact and a warm invitation, not a blank screen. Every empty state has a purpose.

**Errors are human.**
No technical error messages exposed to users. "Something went wrong" is never acceptable. Every error is specific, honest, and tells the user what to do next.

**Animations are purposeful.**
Every transition has an animation. Every animation uses the tokens in `SydneyAnimations`. No jarring cuts between screens. No unnecessary animations that slow the user down.

**The first 10 seconds test.**
Every new screen is shown to a non-technical person. If they don't immediately understand what to do, the screen is redesigned before it ships.

---

## 9. MVP Plan

### 9.1 Best MVP wedge
Read-first recurring agents - agents that message the user on a schedule with useful summaries. Zero risk of unwanted actions.

Starting agents:
- Tech News Brief (web search, no OAuth - build first),
- Daily Email Digest (Gmail OAuth - validates full auth stack),
- Slack Digest,
- PDF Summarizer,
- EOD Task Report.

### 9.2 MVP features
- email/password sign-in via Better Auth,
- pre-installed Assistant contact (general + connected chat),
- prompt-first custom agent creation with confirmation card,
- template shortcuts on creation screen,
- messaging inbox (contact list + chat threads),
- scheduled agent execution via BullMQ,
- push notifications (FCM, WhatsApp-style),
- user replies fed back to agent context,
- pause / resume / delete agent,
- free tier enforcement (3 agents, daily minimum, Assistant excluded),
- graceful unsupported connector response.

### 9.3 First connectors
- Web search (Anthropic server-side web search, no OAuth - day one),
- Gmail,
- Google Drive,
- Slack.

### 9.4 MVP success metrics
- Agent created in under 60 seconds,
- Agent sends useful first message on day one,
- User opens app the next day from a notification (day-2 retention),
- User replies to an agent within the first week.

Day-2 retention driven by push notifications is the single most important early signal.

---
