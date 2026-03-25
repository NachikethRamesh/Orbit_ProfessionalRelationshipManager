"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Monitor,
  MessageCircle,
  Settings,
} from "lucide-react";
import clsx from "clsx";
import ChatModal from "@/components/ChatModal";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/reminders", label: "Reminders", icon: AlertTriangle },
  { href: "/connect", label: "Connect Accounts", icon: Monitor },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [showChat, setShowChat] = useState(false);

  return (
    <div className="h-screen flex bg-black p-4 gap-3 overflow-hidden">
      <nav className="w-[200px] shrink-0 flex flex-col items-start py-6 px-4">
        <div className="mb-8 px-2">
          <div className="text-[24px] font-bold text-white/90 tracking-tight">Orbit</div>
          <p className="text-[10px] text-white/30 mt-0.5">Your contacts. Always in your Orbit.</p>
        </div>

        <div className="flex flex-col gap-1 w-full flex-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 w-full h-10 px-3 rounded-lg text-[13px] transition-all",
                  isActive
                    ? "text-orange-400"
                    : "text-white/25 hover:text-white/90 hover:bg-white/[0.04]"
                )}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
                <span>{label}</span>
              </Link>
            );
          })}

          <div className="mt-auto flex flex-col gap-1">
            <button
              onClick={() => setShowChat(true)}
              className="flex items-center gap-3 w-full h-10 px-3 rounded-lg text-[13px] text-white/25 hover:text-orange-400 hover:bg-white/[0.04] transition-all"
            >
              <MessageCircle className="w-[18px] h-[18px]" strokeWidth={2} />
              <span>Chat</span>
            </button>
            <p className="px-3 text-[9px] leading-tight text-white/15">
              Open-source, locally-runnable. Your data stays on your machine. Built by{" "}
              <a href="https://nachikethramesh.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/30 transition-colors">
                Nachiketh Ramesh
              </a>
            </p>
          </div>
        </div>
      </nav>

      <main className="flex-1 min-w-0 flex gap-3 overflow-hidden">
        {children}
      </main>

      {showChat && <ChatModal onClose={() => setShowChat(false)} />}
    </div>
  );
}
