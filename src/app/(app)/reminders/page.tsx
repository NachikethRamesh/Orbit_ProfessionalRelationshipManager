"use client";

import { useState } from "react";
import {
  useReminders,
  useCreateReminder,
  useUpdateReminder,
} from "@/hooks/useReminders";
import { useContacts } from "@/hooks/useContacts";
import {
  Bell,
  Plus,
  X,
  Loader2,
  Check,
  Clock,
  AlertTriangle,
  Snowflake,
  UserX,
  Reply,
  Calendar,
} from "lucide-react";
import clsx from "clsx";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Completed" },
  { key: "dismissed", label: "Dismissed" },
] as const;

export default function RemindersPage() {
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { data: reminders, isLoading, error } = useReminders(activeTab || undefined);
  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const { data: contacts } = useContacts();

  const [showForm, setShowForm] = useState(false);
  const [newReminder, setNewReminder] = useState({
    title: "",
    contact_id: "",
    remind_at: "",
  });

  const handleCreate = async () => {
    if (!newReminder.title.trim() || !newReminder.remind_at) return;
    try {
      await createReminder.mutateAsync({
        title: newReminder.title,
        contact_id: newReminder.contact_id || undefined,
        remind_at: new Date(newReminder.remind_at).toISOString(),
      } as Partial<import("@/lib/types").Reminder>);
      setNewReminder({ title: "", contact_id: "", remind_at: "" });
      setShowForm(false);
    } catch {}
  };

  const handleSnooze = (reminder: import("@/lib/types").Reminder) => {
    const baseDate = new Date(reminder.remind_at);
    baseDate.setDate(baseDate.getDate() + 3);
    updateReminder.mutate({ id: reminder.id, remind_at: baseDate.toISOString() });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDismissSelected = async () => {
    for (const id of selectedIds) {
      updateReminder.mutate({ id, status: "dismissed" });
    }
    setSelectedIds(new Set());
  };

  const isOverdue = (reminder: import("@/lib/types").Reminder) => {
    return reminder.status === "pending" && new Date(reminder.remind_at) < new Date();
  };

  /** Detect auto-generated reminder type from title prefix and strip it for display */
  const parseReminderType = (title: string) => {
    if (title.startsWith("[cold] ")) return { type: "cold" as const, label: "Cold Contact", icon: Snowflake, color: "text-blue-400/80 bg-blue-500/10", cleanTitle: title.slice(7) };
    if (title.startsWith("[no-contact] ")) return { type: "no-contact" as const, label: "No Contact", icon: UserX, color: "text-yellow-400/80 bg-yellow-500/10", cleanTitle: title.slice(13) };
    if (title.startsWith("[follow-up] ")) return { type: "follow-up" as const, label: "Follow Up", icon: Reply, color: "text-orange-400/80 bg-orange-500/10", cleanTitle: title.slice(12) };
    if (title.startsWith("[meeting] ")) return { type: "meeting" as const, label: "Meeting Debrief", icon: Calendar, color: "text-purple-400/80 bg-purple-500/10", cleanTitle: title.slice(10) };
    return null;
  };

  return (
    <div
      className="flex-1 rounded-3xl border border-white/[0.06] bg-[#0d0d0d] flex flex-col overflow-hidden"
      style={{ boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-white/45 font-medium">Reminders</span>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDismissSelected}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10px] uppercase tracking-widest text-red-400/80 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.2)" }}
            >
              <X className="w-3 h-3" />
              Dismiss Selected ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => setShowForm((p) => !p)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10px] uppercase tracking-widest text-white/90 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.2)" }}
          >
            {showForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showForm ? "Cancel" : "New Reminder"}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="px-6 pb-4 shrink-0">
          <div className="bg-white/[0.04] rounded-lg p-4 space-y-3 border border-white/[0.06]">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Reminder title *"
                value={newReminder.title}
                onChange={(e) => setNewReminder((p) => ({ ...p, title: e.target.value }))}
                className="bg-white/[0.04] border border-transparent rounded-lg px-3 py-2.5 text-[13px] text-white/90 placeholder:text-white/25 placeholder:text-[10px] placeholder:uppercase placeholder:tracking-widest focus:outline-none focus:border-white/[0.15]"
              />
              <input
                type="datetime-local"
                value={newReminder.remind_at}
                onChange={(e) => setNewReminder((p) => ({ ...p, remind_at: e.target.value }))}
                className="bg-white/[0.04] border border-transparent rounded-lg px-3 py-2.5 text-[13px] text-white/90 focus:outline-none focus:border-white/[0.15] [color-scheme:dark]"
              />
              <select
                value={newReminder.contact_id}
                onChange={(e) => setNewReminder((p) => ({ ...p, contact_id: e.target.value }))}
                className="bg-white/[0.04] border border-transparent rounded-lg px-3 py-2.5 text-[13px] text-white/90 focus:outline-none focus:border-white/[0.15] col-span-2"
              >
                <option value="" className="bg-[#0d0d0d]">No contact (optional)</option>
                {contacts?.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0d0d0d]">{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={createReminder.isPending || !newReminder.title.trim() || !newReminder.remind_at}
                className="px-4 py-2 rounded-full text-[10px] uppercase tracking-widest text-white/90 bg-white/[0.08] border border-white/[0.1] hover:bg-white/[0.12] transition-all disabled:opacity-40"
              >
                {createReminder.isPending ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-full text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-all"
              >
                Cancel
              </button>
            </div>
            {createReminder.error && (
              <p className="text-[11px] text-red-400/70">{createReminder.error.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="px-6 pb-4 shrink-0">
        <div className="flex gap-1 bg-white/[0.04] rounded-lg p-1 w-fit">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); setSelectedIds(new Set()); }}
              className={clsx(
                "px-3 py-1.5 text-[10px] uppercase tracking-widest font-medium rounded-md transition-colors",
                activeTab === key
                  ? "bg-white/[0.08] text-white/90"
                  : "text-white/25 hover:text-white/60"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content (scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-white/25" />
          </div>
        )}

        {error && (
          <div className="text-[13px] text-red-400/80 bg-red-500/10 rounded-lg px-4 py-3">
            Failed to load reminders: {error.message}
          </div>
        )}

        {!isLoading && !error && reminders?.length === 0 && (
          <div className="text-center py-16 text-white/25">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-[13px]">No reminders found</p>
          </div>
        )}

        {reminders && reminders.length > 0 && (
          <div className="space-y-1">
            {reminders.map((reminder) => {
              const parsed = parseReminderType(reminder.title);
              const displayTitle = parsed ? parsed.cleanTitle : reminder.title;
              const TypeIcon = parsed?.icon;
              const overdue = isOverdue(reminder);

              return (
                <div
                  key={reminder.id}
                  className={clsx(
                    "flex items-center gap-2 rounded-lg px-3 py-2 border transition-colors group",
                    overdue ? "border-red-500/20 bg-red-500/[0.03]" : "border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]"
                  )}
                >
                  {/* Checkbox for pending */}
                  {reminder.status === "pending" && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(reminder.id)}
                      onChange={() => toggleSelect(reminder.id)}
                      className="w-3.5 h-3.5 shrink-0 accent-orange-500 cursor-pointer"
                    />
                  )}

                  {/* Type icon */}
                  {TypeIcon ? (
                    <TypeIcon className={clsx("w-3.5 h-3.5 shrink-0", parsed!.color.split(" ")[0])} />
                  ) : (
                    <Bell className="w-3.5 h-3.5 shrink-0 text-white/25" />
                  )}

                  {/* Single-line summary */}
                  <p className="flex-1 text-[12px] text-white/80 truncate min-w-0">
                    {displayTitle}
                    {reminder.contact && (
                      <span className="text-white/35"> — {reminder.contact.name}</span>
                    )}
                  </p>

                  {/* Status / overdue badge */}
                  {overdue && (
                    <span className="text-[9px] text-red-400/80 bg-red-500/10 px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-widest">
                      Overdue
                    </span>
                  )}
                  {reminder.status !== "pending" && (
                    <span className={clsx(
                      "text-[9px] px-1.5 py-0.5 rounded-full capitalize shrink-0",
                      reminder.status === "completed" ? "bg-green-500/10 text-green-400/80" : "bg-white/[0.04] text-white/25"
                    )}>
                      {reminder.status}
                    </span>
                  )}

                  {/* Due date */}
                  <span className="text-[10px] text-white/20 shrink-0 whitespace-nowrap">
                    {new Date(reminder.remind_at).toLocaleDateString()}
                  </span>

                  {/* Action buttons — visible on hover for pending */}
                  {reminder.status === "pending" && (
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => updateReminder.mutate({ id: reminder.id, status: "completed" })}
                        className="p-1 rounded-full text-green-400/70 bg-green-500/10 hover:bg-green-500/20 transition-colors"
                        title="Done"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleSnooze(reminder)}
                        className="p-1 rounded-full text-[#4a90e2] bg-[#4a90e2]/10 hover:bg-[#4a90e2]/20 transition-colors"
                        title="Snooze 3 days"
                      >
                        <Clock className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => updateReminder.mutate({ id: reminder.id, status: "dismissed" })}
                        className="p-1 rounded-full text-white/20 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                        title="Dismiss"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
