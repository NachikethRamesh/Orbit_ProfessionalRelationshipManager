"use client";

/**
 * Meeting Brief Page
 *
 * Displays an AI-generated meeting brief for a specific interaction
 * (meeting). Shows the meeting subject, contact info, and the brief
 * content rendered as formatted sections. Includes a "Generate Brief"
 * button if no brief exists yet.
 *
 * Route: /meetings/[id]/brief (inside (app) route group)
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Interaction, Contact } from "@/lib/types";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Sparkles,
  Calendar,
  User,
} from "lucide-react";
import Link from "next/link";

/** Shape of the brief data returned by the API */
interface MeetingBrief {
  interaction: Interaction;
  contact: Contact | null;
  brief: string | null;
}

export default function MeetingBriefPage() {
  const params = useParams();
  const queryClient = useQueryClient();

  /* Extract the meeting (interaction) ID from the URL */
  const meetingId = params.id as string;

  /* ── Generate brief state ── */
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  /* ── Fetch meeting brief data ── */
  const { data, isLoading, error } = useQuery<MeetingBrief>({
    queryKey: ["meeting-brief", meetingId],
    queryFn: () =>
      apiClient.get<MeetingBrief>(
        `/api/interactions?id=${meetingId}&include_brief=true`
      ),
    enabled: !!meetingId,
  });

  /**
   * handleGenerate — triggers brief generation via the API.
   * After generation, invalidates the query to show the new brief.
   */
  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      await apiClient.post(`/api/interactions/${meetingId}/brief`, {});
      /* Refetch the brief data to display the generated content */
      queryClient.invalidateQueries({
        queryKey: ["meeting-brief", meetingId],
      });
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Failed to generate brief"
      );
    } finally {
      setGenerating(false);
    }
  };

  /* ── Loading state ── */
  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Failed to load meeting: {(error as Error).message}
      </div>
    );
  }

  /* ── Not found ── */
  if (!data) {
    return (
      <div className="text-center py-20 text-gray-500">
        Meeting not found.
      </div>
    );
  }

  const { interaction, contact, brief } = data;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* ── Back link ── */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* ── Meeting Header ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        {/* Meeting subject */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Calendar className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {interaction.subject || "Meeting"}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {new Date(interaction.occurred_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Contact info if available */}
        {contact && (
          <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
            <User className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {contact.name}
              </p>
              <p className="text-xs text-gray-500">
                {contact.company}
                {contact.title ? ` - ${contact.title}` : ""}
              </p>
            </div>
            <Link
              href={`/contacts/${contact.id}`}
              className="ml-auto text-xs text-blue-600 hover:underline"
            >
              View Contact
            </Link>
          </div>
        )}

        {/* Meeting snippet / summary preview */}
        {interaction.ai_summary && (
          <div>
            <p className="text-xs text-gray-400 mb-1">AI Summary</p>
            <p className="text-sm text-gray-700">{interaction.ai_summary}</p>
          </div>
        )}
      </div>

      {/* ── Brief Content ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Meeting Brief</h2>
          </div>

          {/* Generate button — shown if no brief exists yet */}
          {!brief && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generating ? "Generating..." : "Generate Brief"}
            </button>
          )}
        </div>

        {/* Show generation error if any */}
        {generateError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {generateError}
          </div>
        )}

        {/* Render the brief content as formatted markdown-like sections */}
        {brief ? (
          <div className="prose prose-sm max-w-none text-gray-700">
            {brief.split("\n").map((line, i) => {
              /* Render lines starting with # as headings */
              if (line.startsWith("### ")) {
                return (
                  <h3 key={i} className="text-base font-semibold text-gray-900 mt-4 mb-1">
                    {line.replace("### ", "")}
                  </h3>
                );
              }
              if (line.startsWith("## ")) {
                return (
                  <h2 key={i} className="text-lg font-bold text-gray-900 mt-5 mb-2">
                    {line.replace("## ", "")}
                  </h2>
                );
              }
              /* Render lines starting with - as list items */
              if (line.startsWith("- ")) {
                return (
                  <li key={i} className="ml-4 list-disc">
                    {line.replace("- ", "")}
                  </li>
                );
              }
              /* Empty lines become spacing */
              if (line.trim() === "") {
                return <div key={i} className="h-2" />;
              }
              /* Everything else is a paragraph */
              return <p key={i} className="mb-1">{line}</p>;
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            No brief generated yet. Click the button above to create an
            AI-powered meeting brief with context from past interactions.
          </p>
        )}
      </div>
    </div>
  );
}
