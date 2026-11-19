"use client";

import React, { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { createClient } from "@/lib/supabase/client";
import { compressAttachmentFile } from "@/lib/image-compression";
import {
  PenTool,
  Upload,
  Eraser,
  CheckCircle2,
  Trash2,
  Loader2,
  AlertCircle,
  FileSignature,
} from "lucide-react";

interface SignatureManagerProps {
  userId: string;
  currentSignatureUrl: string | null;
  onUpdated: (newUrl: string | null) => void;
}

export default function SignatureManager({
  userId,
  currentSignatureUrl,
  onUpdated,
}: SignatureManagerProps) {
  const supabase = createClient();
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);

  const [activeTab, setActiveTab] = useState<"draw" | "upload" | "wet">("draw");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const uploadSignatureBlob = async (fileOrBlob: Blob, ext = "png") => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const filePath = `${userId}/signature_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("att-signatures")
        .upload(filePath, fileOrBlob, {
          upsert: true,
          contentType: `image/${ext}`,
        });

      if (uploadErr) throw uploadErr;

      const { data: pubData } = supabase.storage
        .from("att-signatures")
        .getPublicUrl(filePath);

      const publicUrl = pubData.publicUrl;

      const { error: updateErr } = await supabase
        .from("att_profiles")
        .update({ signature_url: publicUrl })
        .eq("id", userId);

      if (updateErr) throw updateErr;

      onUpdated(publicUrl);
      setSuccessMsg("Tanda tangan digital berhasil disimpan!");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Gagal menyimpan tanda tangan.";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCanvas = async () => {
    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
      setErrorMsg("Canvas tanda tangan masih kosong. Silakan gambar dulu.");
      return;
    }

    const dataUrl = sigCanvasRef.current
      .getTrimmedCanvas()
      .toDataURL("image/png");
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await uploadSignatureBlob(blob, "png");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Harap pilih file gambar (disarankan PNG transparan).");
      return;
    }

    const compressed = await compressAttachmentFile(file, {
      maxDimension: 800,
      preservePngTransparency: true,
    });

    await uploadSignatureBlob(compressed, "png");
  };

  const handleClearForWetSignature = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase
        .from("att_profiles")
        .update({ signature_url: null })
        .eq("id", userId);

      if (error) throw error;
      onUpdated(null);
      setSuccessMsg(
        "Tanda tangan digital dikosongkan (Siap untuk tanda tangan basah saat dicetak)."
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Gagal mengosongkan tanda tangan.";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            <FileSignature className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Digital Signature (E-Sign)
            </h3>
            <p className="text-xs text-slate-500">
              Pilih metode tanda tangan untuk dokumen Export PDF/Cetak
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("draw")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "draw"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            Gambar Canvas
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "upload"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload PNG
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("wet")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "wet"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            TTD Basah
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left: Input Area */}
        <div>
          {activeTab === "draw" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 font-medium">
                Gambar tanda tangan Anda menggunakan mouse atau layar sentuh:
              </p>
              <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/70 overflow-hidden">
                <SignatureCanvas
                  ref={sigCanvasRef}
                  penColor="#0f172a"
                  canvasProps={{
                    className: "w-full h-44 cursor-crosshair",
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => sigCanvasRef.current?.clear()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Bersihkan Canvas
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveCanvas}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  Simpan TTD Canvas
                </button>
              </div>
            </div>
          )}

          {activeTab === "upload" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 font-medium">
                Upload file gambar tanda tangan Anda (disarankan PNG dengan
                background transparan):
              </p>
              <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl bg-slate-50/70 cursor-pointer transition text-center">
                <Upload className="w-7 h-7 text-indigo-600 mb-2" />
                <span className="text-xs font-bold text-slate-700">
                  Klik untuk Pilih File PNG / Gambar TTD
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  Maksimal 5 MB (Transparansi PNG dipertahankan)
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {activeTab === "wet" && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <p className="text-xs font-semibold text-slate-800">
                Mode Tanda Tangan Basah (Kosongkan E-Sign)
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Jika Anda ingin menandatangani kertas secara manual menggunakan
                pulpen setelah dokumen dicetak, klik tombol di bawah untuk
                mengosongkan tanda tangan digital.
              </p>
              <button
                type="button"
                disabled={saving || !currentSignatureUrl}
                onClick={handleClearForWetSignature}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Kosongkan Tanda Tangan Digital
              </button>
            </div>
          )}
        </div>

        {/* Right: Current Active Preview */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col items-center justify-center min-h-[190px]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
            Status Tanda Tangan Aktif Saat Ini
          </span>
          {currentSignatureUrl ? (
            <div className="text-center space-y-2">
              <div className="bg-white border border-slate-200 rounded-xl p-3 inline-block shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentSignatureUrl}
                  alt="Tanda Tangan Aktif"
                  className="max-h-24 object-contain mx-auto"
                />
              </div>
              <p className="text-xs text-emerald-700 font-semibold">
                E-Sign Aktif (Bisa di-drag & resize di Export Preview)
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-xs font-semibold text-slate-500">
                Belum Ada TTD Digital (Mode Tanda Tangan Basah)
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Area tanda tangan akan dibiarkan kosong saat cetak PDF.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
