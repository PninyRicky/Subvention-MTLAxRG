const torontoFormatter = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  weekday: "short",
});

const longTorontoFormatter = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const monthMap: Record<string, string> = {
  janvier: "01",
  fevrier: "02",
  février: "02",
  mars: "03",
  avril: "04",
  mai: "05",
  juin: "06",
  juillet: "07",
  aout: "08",
  août: "08",
  septembre: "09",
  octobre: "10",
  novembre: "11",
  decembre: "12",
  décembre: "12",
};

export type DateWindow = {
  opensAt?: Date | null;
  closesAt?: Date | null;
  rolling?: boolean;
};

function getTorontoParts(date = new Date()) {
  return torontoFormatter.formatToParts(date).reduce<Record<string, string>>((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = part.value;
    }
    return accumulator;
  }, {});
}

export function formatDate(date?: Date | null) {
  if (!date) {
    return "A confirmer";
  }
  return longTorontoFormatter.format(date);
}

export function formatDateTime(date?: Date | null) {
  if (!date) {
    return "A confirmer";
  }

  const parts = getTorontoParts(date);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} Toronto`;
}

export function getTorontoLocalDateKey(date = new Date()) {
  const parts = getTorontoParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getTorontoLocalHour(date = new Date()) {
  return Number(getTorontoParts(date).hour);
}

export function isMondayWednesdayFriday(date = new Date()) {
  const weekday = getTorontoParts(date).weekday?.toLowerCase();
  return weekday === "lun." || weekday === "mer." || weekday === "ven.";
}

export function isOpenToday(window: DateWindow, now = new Date()) {
  if (window.rolling) {
    return true;
  }

  const nowTime = now.getTime();

  if (window.opensAt && nowTime < window.opensAt.getTime()) {
    return false;
  }

  if (window.closesAt && nowTime > window.closesAt.getTime()) {
    return false;
  }

  return true;
}

export function daysUntil(date?: Date | null, now = new Date()) {
  if (!date) {
    return 999;
  }

  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function parseFrenchDateFromText(text: string) {
  const normalized = text.toLowerCase();
  const match = normalized.match(
    /(\d{1,2})(?:er)?\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)\s+(\d{4})/i,
  );

  if (!match) {
    return null;
  }

  const [, day, monthLabel, year] = match;
  const month = monthMap[monthLabel];

  if (!month) {
    return null;
  }

  return new Date(`${year}-${month}-${day.padStart(2, "0")}T12:00:00.000Z`);
}

export function parseRelevantFrenchDeadlineFromText(text: string) {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  const keywordMatchers = [
    /date limite[^.]{0,140}/g,
    /date de depot[^.]{0,140}/g,
    /date de dépôt[^.]{0,140}/g,
    /depot des demandes[^.]{0,140}/g,
    /dépôt des demandes[^.]{0,140}/g,
    /periode de depot[^.]{0,180}/g,
    /période de dépôt[^.]{0,180}/g,
    /s['’]est terminee le[^.]{0,140}/g,
    /s['’]est terminée le[^.]{0,140}/g,
    /soumettre une demande[^.]{0,140}/g,
    /jusqu[’']au[^.]{0,140}/g,
    /cloture[^.]{0,140}/g,
    /clôture[^.]{0,140}/g,
  ];

  for (const matcher of keywordMatchers) {
    const snippets = normalized.match(matcher) ?? [];

    for (const snippet of snippets) {
      const parsed = parseFrenchDateFromText(snippet);

      if (parsed) {
        return parsed;
      }
    }
  }

  return parseFrenchDateFromText(normalized);
}
