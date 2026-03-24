"use client";

/**
 * Contact Detail Page
 *
 * Shows everything about a single contact:
 * - Header with name, edit toggle, and action buttons
 * - Info section: company, title, LinkedIn, warmth bar
 * - Tags with add / remove controls
 * - Exa enrichment button + enriched data display
 * - Suggestions sidebar scoped to this contact
 * - Interaction timeline at the bottom
 *
 * Route: /contacts/[id] (inside (app) route group)
 */

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useContact,
  useUpdateContact,
  useAddTag,
  useRemoveTag,
  useEnrichContact,
} from "@/hooks/useContacts";
import { useSuggestions, useUpdateSuggestion } from "@/hooks/useSuggestions";
import { apiClient } from "@/lib/api";
import type { Interaction } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  Plus,
  Sparkles,
  Loader2,
  ExternalLink,
  Check,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();

  /* Extract the contact ID from the URL */
  const contactId = params.id as string;

  /* ── Data fetching hooks ── */
  const { data: contact, isLoading, error } = useContact(contactId);
  const updateContact = useUpdateContact();
  const addTag = useAddTag();
  const removeTag = useRemoveTag();
  const enrichContact = useEnrichContact();
  const { data: suggestions } = useSuggestions("pending", contactId);
  const updateSuggestion = useUpdateSuggestion();

  /* Fetch interactions for this contact */
  const { data: interactions } = useQuery<Interaction[]>({
    queryKey: ["interactions", contactId],
    queryFn: () =>
      apiClient.get<Interaction[]>(
        `/api/interactions?contact_id=${contactId}`
      ),
    enabled: !!contactId,
  });

  /* ── Edit mode state ── */
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    company: "",
    title: "",
    linkedin_url: "",
    twitter_url: "",
    phone: "",
  });

  /* ── Tag input state ── */
  const [newTag, setNewTag] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  /**
   * startEditing — populate the edit form with current contact
   * data and enable edit mode.
   */
  const startEditing = () => {
    if (!contact) return;
    setEditForm({
      name: contact.name,
      email: contact.email,
      company: contact.company,
      title: contact.title,
      linkedin_url: contact.linkedin_url,
      twitter_url: contact.twitter_url || "",
      phone: contact.phone || "",
    });
    setEditing(true);
  };

  /**
   * handleSave — persist the edited fields and exit edit mode.
   */
  const handleSave = async () => {
    try {
      await updateContact.mutateAsync({ id: contactId, ...editForm });
      setEditing(false);
    } catch {
      /* Error available via updateContact.error */
    }
  };

  /**
   * handleAddTag — add a new tag to this contact and clear the input.
   */
  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    try {
      await addTag.mutateAsync({ contactId, tag: newTag.trim() });
      setNewTag("");
      setShowTagInput(false);
    } catch {
      /* Error available via addTag.error */
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
        Failed to load contact: {error.message}
      </div>
    );
  }

  /* ── Contact not found ── */
  if (!contact) {
    return (
      <div className="text-center py-20 text-gray-500">Contact not found.</div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Back link ── */}
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Contacts
      </Link>

      {/* ── Contact Header ── */}
      <div className="flex items-start justify-between">
        <div>
          {editing ? (
            /* Edit mode: name input */
            <input
              type="text"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className="text-2xl font-bold text-gray-900 border-b border-gray-300 focus:outline-none focus:border-blue-500 bg-transparent"
            />
          ) : (
            <h1 className="text-2xl font-bold text-gray-900">
              {contact.name}
            </h1>
          )}
          {editing ? (
            <input
              type="email"
              value={editForm.email}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, email: e.target.value }))
              }
              className="text-sm text-gray-400 mt-1 border-b border-gray-300 focus:outline-none focus:border-blue-500 bg-transparent"
            />
          ) : (
            <p className="text-sm text-gray-400 mt-1">{contact.email}</p>
          )}
        </div>

        {/* Edit / Save / Cancel buttons */}
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={updateContact.isPending}
                className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={startEditing}
              className="flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* ── Info Section + Suggestions Sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: Contact info (2 cols wide) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company, Title, LinkedIn */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Details</h2>

            {editing ? (
              /* Edit mode form fields */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={editForm.company}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        company: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    LinkedIn URL
                  </label>
                  <input
                    type="url"
                    value={editForm.linkedin_url}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        linkedin_url: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    X (Twitter)
                  </label>
                  <input
                    type="url"
                    value={editForm.twitter_url}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        twitter_url: e.target.value,
                      }))
                    }
                    placeholder="https://x.com/username"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ) : (
              /* Read-only display */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Company</p>
                  <p className="text-gray-900">{contact.company || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Title</p>
                  <p className="text-gray-900">{contact.title || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">LinkedIn</p>
                  {contact.linkedin_url ? (
                    <a
                      href={contact.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      Profile
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <p className="text-gray-900">—</p>
                  )}
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Phone</p>
                  <p className="text-gray-900">{contact.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">X (Twitter)</p>
                  {contact.twitter_url ? (
                    <a
                      href={contact.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      Profile
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <p className="text-gray-900">—</p>
                  )}
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Warmth Score</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          "h-full rounded-full",
                          contact.warmth_score >= 70
                            ? "bg-green-500"
                            : contact.warmth_score >= 40
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        )}
                        style={{
                          width: `${Math.min(contact.warmth_score, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-gray-900 font-medium">
                      {contact.warmth_score}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Tags Section ── */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Tags</h2>
              <button
                onClick={() => setShowTagInput((prev) => !prev)}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Tag
              </button>
            </div>

            {/* Tag list with remove buttons */}
            <div className="flex flex-wrap gap-2">
              {contact.tags && contact.tags.length > 0 ? (
                contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full"
                  >
                    {tag}
                    <button
                      onClick={() =>
                        removeTag.mutate({ contactId, tag })
                      }
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove tag"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              ) : (
                <p className="text-xs text-gray-400">No tags yet</p>
              )}
            </div>

            {/* Inline tag input */}
            {showTagInput && (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tag name"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddTag}
                  disabled={addTag.isPending}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* ── Exa Enrichment Section ── */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                Enrichment Data
              </h2>
              <button
                onClick={() => enrichContact.mutate(contactId)}
                disabled={enrichContact.isPending}
                className="flex items-center gap-1 text-sm bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
              >
                {enrichContact.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {enrichContact.isPending ? "Enriching..." : "Enrich"}
              </button>
            </div>

            {/* Display enriched data or a prompt to enrich */}
            {contact.exa_data ? (
              <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
                {Object.entries(contact.exa_data).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-gray-500 capitalize">
                      {key.replace(/_/g, " ")}:
                    </span>{" "}
                    <span className="text-gray-900">
                      {typeof value === "string"
                        ? value
                        : JSON.stringify(value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No enrichment data yet. Click Enrich to fetch public
                information about this contact.
              </p>
            )}
          </div>

          {/* ── Interaction Timeline ── */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">
              Interaction Timeline
            </h2>

            {!interactions || interactions.length === 0 ? (
              <p className="text-sm text-gray-400">
                No interactions recorded yet.
              </p>
            ) : (
              <div className="space-y-4">
                {interactions.map((interaction) => (
                  <div
                    key={interaction.id}
                    className="border-l-2 border-gray-200 pl-4 pb-4 last:pb-0"
                  >
                    {/* Type badge and date */}
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={clsx(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          interaction.type === "email_sent"
                            ? "bg-blue-50 text-blue-700"
                            : interaction.type === "email_received"
                              ? "bg-green-50 text-green-700"
                              : "bg-purple-50 text-purple-700"
                        )}
                      >
                        {interaction.type.replace("_", " ")}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(
                          interaction.occurred_at
                        ).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Subject and summary */}
                    <p className="text-sm font-medium text-gray-900">
                      {interaction.subject}
                    </p>
                    {interaction.ai_summary && (
                      <p className="text-sm text-gray-600 mt-1">
                        {interaction.ai_summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Suggestions sidebar (1 col wide) */}
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900">Suggestions</h2>

          {!suggestions || suggestions.length === 0 ? (
            <p className="text-sm text-gray-400">
              No pending suggestions for this contact.
            </p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 space-y-2"
                >
                  <h3 className="text-sm font-medium text-gray-900">
                    {suggestion.title}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-3">
                    {suggestion.body}
                  </p>

                  {/* Accept / Dismiss buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        updateSuggestion.mutate({
                          id: suggestion.id,
                          status: "accepted",
                        })
                      }
                      className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      Accept
                    </button>
                    <button
                      onClick={() =>
                        updateSuggestion.mutate({
                          id: suggestion.id,
                          status: "dismissed",
                        })
                      }
                      className="flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
