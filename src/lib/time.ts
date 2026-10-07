/**
 * The study's clock.
 *
 * Every date LEXORA shows, and every "day" it counts, belongs to the children's
 * time zone — not to whichever machine happens to render the page. The two
 * differ in production: the server runs in UTC and the children are in Davao,
 * eight hours ahead. Before this module the gap showed up everywhere a date did:
 *
 *   - a reading at 10:58 in the morning was listed as "2:58 AM" on the learner
 *     page a specialist tags baseline and endline sessions from;
 *   - a practice day ran from 8am to 8am, so a child who practised before and
 *     after eight o'clock was credited with two days, and the streak and the
 *     daily accuracy chart counted the wrong days;
 *   - a probe done on Tuesday morning was stored as Monday, and the child was
 *     told it would return "Monday" — a day it was still resting.
 *
 * Locally none of this appears, because the development machine is already in
 * Manila time; it is a production-only fault, which is why it went unnoticed.
 *
 * Client components format through here too. They render once on the server
 * and again in the browser, and a date formatted in each one's own zone would
 * disagree between the two and break hydration.
 */
import type { Lang } from "./i18n";

/** The children's time zone. Asia/Manila is UTC+8 and observes no daylight saving. */
export const APP_TIME_ZONE = "Asia/Manila";

const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar day an instant falls on in the study's zone, as YYYY-MM-DD. */
export function dayKey(d: Date): string {
  return DAY_KEY.format(d);
}

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** How far the study's zone is ahead of UTC at an instant, in milliseconds. */
function zoneOffsetMs(at: Date): number {
  const p = Object.fromEntries(PARTS.formatToParts(at).map((x) => [x.type, Number(x.value)]));
  const wallClockAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallClockAsUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The instant midnight began, in the study's zone, `daysAgo` calendar days
 * before the day `now` falls on. `startOfDay(0)` is the start of today.
 */
export function startOfDay(daysAgo = 0, now = new Date()): Date {
  const [y, m, d] = dayKey(now).split("-").map(Number);
  // Date.UTC carries day underflow into the month and year, so going back
  // across a month end needs no special case.
  const midnightAsUtc = Date.UTC(y, m - 1, d - daysAgo);
  return new Date(midnightAsUtc - zoneOffsetMs(new Date(midnightAsUtc)));
}

/** The locale the interface language formats dates in. */
export function dateLocale(lang: Lang): string {
  return lang === "fil" ? "fil-PH" : "en-US";
}

/** Format a date in the study's zone. Accepts the ISO strings client props carry. */
export function formatDate(
  d: Date | string,
  locale: string,
  opts: Intl.DateTimeFormatOptions
): string {
  return new Date(d).toLocaleString(locale, { ...opts, timeZone: APP_TIME_ZONE });
}
