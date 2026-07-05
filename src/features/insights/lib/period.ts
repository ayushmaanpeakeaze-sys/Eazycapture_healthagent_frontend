export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const parsePeriodMonth = (
  period: string,
): { year: number; month: number } | null => {
  const iso = period.match(/(\d{4})-(\d{2})/);
  if (iso) return { year: +iso[1], month: +iso[2] - 1 };
  const m = period.match(/([A-Za-z]{3,})\.?\s*-?\s*(\d{2,4})/);
  if (!m) return null;
  const idx = MONTHS.findIndex(
    (x) => x.toLowerCase() === m[1].slice(0, 3).toLowerCase(),
  );
  if (idx < 0) return null;
  let y = +m[2];
  if (y < 100) y += 2000;
  return { year: y, month: idx };
};

export const formatMonthLabel = (period: string): string => {
  const pm = parsePeriodMonth(period);
  if (!pm) return period;
  return new Date(pm.year, pm.month, 1).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
  });
};

export const monthProgress = (
  period: string,
): {
  elapsedPct: number;
  daysRemaining: number;
  isCurrent: boolean;
  known: boolean;
} => {
  const pm = parsePeriodMonth(period);
  if (!pm)
    return { elapsedPct: 0, daysRemaining: 0, isCurrent: false, known: false };
  const now = new Date();
  const daysInMonth = new Date(pm.year, pm.month + 1, 0).getDate();
  const isCurrent =
    pm.year === now.getFullYear() && pm.month === now.getMonth();
  if (isCurrent) {
    const day = Math.min(now.getDate(), daysInMonth);
    return {
      elapsedPct: (day / daysInMonth) * 100,
      daysRemaining: daysInMonth - day,
      isCurrent: true,
      known: true,
    };
  }
  const isPast =
    pm.year < now.getFullYear() ||
    (pm.year === now.getFullYear() && pm.month < now.getMonth());
  return isPast
    ? { elapsedPct: 100, daysRemaining: 0, isCurrent: false, known: true }
    : {
        elapsedPct: 0,
        daysRemaining: daysInMonth,
        isCurrent: false,
        known: true,
      };
};
