# Sydney - Examples
### Internal alias: Sydney | Version 1.0
### A living document. Add new examples as they are discovered.
### Every example is something a real user could type today and get working.

---

## How to read this document

Each example shows:
- what the user types (one sentence)
- what connector is needed (if any)
- what template it uses
- what the agent actually does

No connector = works from day one, no OAuth required.
These are the easiest agents to build and the easiest to demo.

---

## Category 1 - Information Delivery

*Agents that find, summarize, and deliver information on a schedule.
No user action required. Just receive.*

---

### 1.1 Tech News Brief
```
User says:  "deliver me tech news every morning at 7am"
Connector:  web search (no OAuth)
Template:   plain_text
Schedule:   daily 7am
```
Searches for top tech stories, summarizes 6–8 headlines with one-line
descriptions, delivers as a morning message. Feels like a curated
newsletter written specifically for you, arriving before you open
any other app.

---

### 1.2 Daily Email Digest
```
User says:  "summarize my emails every evening at 6pm"
Connector:  Gmail
Template:   data_summary
Schedule:   daily 6pm
```
Reads inbox, filters newsletters and promotions, surfaces emails that
need attention, groups by sender priority. User gets a clear picture
of what actually matters without opening Gmail at all.

---

### 1.3 Slack Digest
```
User says:  "give me a summary of what happened in Slack today at 5pm"
Connector:  Slack
Template:   data_summary
Schedule:   daily 5pm
```
Reads all channels the user is part of, surfaces mentions, important
threads, and decisions made. Ideal for people who are in too many
channels to follow in real time.

---

### 1.4 Slack Urgent Watcher
```
User says:  "alert me immediately if anyone mentions me in Slack"
Connector:  Slack
Template:   urgency_list
Schedule:   event-triggered (real-time monitor)
```
Monitors Slack for direct mentions, DMs, and flagged keywords.
Messages the user instantly when something needs attention.
Unlike checking Slack every 10 minutes, this only interrupts when necessary.

---

### 1.5 Weekly Drive Summary
```
User says:  "tell me what changed in my Drive every Friday"
Connector:  Google Drive
Template:   plain_text
Schedule:   weekly Friday 9am
```
Scans Drive for files modified in the past week, summarizes what
changed and who touched what. Useful for managers and freelancers
tracking project files.

---

### 1.6 PDF Summarizer
```
User says:  "summarize any PDF I share with you"
Connector:  Google Drive
Template:   plain_text
Schedule:   on-demand (triggered when user shares a file)
```
User shares a PDF to Drive, agent detects it, reads it, sends a
summary as a message. Research papers, contracts, reports - summarized
before you have to read them.

---

### 1.7 Meeting Recap Agent
```
User says:  "summarize my meeting notes from Docs every evening"
Connector:  Google Docs
Template:   plain_text
Schedule:   daily 7pm
```
Reads Docs files modified that day, looks for meeting notes format,
extracts decisions, action items, and key points. Never lose a meeting
outcome again.

---

### 1.8 Niche News Agent
```
User says:  "send me updates about Indian startup funding every morning"
Connector:  web search (no OAuth)
Template:   plain_text
Schedule:   daily 8am
```
Targeted news on any topic - not just tech. Sports, finance, politics,
a specific company, a specific industry. User defines the topic in
plain language. Agent delivers it daily.

---

### 1.9 Competitor Watcher
```
User says:  "watch my competitors and tell me what they shipped every week"
Connector:  web search (no OAuth)
Template:   comparison
Schedule:   weekly Monday 9am
```
Searches for product updates, blog posts, press releases, and social
posts from named competitors. Delivers a weekly brief on what they
shipped, what they're saying, and what narrative they're pushing.

---

### 1.10 Stock / Portfolio Watch
```
User says:  "give me a daily portfolio summary at market close"
Connector:  web search (no OAuth)
Template:   data_summary
Schedule:   daily 4pm (market close)
```
Fetches price data for a defined set of stocks, summarizes moves,
flags positions near stop-loss levels, notes major market news.
Bloomberg Terminal for $9.99/month.

---

## Category 2 - Study and Learning

*Agents that teach, track, and build knowledge over time.
No connector required for any of these. Works from day one.*

---

### 2.1 JEE / NEET Study Plan Agent
```
User says:  "create a study plan for my JEE exam on November 15th -
             Physics, Chemistry, Maths"
Connector:  none
Template:   progress_tracker
Schedule:   daily 8am
```
Generates a day-by-day study plan across all subjects. Messages the
user every morning with today's topic and estimated time. Tracks
completion via replies. Implements spaced repetition automatically -
topics revisited at 7, 25, and 55 days after first study. Shifts to
full revision mode 14 days before the exam. Sends a checklist on exam eve.

The full lifecycle:
- Day 1: plan generated and messaged
- Daily: today's topic, progress bars, streak counter
- Weekly: plan adjustment based on user's pace
- Spaced: automatic revision prompts at research-backed intervals
- Final 14 days: revision-only mode, no new topics
- Exam eve: checklist, encouragement, "don't study tonight"

Serves 2.5M+ JEE aspirants and 2M+ NEET aspirants in India alone.
No connector. No OAuth. Works for anyone, everywhere, immediately.

---

### 2.2 Daily Language Word
```
User says:  "teach me one Spanish word every morning and track my streak"
Connector:  none
Template:   streak_counter
Schedule:   daily 8am
```
Delivers one word per day: the word, its meaning, an example sentence,
pronunciation notes. User replies "got it" or "need review." Agent
adjusts difficulty and vocabulary range over time. Streak counter builds
habit. Milestone messages at day 7, 21, and 66 (research-backed habit
formation points).

Works for any language. Works for any vocabulary domain - legal terms,
medical terms, business English, technical vocabulary.

---

### 2.3 Coding Tip of the Day
```
User says:  "send me one advanced Python tip every morning"
Connector:  none
Template:   plain_text
Schedule:   daily 8am
```
Delivers one concrete, actionable coding tip. Not a tutorial - a single
technique, pattern, or built-in the user may not know. Example:
"Today: Python's `collections.defaultdict` - here's when to use it
instead of a regular dict and why it's faster."

Works for any language or framework: Python, JavaScript, TypeScript,
Flutter/Dart, SQL, system design, algorithms.

---

### 2.4 Book Chapter Companion
```
User says:  "I'm reading Atomic Habits, send me one key insight daily
             so I can apply it"
Connector:  none
Template:   plain_text
Schedule:   daily 9am
```
Delivers one insight from a named book per day, with a concrete
application prompt. "Today's insight from Atomic Habits: habits form
through cue, craving, response, reward. Your prompt: identify one habit
you want to build. What's the cue that will trigger it?"

Learning without having to finish the book first.

---

### 2.5 Interview Prep Agent
```
User says:  "I have a Google SWE interview in 3 weeks, prepare me daily"
Connector:  none
Template:   daily_task
Schedule:   daily 9am
```
Creates a 21-day preparation plan. Each day: one LeetCode-style problem
category, one system design concept, one behavioral question to practice.
Tracks progress, adjusts difficulty, flags weak areas based on replies.

---

### 2.6 Habit Anchor Agent
```
User says:  "remind me to meditate every morning and track my streak"
Connector:  none
Template:   streak_counter
Schedule:   daily 7am
```
Daily nudge at a set time. User taps Done when they've meditated.
Streak builds. Milestone messages at day 7, 21, 66. If streak breaks,
no shame - just a warm restart message. No guilt. No judgment. Just the
next chance to build the habit.

Works for any habit: exercise, reading, journaling, cold shower,
gratitude practice, no-phone mornings.

---

## Category 3 - Productivity and Work

*Agents that track, report, and manage work-related information.*

---

### 3.1 EOD Task Report
```
User says:  "create an end of day report of what I did in Slack today"
Connector:  Slack
Template:   plain_text
Schedule:   daily 5:30pm
```
Reads Slack messages sent by the user that day, extracts tasks discussed,
decisions made, and items resolved. Formats as a clean EOD summary.
Useful for managers, freelancers, or anyone who needs to track their
own output.

---

### 3.2 Weekly Progress Report
```
User says:  "every Friday send me a summary of what I accomplished this week"
Connector:  Slack + Google Drive
Template:   plain_text
Schedule:   weekly Friday 5pm
```
Combines Slack activity and Drive file changes to produce a weekly
accomplishment report. What was built, what was decided, what moved
forward. Never blank on "what did you do this week" in 1:1s again.

---

### 3.3 Freelancer Invoice Tracker
```
User says:  "track my unpaid invoices and remind me about them weekly"
Connector:  Gmail
Template:   urgency_list
Schedule:   weekly Monday 9am
```
Searches Gmail for sent invoices, cross-references with payment
confirmations received. Surfaces invoices that are outstanding past
their due date. Flags the oldest and largest first. Never chase a
payment from memory again.

---

### 3.4 Subscription Auditor
```
User says:  "audit my subscriptions every month and flag ones I don't use"
Connector:  Gmail
Template:   data_summary
Schedule:   monthly 1st of month
```
Scans Gmail for billing receipts and subscription emails. Identifies
recurring charges. Flags subscriptions with no associated usage emails
in the past 30 days. Catches duplicates (billed twice by same service).
Surfaces total monthly spend on subscriptions.

---

### 3.5 Email Follow-up Watcher
```
User says:  "alert me if someone I emailed hasn't replied in 3 days"
Connector:  Gmail
Template:   urgency_list
Schedule:   daily 10am
```
Tracks outgoing emails that haven't received a reply within a defined
window. Surfaces them as follow-up candidates. Never let an important
email thread die because you forgot to follow up.

---

### 3.6 Lead Response Monitor
```
User says:  "alert me immediately if a new lead emails me"
Connector:  Gmail
Template:   urgency_list
Schedule:   event-triggered
```
Watches Gmail for emails matching lead keywords (inquiry, proposal,
pricing, services). Messages immediately when one arrives. Ensures
leads never wait hours for a response because the inbox wasn't checked.

---

### 3.7 Project Deadline Watcher
```
User says:  "remind me about my project deadlines every Monday morning"
Connector:  Google Drive + Gmail
Template:   checklist
Schedule:   weekly Monday 8am
```
Scans Docs and Sheets for deadline mentions, cross-references with
calendar events described in emails. Surfaces upcoming deadlines for
the week ahead. No project management tool required.

---

## Category 4 - Personal Life

*Agents for life outside work. No connector required for most.*

---

### 4.1 Procrastination Breaker
```
User says:  "I've been procrastinating building my portfolio website
             for 3 weeks, help me actually do it"
Connector:  none
Template:   daily_task
Schedule:   daily 9am
```
The anti-procrastination agent. Breaks any large, overwhelming project
into minimum viable daily sessions - small enough that "I don't have
time" or "I'm not in the mood" has no valid answer.

How it works:
- Day 1: analyses the project, creates 8–15 sessions, sends session 1
- Every day: delivers one session - specific, time-boxed, unambiguous
- User replies Done / Need more time / Too hard
- Agent adapts: more time = same task tomorrow, too hard = breaks it smaller
- No shame for missing days - just the next session waiting

The magic: starting feels trivial because the task is trivially small.
The momentum builds itself.

Works for anything that's been avoided:
- portfolio website
- thesis or dissertation
- startup idea
- side project
- difficult conversation
- tax filing
- home decluttering
- learning a new skill

This is one of Sydney's most emotionally resonant agents. The feeling
of finally making progress on something that's haunted you is the kind
of experience people talk about.

---

### 4.2 Fitness Check-in
```
User says:  "give me a daily fitness check every morning based on my
             sleep and activity"
Connector:  Google Fit (Phase 2 connector)
Template:   data_summary
Schedule:   daily 7am
```
Reads sleep duration and quality, step count, active minutes.
Delivers a morning assessment: "You slept 6h 20min. Below your 8h goal.
Today's suggested activity: light walk, skip intense training.
Yesterday's steps: 4,200 of 8,000 goal."

A personal trainer who actually knows your data, every morning,
for less than a coffee.

---

### 4.3 Travel Sentinel
```
User says:  "watch my upcoming trip and alert me about anything I need to know"
Connector:  Gmail
Template:   checklist
Schedule:   event-triggered (monitors for booking confirmations)
```
Detects flight and hotel booking confirmations from Gmail. Tracks:
- check-in window opening
- current weather at destination
- travel advisories
- passport validity (flags if less than 6 months remain)
- hotel confirmation not yet received
- visa requirements for destination

Messages the user when anything needs attention. The travel agent
you never had to call.

---

### 4.4 Parenting Milestone Agent
```
User says:  "my baby Lucas is 8 months old, send me weekly development updates"
Connector:  none
Template:   plain_text
Schedule:   weekly same day each week
```
Delivers age-appropriate developmental milestone information weekly.
What to watch for this week, what's normal, what's worth mentioning
to a doctor. Not medical advice - evidence-based developmental guidance
that makes every parent feel more informed and confident.

Works from birth through early childhood. One of the most personal
agents Sydney can create - and one that requires nothing but a name
and a birth date.

---

### 4.5 Relationship Nudge Agent
```
User says:  "remind me to check in with my close friends, 
             I tend to lose touch"
Connector:  none
Template:   plain_text
Schedule:   weekly
```
Rotates through a defined list of people. Each week suggests one person
to reach out to, with a gentle prompt. "This week: check in with Rohan.
You haven't spoken in a while. Even a one-line message counts."

The agent that maintains the friendships busy people let drift.

---

### 4.6 Gratitude Journal Prompt
```
User says:  "prompt me to write three things I'm grateful for every night"
Connector:  none
Template:   plain_text
Schedule:   daily 9pm
```
Sends a gentle evening prompt. Tracks the streak. After 21 days sends
a milestone message. Research-backed: gratitude journaling for 21 days
shows measurable improvement in wellbeing. The agent makes the practice
effortless - the prompt arrives, you reply with three things, done.

---

### 4.7 Job Market Radar
```
User says:  "send me senior product manager roles in Bangalore every Monday"
Connector:  web search (no OAuth)
Template:   plain_text
Schedule:   weekly Monday 8am
```
Searches for relevant job postings matching the user's criteria -
role, location, seniority, company type. Delivers a curated list.
Passive job seekers - most employed professionals - get market visibility
without actively looking. When the right role appears, they see it.

---

## Category 5 - Study Agent Full Lifecycle

*This section documents the complete study agent experience in detail,
because it is one of Sydney's highest-impact use cases.*

---

### The study agent, day by day

**Day 1 - Plan creation**
```
📚 Study Agent                    just now

Your JEE plan is ready.

183 days · 3 subjects · 12 chapters each

July–Aug:   Physics foundation
Sept–Oct:   Chemistry + Physics revision
Nov 1–10:   Full revision + mock tests
Nov 11–14:  Light revision only
Nov 15:     Exam day 🎯

Starting tomorrow: Mechanics - Kinematics

I'll message you every morning at 8am.
```

**Daily message (normal day)**
```
📚 Study Agent                    8:00am

Day 12 of 183 · Physics          🔥 11 day streak

Today: Kinematics - Equations of Motion
~45 min · builds on yesterday's displacement session

Physics     ████░░░░░░  38%  on track
Chemistry   ░░░░░░░░░░   0%  starts Sep
Maths       ░░░░░░░░░░   0%  starts Oct

Overall     ██░░░░░░░░  15% on track ✓

[Done ✓]   [Need more time]   [Too hard]
```

**When user taps "Need more time" twice in a row**
```
📚 Study Agent                    8:00am

Still on Kinematics. That's completely fine.

Some topics take longer. Kinematics has
a lot of equations to internalise.

Take one more day. No rush.

If it's confusing, tell me which part
and I'll find a different way to explain it.

[Done ✓]   [It's confusing - help]
```

**When user taps "It's confusing - help"**
```
📚 Study Agent                    8:02am

Equations of motion trip a lot of people up.

The key insight: there are only 4 equations.
Every kinematics problem uses one or two of them.

Instead of memorising them, try this:

Start with v = u + at
Everything else follows from this one equation
by substituting or integrating.

v² = u² + 2as  →  comes from eliminating t
s = ut + ½at²  →  comes from integrating v = u + at

Try one problem using only v = u + at today.
Don't use the others yet.

[Got it, I'll try]   [Still confused]
```

**Spaced repetition trigger (7 days after studying a topic)**
```
📚 Study Agent                    8:00am

Day 19 · Revision day

You studied Newton's Laws 7 days ago.

Research shows revisiting after 7 days
locks it into long-term memory.

Quick check - can you write Newton's
Second Law in two different forms?

Think first, then tap below.

[I remember it]   [Show me a hint]   [I need a full review]
```

**Critical period (14 days before exam)**
```
📚 Study Agent                    8:00am

⚡ 14 days to JEE

Switching to full revision mode.
No new topics. Your brain needs consolidation now.

This week:
Mon: Physics - all mechanics
Tue: Physics - waves and optics
Wed: Chemistry - organic reactions
Thu: Chemistry - physical chemistry
Fri: Maths - calculus
Sat: Maths - algebra and vectors
Sun: Full mock test

Sleep 8 hours. Eat well.
You've put in 169 days of work.
Trust it.

[Ready]
```

**Exam eve**
```
📚 Study Agent                    9:00pm

Tomorrow is JEE.

Don't study tonight.
Your brain is ready.

Checklist:
☐  Admit card printed
☐  Pencils, pens, eraser ready
☐  Alarm set for 6am
☐  Dinner eaten
☐  Phone charging

You started this 183 days ago
with one message to Sydney.

Tomorrow you show what you built.

You've got this. 🎯
```

---

## Category 6 - Procrastination Breaker Full Lifecycle

*The complete experience of the anti-procrastination agent.*

---

### Portfolio website - broken down

**Day 1 - Project intake**
```
🎯 Portfolio Project              just now

Portfolio website. Got it.

I've broken this into 12 sessions.
Each one is 30–45 minutes max.
None require you to "be ready."
You just start.

Session 1 · Today · ~10 min

Open a blank document.
Write 3 sentences:
  1. Who you are
  2. What you do  
  3. Who you do it for

That's it. No design. No code.
Just 3 sentences. Close the doc when done.

[Done ✓]   [Need more time]   [Too hard, break it smaller]
```

**User taps "Too hard"**
```
🎯 Portfolio Project              just now

Even smaller.

Open a document.
Type your name at the top.
Save it as "portfolio.doc"

That's the whole task.

[Done ✓]
```

**Day 2 - Building momentum**
```
🎯 Portfolio Project              9:00am

Yesterday: ✓ Started the document.

That was the hardest step.
Starting is always the hardest.

Today · Session 2 · ~30 min

Look at 5 portfolios you admire.
Save the links in your document.
Don't analyse them yet. Just collect.

[Done ✓]   [Need more time]   [Too hard]
```

**Day 5 - Checking in after progress**
```
🎯 Portfolio Project              9:00am

4 sessions done. You're 33% through.

You've done more on this project
in 4 days than in the 3 weeks before.

Today · Session 5 · ~45 min

Write one case study headline for your
best piece of work. One sentence.
"I helped X achieve Y by doing Z."

[Done ✓]   [Need more time]   [Too hard]
```

**User goes dark for 3 days - day 8**
```
🎯 Portfolio Project              9:00am

Welcome back.

No catch-up needed. No guilt.
You're at session 4. That stays.

Today whenever you're ready:

Session 5 · ~45 min
Write one case study headline.
"I helped X achieve Y by doing Z."

[Done ✓]   [Need more time]   [Too hard]
```

**Day 12 - Final session**
```
🎯 Portfolio Project              9:00am

Session 12 of 12. Last one.

Today: publish it.
Not "make it perfect." Publish it.

Use Carrd, Webflow, or GitHub Pages.
30 minutes. Live tonight.

Done is better than perfect.
You've been working on this for 12 sessions.
Time to let people see it.

[Published ✓ 🎉]   [Need one more day]
```

**When user taps Published**
```
🎯 Portfolio Project              just now

You did it.

3 weeks of procrastination →
12 sessions → live portfolio.

That's how it works.
One small step. Every day.

Want to tackle your next project?

[Start a new project]   [Take a break first]
```

---

## Category 7 - Future Agents (Phase 3+)

*Agents that require write permissions or advanced connectors.
Not available at launch. Documented here for future reference.*

---

### 7.1 Draft Reply Agent
```
User says:  "draft replies to my important emails and show them to me for approval"
Connector:  Gmail (write)
Template:   urgency_list with approve buttons
Schedule:   daily 10am
Phase:      3 (assisted actions)
```
Reads important unanswered emails, drafts replies based on context
and user's past communication style. Shows drafts for approval before
sending. User taps Approve or Edit. Agent sends only approved replies.

---

### 7.2 Calendar Scheduler
```
User says:  "when someone asks to meet, find a good slot and suggest it"
Connector:  Gmail + Google Calendar (write)
Template:   checklist
Schedule:   event-triggered
Phase:      3 (assisted actions)
```
Detects meeting request emails. Checks calendar availability. Suggests
three slots in a reply draft. User approves the draft. Agent sends.
Meeting coordination without touching the calendar.

---

### 7.3 Coding Agent
```
User says:  "build me a Python script that pulls my Gmail attachments 
             and organises them by sender"
Connector:  OpenShell sandbox (Phase 3)
Template:   (web IDE panel on desktop)
Schedule:   on-demand
Phase:      3 (OpenShell + EC2)
```
Runs inside an isolated OpenShell sandbox per user. Writes the code,
installs dependencies, runs tests, returns working script. On mobile:
messages you the result. On web: full IDE panel with code editor,
terminal output, and agent chat side by side.

---

### 7.4 Physical Device Agents (Phase 5+)
```
User says:  "clean the apartment at 10am on weekdays"
Connector:  Robot MCP (future)
Template:   plain_text
Schedule:   weekdays 10am
Phase:      5 (physical AI)
```
As physical AI devices (robots, smart home) adopt MCP, Sydney becomes
the command interface for the physical world using the same agent model,
same inbox, same message format. The user doesn't learn a new app for
each device - all of them become agent contacts in Sydney.

---

## Quick Reference - Agents by Connector

### No connector required (works from day one)
- Tech News Brief
- Niche News Agent
- Competitor Watcher
- Stock / Portfolio Watch
- JEE / NEET Study Plan
- Daily Language Word
- Coding Tip of the Day
- Book Chapter Companion
- Interview Prep Agent
- Habit Anchor Agent
- Procrastination Breaker
- Parenting Milestone Agent
- Relationship Nudge Agent
- Gratitude Journal Prompt
- Job Market Radar
- Any learning or habit agent

### Gmail required
- Daily Email Digest
- Freelancer Invoice Tracker
- Subscription Auditor
- Email Follow-up Watcher
- Lead Response Monitor
- Travel Sentinel (partial)

### Slack required
- Slack Digest
- Slack Urgent Watcher
- EOD Task Report

### Google Drive required
- Weekly Drive Summary
- PDF Summarizer
- Weekly Progress Report (partial)
- Project Deadline Watcher (partial)

### Google Docs required
- Meeting Recap Agent
- Weekly Progress Report (partial)

### Multiple connectors
- Weekly Progress Report (Slack + Drive)
- Project Deadline Watcher (Drive + Gmail)
- Travel Sentinel (Gmail + Calendar)

---

## Quick Reference - Agents by Template

### plain_text
Tech News, Niche News, PDF Summary, Meeting Recap, Weekly Progress,
Coding Tip, Book Chapter, Parenting Milestone, Relationship Nudge,
Gratitude Prompt, Job Market Radar, Competitor Watcher (simple)

### data_summary
Email Digest, Slack Digest, Portfolio Watch, Subscription Auditor,
Fitness Check-in, Weekly Drive Summary

### urgency_list
Slack Watcher, Email Follow-up Watcher, Lead Monitor, Invoice Tracker,
Draft Reply Agent (Phase 3)

### progress_tracker
JEE Study Plan, NEET Study Plan, any multi-subject learning plan,
fitness progress over time

### daily_task
Procrastination Breaker, Interview Prep, any day-by-day goal pursuit

### streak_counter
Language Word, Habit Anchor, Gratitude Journal, Coding Tip (with streak),
any daily consistency agent

### checklist
Travel Sentinel, Exam Eve, Pre-deadline checklist, Weekly Review Action Items

### comparison
Competitor Watcher (detailed), market analysis agents

---

## The one-sentence test

Every agent in this document can be created with one sentence.
That's the standard. If it takes more than one sentence to describe
what you want, the agent creation flow needs to handle the clarification
in the confirmation card - not burden the user with a form.

If a use case can't be initiated in one sentence, it's not a Sydney agent.
It's a feature request for the intent parser.
