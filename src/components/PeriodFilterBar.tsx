"use client";

import React from "react";
import { ID_MONTHS_FULL, toDateStr } from "@/lib/attendance-utils";
import { Calendar, Filter } from "lucide-react";

export type PeriodMode = "this_month" | "last_month" | "specific_month" | "custom";

export interface PeriodFilterState {
  mode: PeriodMode;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  selectedMonth: string; // YYYY-MM
}

export function getInitialPeriodState(): PeriodFilterState {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);

  return {
    mode: "this_month",
    startDate: toDateStr(firstDay),
    endDate: toDateStr(lastDay),
    selectedMonth: `${y}-${String(m + 1).padStart(2, "0")}`,
  };
}

export function formatPeriodLabel(state: PeriodFilterState): string {
  if (state.mode === "this_month" || state.mode === "last_month" || state.mode === "specific_month") {
    const [y, m] = state.startDate.split("-").map(Number);
    if (y && m) {
      return `${ID_MONTHS_FULL[m - 1]} ${y}`;
    }
  }
  return `${state.startDate} s/d ${state.endDate}`;
}

interface PeriodFilterBarProps {
  value: PeriodFilterState;
  onChange: (next: PeriodFilterState) => void;
}

export default function PeriodFilterBar({
  value,
  onChange,
}: PeriodFilterBarProps) {
  const applyQuickMode = (mode: PeriodMode) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (mode === "this_month") {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      onChange({
        mode,
        startDate: toDateStr(start),
        endDate: toDateStr(end),
        selectedMonth: `${y}-${String(m + 1).padStart(2, "0")}`,
      });
    } else if (mode === "last_month") {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      onChange({
        mode,
        startDate: toDateStr(start),
        endDate: toDateStr(end),
        selectedMonth: `${start.getFullYear()}-${String(
          start.getMonth() + 1
        ).padStart(2, "0")}`,
      });
    } else if (mode === "specific_month") {
      const [selY, selM] = value.selectedMonth.split("-").map(Number);
      const targetY = selY || y;
      const targetM = (selM || m + 1) - 1;
      const start = new Date(targetY, targetM, 1);
      const end = new Date(targetY, targetM + 1, 0);
      onChange({
        mode,
        startDate: toDateStr(start),
        endDate: toDateStr(end),
        selectedMonth: value.selectedMonth,
      });
    } else {
      onChange({
        ...value,
        mode: "custom",
      });
    }
  };

  const handleMonthInput = (ym: string) => {
    if (!ym) return;
    const [y, m] = ym.split("-").map(Number);
    if (!y || !m) return;
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    onChange({
      mode: "specific_month",
      startDate: toDateStr(start),
      endDate: toDateStr(end),
      selectedMonth: ym,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      {/* Quick Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mr-2">
          <Filter className="w-3.5 h-3.5 text-indigo-600" />
          Periode:
        </span>

        {(
          [
            { id: "this_month", label: "Bulan Ini" },
            { id: "last_month", label: "Bulan Lalu" },
            { id: "specific_month", label: "Pilih Bulan" },
            { id: "custom", label: "Custom Range" },
          ] as { id: PeriodMode; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => applyQuickMode(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              value.mode === tab.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dynamic Input Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        {value.mode === "specific_month" && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">Bulan:</label>
            <input
              type="month"
              value={value.selectedMonth}
              onChange={(e) => handleMonthInput(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {value.mode === "custom" ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Dari:</span>
              <input
                type="date"
                value={value.startDate}
                onChange={(e) =>
                  onChange({
                    ...value,
                    startDate: e.target.value,
                  })
                }
                className="px-2.5 py-1.5 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Sampai:</span>
              <input
                type="date"
                value={value.endDate}
                onChange={(e) =>
                  onChange({
                    ...value,
                    endDate: e.target.value,
                  })
                }
                className="px-2.5 py-1.5 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>{formatPeriodLabel(value)}</span>
            <span className="text-slate-400 font-normal">
              ({value.startDate} s/d {value.endDate})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
