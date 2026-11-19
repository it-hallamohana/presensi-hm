"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AttLog, AttProfile, DayRecapRow, WorkMode } from "@/types/attendance";
import {
  calculateWfoVariance,
  formatFullIdDate,
  formatTimeShort,
} from "@/lib/attendance-utils";
import { compressAttachmentFile } from "@/lib/image-compression";
import {
  X,
  Building2,
  Laptop,
  CalendarOff,
  Clock,
  FileText,
  Paperclip,
  Upload,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from "lucide-react";

interface DailyLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: DayRecapRow | null;
  profile: AttProfile;
  userId: string;
  onSaved: () => void;
}

export default function DailyLogModal({
  isOpen,
  onClose,
  row,
  profile,
  userId,
  onSaved,
}: DailyLogModalProps) {
  const supabase = createClient();

  const targetIn = formatTimeShort(profile.default_start_time) || "08:00";
  const targetOut = formatTimeShort(profile.default_end_time) || "17:00";

  const [workMode, setWorkMode] = useState<WorkMode>("WFO");
  const [isWeekendJob, setIsWeekendJob] = useState(false);
  const [checkIn, setCheckIn] = useState(targetIn);
  const [checkOut, setCheckOut] = useState(targetOut);
  const [notes, setNotes] = useState("");
  const [dailyActivity, setDailyActivity] = useState("");
  const [existingAttachmentUrl, setExistingAttachmentUrl] = useState<
    string | null
  >(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!row) return;
    setErrorMsg(null);
    setSelectedFile(null);

    const existing = row.log;
    if (existing) {
      setWorkMode(existing.work_mode);
      setIsWeekendJob(existing.is_weekend_job || row.isWeekend);
      setCheckIn(formatTimeShort(existing.check_in) || targetIn);
      setCheckOut(formatTimeShort(existing.check_out) || targetOut);
      setNotes(existing.notes || "");
      setDailyActivity(existing.daily_activity || "");
      setExistingAttachmentUrl(existing.attachment_url);
    } else {
      setWorkMode("WFO");
      setIsWeekendJob(row.isWeekend);
      setCheckIn(targetIn);
      setCheckOut(targetOut);
      setNotes("");
      setDailyActivity("");
      setExistingAttachmentUrl(null);
    }
  }, [row, targetIn, targetOut]);

  if (!isOpen || !row) return null;

  const variance =
    workMode === "WFO"
      ? calculateWfoVariance(checkIn, checkOut, targetIn, targetOut)
      : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (!allowed.includes(file.type)) {
      setErrorMsg("Format file harus berupa JPG, PNG, WebP, atau PDF.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("Ukuran file maksimal 10 MB.");
      return;
    }

    setErrorMsg(null);
    setSelectedFile(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (workMode === "WFO" && (!checkIn || !checkOut)) {
      setErrorMsg(
        "Untuk mode WFO, Jam Masuk dan Jam Keluar aktual wajib diisi."
      );
      return;
    }

    setSaving(true);
    try {
      let finalAttachmentUrl = existingAttachmentUrl;

      // Upload new attachment if selected
      if (selectedFile) {
        const compressed = await compressAttachmentFile(selectedFile, {
          maxDimension: 1400,
          quality: 0.8,
        });

        const ext = compressed.name.split(".").pop() || "jpg";
        const filePath = `${userId}/${row.dateStr}_${Date.now()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("att-attachments")
          .upload(filePath, compressed, {
            upsert: true,
            contentType: compressed.type,
          });

        if (uploadErr) throw uploadErr;

        const { data: pubData } = supabase.storage
          .from("att-attachments")
          .getPublicUrl(filePath);

        finalAttachmentUrl = pubData.publicUrl;
      }

      const payload = {
        user_id: userId,
        log_date: row.dateStr,
        work_mode: workMode,
        is_weekend_job: row.isWeekend ? true : isWeekendJob,
        check_in:
          workMode === "WFO"
            ? checkIn
            : workMode === "WFA" && checkIn
            ? checkIn
            : null,
        check_out:
          workMode === "WFO"
            ? checkOut
            : workMode === "WFA" && checkOut
            ? checkOut
            : null,
        notes: notes.trim() || null,
        daily_activity: dailyActivity.trim() || null,
        attachment_url: finalAttachmentUrl,
      };

      const { error: upsertErr } = await supabase
        .from("att_logs")
        .upsert(payload, { onConflict: "user_id,log_date" });

      if (upsertErr) throw upsertErr;

      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Gagal menyimpan log harian.";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!row.log) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from("att_logs")
        .delete()
        .eq("id", row.log.id)
        .eq("user_id", userId);

      if (error) throw error;
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Gagal menghapus log harian.";
      setErrorMsg(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {formatFullIdDate(row.dateStr)}
              </h3>
              {row.isWeekend && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                  <Sparkles className="w-3 h-3" />
                  Weekend Job
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Target Jam Kerja Default: {targetIn} - {targetOut}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Work Mode Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Mode Kehadiran *
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  {
                    id: "WFO",
                    label: "WFO",
                    desc: "Work From Office",
                    icon: Building2,
                  },
                  {
                    id: "WFA",
                    label: "WFA",
                    desc: "Work From Anywhere",
                    icon: Laptop,
                  },
                  {
                    id: "OFF",
                    label: "OFF / Izin",
                    desc: "Cuti / Libur",
                    icon: CalendarOff,
                  },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = workMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setWorkMode(item.id);
                      if (item.id === "WFA") {
                        setCheckIn("");
                        setCheckOut("");
                      } else if (item.id === "WFO") {
                        if (!checkIn) setCheckIn(targetIn);
                        if (!checkOut) setCheckOut(targetOut);
                      }
                    }}
                    className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${
                      active
                        ? "border-indigo-600 bg-indigo-50/70 text-indigo-700 ring-2 ring-indigo-500/20"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <span className="text-xs font-bold">{item.label}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* WFO Mandatory Check-in & Check-out + Variance */}
          {workMode === "WFO" && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jam Masuk Aktual *
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="time"
                      required
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jam Keluar Aktual *
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="time"
                      required
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {variance && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 text-xs">
                  <span className="text-slate-500 font-medium">
                    Selisih thd Target ({targetIn} - {targetOut}):
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold ${
                      variance.badgeColor === "green"
                        ? "bg-emerald-100 text-emerald-800"
                        : variance.badgeColor === "amber"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {variance.summaryText}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* WFA Info & Optional Notes */}
          {workMode === "WFA" && (
            <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200/80 text-xs text-sky-900">
              <p className="font-semibold">Mode WFA (Work From Anywhere)</p>
              <p className="text-sky-700 mt-0.5">
                Tanpa wajib jam masuk & keluar. Anda dapat mengisi catatan
                waktu/lokasi fleksibel pada kolom Keterangan di bawah.
              </p>
            </div>
          )}

          {/* Notes Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Catatan / Keterangan (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                workMode === "WFA"
                  ? 'Contoh: "Siang - Sore di kantor" atau "Remote dari rumah"'
                  : "Contoh: Meeting client di luar kantor"
              }
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Daily Activity */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              <span className="inline-flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                Daily Activity (Logbook Aktivitas Harian)
              </span>
            </label>
            <textarea
              rows={3}
              value={dailyActivity}
              onChange={(e) => setDailyActivity(e.target.value)}
              placeholder="Tuliskan rincian pekerjaan atau task yang diselesaikan hari ini..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 1 Attachment Upload */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              <span className="inline-flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                Lampiran Bukti Harian (Maks 1 File JPG/PNG/PDF)
              </span>
            </label>

            {existingAttachmentUrl && !selectedFile && (
              <div className="flex items-center justify-between p-3 mb-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <a
                  href={existingAttachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:underline truncate"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  Lihat Lampiran Tersimpan
                </a>
                <button
                  type="button"
                  onClick={() => setExistingAttachmentUrl(null)}
                  className="text-red-600 hover:text-red-700 font-semibold ml-3"
                >
                  Hapus Lampiran
                </button>
              </div>
            )}

            <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 cursor-pointer transition">
              <Upload className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-semibold text-slate-700 truncate">
                {selectedFile
                  ? `File dipilih: ${selectedFile.name}`
                  : "Klik untuk pilih foto bukti / PDF (Otomatis dikompres)"}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {row.log ? (
              <button
                type="button"
                disabled={deleting || saving}
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Reset Tanggal Ini
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving || deleting}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white shadow-sm shadow-indigo-500/20 transition"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Simpan Log Harian
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
