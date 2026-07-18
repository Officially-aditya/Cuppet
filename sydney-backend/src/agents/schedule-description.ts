export function describeSchedule(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return "on a custom schedule";

  const minuteRaw = parts[0]!;
  const hourRaw = parts[1]!;
  const dayOfMonth = parts[2]!;
  const month = parts[3]!;
  const dayOfWeek = parts[4]!;
  const minute = Number(minuteRaw);
  const hour = Number(hourRaw);
  if (
    !Number.isInteger(minute) ||
    !Number.isInteger(hour) ||
    minute < 0 ||
    minute > 59 ||
    hour < 0 ||
    hour > 23 ||
    month !== "*"
  ) {
    return "on a custom schedule";
  }

  const time = formatTime(hour, minute);
  if (dayOfMonth === "*" && dayOfWeek === "*") {
    return `every day at ${time}`;
  }
  if (dayOfMonth === "*" && dayOfWeek === "1-5") {
    return `every weekday at ${time}`;
  }
  if (dayOfMonth === "*" && /^[0-7]$/.test(dayOfWeek)) {
    return `weekly on ${weekdayName(Number(dayOfWeek))} at ${time}`;
  }
  if (/^\d{1,2}$/.test(dayOfMonth) && dayOfWeek === "*") {
    const day = Number(dayOfMonth);
    if (day >= 1 && day <= 31) {
      return `monthly on the ${ordinal(day)} at ${time}`;
    }
  }
  return "on a custom schedule";
}

function formatTime(hour24: number, minute: number): string {
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

function weekdayName(day: number): string {
  return (
    [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday"
    ][day] ?? "Monday"
  );
}

function ordinal(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}
