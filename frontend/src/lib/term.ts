/** Parses a course's `term` string into a sortable (year, season) rank, so
 * the most recent semester can be found across courses from different
 * platforms even when their term text isn't identical (Gradescope: "Fall
 * 2026"; PrairieLearn: sometimes "PHYS 214 Fall 2026" with the course name
 * folded in, sometimes unparseable text like "Proficiency Exam Practice:
 * PHYS 213"). Matching on the parsed (season, year) instead of the raw
 * string is what lets those different-looking strings still group as "the
 * same semester" - a plain string-equality check would treat every one of
 * these as a different term. Returns null for text with no recognizable
 * season+year (kept in the active list rather than guessed into archived -
 * see CourseTabs.tsx). */
const SEASON_RANK: Record<string, number> = { spring: 0, summer: 1, fall: 2, winter: 3 };

export interface TermRank {
  year: number;
  season: number;
}

export function parseTermRank(term: string | null): TermRank | null {
  if (!term) return null;
  const match = term.match(/\b(spring|summer|fall|winter)\b\D{0,3}(\d{4})\b/i);
  if (!match) return null;
  return { year: parseInt(match[2], 10), season: SEASON_RANK[match[1].toLowerCase()] };
}

export function compareTermRank(a: TermRank, b: TermRank): number {
  return a.year !== b.year ? a.year - b.year : a.season - b.season;
}
