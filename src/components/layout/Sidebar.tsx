"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  HomeIcon,
  CalendarDaysIcon,
  ClockIcon,
  UsersIcon,
  DocumentChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  BriefcaseIcon,
  TagIcon,
  CurrencyEuroIcon,
  ChatBubbleLeftRightIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { useState, useEffect } from "react";
import NotificationBell from "@/components/NotificationBell";

const navigation = [
  {
    name: "Dashboard",
    employeeName: "Dashboard",
    href: "/dashboard",
    icon: HomeIcon,
    roles: ["ADMIN", "MANAGER", "EMPLOYEE"],
  },
  {
    name: "Planning",
    employeeName: "Mijn Rooster",
    href: "/planning",
    icon: CalendarDaysIcon,
    roles: ["ADMIN", "MANAGER", "EMPLOYEE"],
  },
  {
    name: "Open Diensten",
    employeeName: "Open Diensten",
    href: "/open-shifts",
    icon: BriefcaseIcon,
    roles: ["ADMIN", "MANAGER", "EMPLOYEE"],
  },
  {
    name: "Beschikbaarheid",
    employeeName: "Mijn Beschikbaarheid",
    href: "/availability",
    icon: ClockIcon,
    roles: ["ADMIN", "MANAGER", "EMPLOYEE"],
  },
  {
    name: "Medewerkers",
    employeeName: "Medewerkers",
    href: "/employees",
    icon: UsersIcon,
    roles: ["ADMIN"],
  },
  {
    name: "Functies",
    employeeName: "Functies",
    href: "/functies",
    icon: TagIcon,
    roles: ["ADMIN"],
  },
  {
    name: "Kwalificaties",
    employeeName: "Kwalificaties",
    href: "/kwalificaties",
    icon: TagIcon,
    roles: ["ADMIN"],
  },
  {
    name: "Toeslagen",
    employeeName: "Toeslagen",
    href: "/toeslagen",
    icon: CurrencyEuroIcon,
    roles: ["ADMIN"],
  },
  {
    name: "Opdrachtgevers",
    employeeName: "Opdrachtgevers",
    href: "/opdrachtgevers",
    icon: BuildingOfficeIcon,
    roles: ["ADMIN"],
  },
  {
    name: "Berichten",
    employeeName: "Berichten",
    href: "/berichten",
    icon: ChatBubbleLeftRightIcon,
    roles: ["ADMIN", "MANAGER", "EMPLOYEE"],
  },
  {
    name: "Rapportages",
    employeeName: "Rapportages",
    href: "/admin/reports",
    icon: DocumentChartBarIcon,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    name: "Permissies",
    employeeName: "Permissies",
    href: "/admin/permissions",
    icon: ShieldCheckIcon,
    roles: ["ADMIN"],
  },
  {
    name: "Instellingen",
    employeeName: "Instellingen",
    href: "/settings",
    icon: Cog6ToothIcon,
    roles: ["ADMIN", "MANAGER", "EMPLOYEE"],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const userRole = session?.user?.role || "EMPLOYEE";

  const filteredNav = navigation.filter((item) =>
    item.roles.includes(userRole),
  );
  const isEmployee = userRole === "EMPLOYEE";

  // Prefetch all navigable routes on mount for instant transitions
  useEffect(() => {
    filteredNav.forEach((item) => {
      router.prefetch(item.href);
    });
  }, [filteredNav, router]);

  const NavContent = () => (
    <>
      {/* Logo + Notification Bell */}
      <div className="flex items-center justify-between px-4 py-6 border-b border-gray-700/50">
        <Image
          src="/logo.png"
          alt="NoLimitSafety"
          width={180}
          height={50}
          className="h-10 w-auto object-contain"
          priority
        />
        <NotificationBell />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {filteredNav.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-brand-500/15 text-brand-400 border border-brand-500/20"
                  : "text-gray-400 hover:text-white hover:bg-gray-800",
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 flex-shrink-0",
                  isActive ? "text-brand-400" : "text-gray-500",
                )}
              />
              {isEmployee ? item.employeeName : item.name}
            </Link>
          );
        })}
      </nav>

      {/* User info & logout */}
      <div className="p-4 border-t border-gray-700/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium text-brand-400">
            {session?.user?.name?.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {session?.user?.name}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {userRole === "ADMIN"
                ? "Administrator"
                : userRole === "MANAGER"
                  ? "Manager"
                  : "Medewerker"}
            </p>
          </div>
        </div>
        <button
          onClick={async () => {
            await signOut({ redirect: false });
            window.location.href = "/login";
          }}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <ArrowRightOnRectangleIcon className="h-4 w-4" />
          Uitloggen
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-md border-b border-gray-700/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="NoLimitSafety"
            width={140}
            height={40}
            className="h-8 w-auto object-contain"
          />
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-gray-400 hover:text-white"
            aria-label="Menu openen"
          >
            {mobileOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          "lg:hidden fixed top-0 left-0 bottom-0 z-40 w-72 bg-gray-900 border-r border-gray-700/50 transform transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          <NavContent />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-gray-900 border-r border-gray-700/50 sidebar-fixed">
        <NavContent />
      </div>
    </>
  );
}
