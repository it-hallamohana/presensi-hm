export type WorkMode = "WFO" | "WFA" | "OFF";

export interface AttProfile {
  id: string;
  full_name: string;
  role_title: string;
  default_start_time: string; // HH:mm:ss or HH:mm
  default_end_time: string;   // HH:mm:ss or HH:mm
  signature_url: string | null;
  created_at: string;
}

export interface AttApprover {
  id: string;
  user_id: string;
  name: string;
  department_or_title: string;
  is_default: boolean;
  created_at?: string;
}

export interface AttLog {
  id: string;
  user_id: string;
  log_date: string; // YYYY-MM-DD
  work_mode: WorkMode;
  is_weekend_job: boolean;
  check_in: string | null; // HH:mm:ss or HH:mm
  check_out: string | null; // HH:mm:ss or HH:mm
  notes: string | null;
  daily_activity: string | null;
  attachment_url: string | null;
  created_at?: string;
}

export interface DayRecapRow {
  dateStr: string;       // YYYY-MM-DD
  dateObj: Date;
  dayName: string;       // Senin, Selasa, etc.
  formattedDate: string; // 19 Nov 2026
  isWeekend: boolean;
  log: AttLog | null;
}
