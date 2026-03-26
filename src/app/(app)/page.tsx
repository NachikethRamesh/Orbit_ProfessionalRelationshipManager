"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboard } from "@/hooks/useDashboard";
import { useUpdateSuggestion } from "@/hooks/useSuggestions";
import { apiClient } from "@/lib/api";
import { warmthColor } from "@/lib/format";
import {
  Zap,
  Loader2,
  Users,
  Lightbulb,
  Calendar,
  Check,
  X,
  TrendingDown,
} from "lucide-react";
import clsx from "clsx";

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboard();
  const updateSuggestion = useUpdateSuggestion();
  const queryClient = useQueryClient();

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeResult(null);
    try {
      const result = await apiClient.post<{
        success: boolean;
        results: { synced: { gmail: number; calendar: number }; summarized: number; actionItems: number; warmthUpdated: boolean };
      }>("/api/sync/analyze", {});
      const r = result.results;
      const parts: string[] = [];
      if (r.synced.gmail > 0 || r.synced.calendar > 0) parts.push(`Synced ${r.synced.gmail} emails, ${r.synced.calendar} events`);
      if (r.summarized > 0) parts.push(`${r.summarized} interactions summarized`);
      if (r.actionItems > 0) parts.push(`${r.actionItems} suggestions generated`);
      if (r.warmthUpdated) parts.push("Warmth scores updated");
      setAnalyzeResult(parts.length > 0 ? parts.join(" \u00b7 ") : "Analysis complete \u2014 no new activity found.");
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      setAnalyzeResult(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/25" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-[13px] text-red-400/80 bg-red-500/10 rounded-lg px-4 py-3">
          Failed to load dashboard: {error.message}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/25 text-[13px]">
        No dashboard data available. Try syncing your email first.
      </div>
    );
  }

  return (
    <div
      className="flex-1 rounded-3xl border border-white/[0.06] bg-[#0d0d0d] flex flex-col overflow-hidden"
      style={{ boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-white/45 font-medium">Dashboard</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10px] uppercase tracking-widest text-white/90 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all disabled:opacity-50"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.2)" }}
          >
            {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {analyzing ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      </div>

      {/* Analyze result banner */}
      {analyzeResult && (
        <div className="px-6 pb-3 shrink-0">
          <div className="text-[11px] text-white/45 bg-white/[0.04] rounded-lg px-3 py-2">
            {analyzeResult}
            <button onClick={() => setAnalyzeResult(null)} className="ml-2 text-white/25 hover:text-white/60">
              <X className="w-3 h-3 inline" />
            </button>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="px-6 pb-4 shrink-0">
        <div className="grid grid-cols-3 gap-px bg-white/[0.06] border border-white/[0.06] rounded-lg overflow-hidden">
          <div className="bg-[#0d0d0d] p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-white/25" />
              <span className="text-[10px] uppercase tracking-widest text-white/45 font-medium">Contacts</span>
            </div>
            <span className="text-[28px] text-white/90 tabular-nums">{data.totalContacts}</span>
          </div>
          <div className="bg-[#0d0d0d] p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-white/25" />
              <span className="text-[10px] uppercase tracking-widest text-white/45 font-medium">Suggestions</span>
            </div>
            <span className="text-[28px] text-white/90 tabular-nums">{data.pendingSuggestions.length}</span>
          </div>
          <div className="bg-[#0d0d0d] p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-white/25" />
              <span className="text-[10px] uppercase tracking-widest text-white/45 font-medium">Meetings</span>
            </div>
            <span className="text-[28px] text-white/90 tabular-nums">{data.upcomingMeetings.length}</span>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Pending Suggestions */}
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.04]">
              <span className="text-[10px] uppercase tracking-widest text-white/45 font-medium">Pending Suggestions</span>
            </div>
            {data.pendingSuggestions.length === 0 ? (
              <p className="text-[13px] text-white/25">No pending suggestions. Hit Analyze to generate some!</p>
            ) : (
              <div className="space-y-2">
                {data.pendingSuggestions.map((suggestion) => (
                  <div key={suggestion.id} className="bg-white/[0.04] rounded-lg p-4 border border-white/[0.06]">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="text-[13px] font-medium text-white/90">{suggestion.title}</h3>
                      <span className="text-[10px] text-white/25 capitalize ml-2 shrink-0">
                        {suggestion.type.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-[12px] text-white/45 line-clamp-2 mb-2">{suggestion.body}</p>
                    {suggestion.contact && (
                      <p className="text-[10px] text-white/25 mb-2">Re: {suggestion.contact.name}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateSuggestion.mutate({ id: suggestion.id, status: "accepted" })}
                        className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-green-400/80 bg-green-500/10 px-2.5 py-1.5 rounded-full hover:bg-green-500/20 transition-colors"
                      >
                        <Check className="w-3 h-3" /> Accept
                      </button>
                      <button
                        onClick={() => updateSuggestion.mutate({ id: suggestion.id, status: "dismissed" })}
                        className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-white/25 bg-white/[0.04] px-2.5 py-1.5 rounded-full hover:bg-white/[0.08] transition-colors"
                      >
                        <X className="w-3 h-3" /> Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column: Cooling Contacts + Upcoming Meetings */}
          <div className="space-y-6">
            {/* Cooling Contacts */}
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.04]">
                <span className="text-[10px] uppercase tracking-widest text-white/45 font-medium">Cooling Contacts</span>
              </div>
              {data.decayingContacts.length === 0 ? (
                <p className="text-[13px] text-white/25">All your contacts are warm!</p>
              ) : (
                <div className="space-y-2">
                  {data.decayingContacts.map((contact) => (
                    <div key={contact.id} className="bg-white/[0.04] rounded-lg p-3 border border-white/[0.06] flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-medium text-white/90">{contact.name}</p>
                        <p className="text-[11px] text-white/25">{contact.company}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${warmthColor(contact.warmth_score)}`}
                            style={{ width: `${Math.min(contact.warmth_score, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-white/25 w-5 text-right tabular-nums">{contact.warmth_score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Meetings */}
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.04]">
                <span className="text-[10px] uppercase tracking-widest text-white/45 font-medium">Upcoming Meetings</span>
              </div>
              {data.upcomingMeetings.length === 0 ? (
                <p className="text-[13px] text-white/25">No upcoming meetings.</p>
              ) : (
                <div className="space-y-2">
                  {data.upcomingMeetings.map((meeting) => (
                    <div key={meeting.id} className="bg-white/[0.04] rounded-lg p-3 border border-white/[0.06]">
                      <p className="text-[13px] font-medium text-white/90">{meeting.subject}</p>
                      <p className="text-[10px] text-white/25 mt-1">
                        {new Date(meeting.occurred_at).toLocaleString()}
                      </p>
                      {meeting.ai_summary && (
                        <p className="text-[12px] text-white/45 mt-1.5 line-clamp-2">{meeting.ai_summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
