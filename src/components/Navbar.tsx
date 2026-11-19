"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AttProfile } from "@/types/attendance";
import {
  CalendarCheck2,
  LayoutDashboard,
  FileSpreadsheet,
  UserCog,
  LogOut,
} from "lucide-react";

interface NavbarProps {
  profile: AttProfile | null;
  userEmail?: string;
}

export default function Navbar({ profile, userEmail }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const navItems = [
    {
      href: "/",
      label: "Dashboard & Logbook",
      icon: LayoutDashboard,
    },
    {
      href: "/export",
      label: "Export & E-Sign Preview",
      icon: FileSpreadsheet,
    },
    {
      href: "/profile",
      label: "Profil & TTD Digital",
      icon: UserCog,
    },
  ];

  return (
    <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
              <CalendarCheck2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm sm:text-base tracking-tight block leading-none">
                Presensi & Logbook
              </span>
              <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                Halla Mohana Workspace
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-slate-800 truncate max-w-[180px]">
                {profile?.full_name || userEmail || "User"}
              </p>
              <p className="text-[11px] text-slate-500 truncate max-w-[180px]">
                {profile?.role_title || "Member"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Keluar (Logout)"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>

        {/* Mobile Bottom Bar inside Header */}
        <div className="flex md:hidden items-center justify-around border-t border-slate-100 py-1.5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
