/** Per-platform color coding, used anywhere a task/course's source needs to
 * be visually distinguishable at a glance (the source badge on task cards,
 * calendar day pills, etc). Falls back to the app's default indigo for any
 * future/unrecognized source rather than breaking. */
export function sourceColorClasses(source: string): { badge: string; pill: string } {
  switch (source) {
    case "canvas":
      return {
        badge: "text-emerald-700 bg-emerald-50",
        pill: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
      };
    case "gradescope":
      return {
        badge: "text-blue-700 bg-blue-50",
        pill: "bg-blue-50 text-blue-700 hover:bg-blue-100",
      };
    case "prairielearn":
      return {
        badge: "text-orange-700 bg-orange-50",
        pill: "bg-orange-50 text-orange-700 hover:bg-orange-100",
      };
    default:
      return {
        badge: "text-indigo-500 bg-indigo-50",
        pill: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
      };
  }
}
