"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  UserCheck,
  Briefcase,
  Clock,
  ShieldCheck,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface ApproverDraft {
  name: string;
  department_or_title: string;
  is_default: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");

  const [approvers, setApprovers] = useState<ApproverDraft[]>([
    { name: "", department_or_title: "", is_default: true },
  ]);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      // Check if already onboarded
      const { data: profile } = await supabase
        .from("att_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      const { data: existingApprovers } = await supabase
        .from("att_approvers")
        .select("*")
        .eq("user_id", user.id);

      if (
        profile &&
        profile.full_name?.trim() &&
        existingApprovers &&
        existingApprovers.length > 0
      ) {
        router.replace("/");
        return;
      }

      if (profile) {
        setFullName(profile.full_name || "");
        setRoleTitle(profile.role_title || "");
        if (profile.default_start_time) {
          setStartTime(profile.default_start_time.slice(0, 5));
        }
        if (profile.default_end_time) {
          setEndTime(profile.default_end_time.slice(0, 5));
        }
      }

      if (existingApprovers && existingApprovers.length > 0) {
        setApprovers(
          existingApprovers.map((a) => ({
            name: a.name,
            department_or_title: a.department_or_title,
            is_default: a.is_default,
          }))
        );
      }

      setChecking(false);
    }

    loadUser();
  }, [router, supabase]);

  const handleFillSample = () => {
    setFullName("Yosep Geovanie Aritonang");
    setRoleTitle("Fullstack");
    setStartTime("08:00");
    setEndTime("17:00");
    setApprovers([
      {
        name: "Reza Putra",
        department_or_title: "IT Department",
        is_default: true,
      },
    ]);
  };

  const addApproverRow = () => {
    setApprovers((prev) => [
      ...prev,
      { name: "", department_or_title: "", is_default: prev.length === 0 },
    ]);
  };

  const removeApproverRow = (idx: number) => {
    if (approvers.length <= 1) return;
    setApprovers((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (!next.some((a) => a.is_default) && next.length > 0) {
        next[0].is_default = true;
      }
      return next;
    });
  };

  const setDefaultApprover = (idx: number) => {
    setApprovers((prev) =>
      prev.map((item, i) => ({
        ...item,
        is_default: i === idx,
      }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!userId) return;

    if (!fullName.trim() || !roleTitle.trim()) {
      setErrorMsg("Nama lengkap dan Jabatan wajib diisi.");
      return;
    }

    const validApprovers = approvers.filter(
      (a) => a.name.trim() && a.department_or_title.trim()
    );

    if (validApprovers.length === 0) {
      setErrorMsg(
        "Wajib menambahkan minimal 1 Approver (Nama & Departemen/Jabatan)."
      );
      return;
    }

    setSaving(true);
    try {
      // 1. Upsert att_profiles
      const { error: profileError } = await supabase
        .from("att_profiles")
        .upsert(
          {
            id: userId,
            full_name: fullName.trim(),
            role_title: roleTitle.trim(),
            default_start_time: startTime,
            default_end_time: endTime,
          },
          { onConflict: "id" }
        );

      if (profileError) throw profileError;

      // 2. Replace user's approvers with the submitted list
      await supabase.from("att_approvers").delete().eq("user_id", userId);

      const { error: approverError } = await supabase
        .from("att_approvers")
        .insert(
          validApprovers.map((a, index) => ({
            user_id: userId,
            name: a.name.trim(),
            department_or_title: a.department_or_title.trim(),
            is_default: a.is_default || index === 0,
          }))
        );

      if (approverError) throw approverError;

      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Gagal menyimpan data onboarding.";
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Memuat profil Anda...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Langkah Awal (Onboarding)
            </span>
            <h1 className="text-2xl font-bold text-slate-900">
              Lengkapi Profil & Approver
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Data ini akan digunakan secara otomatis pada tabel rekap presensi,
              perhitungan target jam kerja, dan blok tanda tangan dokumen.
            </p>
          </div>
          <button
            type="button"
            onClick={handleFillSample}
            className="self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
            Isi Contoh Cepat
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Data Diri & Jam Kerja */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  1. Identitas & Target Jam Kerja
                </h2>
                <p className="text-xs text-slate-500">
                  Nama dan jabatan yang tampil pada header serta blok tanda
                  tangan kiri
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Contoh: Yosep Geovanie Aritonang"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Jabatan / Role *
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="Contoh: Fullstack"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Target Jam Masuk (WFO)
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Target Jam Keluar (WFO)
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Approver */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    2. Daftar Approver (Atasan / Penyetuju)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Minimal 1 Approver untuk blok tanda tangan kanan saat Export
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={addApproverRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Approver
              </button>
            </div>

            <div className="space-y-3">
              {approvers.map((app, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase">
                      Approver #{idx + 1}
                    </span>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="default_approver"
                          checked={app.is_default}
                          onChange={() => setDefaultApprover(idx)}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        Jadikan Default
                      </label>
                      {approvers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeApproverRow(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Hapus Approver"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Nama Approver *
                      </label>
                      <input
                        type="text"
                        required
                        value={app.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setApprovers((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, name: val } : item
                            )
                          );
                        }}
                        placeholder="Contoh: Reza Putra"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Departemen / Jabatan *
                      </label>
                      <input
                        type="text"
                        required
                        value={app.department_or_title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setApprovers((prev) =>
                            prev.map((item, i) =>
                              i === idx
                                ? { ...item, department_or_title: val }
                                : item
                            )
                          );
                        }}
                        placeholder="Contoh: IT Department"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-sm shadow-md shadow-indigo-500/20 transition"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan Profil...
                </>
              ) : (
                <>
                  Simpan & Masuk ke Dashboard
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
