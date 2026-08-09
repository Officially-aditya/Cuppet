import { Plus } from 'lucide-react'
import SectionHeading from '../components/SectionHeading'

const QUESTIONS = [
  {
    n: '01',
    question: 'What does Cuppet do?',
    answer:
      'Cuppet turns a plain-language request into a persistent agent. Connect the tools it needs, choose when it should run, and receive the finished result in chat.',
  },
  {
    n: '02',
    question: 'How is this different from a chatbot?',
    answer:
      'A chatbot responds when you start a conversation. Cuppet can run recurring work on its own, such as preparing a morning brief, then message you when the result is ready.',
  },
  {
    n: '03',
    question: 'What is a scheduled agent?',
    answer:
      'It is a saved instruction with a schedule, connected tools, and approved limits. For example, an agent could check your sources every weekday morning and send you a concise brief.',
  },
  {
    n: '04',
    question: 'Which apps can I connect?',
    answer:
      "Cuppet is building connectors for tools like Gmail, Calendar, Drive, Docs, Notion, and Slack. You choose which connections to enable for each agent, and more connectors are planned.",
  },
  {
    n: '05',
    question: 'Is my data private?',
    answer:
      'You decide what each agent can access. Select its connected apps and review the requested permissions before approving the agent, so it only has access to the tools you choose.',
  },
  {
    n: '06',
    question: "Do I need my company's approval to use this?",
    answer:
      "No. Cuppet connects to your own accounts individually — there's nothing for an IT team to configure or approve. If it's useful, bringing it to your team is a separate conversation for later, not a requirement to start.",
  },
]

export default function FAQ() {
  return (
    <section id="faq" className="border-t border-[var(--rule)] py-20 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="FAQ"
          title="Common questions"
          sub="Still have questions? We've got you."
          align="left"
        />

        <div className="mt-12 border-t border-[var(--rule)]">
          {QUESTIONS.map((item) => (
            <details key={item.n} className="group border-b border-[var(--rule)]">
              <summary className="flex cursor-pointer list-none items-start gap-5 py-6 marker:hidden sm:gap-8 sm:py-7">
                <span className="pt-1 text-[10px] font-semibold tracking-[0.16em] text-[var(--ink-faint)]">
                  {item.n}
                </span>
                <span className="flex-1 text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)] sm:text-lg">
                  {item.question}
                </span>
                <Plus
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--forest-mid)] transition-transform duration-200 group-open:rotate-45"
                  strokeWidth={1.5}
                />
              </summary>
              <p className="pb-6 pl-[3.25rem] pr-8 text-sm leading-6 text-[var(--ink-soft)] sm:pb-7 sm:pl-16 sm:pr-12 sm:text-[15px] sm:leading-7">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
