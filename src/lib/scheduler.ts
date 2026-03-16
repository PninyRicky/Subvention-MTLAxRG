import { getTorontoLocalDateKey, isMondayWednesdayFriday } from "@/lib/dates";

export function isScheduledRunWindow(now = new Date()) {
  return isMondayWednesdayFriday(now);
}

export function getScheduleLabel() {
  return "Lundi, mercredi et vendredi, une fois par jour sur Vercel Hobby (environ 06:00 ou 07:00 Toronto selon la saison)";
}

export function hasRunToday(date?: Date | null, now = new Date()) {
  if (!date) {
    return false;
  }

  return getTorontoLocalDateKey(date) === getTorontoLocalDateKey(now);
}
