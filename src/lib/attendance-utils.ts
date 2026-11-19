import { AttLog, DayRecapRow } from "@/types/attendance";

const ID_DAYS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

const ID_MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export const ID_MONTHS_FULL = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/**
 * Formats HH:mm:ss or HH:mm into clean HH:mm
 */
export function formatTimeShort(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  }
  return timeStr;
}

/**
 * Converts HH:mm(:ss) to minutes since midnight
 */
export function timeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(":").map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

/**
 * Computes attendance variance & duration against target hours (e.g. 08:00 - 17:00)
 */
export function calculateWfoVariance(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
  targetIn: string = "08:00",
  targetOut: string = "17:00"
): {
  inDiffMinutes: number | null;
  outDiffMinutes: number | null;
  workDurationMinutes: number | null;
  targetDurationMinutes: number;
  netDiffMinutes: number | null;
  summaryText: string;
  badgeColor: "green" | "amber" | "red" | "slate";
} {
  const inMin = timeToMinutes(checkIn);
  const outMin = timeToMinutes(checkOut);
  const targetInMin = timeToMinutes(targetIn) ?? 480; // 08:00
  const targetOutMin = timeToMinutes(targetOut) ?? 1020; // 17:00
  const targetDurationMinutes = Math.max(0, targetOutMin - targetInMin);

  if (inMin === null || outMin === null) {
    return {
      inDiffMinutes: null,
      outDiffMinutes: null,
      workDurationMinutes: null,
      targetDurationMinutes,
      netDiffMinutes: null,
      summaryText: "-",
      badgeColor: "slate",
    };
  }

  // Positive inDiffMinutes means late check-in
  const inDiffMinutes = inMin - targetInMin;
  // Positive outDiffMinutes means overtime / later check-out
  const outDiffMinutes = outMin - targetOutMin;
  const workDurationMinutes = Math.max(0, outMin - inMin);
  const netDiffMinutes = workDurationMinutes - targetDurationMinutes;

  const parts: string[] = [];

  if (inDiffMinutes > 0) {
    parts.push(`Telat ${formatMinutesLabel(inDiffMinutes)}`);
  } else if (inDiffMinutes < 0) {
    parts.push(`Lebih awal ${formatMinutesLabel(Math.abs(inDiffMinutes))}`);
  } else {
    parts.push("Tepat waktu");
  }

  if (outDiffMinutes > 0) {
    parts.push(`+Lembur ${formatMinutesLabel(outDiffMinutes)}`);
  } else if (outDiffMinutes < 0) {
    parts.push(`Pulang awal ${formatMinutesLabel(Math.abs(outDiffMinutes))}`);
  }

  let badgeColor: "green" | "amber" | "red" | "slate" = "green";
  if (inDiffMinutes > 0 && netDiffMinutes < 0) {
    badgeColor = "red";
  } else if (inDiffMinutes > 0 || outDiffMinutes < 0) {
    badgeColor = "amber";
  }

  return {
    inDiffMinutes,
    outDiffMinutes,
    workDurationMinutes,
    targetDurationMinutes,
    netDiffMinutes,
    summaryText: parts.join(", "),
    badgeColor,
  };
}

export function formatMinutesLabel(totalMinutes: number): string {
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours > 0 && mins > 0) return `${hours}j ${mins}m`;
  if (hours > 0) return `${hours}j`;
  return `${mins}m`;
}

/**
 * Formats Date object to YYYY-MM-DD in local time
 */
export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parses YYYY-MM-DD string safely into local Date
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Formats YYYY-MM-DD into "Senin, 19 Nov 2026"
 */
export function formatFullIdDate(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  const dayName = ID_DAYS[date.getDay()];
  const dayNum = String(date.getDate()).padStart(2, "0");
  const monthName = ID_MONTHS_SHORT[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName}, ${dayNum} ${monthName} ${year}`;
}

/**
 * Generates an array of DayRecapRow for every single day between startDate and endDate inclusive.
 * Automatically marks Saturdays (6) and Sundays (0) as isWeekend = true.
 */
export function buildDateRangeRows(
  startDateStr: string,
  endDateStr: string,
  logs: AttLog[]
): DayRecapRow[] {
  const start = parseLocalDate(startDateStr);
  const end = parseLocalDate(endDateStr);
  if (start > end) return [];

  const logMap = new Map<string, AttLog>();
  for (const log of logs) {
    logMap.set(log.log_date, log);
  }

  const rows: DayRecapRow[] = [];
  const curr = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  while (curr <= end) {
    const dateStr = toDateStr(curr);
    const dow = curr.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const dayName = ID_DAYS[dow];
    const formattedDate = `${String(curr.getDate()).padStart(2, "0")} ${
      ID_MONTHS_SHORT[curr.getMonth()]
    } ${curr.getFullYear()}`;

    rows.push({
      dateStr,
      dateObj: new Date(curr),
      dayName,
      formattedDate,
      isWeekend,
      log: logMap.get(dateStr) || null,
    });

    curr.setDate(curr.getDate() + 1);
  }

  return rows;
}

/**
 * Helper to compute the Keterangan column text for a row
 */
export function getRowKeterangan(
  row: DayRecapRow,
  targetIn: string,
  targetOut: string
): string {
  const { log, isWeekend } = row;
  if (!log) {
    return isWeekend ? "WEEKEND" : "-";
  }

  const parts: string[] = [];
  if (isWeekend || log.is_weekend_job) {
    parts.push("Weekend Job");
  }

  if (log.work_mode === "WFO") {
    const variance = calculateWfoVariance(
      log.check_in,
      log.check_out,
      targetIn,
      targetOut
    );
    if (variance.summaryText && variance.summaryText !== "-") {
      parts.push(variance.summaryText);
    }
    if (log.notes?.trim()) {
      parts.push(log.notes.trim());
    }
  } else if (log.work_mode === "WFA") {
    if (log.notes?.trim()) {
      parts.push(log.notes.trim());
    } else {
      parts.push("Work From Anywhere");
    }
  } else if (log.work_mode === "OFF") {
    parts.push(log.notes?.trim() ? `OFF / Cuti: ${log.notes.trim()}` : "OFF / Libur");
  }

  return parts.join(" • ") || "-";
}
