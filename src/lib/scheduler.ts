import { getTorontoLocalDateKey, getTorontoLocalHour, isMondayWednesdayFriday } from "@/lib/dates";

export function isScheduledRunWindow(now = new Date()) {
  return isMondayWednesdayFriday(now) && getTorontoLocalHour(now) === 6;
}

export function getScheduleLabel() {
  return "Lundi, mercredi et vendredi a 06:00 (America/Toronto)";
}

export function hasRunToday(date?: Date | null, now = new Date()) {
  if (!date) {
    return false;
  }

  return getTorontoLocalDateKey(date) === getTorontoLocalDateKey(now);
}
