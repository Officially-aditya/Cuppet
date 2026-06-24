type DsaQuestion = {
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  prompt: string;
  target: string;
  hint: string;
};

const dsaQuestions: DsaQuestion[] = [
  {
    title: "Two Sum",
    difficulty: "Easy",
    prompt:
      "Given an array of integers and a target, return the indices of two numbers that add up to the target.",
    target: "Solve it in O(n) time using a hash map.",
    hint: "Store each number's complement as you scan the array."
  },
  {
    title: "Valid Parentheses",
    difficulty: "Easy",
    prompt:
      "Given a string containing only brackets, decide whether every opening bracket is closed in the correct order.",
    target: "Use a stack and handle mismatched closing brackets immediately.",
    hint: "Push expected closing brackets instead of opening brackets."
  },
  {
    title: "Merge Intervals",
    difficulty: "Medium",
    prompt:
      "Given intervals like [start, end], merge all overlapping intervals and return the condensed list.",
    target: "Sort by start time, then merge into the last accepted interval.",
    hint: "After sorting, only compare the current interval with the previous merged interval."
  },
  {
    title: "Binary Tree Level Order Traversal",
    difficulty: "Medium",
    prompt:
      "Given a binary tree, return the node values level by level from top to bottom.",
    target: "Use BFS with a queue and process one level at a time.",
    hint: "Capture the queue length before each level starts."
  },
  {
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    prompt:
      "Given a string, find the length of the longest substring that contains no repeated characters.",
    target: "Use a sliding window with last-seen character positions.",
    hint: "Move the left pointer only forward when a duplicate appears."
  },
  {
    title: "Top K Frequent Elements",
    difficulty: "Medium",
    prompt:
      "Given an integer array and k, return the k most frequent elements.",
    target: "Use frequency counting plus a heap or bucket sort.",
    hint: "Bucket sort can make this O(n) because frequencies range from 1 to n."
  },
  {
    title: "Number of Islands",
    difficulty: "Medium",
    prompt:
      "Given a grid of 1s and 0s, count how many connected groups of 1s exist horizontally or vertically.",
    target: "Use DFS, BFS, or union-find to mark visited land.",
    hint: "Sink each island after counting it so it cannot be counted twice."
  },
  {
    title: "Search in Rotated Sorted Array",
    difficulty: "Medium",
    prompt:
      "Given a rotated sorted array and a target, return the target index or -1.",
    target: "Use modified binary search in O(log n).",
    hint: "At every step, one half of the array is still sorted."
  },
  {
    title: "Coin Change",
    difficulty: "Medium",
    prompt:
      "Given coin denominations and an amount, return the fewest coins needed to make that amount, or -1.",
    target: "Use bottom-up dynamic programming over amounts from 0 to target.",
    hint: "Initialize impossible states with a value larger than the amount."
  },
  {
    title: "Daily Temperatures",
    difficulty: "Medium",
    prompt:
      "Given daily temperatures, return how many days each day must wait for a warmer temperature.",
    target: "Use a monotonic decreasing stack of indices.",
    hint: "When the current temperature is warmer, resolve previous colder days."
  },
  {
    title: "Product of Array Except Self",
    difficulty: "Medium",
    prompt:
      "Given an integer array, return an array where each index contains the product of all other values.",
    target: "Solve in O(n) time without division.",
    hint: "Multiply prefix products in one pass and suffix products in another."
  },
  {
    title: "Course Schedule",
    difficulty: "Medium",
    prompt:
      "Given course prerequisites, determine whether it is possible to finish all courses.",
    target: "Detect cycles using topological sort or DFS coloring.",
    hint: "If Kahn's algorithm processes fewer than n courses, there is a cycle."
  }
];

const dsaRequestPattern =
  /\b(?:dsa|data structures?\s*(?:and|&)\s*algorithms?|algorithm)\b[\s\S]*\b(?:question|problem|challenge)\b/i;

export function wantsDsaQuestion(text: string): boolean {
  return dsaRequestPattern.test(text);
}

export function createDsaReminderBody(params: {
  action: string;
  agentId: string;
  now?: Date;
  topicsCovered?: string[];
}): string {
  const reminder = reminderWithoutDsaRequest(params.action);
  const sections = [];

  if (reminder) {
    sections.push(`Reminder: ${withPeriod(reminder)}`);
  }

  sections.push(createDsaQuestionSection(params));

  return sections.join("\n\n");
}

export function createDsaQuestionSection(params: {
  agentId: string;
  now?: Date;
  topicsCovered?: string[];
}): string {
  const date = dateKey(params.now ?? new Date());
  const question = questionForDate(date, params.agentId, params.topicsCovered);

  return [
    `DSA question of the day (${date}): ${question.title}`,
    `Difficulty: ${question.difficulty}`,
    "",
    question.prompt,
    "",
    `Target: ${question.target}`,
    `Hint: ${question.hint}`
  ].join("\n");
}

export function renderDsaQuestion(params: {
  agentId: string;
  now?: Date;
  topicsCovered?: string[];
}) {
  const date = dateKey(params.now ?? new Date());
  const question = questionForDate(date, params.agentId, params.topicsCovered);
  const slug = question.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const leetcodeUrl = `https://leetcode.com/problems/${slug}/`;

  return {
    title: question.title,
    difficulty: question.difficulty,
    problem: question.prompt,
    constraints: question.target,
    examples: [],
    hint: question.hint,
    references: [
      {
        title: `LeetCode: ${question.title}`,
        url: leetcodeUrl
      }
    ],
    completed: false,
    actions: [
      { id: "done", label: "Done", style: "primary" },
      { id: "snooze", label: "Snooze 30min", style: "secondary" },
      { id: "skip", label: "Skip today", style: "ghost" }
    ] as Array<{
      id: "done" | "snooze" | "skip";
      label: string;
      style?: "primary" | "secondary" | "ghost";
    }>
  };
}

function questionForDate(date: string, agentId: string, topicsCovered?: string[]): DsaQuestion {
  const pool = dsaQuestions.filter(
    (q) => !topicsCovered?.map((t) => t.toLowerCase()).includes(q.title.toLowerCase())
  );
  const questionPool = pool.length > 0 ? pool : dsaQuestions;
  const index = Math.abs(hash(`${date}:${agentId}`)) % questionPool.length;
  return questionPool[index]!;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function reminderWithoutDsaRequest(action: string): string {
  return action
    .replace(/^reminder:\s*/i, "")
    .replace(
      /\s*(?:,?\s*(?:and|along with reminders?)\s*)?(?:send|give|share|include)\s+me\s+(?:the\s+)?(?:dsa|data structures?\s*(?:and|&)\s*algorithms?|algorithm)\s+(?:question|problem|challenge)(?:\s+of\s+the\s+day|\s+daily)?\s*\.?$/i,
      ""
    )
    .trim()
    .replace(/\s+\.$/, "");
}

function withPeriod(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function hash(input: string): number {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) {
    value = (value * 31 + input.charCodeAt(i)) | 0;
  }
  return value;
}
