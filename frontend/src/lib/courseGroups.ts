import type { Course } from "../api/client";
import { compareTermRank, parseTermRank } from "./term";

/** One tab in the Courses page - usually a single synced course, but merged
 * into several when the same real class is tracked on more than one platform
 * (e.g. Gradescope's "University Physics: Thermal Physics" and PrairieLearn's
 * "PHYS 213: Thermal Physics" are the same class, just phrased differently by
 * each platform). */
export interface CourseGroup {
  key: string;
  displayName: string;
  courses: Course[]; // >1 only for a genuine cross-platform merge
  term: string | null;
}

/** Groups courses by their extracted `code` (e.g. "PHYS 213"), but ONLY
 * merges a code shared across DIFFERENT sources - never within the same one.
 * Two Gradescope rows sharing a code (e.g. "ECE 110-ABA" / "-ABE" / "-HOMEWORK",
 * all separate lab sections/rosters) are legitimately distinct and must stay
 * as separate tabs; only a cross-platform match (same code, different
 * `source`) represents the same real class tracked twice.
 */
/** Picks whichever member's term text actually parses into the highest
 * (season, year) - not just "the first one with any non-empty term" - since
 * one platform's term text for the same real class can be junk (e.g.
 * PrairieLearn's occasional "Proficiency Exam Practice: PHYS 213" instead of
 * a real semester) while another member correctly says "Fall 2026". Falls
 * back to null (kept active, not guessed into archived) only if NONE of the
 * group's members have a parseable term. */
function representativeTerm(group: Course[]): string | null {
  let best: { term: string; rank: ReturnType<typeof parseTermRank> } | null = null;
  for (const course of group) {
    const rank = parseTermRank(course.term);
    if (rank && (!best || compareTermRank(rank, best.rank!) > 0)) {
      best = { term: course.term as string, rank };
    }
  }
  return best?.term ?? null;
}

export function groupCourses(courses: Course[]): CourseGroup[] {
  const byCode = new Map<string, Course[]>();
  for (const course of courses) {
    if (!course.code) continue;
    if (!byCode.has(course.code)) byCode.set(course.code, []);
    byCode.get(course.code)!.push(course);
  }

  const merged = new Set<number>();
  const groups: CourseGroup[] = [];

  for (const [code, group] of byCode) {
    if (new Set(group.map((c) => c.source)).size <= 1) continue; // same-source only, don't merge
    for (const c of group) merged.add(c.id);
    groups.push({
      key: `code:${code}`,
      displayName: code,
      courses: group,
      term: representativeTerm(group),
    });
  }

  for (const course of courses) {
    if (merged.has(course.id)) continue;
    groups.push({ key: `course:${course.id}`, displayName: course.name, courses: [course], term: course.term });
  }

  return groups;
}
