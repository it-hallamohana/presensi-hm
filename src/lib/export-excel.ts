import ExcelJS from "exceljs";
import { AttProfile, DayRecapRow } from "@/types/attendance";
import { formatTimeShort, getRowKeterangan } from "@/lib/attendance-utils";

async function fetchImageForExcel(url: string): Promise<{
  buffer: ArrayBuffer;
  extension: "jpeg" | "png";
} | null> {
  try {
    const cleanUrl = url.split("?")[0].toLowerCase();
    if (cleanUrl.endsWith(".pdf")) return null;

    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("pdf")) return null;

    const blob = await response.blob();

    // Convert any image (including webp/png/jpg) to clean PNG or JPEG via canvas if in browser,
    // or directly use buffer if already png/jpeg
    if (contentType.includes("png") || cleanUrl.endsWith(".png")) {
      const buffer = await blob.arrayBuffer();
      return { buffer, extension: "png" };
    }

    if (
      contentType.includes("jpeg") ||
      contentType.includes("jpg") ||
      cleanUrl.endsWith(".jpg") ||
      cleanUrl.endsWith(".jpeg")
    ) {
      const buffer = await blob.arrayBuffer();
      return { buffer, extension: "jpeg" };
    }

    // Fallback: convert via HTML5 Canvas to JPEG so ExcelJS never fails on WebP
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);

    const jpegBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85)
    );
    if (!jpegBlob) return null;
    const buffer = await jpegBlob.arrayBuffer();
    return { buffer, extension: "jpeg" };
  } catch {
    return null;
  }
}

export async function exportAttendanceToExcel(params: {
  rows: DayRecapRow[];
  profile: AttProfile;
  periodLabel: string;
}) {
  const { rows, profile, periodLabel } = params;
  const targetIn = formatTimeShort(profile.default_start_time) || "08:00";
  const targetOut = formatTimeShort(profile.default_end_time) || "17:00";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = profile.full_name || "Attendance & Daily Logbook";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Rekap Presensi", {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  // Title Row
  sheet.mergeCells("A1:I1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `REKAPITULASI PRESENSI & DAILY LOGBOOK - ${profile.full_name.toUpperCase()}`;
  titleCell.font = { bold: true, size: 13, color: { argb: "FF0F172A" } };

  // Subtitle Row
  sheet.mergeCells("A2:I2");
  const subCell = sheet.getCell("A2");
  subCell.value = `Jabatan: ${profile.role_title || "-"}  |  Periode: ${periodLabel}  |  Target Jam Kerja: ${targetIn} - ${targetOut}`;
  subCell.font = { italic: true, size: 10, color: { argb: "FF475569" } };

  // Blank row 3
  sheet.addRow([]);

  // Headers at Row 4
  const headers = [
    "Tanggal",
    "Nama",
    "Target Masuk",
    "Target Keluar",
    "Aktual/WFA",
    "Jam Keluar",
    "Keterangan",
    "Daily Activity",
    "Bukti Lampiran",
  ];

  const headerRow = sheet.getRow(4);
  headerRow.values = headers;
  headerRow.height = 26;

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" }, // Slate 800
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  // Set Column Widths
  sheet.columns = [
    { key: "tanggal", width: 20 },
    { key: "nama", width: 25 },
    { key: "target_masuk", width: 13 },
    { key: "target_keluar", width: 13 },
    { key: "aktual_wfa", width: 14 },
    { key: "jam_keluar", width: 13 },
    { key: "keterangan", width: 32 },
    { key: "daily_activity", width: 45 },
    { key: "bukti_lampiran", width: 28 },
  ];

  // Pre-fetch all attachment images in parallel so export is fast
  const attachmentImages = await Promise.all(
    rows.map(async (row) => {
      const url = row.log?.attachment_url;
      if (!url) return null;
      return await fetchImageForExcel(url);
    })
  );

  const appendixItems: {
    row: DayRecapRow;
    imgData: { buffer: ArrayBuffer; extension: "jpeg" | "png" };
  }[] = [];

  rows.forEach((row, index) => {
    const { log, isWeekend, dayName, formattedDate } = row;

    let aktualWfa = "-";
    let jamKeluar = "-";
    const targetMasukCell = isWeekend && !log ? "-" : targetIn;
    const targetKeluarCell = isWeekend && !log ? "-" : targetOut;

    if (!log) {
      if (isWeekend) {
        aktualWfa = "WEEKEND";
        jamKeluar = "WEEKEND";
      }
    } else {
      if (log.work_mode === "WFO") {
        aktualWfa = formatTimeShort(log.check_in) || "-";
        jamKeluar = formatTimeShort(log.check_out) || "-";
      } else if (log.work_mode === "WFA") {
        aktualWfa = "WFA";
        jamKeluar = log.check_out ? formatTimeShort(log.check_out) : "WFA";
      } else if (log.work_mode === "OFF") {
        aktualWfa = "OFF";
        jamKeluar = "OFF";
      }
    }

    const keterangan = getRowKeterangan(row, targetIn, targetOut);
    const activity = log?.daily_activity || (isWeekend && !log ? "WEEKEND" : "-");
    const attachmentUrl = log?.attachment_url || "";
    const imgData = attachmentImages[index];

    let lampiranCellText = "-";
    if (attachmentUrl && !imgData) {
      // e.g. PDF document
      lampiranCellText = "Dokumen PDF Terlampir";
    } else if (imgData) {
      lampiranCellText = ""; // Will be filled with embedded image
    }

    const excelRow = sheet.addRow([
      `${dayName}, ${formattedDate}`,
      profile.full_name,
      targetMasukCell,
      targetKeluarCell,
      aktualWfa,
      jamKeluar,
      keterangan,
      activity,
      lampiranCellText,
    ]);

    const rowNumber = excelRow.number;

    if (imgData) {
      // Set row height tall enough so the physical printed thumbnail is clearly visible
      excelRow.height = 95;
      appendixItems.push({ row, imgData });
    }

    excelRow.eachCell((cell, colNumber) => {
      cell.font = {
        size: 10,
        color: { argb: isWeekend && !log ? "FF64748B" : "FF0F172A" },
      };

      // Highlight WEEKEND rows in gray
      if (isWeekend) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: log ? "FFE2E8F0" : "FFF1F5F9" },
        };
      }

      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      if ([3, 4, 5, 6, 9].includes(colNumber)) {
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      } else {
        cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      }
    });

    // Embed actual image inside Column I (col index 8 in 0-based)
    if (imgData) {
      const imageId = workbook.addImage({
        buffer: imgData.buffer,
        extension: imgData.extension,
      });

      sheet.addImage(imageId, {
        tl: { col: 8.08, row: rowNumber - 1 + 0.08 },
        ext: { width: 175, height: 110 },
        editAs: "oneCell",
      });
    }
  });

  // Also add a dedicated "Lampiran Bukti (Cetak)" worksheet with large images for physical printing
  if (appendixItems.length > 0) {
    const appSheet = workbook.addWorksheet("Lampiran Bukti (Cetak)", {
      pageSetup: {
        paperSize: 9, // A4
        orientation: "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    appSheet.columns = [
      { key: "info", width: 38 },
      { key: "gambar", width: 58 },
    ];

    appSheet.mergeCells("A1:B1");
    const appTitle = appSheet.getCell("A1");
    appTitle.value = `LAMPIRAN BUKTI AKTIVITAS HARIAN - ${profile.full_name.toUpperCase()} (${periodLabel})`;
    appTitle.font = { bold: true, size: 12, color: { argb: "FF0F172A" } };
    appSheet.getRow(1).height = 24;

    const appHeader = appSheet.getRow(2);
    appHeader.values = ["Tanggal & Detail Aktivitas", "Foto / Gambar Bukti Lampiran"];
    appHeader.height = 24;
    appHeader.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E293B" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    appendixItems.forEach(({ row, imgData }) => {
      const { dayName, formattedDate, log } = row;
      const modeInfo =
        log?.work_mode === "WFO"
          ? `WFO (${formatTimeShort(log.check_in)} - ${formatTimeShort(log.check_out)})`
          : log?.work_mode || "-";

      const detailText = [
        `Tanggal: ${dayName}, ${formattedDate}`,
        `Mode: ${modeInfo}`,
        log?.notes ? `Keterangan: ${log.notes}` : null,
        "",
        "Daily Activity:",
        log?.daily_activity || "-",
      ]
        .filter((x) => x !== null)
        .join("\n");

      const itemRow = appSheet.addRow([detailText, ""]);
      itemRow.height = 210;

      itemRow.eachCell((cell) => {
        cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
        cell.font = { size: 10, color: { argb: "FF0F172A" } };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
      });

      const imgId = workbook.addImage({
        buffer: imgData.buffer,
        extension: imgData.extension,
      });

      appSheet.addImage(imgId, {
        tl: { col: 1.05, row: itemRow.number - 1 + 0.05 },
        ext: { width: 360, height: 250 },
        editAs: "oneCell",
      });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const safeName = (profile.full_name || "User")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/__+/g, "_");
  const safePeriod = periodLabel
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/__+/g, "_");

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Rekap_Presensi_${safeName}_${safePeriod}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
