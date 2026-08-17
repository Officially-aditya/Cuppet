import {
  Activity,
  Bot,
  CalendarDays,
  FileText,
  Github,
  HardDrive,
  Mail,
  MessageSquare,
  Newspaper,
  Search,
  Sparkles,
  Sun,
  type LucideIcon
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  activity: Activity,
  bot: Bot,
  calendar: CalendarDays,
  calendardays: CalendarDays,
  filetext: FileText,
  github: Github,
  harddrive: HardDrive,
  mail: Mail,
  messagesquare: MessageSquare,
  newspaper: Newspaper,
  search: Search,
  sparkles: Sparkles,
  sun: Sun
};

export function AgentIcon({ name, size = 19 }: { name?: string; size?: number }) {
  const Icon = icons[(name ?? "bot").replace(/[^a-z]/gi, "").toLowerCase()] ?? Bot;
  return <Icon size={size} />;
}

export function agentTone(seed: string): "coral" | "sage" | "blue" | "gold" {
  const value = [...seed].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return (["coral", "sage", "blue", "gold"] as const)[value % 4]!;
}
