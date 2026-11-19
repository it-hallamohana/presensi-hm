"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AttApprover, AttProfile } from "@/types/attendance";
import { formatTimeShort } from "@/lib/attendance-utils";
import Navbar from "@/components/Navbar";
import SignatureManager from "@/components/SignatureManager";
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
  Save,
} from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<AttProfile | null>(null);

  const [fullName, setFullName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

  const [approvers, setApprovers] = useState<AttApprover[]>([]);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingApprovers, setSavingApprovers] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
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

    if (prof) {
      setProfile(prof);
      setFullName(prof.full_name || "");
      setRoleTitle(prof.role_title || "");
      setStartTime(formatTimeShort(prof.default_start_time) || "08:00");
      setEndTime(formatTimeShort(prof.default_end_time) || "17:00");
      setSignatureUrl(prof.signature_url);
    }

    const { data: appList } = await supabase
      .from("att_approvers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    setApprovers(
      appList && appList.length > 0
        ? appList
        : [
            {
              id: "temp-1",
              user_id: user.id,
              name: "",
              department_or_title: "",
              is_default: true,
            },
          ]
    );

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName.trim() || !roleTitle.trim()) {
      setErrorMsg("Nama lengkap dan Jabatan tidak boleh kosong.");
      return;
    }

    setSavingProfile(true);
    try {
      const { data, error } = await supabase
        .from("att_profiles")
        .upsert(
          {
            id: userId,
            full_name: fullName.trim(),
            role_title: roleTitle.trim(),
            default_start_time: startTime,
            default_end_time: endTime,
            signature_url: signatureUrl,
          },
          { onConflict: "id" }
        )
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
      setSuccessMsg("Profil & Target Jam Kerja berhasil diperbarui.");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Gagal menyimpan profil.";
      setErrorMsg(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveApprovers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const valid = approvers.filter(
      (a) => a.name.trim() && a.department_or_title.trim()
    );
    if (valid.length === 0) {
      setErrorMsg("Minimal harus ada 1 Approver yang valid.");
      return;
    }

    setSavingApprovers(true);
    try {
      await supabase.from("att_approvers").delete().eq("user_id", userId);
      const { error } = await supabase.from("att_approvers").insert(
        valid.map((a, idx) => ({
          user_id: userId,
          name: a.name.trim(),
          department_or_title: a.department_or_title.trim(),
          is_default: a.is_default || idx === 0,
        }))
      );
      if (error) throw error;
      await loadData();
      setSuccessMsg("Daftar Approver berhasil diperbarui.");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Gagal menyimpan Approver.";
      setErrorMsg(msg);
    } finally {
      setSavingApprovers(false);
    }
  };

  if (loading || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">
            Memuat Pengaturan Profil & TTD Digital...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar profile={profile} userEmail={userEmail} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Pengaturan Profil, Approver & Tanda Tangan Digital
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Kelola identitas Anda, target jam kerja WFO, daftar atasan
            penyetuju (Approver), dan metode tanda tangan digital (E-Sign).
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-start gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. Digital Signature Manager */}
        <SignatureManager
          userId={userId}
          currentSignatureUrl={signatureUrl}
          onUpdated={(newUrl) => {
            setSignatureUrl(newUrl);
            if (profile) {
              setProfile({ ...profile, signature_url: newUrl });
            }
          }}
        />

        {/* 2. Identitas & Target Jam Kerja */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Identitas Diri & Target Jam Kerja
                </h2>
                <p className="text-xs text-slate-500">
                  Digunakan pada kolom Nama dan blok tanda tangan kiri
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white shadow-sm transition"
            >
              {savingProfile ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Simpan Profil
            </button>
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
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Jam Masuk Default
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
                Target Jam Keluar Default
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
        </form>

        {/* 3. Approvers List */}
        <form
          onSubmit={handleSaveApprovers}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Daftar Approver (Blok Tanda Tangan Kanan)
                </h2>
                <p className="text-xs text-slate-500">
                  Anda dapat memilih Approver mana yang tampil saat Export PDF
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setApprovers((prev) => [
                    ...prev,
                    {
                      id: `temp-${Date.now()}`,
                      user_id: userId,
                      name: "",
                      department_or_title: "",
                      is_default: prev.length === 0,
                    },
                  ])
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Baris
              </button>

              <button
                type="submit"
                disabled={savingApprovers}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white shadow-sm transition"
              >
                {savingApprovers ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Simpan Approver
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {approvers.map((app, idx) => (
              <div
                key={app.id || idx}
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
                        name="default_approver_profile"
                        checked={app.is_default}
                        onChange={() =>
                          setApprovers((prev) =>
                            prev.map((item, i) => ({
                              ...item,
                              is_default: i === idx,
                            }))
                          )
                        }
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      Default
                    </label>
                    {approvers.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setApprovers((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="text-red-500 hover:text-red-700 p-1"
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
        </form>
      </main>
    </div>
  );
}
