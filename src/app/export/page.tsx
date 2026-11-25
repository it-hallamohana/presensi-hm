"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Rnd } from "react-rnd";
import { createClient } from "@/lib/supabase/client";
import { AttApprover, AttLog, AttProfile } from "@/types/attendance";
import {
  buildDateRangeRows,
  formatFullIdDate,
  formatTimeShort,
  getRowKeterangan,
} from "@/lib/attendance-utils";
import Navbar from "@/components/Navbar";
import PeriodFilterBar, {
  formatPeriodLabel,
  getInitialPeriodState,
  PeriodFilterState,
  PeriodMode,
} from "@/components/PeriodFilterBar";
import SignatureManager from "@/components/SignatureManager";
import { exportAttendanceToExcel } from "@/lib/export-excel";
import {
  Printer,
  FileSpreadsheet,
  Move,
  RotateCcw,
  FileSignature,
  Loader2,
  Eye,
  EyeOff,
  CheckSquare,
  ExternalLink,
  FileText,
} from "lucide-react";

function ExportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<AttProfile | null>(null);
  const [approvers, setApprovers] = useState<AttApprover[]>([]);
  const [selectedApproverId, setSelectedApproverId] = useState<string>("");
  const [logs, setLogs] = useState<AttLog[]>([]);

  const [period, setPeriod] = useState<PeriodFilterState>(() => {
    const initial = getInitialPeriodState();
    const modeParam = searchParams.get("mode") as PeriodMode | null;
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const monthParam = searchParams.get("month");

    return {
      mode: modeParam || initial.mode,
      startDate: startParam || initial.startDate,
      endDate: endParam || initial.endDate,
      selectedMonth: monthParam || initial.selectedMonth,
    };
  });

  // Toggle Signature Manager Drawer
  const [showSigSettings, setShowSigSettings] = useState(false);
  const [useWetSignatureOverride, setUseWetSignatureOverride] = useState(false);
  const [includeAppendix, setIncludeAppendix] = useState(true);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Interactive Drag & Resize state for User Signature over left signature box
  const [sigPos, setSigPos] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>({
    x: 24,
    y: 8,
    width: 170,
    height: 85,
  });

  const resetSignaturePosition = () => {
    setSigPos({ x: 24, y: 8, width: 170, height: 85 });
  };

  const fetchData = useCallback(async () => {
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
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (!prof || !prof.full_name?.trim() || !appList || appList.length === 0) {
      router.replace("/onboarding");
      return;
    }

    setProfile(prof);
    setApprovers(appList);

    const defApprover = appList.find((a) => a.is_default) || appList[0];
    setSelectedApproverId((prev) => prev || defApprover.id);

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
    fetchData();
  }, [fetchData]);

  const rows = useMemo(() => {
    return buildDateRangeRows(period.startDate, period.endDate, logs);
  }, [period.startDate, period.endDate, logs]);

  const appendixLogs = useMemo(() => {
    return rows
      .filter((r) => r.log && r.log.attachment_url)
      .map((r) => r.log!);
  }, [rows]);

  const activeApprover = useMemo(() => {
    return (
      approvers.find((a) => a.id === selectedApproverId) ||
      approvers[0] || {
        name: "Approver",
        department_or_title: "Department",
      }
    );
  }, [approvers, selectedApproverId]);

  const handlePrintPdf = () => {
    window.print();
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

  if (loading || !profile || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">
            Menyiapkan Dokumen Export & E-Sign Preview...
          </span>
        </div>
      </div>
    );
  }

  const targetIn = formatTimeShort(profile.default_start_time) || "08:00";
  const targetOut = formatTimeShort(profile.default_end_time) || "17:00";
  const showDigitalSignature =
    Boolean(profile.signature_url) && !useWetSignatureOverride;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Navbar profile={profile} userEmail={userEmail} />

      {/* Control Panel (Hidden when printing) */}
      <div className="no-print max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Export Preview & Interactive Digital Signature (E-Sign)
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Geser (drag) dan ubah ukuran (resize) tanda tangan digital Anda
              langsung pada kotak tanda tangan di bawah sebelum mencetak ke PDF.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowSigSettings((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
            >
              <FileSignature className="w-4 h-4" />
              {showSigSettings ? "Tutup Panel TTD" : "Ubah / Gambar TTD"}
            </button>

            <button
              type="button"
              disabled={exportingExcel}
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white shadow-sm transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {exportingExcel ? "Mengekspor..." : "Download Excel (.xlsx)"}
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-md transition"
            >
              <Printer className="w-4 h-4" />
              Cetak / Simpan PDF (A4)
            </button>
          </div>
        </div>

        {/* Period Filter */}
        <PeriodFilterBar value={period} onChange={setPeriod} />

        {/* Document Options Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            {/* Approver Selector */}
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-700">
                Pilih Approver:
              </label>
              <select
                value={selectedApproverId}
                onChange={(e) => setSelectedApproverId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {approvers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.department_or_title})
                  </option>
                ))}
              </select>
            </div>

            {/* Toggle Wet vs Digital Signature */}
            <button
              type="button"
              onClick={() => setUseWetSignatureOverride((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold border transition ${
                !useWetSignatureOverride && profile.signature_url
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-slate-100 border-slate-200 text-slate-700"
              }`}
            >
              {!useWetSignatureOverride && profile.signature_url ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  Mode: E-Sign Digital Aktif
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  Mode: Kosongkan (TTD Basah)
                </>
              )}
            </button>

            {/* Toggle Appendix Page */}
            <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAppendix}
                onChange={(e) => setIncludeAppendix(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
              Sertakan Halaman Lampiran Bukti ({appendixLogs.length} file)
            </label>
          </div>

          {showDigitalSignature && (
            <button
              type="button"
              onClick={resetSignaturePosition}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Posisi TTD
            </button>
          )}
        </div>

        {/* Collapsible Signature Pad / Upload Drawer */}
        {showSigSettings && (
          <SignatureManager
            userId={userId}
            currentSignatureUrl={profile.signature_url}
            onUpdated={(newUrl) => {
              setProfile({ ...profile, signature_url: newUrl });
              if (newUrl) setUseWetSignatureOverride(false);
            }}
          />
        )}
      </div>

      {/* =====================================================================
          A4 PRINTABLE DOCUMENT PREVIEW AREA
         ===================================================================== */}
      <div className="max-w-5xl w-full mx-auto my-6 px-4 sm:px-6 lg:px-8 print:my-0 print:px-0 print:max-w-none">
        <div className="print-container bg-white rounded-2xl shadow-lg border border-slate-200 p-8 sm:p-10 text-slate-900">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                REKAPITULASI PRESENSI & DAILY LOGBOOK
              </h2>
            </div>
            <div className="text-xs sm:text-right space-y-0.5">
              <p>
                <span className="text-slate-500">Periode:</span>{" "}
                <strong className="text-slate-900">
                  {formatPeriodLabel(period)}
                </strong>
              </p>
              <p>
                <span className="text-slate-500">Rentang Tanggal:</span>{" "}
                <span className="font-medium">
                  {period.startDate} s/d {period.endDate}
                </span>
              </p>
            </div>
          </div>

          {/* Employee Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Nama Lengkap</span>
              <strong className="text-slate-900 text-sm">
                {profile.full_name}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Jabatan / Role</span>
              <strong className="text-slate-900 text-sm">
                {profile.role_title}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">User</span>
              <strong className="text-slate-900 text-sm">
                {activeApprover.name}
              </strong>
            </div>
          </div>

          {/* Main Attendance Recap Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="border border-slate-300 py-2 px-2.5 font-bold">
                    Tanggal
                  </th>
                  <th className="border border-slate-300 py-2 px-2.5 font-bold">
                    Nama
                  </th>
                  <th className="border border-slate-300 py-2 px-2 font-bold text-center">
                    Target Masuk
                  </th>
                  <th className="border border-slate-300 py-2 px-2 font-bold text-center">
                    Target Keluar
                  </th>
                  <th className="border border-slate-300 py-2 px-2 font-bold text-center">
                    Aktual/WFA
                  </th>
                  <th className="border border-slate-300 py-2 px-2 font-bold text-center">
                    Jam Keluar
                  </th>
                  <th className="border border-slate-300 py-2 px-2.5 font-bold">
                    Keterangan
                  </th>
                  <th className="border border-slate-300 py-2 px-2.5 font-bold">
                    Daily Activity
                  </th>
                  <th className="border border-slate-300 py-2 px-2 font-bold text-center w-28">
                    Bukti Lampiran
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const { log, isWeekend, dayName, formattedDate, dateStr } =
                    row;
                  const keterangan = getRowKeterangan(row, targetIn, targetOut);

                  let aktualCell = "-";
                  let keluarCell = "-";

                  if (!log) {
                    if (isWeekend) {
                      aktualCell = "WEEKEND";
                      keluarCell = "WEEKEND";
                    }
                  } else if (log.work_mode === "WFO") {
                    aktualCell = formatTimeShort(log.check_in) || "-";
                    keluarCell = formatTimeShort(log.check_out) || "-";
                  } else if (log.work_mode === "WFA") {
                    aktualCell = "WFA";
                    keluarCell = log.check_out
                      ? formatTimeShort(log.check_out)
                      : "WFA";
                  } else if (log.work_mode === "OFF") {
                    aktualCell = "OFF";
                    keluarCell = "OFF";
                  }

                  const isPdf = log?.attachment_url
                    ?.toLowerCase()
                    .split("?")[0]
                    .endsWith(".pdf");

                  return (
                    <tr
                      key={dateStr}
                      className={
                        isWeekend
                          ? "bg-slate-200/80 text-slate-700"
                          : "bg-white text-slate-900"
                      }
                    >
                      <td className="border border-slate-300 py-1.5 px-2.5 whitespace-nowrap font-semibold">
                        {dayName}, {formattedDate}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2.5 whitespace-nowrap">
                        {profile.full_name}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2 text-center whitespace-nowrap">
                        {isWeekend && !log ? "-" : targetIn}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2 text-center whitespace-nowrap">
                        {isWeekend && !log ? "-" : targetOut}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2 text-center whitespace-nowrap font-bold">
                        {aktualCell}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2 text-center whitespace-nowrap font-bold">
                        {keluarCell}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2.5">
                        {keterangan}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2.5 whitespace-pre-line">
                        {log?.daily_activity ||
                          (isWeekend && !log ? "WEEKEND" : "-")}
                      </td>
                      <td className="border border-slate-300 py-1.5 px-2 text-center">
                        {log?.attachment_url ? (
                          isPdf ? (
                            <span className="text-[10px] font-semibold text-slate-700">
                              Dokumen PDF
                            </span>
                          ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={log.attachment_url}
                              alt={`Bukti ${dateStr}`}
                              className="w-24 h-16 object-cover rounded border border-slate-200 mx-auto"
                            />
                          )
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* =================================================================
              SIGNATURE BLOCK (LEFT: USER & ROLE, RIGHT: APPROVER & DEPT)
              WITH FREE DRAG & RESIZE (REACT-RND)
             ================================================================= */}
          <div className="print-avoid-break mt-10 pt-4">
            <div className="grid grid-cols-2 gap-8">
              {/* LEFT BLOCK: User & Role */}
              <div className="flex flex-col items-center text-center">
                <p className="text-xs font-semibold text-slate-600 mb-1">
                  Dibuat Oleh,
                </p>

                {/* Signature Stage */}
                <div className="relative w-60 h-28 border border-dashed border-slate-300 print:border-transparent rounded-xl my-1 flex items-center justify-center select-none">
                  {!showDigitalSignature && (
                    <span className="no-print text-[11px] text-slate-400">
                      Area Tanda Tangan Basah
                    </span>
                  )}

                  {showDigitalSignature && profile.signature_url && (
                    <Rnd
                      bounds="parent"
                      size={{ width: sigPos.width, height: sigPos.height }}
                      position={{ x: sigPos.x, y: sigPos.y }}
                      onDragStop={(_e, d) => {
                        setSigPos((prev) => ({ ...prev, x: d.x, y: d.y }));
                      }}
                      onResizeStop={(
                        _e,
                        _dir,
                        ref,
                        _delta,
                        position
                      ) => {
                        setSigPos({
                          width: parseInt(ref.style.width, 10) || 170,
                          height: parseInt(ref.style.height, 10) || 85,
                          x: position.x,
                          y: position.y,
                        });
                      }}
                      className="group border border-indigo-400/70 hover:border-indigo-600 print:border-transparent rounded-lg cursor-move"
                    >
                      <div className="w-full h-full relative flex items-center justify-center">
                        <span className="no-print absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap flex items-center gap-1 shadow">
                          <Move className="w-2.5 h-2.5" />
                          Drag / Resize
                        </span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={profile.signature_url}
                          alt="Tanda Tangan User"
                          draggable={false}
                          className="w-full h-full object-contain pointer-events-none"
                        />
                      </div>
                    </Rnd>
                  )}
                </div>

                <div className="mt-1">
                  <p className="text-sm font-bold text-slate-900 underline underline-offset-4">
                    {profile.full_name}
                  </p>
                  <p className="text-xs font-medium text-slate-600 mt-0.5">
                    {profile.role_title}
                  </p>
                </div>
              </div>

              {/* RIGHT BLOCK: Approver & Department */}
              <div className="flex flex-col items-center text-center">
                <p className="text-xs font-semibold text-slate-600 mb-1">
                  Disetujui Oleh,
                </p>

                <div className="w-60 h-28 border border-dashed border-slate-200 print:border-transparent rounded-xl my-1 flex items-center justify-center">
                  <span className="no-print text-[11px] text-slate-400">
                    Area Tanda Tangan Approver
                  </span>
                </div>

                <div className="mt-1">
                  <p className="text-sm font-bold text-slate-900 underline underline-offset-4">
                    {activeApprover.name}
                  </p>
                  <p className="text-xs font-medium text-slate-600 mt-0.5">
                    {activeApprover.department_or_title}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* =================================================================
              APPENDIX: DAILY ATTACHMENT EVIDENCE PAGES
             ================================================================= */}
          {includeAppendix && appendixLogs.length > 0 && (
            <div className="print-page-break mt-12 pt-8 border-t-2 border-dashed border-slate-300 print:border-none print:mt-0 print:pt-0">
              <div className="border-b-2 border-slate-900 pb-3 mb-6">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  LAMPIRAN BUKTI AKTIVITAS HARIAN (APPENDIX)
                </p>
                <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                  {profile.full_name} &mdash; {formatPeriodLabel(period)}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {appendixLogs.map((item) => {
                  const isPdf = item.attachment_url
                    ?.toLowerCase()
                    .includes(".pdf");

                  return (
                    <div
                      key={item.id}
                      className="print-avoid-break rounded-xl border border-slate-300 overflow-hidden bg-slate-50/50 flex flex-col justify-between"
                    >
                      <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            {formatFullIdDate(item.log_date)}
                          </span>
                          <span className="text-[11px] text-slate-600">
                            Mode: <strong>{item.work_mode}</strong>
                            {item.work_mode === "WFO" &&
                              ` (${formatTimeShort(
                                item.check_in
                              )} - ${formatTimeShort(item.check_out)})`}
                          </span>
                        </div>
                        {item.attachment_url && (
                          <a
                            href={item.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="no-print inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Buka
                          </a>
                        )}
                      </div>

                      <div className="p-4 flex items-center justify-center bg-white min-h-[220px]">
                        {isPdf ? (
                          <div className="text-center p-6 space-y-2">
                            <FileText className="w-10 h-10 text-indigo-600 mx-auto" />
                            <p className="text-xs font-bold text-slate-800">
                              Dokumen Lampiran PDF
                            </p>
                            <p className="text-[11px] text-slate-500 break-all">
                              {item.attachment_url}
                            </p>
                          </div>
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={item.attachment_url!}
                            alt={`Lampiran ${item.log_date}`}
                            className="max-h-64 w-auto object-contain rounded-lg mx-auto"
                          />
                        )}
                      </div>

                      {item.daily_activity && (
                        <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-700">
                          <span className="font-bold text-slate-900 block mb-0.5">
                            Aktivitas:
                          </span>
                          <p className="whitespace-pre-line">
                            {item.daily_activity}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
        </div>
      }
    >
      <ExportContent />
    </Suspense>
  );
}
