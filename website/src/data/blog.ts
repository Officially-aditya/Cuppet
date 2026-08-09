export type BlogVisual = 'signal' | 'connections' | 'filter' | 'trust'

export type BlogSection = {
  heading: string
  paragraphs: string[]
}

export type BlogPost = {
  slug: string
  title: string
  excerpt: string
  dek: string
  category: string
  published: string
  displayDate: string
  readingTime: string
  visual: BlogVisual
  sections: BlogSection[]
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'the-information-problem-ai-still-hasnt-solved',
    title: "The information problem AI still hasn't solved",
    excerpt:
      'AI can find almost anything. The harder question is whether it can decide what is worth bringing to you.',
    dek:
      'The next useful leap in AI will not come from producing more information. It will come from selecting less of it, with better judgment and a clearer understanding of the person receiving it.',
    category: 'Perspective',
    published: '2026-07-18',
    displayDate: 'July 18, 2026',
    readingTime: '8 min read',
    visual: 'signal',
    sections: [
      {
        heading: 'Access is no longer the scarce resource',
        paragraphs: [
          'For most of the internet era, finding information was the work. You had to know where to look, choose the right query, open a dozen tabs, and compare sources that rarely agreed on structure or language. Search engines made that process dramatically faster. Generative AI compressed it again by turning the search, synthesis, and first draft into a single conversation. A capable model can now explain a technical concept, summarize a market, inspect a document, or sketch a plan in seconds.',
          'That progress is real, but it leaves an important problem untouched. Most people are not short of information. They are short of attention. Their inbox, documents, calendars, group chats, dashboards, feeds, and project tools already produce more context than a working day can absorb. Adding another place that can generate an unlimited amount of text does not automatically make that day more informed. Sometimes it simply creates a more articulate form of overload.',
        ],
      },
      {
        heading: 'An answer is not the same as relevance',
        paragraphs: [
          'A good answer can be accurate and still be useless. A ten-point industry summary may contain only one development that affects your current work. A complete inbox recap can bury the message that needs a reply before noon. A thorough research report may cover the whole field while missing the narrow change that invalidates a decision you made last week. Quality is not only a property of the source or the prose. It depends on timing, context, and the consequence for a specific person.',
          'Relevance therefore cannot be solved by a model in isolation. It depends on what you are working on, which commitments are active, what you already know, what changed, and how much interruption the change deserves. This is why a generic chatbot often feels impressive in a demonstration and strangely demanding in daily life. It waits for you to remember the question, gather the context, ask at the right moment, and then decide what part of the response matters.',
        ],
      },
      {
        heading: 'Selection is the missing product layer',
        paragraphs: [
          'The more useful system begins before the prompt. It knows the sources you have deliberately connected, the topics or projects you care about, the schedule on which information becomes useful, and the boundaries it must respect. Instead of asking you to visit a new dashboard, it watches for the small set of changes that match those instructions. It compresses them into a brief result and sends that result to the place where you already make decisions.',
          'This is not about hiding evidence or allowing an algorithm to decide what is true. Good selection should make its reasoning inspectable. Every concise update should preserve a route back to the original email, file, event, or article. The system should be able to say why something was included, what was ignored, and which instruction shaped the result. Selection earns trust when it reduces noise without severing the connection to source material.',
        ],
      },
      {
        heading: 'Useful AI should respect the cost of interruption',
        paragraphs: [
          'Every notification spends attention. Most software treats that cost as negligible because engagement is valuable to the product. A tool designed for better information access needs the opposite incentive: silence is a successful outcome when nothing meaningful changed. The goal is not to make the user return more often. It is to make each return more worthwhile, and eventually to make returning unnecessary because the result arrives through an existing channel.',
          'That changes how AI products should be measured. The interesting numbers are not prompts sent, minutes spent, or words generated. They are questions the user no longer had to remember, sources they no longer had to check manually, and decisions they could make with less uncertainty. A three-line message delivered at the right time can create more value than a beautifully designed dashboard full of exhaustive analysis.',
        ],
      },
      {
        heading: 'From infinite answers to selected intelligence',
        paragraphs: [
          'AI has already made information abundant. Its next responsibility is to make abundance manageable. That requires products built around durable intent rather than isolated prompts: tell the system what deserves attention once, give it appropriately limited access, and let it return only when the instruction has been satisfied. The intelligence is not merely in producing the response. It is in knowing when a response is warranted.',
          'The best AI experience may therefore feel quieter than the technology that came before it. It will not ask to become the center of your work. It will sit across the tools you already use, notice the few changes that match your priorities, and make those changes easy to act on. When information is selected well, the product becomes almost invisible. What remains is a clearer day.',
        ],
      },
    ],
  },
  {
    slug: 'why-ai-should-work-through-the-tools-you-already-use',
    title: 'Why AI should work through the tools you already use',
    excerpt:
      'The most useful AI product may not be another destination. It may be a quiet layer across the tools already holding your work.',
    dek:
      'People do not need another place to check. AI becomes genuinely useful when it can understand the systems that already contain our commitments and return the result through a familiar channel.',
    category: 'Product',
    published: '2026-07-15',
    displayDate: 'July 15, 2026',
    readingTime: '7 min read',
    visual: 'connections',
    sections: [
      {
        heading: 'Work already has a home',
        paragraphs: [
          'Your work is not waiting inside an AI app. It is distributed across email threads, shared drives, calendars, code repositories, project boards, and conversations with colleagues. Each tool holds a different kind of truth. Email records agreements and requests. Calendars reveal when those commitments become urgent. Documents carry evolving decisions. Project tools show status, while messaging captures the context that never made it into a formal brief.',
          'A standalone assistant sees very little of this unless you repeatedly move the information into its window. Copying and pasting can be useful for a one-off task, but it is a poor foundation for recurring work. It asks the person to become the integration layer: find the material, remove anything sensitive, explain the context, and repeat the process whenever something changes. The model may save time during the final step while the setup quietly consumes it.',
        ],
      },
      {
        heading: 'Another dashboard creates another obligation',
        paragraphs: [
          'Software often responds to complexity by creating a new dashboard. The dashboard promises one place for everything, but it usually becomes one more place beside everything. It needs to be opened, scanned, configured, and kept current. Over time, the user develops a new recurring task: check the tool that was supposed to remove recurring tasks. The problem is especially visible with AI products that generate useful work but require a visit to discover whether the work is finished.',
          'A better product should meet people closer to the point where attention already exists. If a result is a short update, a message may be the right interface. If it changes a meeting, the calendar may be the right interface. If it is a draft that needs collaboration, the document may be the right interface. The destination should follow the shape of the outcome instead of forcing every outcome into the product maker’s preferred container.',
        ],
      },
      {
        heading: 'Connected does not have to mean uncontrolled',
        paragraphs: [
          'The phrase “connected AI” can sound broader than it needs to be. Useful access should be specific, visible, and reversible. A user may choose one folder rather than an entire drive, a single calendar rather than every event, or read access without permission to modify anything. Connections should explain what the system can see, what it cannot see, and which task currently depends on that access.',
          'Starting with read-first access creates room to establish value before asking for authority. Many high-value workflows do not require autonomous action at all. Finding the two emails that need a reply, tracking whether a project document changed, or assembling a morning brief are acts of attention, not acts of control. When a workflow eventually benefits from writing or sending, that permission can be requested at the moment it becomes relevant rather than bundled into setup.',
        ],
      },
      {
        heading: 'Persistent intent is more useful than repeated prompting',
        paragraphs: [
          'People repeat themselves to software because most tools forget the reason they were opened. Every morning begins with the same searches. Every Friday ends with the same status collection. Every new client message triggers the same sequence of tabs. An AI system connected to existing tools can turn that repetition into a durable instruction: watch these sources, apply these criteria, and report on this schedule.',
          'Persistence changes the role of the interface. Instead of being a blank box that waits for a clever prompt, it becomes a place to establish and refine expectations. The instruction should remain easy to inspect in plain language. The user should be able to change the schedule, narrow a source, or pause the routine with the simplicity of editing a message. The system carries the operational burden while the person retains the judgment.',
        ],
      },
      {
        heading: 'The product can disappear while the value remains',
        paragraphs: [
          'Great infrastructure is often noticed only when it fails. AI tools that work across existing systems can aspire to the same quiet reliability. You should not need to watch a progress screen or maintain a complicated workflow graph. You should be able to describe the outcome, connect the minimum source, and trust that the system will either deliver the result or clearly explain why it could not.',
          'This is a different ambition from becoming the app where a person spends the most time. It is about helping the tools they already chose work together with less manual coordination. The AI layer does not replace email, calendars, documents, or chat. It gives those tools a shared ability to notice, select, and communicate what matters. The product becomes lighter, while the user’s existing environment becomes more capable.',
        ],
      },
    ],
  },
  {
    slug: 'from-information-overload-to-selected-intelligence',
    title: 'From information overload to selected intelligence',
    excerpt:
      'Summaries make information shorter. Selection makes it smaller. That distinction changes what an AI assistant should do.',
    dek:
      'Compression alone cannot solve overload. A useful information system needs to understand priorities, preserve sources, and sometimes decide that the right update is no update at all.',
    category: 'Design',
    published: '2026-07-11',
    displayDate: 'July 11, 2026',
    readingTime: '8 min read',
    visual: 'filter',
    sections: [
      {
        heading: 'Shorter is not always smaller',
        paragraphs: [
          'Summarization is one of the clearest strengths of modern AI. A long document becomes a page, a meeting becomes a list, and a crowded inbox becomes a paragraph. The reduction feels like relief because the result is easier to scan. Yet summarizing every source can leave the underlying information burden intact. Twenty short summaries are still twenty things asking for attention. Compression changes the size of each object without questioning whether the object belongs in the day at all.',
          'Selection asks a harder question: which parts should cross the boundary into awareness? That question cannot be answered by length alone. A one-line change to a contract may matter more than a fifty-page report. A familiar weekly update may deserve silence, while a small deviation needs immediate attention. The system has to evaluate a change against a person’s stated priorities rather than applying the same summarization process to everything it can access.',
        ],
      },
      {
        heading: 'A useful filter begins with explicit intent',
        paragraphs: [
          'Personalization is often treated as something a product infers in the background. For high-trust information work, important preferences should be expressible and inspectable. “Tell me when a launch date moves.” “Send three AI infrastructure stories every morning, but skip funding announcements.” “At the end of the day, show only messages that require my reply.” These instructions make relevance concrete enough for both the person and the system to evaluate.',
          'Plain language matters because priorities change faster than configuration screens. A rule built from menus can become invisible once it is saved. A sentence remains legible. It can be questioned, revised, or forwarded to a colleague. The system may translate that sentence into schedules and source queries behind the scenes, but the user-facing contract should remain understandable without requiring knowledge of how the workflow is implemented.',
        ],
      },
      {
        heading: 'Context should narrow the result, not expand surveillance',
        paragraphs: [
          'More context can improve relevance, but collecting everything is not a responsible shortcut. A well-designed assistant should let the user choose the smallest context that can satisfy the instruction. If the task concerns a project folder, the system should not need the whole drive. If it checks a daily newsletter, it should not need every message in an inbox. Scope is both a privacy boundary and a quality tool: fewer unrelated sources reduce the chance of producing plausible but distracting connections.',
          'The system should also separate durable preferences from temporary context. A preferred delivery time may remain useful for months. A confidential document needed for one question should not silently become part of every future answer. Clear source labels, visible connection settings, and routine-level permissions give the user a mental model of what the assistant knows and why it knows it.',
        ],
      },
      {
        heading: 'Silence can be a successful result',
        paragraphs: [
          'Most notification systems are designed to prove that they are working. They surface routine activity, repeated status, and low-consequence changes because an empty screen can feel like a product failure. Selected intelligence needs a different standard. If the instruction is “tell me when something affects the launch,” and nothing does, then no message is the correct output. The system has protected attention while continuing to perform the task.',
          'This requires clear expectations. A user should be able to see when a routine last ran and whether it found nothing, without receiving a notification for every empty run. Periodic health indicators can establish confidence without recreating noise. The assistant becomes dependable not because it speaks constantly, but because its silence has meaning and its interruptions consistently justify themselves.',
        ],
      },
      {
        heading: 'Designing for a finite day',
        paragraphs: [
          'The internet was built around the assumption that more access creates more value. AI makes access close to infinite, so the product challenge changes. The limiting resource is now the number of things a person can consider with care. Interfaces for selected intelligence should therefore make tradeoffs visible: why this item, why now, and what was left out. They should help a person adjust the filter when the result is too broad or too quiet.',
          'A finite day is not a constraint technology needs to defeat. It is the reality good technology should respect. When AI is designed around that reality, it stops competing for attention and starts protecting it. The outcome is not a perfect summary of everything that happened. It is a small, sourced, well-timed view of what deserves a decision next.',
        ],
      },
    ],
  },
  {
    slug: 'trustworthy-ai-starts-with-read-first-access',
    title: 'Trustworthy AI starts with read-first access',
    excerpt:
      'Before an assistant acts on your behalf, it should prove that it can understand what deserves your attention.',
    dek:
      'The fastest route to useful AI is not always more autonomy. Read-first access lets an assistant create value through awareness while keeping consequential actions in human hands.',
    category: 'Trust',
    published: '2026-07-07',
    displayDate: 'July 7, 2026',
    readingTime: '7 min read',
    visual: 'trust',
    sections: [
      {
        heading: 'Autonomy is not the only measure of progress',
        paragraphs: [
          'AI product conversations often treat action as the final proof of usefulness. An assistant should send the email, move the file, update the record, and complete the transaction. Those abilities can be valuable, but they combine several difficult problems at once: understanding the request, finding the right context, choosing an action, predicting its consequences, and recovering when the situation differs from expectation. A mistake can travel from a generated sentence into a real relationship or system of record.',
          'There is a large and underappreciated category of value before that point. People spend hours locating, comparing, checking, and remembering information so they can decide what to do. An assistant that reliably identifies the messages requiring a reply, the documents that changed, or the deadlines at risk can remove much of that work without taking an irreversible step. Awareness is not a lesser form of intelligence. It is often the safest place to establish usefulness.',
        ],
      },
      {
        heading: 'Read-first is a product principle',
        paragraphs: [
          'Read-first access means a new connection begins with the narrowest permission required to inspect relevant information. The assistant can retrieve and summarize, but it cannot send, delete, publish, or modify. This boundary should be obvious in the interface and attached to each routine. Users should not have to interpret a long permission screen to understand whether a task can change something important.',
          'The principle also shapes the workflow itself. If a request can be satisfied by delivering a sourced recommendation, the product should not ask for write access simply because an integration supports it. Additional authority becomes a deliberate upgrade tied to a concrete benefit. The user can first observe whether the assistant finds the right material, follows the instruction, and behaves predictably over time.',
        ],
      },
      {
        heading: 'Trust grows from small, observable promises',
        paragraphs: [
          'A broad promise such as “manage my inbox” is difficult to evaluate and risky to grant. A smaller promise—“at 5 PM, show me messages from clients that still need a response”—has clear inputs, timing, and success criteria. The result can be compared with the source. If it is too broad, the instruction can be refined. If it misses something, the user can explain why that message mattered. Each correction improves a bounded routine rather than changing an opaque autonomous system.',
          'Repeated reliability creates a stronger form of trust than a dramatic demo. The assistant runs when expected, cites the items it used, distinguishes fact from inference, and reports uncertainty when context is missing. The user learns where it performs well and where judgment still belongs to them. Trust becomes calibrated: neither blind confidence nor permanent suspicion, but an accurate sense of what the system can safely handle.',
        ],
      },
      {
        heading: 'Permission should follow consequence',
        paragraphs: [
          'Not all actions carry the same cost. Drafting a reply for review is different from sending it. Suggesting a calendar change is different from moving the meeting. Preparing a file is different from publishing it. Product interfaces should reflect these layers instead of treating access as a single switch between passive and autonomous. A user may be comfortable allowing low-consequence changes while requiring confirmation for anything that affects another person.',
          'This is where visible approval boundaries matter. The assistant should explain the proposed action, the source that prompted it, and what will happen after approval. Repeated actions can earn a more streamlined path only when the user explicitly chooses it. Authority should expand because the workflow has demonstrated value and predictability, not because the product wants setup to feel effortless.',
        ],
      },
      {
        heading: 'Useful first, autonomous when earned',
        paragraphs: [
          'A read-first assistant can solve meaningful problems today: research briefs, inbox triage, project monitoring, change detection, meeting preparation, and daily summaries shaped around real priorities. These workflows reduce the cognitive cost of staying informed while preserving the person’s control over communication and decisions. They also create the feedback needed to build safer action later.',
          'The long-term future may include capable agents that complete complex work across many systems. The path there should be made of understandable steps. Begin by helping people see the right information. Preserve evidence. Ask for the minimum access. Make every routine legible. Then, where action creates clear value, expand authority with consent and an appropriate checkpoint. Trustworthy AI does not begin by asking for the keys. It begins by proving that it knows which door matters.',
        ],
      },
    ],
  },
]

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug)
}
