"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AttLog, AttProfile, DayRecapRow } from "@/types/attendance";
import {
  buildDateRangeRows,
  calculateWfoVariance,
  formatTimeShort,
  getRowKeterangan,
  parseLocalDate,
  toDateStr,
} from "@/lib/attendance-utils";
import Navbar from "@/components/Navbar";
import PeriodFilterBar, {
  formatPeriodLabel,
  getInitialPeriodState,
  PeriodFilterState,
} from "@/components/PeriodFilterBar";
import DailyLogModal from "@/components/DailyLogModal";
import { exportAttendanceToExcel } from "@/lib/export-excel";
import {
  Calendar as CalendarIcon,
  List,
  Building2,
  Laptop,
  Sparkles,
  FileSpreadsheet,
  Printer,
  PlusCircle,
  ExternalLink,
  Loader2,
  Clock,
  CheckCircle2,
  Edit3,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [profile, setProfile] = useState<AttProfile | null>(null);
  const [logs, setLogs] = useState<AttLog[]>([]);

  const [period, setPeriod] = useState<PeriodFilterState>(() =>
    getInitialPeriodState()
  );
  const [viewMode, setViewMode] = useState<"split" | "list" | "calendar">(
    "split"
  );
  const [selectedRow, setSelectedRow] = useState<DayRecapRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    setUserId(user.id);
    setUserEmail(user.email || "");

    const { data: prof } = await supabase
      .from("att_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    const { data: appList } = await supabase
      .from("att_approvers")
      .select("id")
      .eq("user_id", user.id);

    if (!prof || !prof.full_name?.trim() || !appList || appList.length === 0) {
      router.replace("/onboarding");
      return;
    }

    setProfile(prof);

    const { data: logRows } = await supabase
      .from("att_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("log_date", period.startDate)
      .lte("log_date", period.endDate)
      .order("log_date", { ascending: true });

    setLogs(logRows || []);
    setLoading(false);
  }, [period.startDate, period.endDate, router, supabase]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const rows = useMemo(() => {
    return buildDateRangeRows(period.startDate, period.endDate, logs);
  }, [period.startDate, period.endDate, logs]);

  const stats = useMemo(() => {
    let wfoCount = 0;
    let wfaCount = 0;
    let weekendJobCount = 0;
    let filledDays = 0;

    for (const r of rows) {
      if (r.log) {
        filledDays++;
        if (r.log.work_mode === "WFO") wfoCount++;
        if (r.log.work_mode === "WFA") wfaCount++;
        if (r.isWeekend || r.log.is_weekend_job) weekendJobCount++;
      }
    }
    return { wfoCount, wfaCount, weekendJobCount, filledDays };
  }, [rows]);

  const todayStr = toDateStr(new Date());

  const handleOpenDay = (row: DayRecapRow) => {
    setSelectedRow(row);
    setIsModalOpen(true);
  };

  const handleOpenToday = () => {
    const existingRow = rows.find((r) => r.dateStr === todayStr);
    if (existingRow) {
      handleOpenDay(existingRow);
    } else {
      const tempRows = buildDateRangeRows(todayStr, todayStr, logs);
      if (tempRows[0]) handleOpenDay(tempRows[0]);
    }
  };

  const handleExportExcel = async () => {
    if (!profile) return;
    setExportingExcel(true);
    try {
      await exportAttendanceToExcel({
        rows,
        profile,
        periodLabel: formatPeriodLabel(period),
      });
    } finally {
      setExportingExcel(false);
    }
  };

  // Build calendar leading empty slots based on startDate day-of-week (Monday=0 .. Sunday=6)
  const calendarLeadingSlots = useMemo(() => {
    if (rows.length === 0) return [];
    const firstDate = parseLocalDate(rows[0].dateStr);
    const dow = firstDate.getDay(); // 0=Sun, 1=Mon...
    const mondayFirstOffset = dow === 0 ? 6 : dow - 1;
    return Array.from({ length: mondayFirstOffset });
  }, [rows]);

  if (loading || !profile || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">
            Memuat Dashboard & Logbook...
          </span>
        </div>
      </div>
    );
  }

  const targetIn = formatTimeShort(profile.default_start_time) || "08:00";
  const targetOut = formatTimeShort(profile.default_end_time) || "17:00";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar profile={profile} userEmail={userEmail} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Welcome & Action Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                Halo, {profile.full_name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                {profile.role_title}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              Target Jam Kerja Default:{" "}
              <strong className="text-slate-700">
                {targetIn} - {targetOut}
              </strong>
              <span>&bull;</span>
              <span>Klik tanggal mana saja untuk isi WFO / WFA / Weekend Job</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleOpenToday}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20 transition"
            >
              <PlusCircle className="w-4 h-4" />
              Isi Presensi Hari Ini
            </button>

            <button
              type="button"
              disabled={exportingExcel}
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white shadow-sm transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {exportingExcel ? "Mengekspor..." : "Export Excel (.xlsx)"}
            </button>

            <Link
              href={`/export?mode=${period.mode}&start=${period.startDate}&end=${period.endDate}&month=${period.selectedMonth}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              Export PDF & E-Sign
            </Link>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Total Hari Terisi
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {stats.filledDays}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  / {rows.length} hari
                </span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Kehadiran WFO
              </p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {stats.wfoCount}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  hari
                </span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Kehadiran WFA
              </p>
              <p className="text-2xl font-bold text-sky-700 mt-1">
                {stats.wfaCount}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  hari
                </span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Laptop className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Weekend Job
              </p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {stats.weekendJobCount}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  hari
                </span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Period Filter + View Mode Switcher */}
        <div className="flex flex-col gap-3">
          <PeriodFilterBar value={period} onChange={setPeriod} />

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">
              Menampilkan <strong>{rows.length}</strong> hari pada periode{" "}
              <strong>{formatPeriodLabel(period)}</strong>
            </p>
            <div className="inline-flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === "split"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                Kalender + Tabel
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === "list"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Tabel Rekap Saja
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === "calendar"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                Kalender Saja
              </button>
            </div>
          </div>
        </div>

        {/* CALENDAR VIEW */}
        {(viewMode === "split" || viewMode === "calendar") && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Kalender Interaktif ({formatPeriodLabel(period)})
                </h2>
                <p className="text-xs text-slate-500">
                  Klik tanggal mana pun (termasuk Sabtu/Minggu untuk Weekend
                  Job) untuk mengisi atau mengubah log harian.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  WFO
                </span>
                <span className="inline-flex items-center gap-1.5 text-sky-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  WFA
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Weekend Job
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  Weekend
                </span>
              </div>
            </div>

            {/* Day Headers (Sen - Min) */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center">
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(
                (d, idx) => (
                  <div
                    key={d}
                    className={`text-xs font-bold uppercase tracking-wider py-1.5 rounded-lg ${
                      idx >= 5
                        ? "text-slate-500 bg-slate-100"
                        : "text-slate-600 bg-slate-50"
                    }`}
                  >
                    {d}
                  </div>
                )
              )}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {calendarLeadingSlots.map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  className="hidden sm:block min-h-[86px] rounded-xl bg-slate-50/40 border border-dashed border-slate-100"
                />
              ))}

              {rows.map((row) => {
                const { log, isWeekend, dateObj, dateStr } = row;
                const isToday = dateStr === todayStr;

                let cardStyle =
                  "bg-white border-slate-200 hover:border-indigo-400";
                if (isWeekend && !log) {
                  cardStyle =
                    "bg-slate-100/90 border-slate-200/80 text-slate-500 hover:border-amber-400";
                } else if (log?.work_mode === "WFO") {
                  cardStyle =
                    "bg-emerald-50/60 border-emerald-200 hover:border-emerald-400";
                } else if (log?.work_mode === "WFA") {
                  cardStyle =
                    "bg-sky-50/60 border-sky-200 hover:border-sky-400";
                } else if (log?.work_mode === "OFF") {
                  cardStyle =
                    "bg-rose-50/60 border-rose-200 hover:border-rose-400";
                }

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => handleOpenDay(row)}
                    className={`group text-left p-2.5 rounded-xl border transition-all flex flex-col justify-between min-h-[78px] sm:min-h-[92px] relative ${cardStyle} ${
                      isToday ? "ring-2 ring-indigo-600" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs sm:text-sm font-bold ${
                          isToday
                            ? "text-indigo-700"
                            : isWeekend && !log
                            ? "text-slate-500"
                            : "text-slate-800"
                        }`}
                      >
                        {dateObj.getDate()}
                      </span>

                      {log ? (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            log.work_mode === "WFO"
                              ? "bg-emerald-600 text-white"
                              : log.work_mode === "WFA"
                              ? "bg-sky-600 text-white"
                              : "bg-rose-600 text-white"
                          }`}
                        >
                          {log.work_mode}
                        </span>
                      ) : isWeekend ? (
                        <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-600">
                          WEEKEND
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1.5 space-y-0.5 w-full overflow-hidden">
                      {log ? (
                        <>
                          {log.work_mode === "WFO" && (
                            <p className="text-[10px] font-semibold text-emerald-800 truncate">
                              {formatTimeShort(log.check_in)} -{" "}
                              {formatTimeShort(log.check_out)}
                            </p>
                          )}
                          {(isWeekend || log.is_weekend_job) && (
                            <p className="text-[10px] font-bold text-amber-700 truncate">
                              ★ Weekend Job
                            </p>
                          )}
                          {log.daily_activity && (
                            <p className="text-[10px] text-slate-600 truncate">
                              {log.daily_activity}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition">
                          {isWeekend ? "+ Weekend Job" : "+ Isi Log"}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* LIST / TABLE RECAP VIEW */}
        {(viewMode === "split" || viewMode === "list") && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Tabel Rekapitulasi Presensi & Daily Logbook
                </h2>
                <p className="text-xs text-slate-500">
                  Hari Sabtu & Minggu otomatis ditandai{" "}
                  <span className="font-semibold text-slate-700">WEEKEND</span>.
                  Klik baris mana saja untuk mengisi/mengedit log atau{" "}
                  <span className="font-semibold text-amber-700">
                    Weekend Job
                  </span>
                  .
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Tanggal</th>
                    <th className="py-3 px-3 font-semibold">Nama</th>
                    <th className="py-3 px-3 font-semibold text-center">
                      Target Masuk
                    </th>
                    <th className="py-3 px-3 font-semibold text-center">
                      Target Keluar
                    </th>
                    <th className="py-3 px-3 font-semibold text-center">
                      Aktual / WFA
                    </th>
                    <th className="py-3 px-3 font-semibold text-center">
                      Jam Keluar
                    </th>
                    <th className="py-3 px-4 font-semibold">Keterangan</th>
                    <th className="py-3 px-4 font-semibold">Daily Activity</th>
                    <th className="py-3 px-3 font-semibold text-center">
                      Lampiran
                    </th>
                    <th className="py-3 px-3 font-semibold text-center">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {rows.map((row) => {
                    const { log, isWeekend, dayName, formattedDate, dateStr } =
                      row;
                    const isToday = dateStr === todayStr;

                    const keterangan = getRowKeterangan(
                      row,
                      targetIn,
                      targetOut
                    );
                    const variance =
                      log?.work_mode === "WFO"
                        ? calculateWfoVariance(
                            log.check_in,
                            log.check_out,
                            targetIn,
                            targetOut
                          )
                        : null;

                    return (
                      <tr
                        key={dateStr}
                        onClick={() => handleOpenDay(row)}
                        className={`cursor-pointer transition ${
                          isWeekend
                            ? "bg-slate-100/90 hover:bg-slate-200/70 text-slate-600"
                            : "bg-white hover:bg-indigo-50/40 text-slate-800"
                        } ${isToday ? "ring-1 ring-inset ring-indigo-500" : ""}`}
                      >
                        {/* Tanggal */}
                        <td className="py-3 px-4 whitespace-nowrap font-semibold">
                          <div className="flex items-center gap-2">
                            <span>
                              {dayName}, {formattedDate}
                            </span>
                            {isToday && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-bold">
                                Hari Ini
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Nama */}
                        <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                          {profile.full_name}
                        </td>

                        {/* Target Masuk */}
                        <td className="py-3 px-3 text-center whitespace-nowrap text-slate-500">
                          {isWeekend && !log ? "-" : targetIn}
                        </td>

                        {/* Target Keluar */}
                        <td className="py-3 px-3 text-center whitespace-nowrap text-slate-500">
                          {isWeekend && !log ? "-" : targetOut}
                        </td>

                        {/* Aktual / WFA */}
                        <td className="py-3 px-3 text-center whitespace-nowrap font-bold">
                          {!log ? (
                            isWeekend ? (
                              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-[11px]">
                                WEEKEND
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">
                                -
                              </span>
                            )
                          ) : log.work_mode === "WFO" ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              {formatTimeShort(log.check_in)}
                            </span>
                          ) : log.work_mode === "WFA" ? (
                            <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                              WFA
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                              OFF
                            </span>
                          )}
                        </td>

                        {/* Jam Keluar */}
                        <td className="py-3 px-3 text-center whitespace-nowrap font-bold">
                          {!log ? (
                            isWeekend ? (
                              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-[11px]">
                                WEEKEND
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">
                                -
                              </span>
                            )
                          ) : log.work_mode === "WFO" ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              {formatTimeShort(log.check_out)}
                            </span>
                          ) : log.work_mode === "WFA" ? (
                            <span className="text-sky-700 font-semibold">
                              {log.check_out
                                ? formatTimeShort(log.check_out)
                                : "WFA"}
                            </span>
                          ) : (
                            <span className="text-rose-700">OFF</span>
                          )}
                        </td>

                        {/* Keterangan */}
                        <td className="py-3 px-4 max-w-[240px]">
                          <div className="flex flex-wrap items-center gap-1">
                            {(isWeekend || log?.is_weekend_job) && log && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                Weekend Job
                              </span>
                            )}
                            {variance && variance.summaryText !== "-" && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  variance.badgeColor === "green"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : variance.badgeColor === "amber"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                {variance.summaryText}
                              </span>
                            )}
                            {log?.notes && (
                              <span className="text-slate-700">
                                {log.notes}
                              </span>
                            )}
                            {!log && (
                              <span className="text-slate-400 font-medium">
                                {keterangan}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Daily Activity */}
                        <td className="py-3 px-4 max-w-[300px]">
                          {log?.daily_activity ? (
                            <p className="text-slate-800 line-clamp-2 whitespace-pre-line">
                              {log.daily_activity}
                            </p>
                          ) : isWeekend && !log ? (
                            <span className="text-slate-400 font-medium">
                              WEEKEND
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">
                              Belum diisi
                            </span>
                          )}
                        </td>

                        {/* Lampiran */}
                        <td
                          className="py-3 px-3 text-center whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {log?.attachment_url ? (
                            <a
                              href={log.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-[11px] transition"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Bukti
                            </a>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Aksi */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 font-semibold text-[11px] transition">
                            <Edit3 className="w-3 h-3" />
                            {log
                              ? "Edit"
                              : isWeekend
                              ? "+ Weekend Job"
                              : "+ Isi"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <DailyLogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        row={selectedRow}
        profile={profile}
        userId={userId}
        onSaved={fetchDashboardData}
      />
    </div>
  );
}
