import ExcelJS from "exceljs";
import { AttProfile, DayRecapRow } from "@/types/attendance";
import { formatTimeShort, getRowKeterangan } from "@/lib/attendance-utils";

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
    "Link Lampiran",
  ];

  const headerRow = sheet.getRow(4);
  headerRow.values = headers;
  headerRow.height = 24;

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
    { key: "nama", width: 26 },
    { key: "target_masuk", width: 14 },
    { key: "target_keluar", width: 14 },
    { key: "aktual_wfa", width: 15 },
    { key: "jam_keluar", width: 14 },
    { key: "keterangan", width: 32 },
    { key: "daily_activity", width: 45 },
    { key: "link_lampiran", width: 26 },
  ];

  rows.forEach((row) => {
    const { log, isWeekend, dayName, formattedDate } = row;

    let aktualWfa = "-";
    let jamKeluar = "-";
    let targetMasukCell = isWeekend && !log ? "-" : targetIn;
    let targetKeluarCell = isWeekend && !log ? "-" : targetOut;

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

    const excelRow = sheet.addRow([
      `${dayName}, ${formattedDate}`,
      profile.full_name,
      targetMasukCell,
      targetKeluarCell,
      aktualWfa,
      jamKeluar,
      keterangan,
      activity,
      attachmentUrl ? "Lihat Lampiran" : "-",
    ]);

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
          fgColor: { argb: log ? "FFE2E8F0" : "FFF1F5F9" }, // Grey highlight for weekend
        };
      }

      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      if ([3, 4, 5, 6].includes(colNumber)) {
        cell.alignment = { vertical: "top", horizontal: "center" };
      } else {
        cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      }
    });

    // Add clickable hyperlink if attachment exists
    if (attachmentUrl) {
      const linkCell = excelRow.getCell(9);
      linkCell.value = {
        text: "Buka Bukti Lampiran",
        hyperlink: attachmentUrl,
      };
      linkCell.font = {
        size: 10,
        color: { argb: "FF2563EB" },
        underline: true,
      };
    }
  });

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
