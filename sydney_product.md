# Sydney — Product Document
### Internal alias: Sydney | Version 1.0
### Read this to understand what Sydney is, who it's for, and why it exists.

---

## 1. What Is Sydney

A mobile-first app that lets anyone create persistent AI agents by describing what they want in plain language — one sentence, no setup, no technical knowledge required.

The interface model is a **messaging platform**, not a dashboard. Every agent is a contact. Every agent output is a message. The app feels like WhatsApp — except instead of friends sending you messages, your agents are sending you reports, summaries, alerts, and digests. You reply to refine them, just like replying to a contact.

The core promise:
> **"Your agents message you. You just read."**

The product is not an automation builder. It is not a chat interface. It is a **delegation layer** — a set of always-on contacts that work for you and report back.

### What the user says
- "Deliver me tech news every morning at 7am."
- "Check my email every day and give me a report at 6pm."
- "Summarize the PDFs in my Drive every Friday."
- "Watch Slack for urgent messages and alert me."
- "Create a study plan for my JEE exam on November 15th."
- "Give me an end-of-day report of what I did today."

### What the app does
Sydney translates a plain-language prompt into a persistent agent by identifying the user intent, the tool or data source required, the action to perform, the schedule or trigger, the delivery format, and any required permissions.

It then creates a new agent contact in the inbox that connects to user-approved services via MCP, executes on a schedule or event trigger, gathers and summarizes data, sends the result as a message in its chat thread, delivers a push notification like a new WhatsApp message, and learns from user replies to improve over time.

### Product layers
Three layers of capability, all inside the same messaging interface:

**Layer 1 — Custom agents (core product)**
User describes what they want in one sentence. Sydney creates a dedicated agent contact that runs on a schedule and messages results. Every user's agent list is unique to them.

**Layer 2 — Connected chat (via Assistant contact)**
The pre-installed Assistant contact answers on-demand questions using live data from connected services. "What emails did I miss today?" pulls from Gmail via MCP and answers in real time. Like Perplexity but for the user's own data.

**Layer 3 — General chat (via Assistant contact)**
The same Assistant contact handles plain AI conversation — drafting, thinking, answering questions — powered by Claude Haiku. No recurring schedule, just chat.

### Product category
Sydney sits between messaging platforms, personal AI assistants, recurring reporting tools, and consumer automation — but belongs to none of them. It is a new category:

> **The AI application layer that utilises everything AI has to offer — through agents.**

It is not a power-user workflow app.
It is not a developer tool.
It is not another AI chat interface.

---

## 2. Product Principles

1. **Agents message you. You don't query them.**
   The default mode is push, not pull. Agents reach out. Users receive. This is the fundamental inversion from every other AI product.

2. **Every agent is a contact.**
   The mental model is a contact list, not a dashboard. Each agent has a name, a purpose, and a full chat history. Creating an agent is like adding a new contact that starts working immediately.

3. **Custom agents are the product. Templates are shortcuts.**
   The primary creation flow is always: user types what they want in plain language → agent is created. Templates pre-fill the prompt bar for users who don't know where to start. Both paths produce identical custom agents.

4. **The Assistant contact is always there.**
   A pre-installed Assistant contact is present from the moment the user signs up. It handles general chat, connected chat, and onboarding. The inbox is never empty.

5. **Hide all infrastructure.**
   Users never see MCP, APIs, workflows, triggers, connectors, or any technical concept. They see contacts, messages, and permissions.

6. **Speak in outcomes, not tools.**
   The UI centers on tasks: "daily brief," "weekly report," "watch and alert," "summarize," "remind."

7. **Default to read-first behavior.**
   Start with summaries, monitoring, and reporting before allowing autonomous actions.

8. **Make permissions explicit.**
   The user always knows what an agent can access and what it can do.

9. **Every agent should feel trustworthy.**
   A user should always understand what happened, why, and when. Failures surface as messages, never as silent errors.

10. **One-line creation.**
    The strongest experience is when a user creates a useful agent with one sentence.

---

## 3. Target Users

### Primary users
Non-technical consumers who want recurring digital help:
- busy professionals,
- founders,
- students,
- creators,
- managers,
- freelancers,
- anyone overwhelmed by inboxes, files, tasks, and updates.

### User mindset
These users do not want automation. They want relief.

They are not asking "how do I build a workflow?" They are asking "can something just handle this for me?"

The messaging interface serves this perfectly. The user does not manage a system. They receive messages from contacts that are handling things for them.

### Early adopters
People with:
- high email volume,
- active Slack or messaging workspaces,
- recurring reporting needs,
- frequent document review tasks,
- repetitive information monitoring,
- exam preparation or daily learning goals — students are a high-value early adopter segment with strong word-of-mouth in peer groups.

---

## 4. Core Use Cases

### Custom agents (user-defined, unlimited combinations)
Users create agents by describing what they want. Any combination of connector + schedule + output is a valid agent. No two users' agent lists will look the same.

Examples:
- "deliver me tech news at 7am daily"
- "summarize my emails every evening at 6pm"
- "alert me when someone mentions my name in Slack"
- "summarize any PDF I share with you"
- "give me a weekly Drive folder change report every Friday"
- "remind me to follow up with leads every Monday morning"
- "give me a coding tip every morning"
- "summarize my calendar for the week every Sunday night"
- "create a study plan for my JEE exam on November 15th — Physics, Chemistry, Maths"
- "send me a Spanish word every morning and track my streak"
- "watch my competitors and tell me what they shipped every week"
- "audit my subscriptions every month and flag ones I haven't used"
- "give me a fitness check every morning based on my sleep and steps"
- "send me a job market update every Monday for senior product roles in Bangalore"

### Unsupported connector handling
If a user requests a connector Sydney doesn't support yet:
```
User:   "monitor my Instagram DMs"
Sydney: I can't access Instagram yet.
        I can monitor your Gmail or Slack instead —
        want me to set one of those up?
```

### Information digest
Daily email summary, tech news brief, Slack digest, project status report, meeting recap, folder change summary.

### Monitoring
Watch Gmail for important messages, monitor Slack for flagged keywords, track Drive documents for changes, alert on deadlines or missed follow-ups.

### Summarization
PDFs, docs, threads, meeting notes, message history.

### Reporting
End-of-day task report, weekly progress summary, project health report, "what changed since yesterday."

### Reminder and follow-up
Recurring reminders, follow-up nudges, calendar-based prompts, context-aware alerts.

### Connected chat (Assistant contact)
- "what important emails did I miss today?"
- "summarize what happened in Slack this week"
- "what files changed in my Drive folder?"
Real-time answers using live MCP-fetched user data.

### General chat (Assistant contact)
Ask anything, draft content, think through problems, plain AI conversation powered by Claude Haiku.

### Study and learning agents
A dedicated category worth calling out — no connector required, pure scheduled intelligence, extremely high daily engagement.

**Study plan agent:**
User says "create a study plan for JEE on November 15th — Physics, Chemistry, Maths." Sydney generates a day-by-day plan, messages the user every morning with today's topic, tracks completion via replies, implements spaced repetition automatically, and shifts to full revision mode in the final 2 weeks.

Agent lifecycle:
- Day 1: full plan generated, messaged to user
- Daily 8am: today's topic, estimated time, progress update
- Weekly: plan adjustment if user is behind or ahead
- Spaced repetition: topics revisited at day 7, day 25, day 55 automatically
- Critical period (14 days before exam): switches to revision-only mode
- Exam eve: sends checklist, encouragement, no new content

This agent requires zero connectors, works from day one, creates daily habit, and serves India's 2.5M+ JEE aspirants, 2M+ NEET aspirants, plus global exam markets. Strong word-of-mouth vector — students share tools with classmates.

**Learning streak agent:**
Daily word, concept, or skill delivery with streak tracking. User says "teach me one Spanish word every morning." Agent delivers word, example sentence, pronunciation note, and streak counter. User replies "got it" or "need review" — agent adjusts difficulty over time.

**Habit anchor agent:**
"Remind me to meditate every morning and track my streak." Agent messages daily, tracks consistency via replies, sends milestone messages at day 7, day 21, day 66 (habit formation research milestones), and adjusts encouragement tone based on streak health.

### Light action taking (Phase 3+)
Drafting responses, creating docs, scheduling calendar events, filing or organizing content, sending approved messages.

---

## 5. Product Scope

### What the product does well
- presents agents as contacts in a messaging interface,
- creates custom agents from plain language in one step,
- pre-installs an Assistant contact so the inbox is never empty,
- connects to user accounts with simple permissioning,
- runs recurring or event-driven jobs reliably,
- delivers outputs as messages with push notifications,
- supports replies that refine agent behaviour,
- manages multiple agents in one inbox,
- makes pausing, editing, and deleting easy,
- shows full message history per agent.

### What the product does not do first
- open-ended autonomous web browsing,
- multi-step action chains with high risk,
- complex visual flow builders,
- enterprise admin dashboards,
- developer-centric config or JSON editing,
- any action that writes or modifies user data (Phase 3+),
- human-to-human messaging (never — this would destroy positioning).

---

## 6. Pricing

| Feature | Free | Pro ($9.99/month) |
|---|---|---|
| Assistant contact | ✓ always included | ✓ always included |
| Custom agents | 3 | Unlimited |
| Minimum schedule interval | Daily | Hourly |
| Connected chat | ✓ | ✓ |
| General chat | ✓ | ✓ |
| Connectors | All available | All available |
| Message history | 30 days | Unlimited |
| Web access | ✓ | ✓ |

Notes:
- The Assistant contact does not count toward the 3-agent free tier limit.
- Free tier delivers real daily value and builds the habit.
- The ceiling hits naturally when users rely on the product enough to pay.
- At $9.99/month, Sydney sits below Claude Pro and ChatGPT Plus (~$20) and does something neither can: works while the user is away and messages them unprompted.

---

## 7. Roadmap

### Phase 1 — Read-only agents (MVP)
Agents message the user with summaries, digests, reports. User replies to refine. No actions taken. Assistant contact for general and connected chat. Android only.

### Phase 2 — Web version
Full web app with split-pane inbox, multi-agent overview, and connected chat. Same backend, same agents, same history across mobile and web.

### Phase 3 — Assisted actions + OpenShell + EC2
Agents suggest actions in messages. User taps to approve. Migrate to EC2 + OpenShell for kernel-level sandboxing. Introduce coding agent with IDE panel on web.

### Phase 4 — Light autonomous actions
Agents take low-risk actions within pre-approved boundaries: filing, tagging, scheduling, marking tasks complete.

### Phase 5 — Multi-agent orchestration
Agents trigger other agents. Agent marketplace — users publish and install community agents. Network effects begin.

### iOS
After web version is stable. Same Flutter codebase, one config change.

### Long-term vision
Sydney becomes the command layer between humans and all AI — digital and physical. As MCP grows, every app on Android becomes a potential Sydney connector. As physical AI (robots, devices) adopt MCP, Sydney becomes the unified interface for commanding both software and hardware agents from one inbox.

---

## 8. Key Risks

### 1. Trust collapse
If an agent misses an important email or sends a bad summary twice, the user stops trusting it. Output quality is the product. Failure transparency is mandatory.

### 2. Notification fatigue
If agents message too frequently or with low-value content, users mute notifications and the core loop breaks. Every message must earn its place.

### 3. Google OAuth verification delay
Google caps unverified apps at 100 users for Gmail/Drive scopes. Verification takes 2–6 weeks. Submit the week Gmail works locally — not before launch.

### 4. Haiku rate limits at scale
5,000 users with 7am news agents firing simultaneously without jitter will hit Anthropic rate limits. Apply for higher tier and implement jitter before launch.

### 5. Token vault reliability
Silent refresh failures cause agents to stop messaging without explanation. Every failure must surface as a message in the agent thread immediately.

### 6. Overreach
Too many connectors or agent types at launch creates confusion. Launch with 4 connectors maximum. Expand based on user requests.

### 7. Generic positioning
Described as "another AI assistant," Sydney is ignored. "Agents that message you" must be the consistent frame everywhere — App Store description, first tweet, onboarding message, press coverage.

### 8. Platform risk (OpenShell)
OpenShell is alpha software in single-player mode. Not suitable for multi-tenant Phase 1 deployment. Adopt only at Phase 3.

---

## 9. Positioning

### Core positioning
**AI agents that message you.**

Not a chatbot you open. Not a dashboard you manage. Contacts that work for you and report back — like getting a WhatsApp message, except it's your email digest, news brief, or Slack summary.

### Competitive differentiation

| | Sydney | Claude/ChatGPT | Perplexity | Zapier/n8n |
|---|---|---|---|---|
| Works while you're away | ✓ | ✗ | ✗ | ✓ |
| Consumer mobile app | ✓ | ✓ | ✗ | ✗ |
| Messaging interface | ✓ | ✗ | ✗ | ✗ |
| Knows your real data | ✓ | ✗ | ✗ | ✓ |
| No-code creation | ✓ | N/A | N/A | ✗ |
| Scheduled agents | ✓ | ✗ | ✗ | ✓ |

### Good messaging
- "AI agents that message you."
- "Your daily briefings, summaries, and alerts — delivered like messages."
- "Tell it what you want. It handles the rest."

### Avoid
- "MCP-powered agent builder" — too technical
- "workflow automation platform" — wrong audience
- "developer agent framework" — wrong audience
- "AI assistant" — too generic, indistinguishable

### Pricing anchor
$9.99/month sits between Claude Pro / ChatGPT Plus (~$20) and is half the price while doing something neither can: working while you're away and messaging you unprompted.

---

## 10. Product Thesis

Sydney inverts the relationship between users and AI.

Every other AI product asks the user to show up and ask. Sydney has the AI show up and tell.

From pull to push. From tool to contact. From dashboard to inbox. From "I need to remember to check this" to "it already messaged me."

The moat compounds over time:
- **Month 1–3:** First-mover on Android consumer agent messaging — no competitor has this UI
- **Month 3–6:** Agent memory and personalisation — each user's agents learn their preferences, that context doesn't transfer to competitors
- **Month 6–12:** MCP ecosystem compounds — every new MCP server published becomes a potential Sydney connector for free
- **Year 2+:** Agent marketplace — community-published agents, network effects, platform lock-in

The winning formula:
- custom agents in one sentence,
- agents as contacts, outputs as messages,
- notifications as the retention loop,
- replies as the refinement mechanism,
- Assistant contact always present,
- zero visible infrastructure,
- trust built through transparency.

If executed well, Sydney becomes the messaging app where your contacts work for you — and eventually the command layer for all AI in your life.
