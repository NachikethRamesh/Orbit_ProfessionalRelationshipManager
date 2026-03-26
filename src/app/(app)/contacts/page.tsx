"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useDeleteAllContacts,
  useBulkDeleteContacts,
  useBuildPRM,
  useSyncEmail,
  useEnrichContact,
  useAddTag,
} from "@/hooks/useContacts";
import { useClickOutside } from "@/hooks/useClickOutside";
import { apiClient } from "@/lib/api";
import { formatRelative, warmthColor } from "@/lib/format";
import type { Contact, ContactFilters, Interaction } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Plus,
  X,
  Loader2,
  ArrowUp,
  ArrowDown,
  Users,
  Pencil,
  Trash2,
  Mail,
  ChevronUp,
  MapPin,
  Phone,
  Clock,
  RefreshCw,
  Info,
  Tag,
  Copy,
  Check,
  Linkedin,
  Star,
} from "lucide-react";
import clsx from "clsx";

/* ── Shared style constants ── */

const PILL_BTN =
  "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10px] uppercase tracking-widest text-white/90 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all disabled:opacity-50";

const PILL_SHADOW = { boxShadow: "0 2px 10px rgba(0,0,0,0.2)" } as const;

const PANEL_STYLE =
  "rounded-3xl border border-white/[0.06] bg-[#0d0d0d] flex flex-col overflow-hidden";

const PANEL_SHADOW = { boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)" } as const;

const FORM_INPUT =
  "bg-white/[0.04] border border-transparent rounded-lg px-3 py-2.5 text-[13px] text-white/90 placeholder:text-white/25 placeholder:uppercase placeholder:text-[10px] placeholder:tracking-widest focus:outline-none focus:border-white/[0.15]";

type ContactSummary = {
  summary: string;
  lastContactDate: string | null;
  interactionCount: number;
};

/* Initials from name */
function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ContactsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [starredFilter, setStarredFilter] = useState(false);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", email: "", company: "", title: "" });
  const [buildResult, setBuildResult] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters: ContactFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      tag: tagFilter || undefined,
      starred: starredFilter || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
    }),
    [debouncedSearch, tagFilter, starredFilter, sortBy, sortOrder]
  );

  const { data: contacts, isLoading, error } = useContacts(filters);
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const deleteAllContacts = useDeleteAllContacts();
  const bulkDeleteContacts = useBulkDeleteContacts();
  const buildPRM = useBuildPRM();
  const syncEmail = useSyncEmail();
  const enrichContact = useEnrichContact();

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!contacts) return;
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
  };

  const allTags = useMemo(() => {
    if (!contacts) return [];
    const tagSet = new Set<string>();
    contacts.forEach((c) => c.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [contacts]);

  const handleCreate = async () => {
    if (!newContact.name.trim()) return;
    try {
      await createContact.mutateAsync(newContact);
      setNewContact({ name: "", email: "", company: "", title: "" });
      setShowCreateForm(false);
    } catch {}
  };

  const handleSortToggle = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return null;
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 inline ml-1" />
    );
  };

  const selectedContact = selectedId
    ? contacts?.find((c) => c.id === selectedId) ?? null
    : null;

  return (
    <>
      {/* ── Central Panel (contacts list) ── */}
      <div className={`flex-1 flex flex-col overflow-hidden ${PANEL_STYLE}`} style={PANEL_SHADOW}>
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <span className="text-[10px] uppercase tracking-widest text-white/45 font-medium">Contacts</span>
          <div className="flex items-center gap-2">
            {/* Add Contact */}
            <button onClick={() => setShowCreateForm((p) => !p)} className={PILL_BTN} style={PILL_SHADOW}>
              <Plus className="w-3 h-3" />
              Add Contact
            </button>
            {/* Build PRM → then Sync */}
            <button
              onClick={async () => {
                setBuildResult(null);
                setSyncResult(null);
                try {
                  const r = await buildPRM.mutateAsync();
                  setBuildResult(r.message);
                  /* After build completes and table reloads, run sync */
                  try {
                    const s = await syncEmail.mutateAsync();
                    setSyncResult(`${s.syncedCount} synced`);
                  } catch (e) {
                    setSyncResult(e instanceof Error ? e.message : "Sync failed");
                  }
                  setTimeout(() => window.location.reload(), 1500);
                } catch (e) {
                  setBuildResult(e instanceof Error ? e.message : "Failed");
                }
              }}
              disabled={buildPRM.isPending || syncEmail.isPending}
              className={PILL_BTN}
              style={PILL_SHADOW}
            >
              {(buildPRM.isPending || syncEmail.isPending) && <RefreshCw className="w-3 h-3 text-green-500 animate-spin shrink-0" />}
              {buildPRM.isPending ? "Building PRM" : syncEmail.isPending ? "Syncing" : "Build PRM"}
            </button>
            {/* Sync */}
            <button
              onClick={async () => {
                setSyncResult(null);
                try {
                  const r = await syncEmail.mutateAsync();
                  setSyncResult(`${r.syncedCount} synced`);
                } catch (e) {
                  setSyncResult(e instanceof Error ? e.message : "Failed");
                }
              }}
              disabled={syncEmail.isPending}
              className={PILL_BTN}
              style={PILL_SHADOW}
            >
              {syncEmail.isPending && <RefreshCw className="w-3 h-3 text-green-500 animate-spin shrink-0" />}
              {syncEmail.isPending ? "Syncing" : "Sync"}
            </button>
            {/* Enrich All Contacts */}
            <span className="relative group inline-flex">
              <button
                onClick={async () => {
                  if (!contacts || contacts.length === 0) return;
                  setEnriching(true);
                  setEnrichResult(null);
                  let enriched = 0;
                  try {
                    for (let i = 0; i < contacts.length; i++) {
                      try {
                        await enrichContact.mutateAsync(contacts[i].id);
                        enriched++;
                      } catch {}
                      if (i < contacts.length - 1) {
                        await new Promise((r) => setTimeout(r, 1500));
                      }
                    }
                    setEnrichResult(`${enriched} contacts enriched`);
                  } catch (e) {
                    setEnrichResult(e instanceof Error ? e.message : "Failed");
                  } finally {
                    setEnriching(false);
                  }
                }}
                disabled={enriching}
                className={PILL_BTN}
                style={PILL_SHADOW}
              >
                {enriching && <RefreshCw className="w-3 h-3 text-green-500 animate-spin shrink-0" />}
                {enriching ? "Enriching" : "Enrich All"}
                <Info className="w-3 h-3 text-white/25" />
              </button>
              <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 rounded-lg bg-[#1a1a1a] border border-white/[0.1] px-3 py-2 text-left opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-xl">
                <span className="block text-[10px] text-white/45 leading-relaxed">
                  Enhance all contacts with publicly available information — company details, roles, social profiles, and more.
                </span>
              </span>
            </span>
            {/* Delete All */}
            <button
              onClick={() => {
                if (contacts && contacts.length > 0) setShowDeleteModal(true);
              }}
              disabled={deleteAllContacts.isPending}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10px] uppercase tracking-widest text-white/45 bg-white/[0.03] border border-white/[0.08] hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all disabled:opacity-50"
              style={PILL_SHADOW}
            >
              {deleteAllContacts.isPending ? <RefreshCw className="w-3 h-3 text-red-400 animate-spin shrink-0" /> : <Trash2 className="w-3 h-3" />}
              {deleteAllContacts.isPending ? "Deleting" : "Delete All"}
            </button>
          </div>
        </div>

        {/* Status banners */}
        {(buildResult || syncResult || enrichResult) && (
          <div className="px-6 pb-3 shrink-0 space-y-1">
            <StatusBanner message={buildResult} onDismiss={() => setBuildResult(null)} />
            <StatusBanner message={syncResult} onDismiss={() => setSyncResult(null)} />
            <StatusBanner message={enrichResult} onDismiss={() => setEnrichResult(null)} />
          </div>
        )}

        {/* Create form */}
        {showCreateForm && (
          <div className="px-6 pb-4 shrink-0">
            <div className="bg-white/[0.04] rounded-lg p-4 space-y-3 border border-white/[0.06]">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Name *" value={newContact.name} onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))} className={FORM_INPUT} />
                <input type="email" placeholder="Email" value={newContact.email} onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))} className={FORM_INPUT} />
                <input type="text" placeholder="Company" value={newContact.company} onChange={(e) => setNewContact((p) => ({ ...p, company: e.target.value }))} className={FORM_INPUT} />
                <input type="text" placeholder="Title" value={newContact.title} onChange={(e) => setNewContact((p) => ({ ...p, title: e.target.value }))} className={FORM_INPUT} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={createContact.isPending || !newContact.name.trim()}
                  className="px-4 py-2 rounded-full text-[10px] uppercase tracking-widest text-white/90 bg-white/[0.08] border border-white/[0.1] hover:bg-white/[0.12] transition-all disabled:opacity-40">
                  {createContact.isPending ? "Creating..." : "Create"}
                </button>
                <button onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 rounded-full text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 bg-white/[0.04] border border-transparent rounded-lg px-4 py-3 focus-within:border-white/[0.15] transition-colors">
            <Search className="w-4 h-4 text-white/45 shrink-0" />
            <input
              type="text"
              placeholder="SEARCH CONTACTS..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] text-white/90 w-full placeholder:text-white/25 placeholder:text-[10px] placeholder:uppercase placeholder:tracking-widest"
            />
            <button
              onClick={() => setStarredFilter((p) => !p)}
              className={clsx(
                "flex items-center gap-1 border rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest transition-colors shrink-0",
                starredFilter
                  ? "border-yellow-500/30 text-yellow-400/90 bg-yellow-500/10"
                  : "border-white/[0.06] text-white/45 hover:text-white/70"
              )}
              title={starredFilter ? "Show all contacts" : "Show favorites only"}
            >
              <Star className={clsx("w-3 h-3", starredFilter && "fill-yellow-400/90")} />
              Favs
            </button>
            {allTags.length > 0 && (
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="bg-transparent border border-white/[0.06] rounded-full px-2 py-1 text-[10px] text-white/45 outline-none cursor-pointer"
              >
                <option value="" className="bg-[#0d0d0d]">Filter</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag} className="bg-[#0d0d0d]">{tag}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="px-6 pb-3 shrink-0">
            <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5">
              <span className="text-[11px] text-white/60">{selectedIds.size} selected</span>
              <button
                onClick={() => setShowBulkDeleteModal(true)}
                disabled={bulkDeleteContacts.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                {bulkDeleteContacts.isPending ? <RefreshCw className="w-3 h-3 text-red-400 animate-spin shrink-0" /> : <Trash2 className="w-3 h-3" />}
                {bulkDeleteContacts.isPending ? "Deleting" : `Delete Selected (${selectedIds.size})`}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-all ml-auto"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Table (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading && (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-white/25" />
            </div>
          )}
          {error && (
            <div className="mx-6 text-[13px] text-red-400/80 bg-red-500/10 rounded-lg px-4 py-3">
              Failed to load contacts: {error.message}
            </div>
          )}
          {!isLoading && !error && contacts?.length === 0 && (
            <div className="text-center py-16 text-white/25">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-[13px]">No contacts found</p>
            </div>
          )}

          {contacts && contacts.length > 0 && (
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-white/[0.06] bg-[#0d0d0d]">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={contacts.length > 0 && selectedIds.size === contacts.length}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-white/20 bg-transparent accent-white/90 cursor-pointer"
                    />
                  </th>
                  <th className="w-8"></th>
                  <th onClick={() => handleSortToggle("name")} className="text-left px-4 py-2.5 text-[10px] font-medium text-white/45 uppercase tracking-widest cursor-pointer hover:text-white/70 select-none">Name<SortIcon column="name" /></th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-medium text-white/45 uppercase tracking-widest">Email</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-medium text-white/45 uppercase tracking-widest">Company</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-medium text-white/45 uppercase tracking-widest">Title</th>
                  <th onClick={() => handleSortToggle("warmth")} className="text-left px-4 py-2.5 text-[10px] font-medium text-white/45 uppercase tracking-widest cursor-pointer hover:text-white/70 select-none w-28"><span className="inline-flex items-center">Warmth<WarmthInfoTip /><SortIcon column="warmth" /></span></th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-medium text-white/45 uppercase tracking-widest">Tags</th>
                  <th onClick={() => handleSortToggle("recent")} className="text-left px-4 py-2.5 text-[10px] font-medium text-white/45 uppercase tracking-widest cursor-pointer hover:text-white/70 select-none">Updated<SortIcon column="recent" /></th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => {
                  const isSelected = selectedId === contact.id;
                  return (
                    <tr
                      key={contact.id}
                      onClick={() => setSelectedId(isSelected ? null : contact.id)}
                      className={clsx(
                        "cursor-pointer transition-colors border-l-2",
                        isSelected
                          ? "bg-white/[0.08] border-l-white/90"
                          : "border-l-transparent hover:bg-white/[0.04]"
                      )}
                    >
                      <td className="w-10 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(contact.id)}
                          onChange={() => toggleSelect(contact.id)}
                          className="w-3.5 h-3.5 rounded border-white/20 bg-transparent accent-white/90 cursor-pointer"
                        />
                      </td>
                      <td className="w-8 px-1 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => updateContact.mutate({ id: contact.id, starred: !contact.starred } as any)}
                          className="p-0.5 rounded transition-colors"
                          title={contact.starred ? "Unstar" : "Star"}
                        >
                          <Star className={clsx("w-3.5 h-3.5", contact.starred ? "fill-yellow-400 text-yellow-400" : "text-white/15 hover:text-yellow-400/50")} />
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0",
                            isSelected ? "bg-white/[0.08] text-white/90" : "bg-white/[0.04] text-white/45"
                          )}>
                            {getInitials(contact.name)}
                          </div>
                          <span className={clsx("font-medium", isSelected ? "text-white/90" : "text-white/45")}>
                            {contact.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-white/45 max-w-[180px] truncate">{contact.email}</td>
                      <td className="px-4 py-2.5 text-white/45">{contact.company || "—"}</td>
                      <td className="px-4 py-2.5 text-white/45">{contact.title || "—"}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${warmthColor(contact.warmth_score)}`}
                              style={{ width: `${Math.min(contact.warmth_score, 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-white/25 w-5 text-right">{contact.warmth_score}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {contact.tags && contact.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {contact.tags.map((tag) => (
                              <span key={tag} className="text-[10px] bg-white/[0.06] text-white/45 px-2 py-0.5 rounded-full">{tag}</span>
                            ))}
                          </div>
                        ) : <span className="text-white/15">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-white/25 whitespace-nowrap">{new Date(contact.updated_at).toLocaleDateString()}</td>
                      <td className="px-2 py-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ id: contact.id, name: contact.name });
                          }}
                          className="p-1 rounded text-white/10 hover:text-red-400/80 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Right Detail Panel ── */}
      {selectedContact && (
        <DetailPanel
          key={selectedContact.id}
          contact={selectedContact}
          onClose={() => setSelectedId(null)}
          onDelete={() => {
            setDeleteTarget({ id: selectedContact.id, name: selectedContact.name });
          }}
        />
      )}

      {/* ── Delete Single Contact Modal ── */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Contact"
          message={`Are you sure you want to delete \u201c${deleteTarget.name}\u201d? This contact will be excluded from future imports.`}
          confirmLabel="Delete"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            const id = deleteTarget.id;
            setDeleteTarget(null);
            if (selectedId === id) setSelectedId(null);
            deleteContact.mutate(id);
          }}
        />
      )}

      {/* ── Bulk Delete Modal ── */}
      {showBulkDeleteModal && (
        <ConfirmModal
          title="Delete Selected Contacts"
          message={`Are you sure you want to delete ${selectedIds.size} contact${selectedIds.size > 1 ? "s" : ""}? They will be excluded from future imports.`}
          confirmLabel={`Delete ${selectedIds.size}`}
          onCancel={() => setShowBulkDeleteModal(false)}
          onConfirm={async () => {
            const ids = Array.from(selectedIds);
            setShowBulkDeleteModal(false);
            if (selectedId && selectedIds.has(selectedId)) setSelectedId(null);
            await bulkDeleteContacts.mutateAsync(ids);
            setSelectedIds(new Set());
          }}
        />
      )}

      {/* ── Delete All Modal ── */}
      {showDeleteModal && (
        <ConfirmModal
          title="Delete All Contacts"
          message={`Are you sure you want to delete ALL ${contacts?.length ?? 0} contacts? This action cannot be undone.`}
          confirmLabel="Delete All"
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={async () => {
            setShowDeleteModal(false);
            setSelectedId(null);
            await deleteAllContacts.mutateAsync();
          }}
        />
      )}
    </>
  );
}

// ─── Detail Panel ──────────────────────────────────────────────

function DetailPanel({
  contact,
  onClose,
  onDelete,
}: {
  contact: Contact;
  onClose: () => void;
  onDelete: () => void;
}) {
  const updateContact = useUpdateContact();
  const enrichContact = useEnrichContact();
  const [enrichingProfile, setEnrichingProfile] = useState(false);

  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery<ContactSummary>({
    queryKey: ["contact-summary", contact.id],
    queryFn: () => apiClient.get<ContactSummary>(`/api/contacts/${contact.id}/summary`),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: interactions, isLoading: interactionsLoading } = useQuery<Interaction[]>({
    queryKey: ["interactions", contact.id],
    queryFn: () => apiClient.get<Interaction[]>(`/api/interactions?contact_id=${contact.id}`),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: contact.name,
    email: contact.email,
    company: contact.company,
    title: contact.title,
    linkedin_url: contact.linkedin_url,
    phone: contact.phone ?? "",
    location: contact.location ?? "",
  });

  const handleSave = async () => {
    try {
      await updateContact.mutateAsync({ id: contact.id, ...form });
      setEditing(false);
    } catch {}
  };

  return (
    <div className={`w-[420px] shrink-0 ${PANEL_STYLE}`} style={PANEL_SHADOW}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-white/45 font-medium">Profile Details</span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* Profile header */}
        <div className="flex items-center gap-4 mb-6 mt-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-white/10 to-white/[0.03] border border-white/[0.05] flex items-center justify-center text-[22px] text-white/45 shrink-0">
            {getInitials(editing ? form.name : contact.name)}
          </div>
          <div className="min-w-0">
            {editing ? (
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Name"
                className="text-[20px] font-medium text-white/90 bg-transparent border-b border-white/[0.15] outline-none w-full mb-1 tracking-tight"
              />
            ) : (
              <h1 className="text-[20px] font-medium text-white/90 mb-1 tracking-tight">{contact.name}</h1>
            )}
            <p className="text-[12px] text-white/45">
              {contact.title && contact.company
                ? `${contact.title} @ ${contact.company}`
                : contact.title || contact.company || "—"}
            </p>
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-1.5 mb-6">
          {/* Edit Contact */}
          <button
            onClick={() => setEditing((p) => !p)}
            className={clsx(
              "flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] uppercase tracking-widest transition-all",
              editing
                ? "text-white/90 bg-white/[0.08] border border-white/[0.15]"
                : "text-white/90 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08]"
            )}
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>

          {/* Add Tag */}
          <TagDropdown contactId={contact.id} existingTags={contact.tags ?? []} />

          {/* Enrich Contact */}
          <span className="relative group inline-flex">
            <button
              onClick={async () => {
                setEnrichingProfile(true);
                try { await enrichContact.mutateAsync(contact.id); } catch {}
                setEnrichingProfile(false);
              }}
              disabled={enrichingProfile}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] uppercase tracking-widest text-white/90 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] transition-all disabled:opacity-50"
            >
              {enrichingProfile ? <RefreshCw className="w-3 h-3 text-green-500 animate-spin shrink-0" /> : <Info className="w-3 h-3 text-white/25" />}
              {enrichingProfile ? "Enriching" : "Enrich"}
            </button>
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 rounded-lg bg-[#1a1a1a] border border-white/[0.1] px-3 py-2 text-left opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-xl">
              <span className="block text-[10px] text-white/45 leading-relaxed">
                Enhance this contact with publicly available information — company details, role, social profiles, and more.
              </span>
            </span>
          </span>

          {/* Delete */}
          <button
            onClick={() => onDelete()}
            className="p-1.5 rounded-full text-white/20 bg-white/[0.03] border border-white/[0.08] hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all ml-auto"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-px bg-white/[0.06] border border-white/[0.06] rounded-md mb-6">
          <div className="bg-[#0d0d0d] px-2.5 py-2 flex flex-col rounded-l-md">
            <span className="text-[8px] uppercase tracking-widest text-white/35 font-medium">Warmth</span>
            <div className="flex items-center gap-1">
              <span className="text-[16px] text-white/90 tabular-nums leading-tight">{contact.warmth_score}</span>
              <ChevronUp className="w-2.5 h-2.5 text-white/35" />
            </div>
          </div>
          <div className="bg-[#0d0d0d] px-2.5 py-2 flex flex-col">
            <span className="text-[8px] uppercase tracking-widest text-white/35 font-medium">Last</span>
            <span className="text-[12px] text-white/90 leading-tight mt-0.5">
              {summaryLoading ? "..." : summaryData?.lastContactDate ? formatRelative(summaryData.lastContactDate) : "None"}
            </span>
          </div>
          <div className="bg-[#0d0d0d] px-2.5 py-2 flex flex-col rounded-r-md">
            <span className="text-[8px] uppercase tracking-widest text-white/35 font-medium">Interactions</span>
            <span className="text-[16px] text-white/90 tabular-nums leading-tight">
              {summaryLoading ? "—" : summaryData?.interactionCount ?? 0}
            </span>
          </div>
        </div>

        {/* AI Summary */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.04]">
            <span className="text-[10px] uppercase tracking-widest text-white/45 font-medium">AI Executive Summary</span>
          </div>
          {summaryLoading ? (
            <div className="bg-white/[0.04] rounded-lg p-3 flex items-center gap-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white/25 shrink-0" />
              <span className="text-[12px] text-white/45 italic">Fetching conversation summary...</span>
            </div>
          ) : summaryError ? (
            <div className="bg-red-500/10 rounded-lg p-3">
              <p className="text-[12px] text-red-400/70">Failed to load summary.</p>
            </div>
          ) : summaryData?.interactionCount === 0 ? (
            <div className="bg-white/[0.04] rounded-lg p-3">
              <p className="text-[12px] text-white/45 leading-relaxed">
                No interactions synced yet. Use <strong className="text-white/70 font-medium">Sync</strong> to import emails.
              </p>
            </div>
          ) : (
            <div className="bg-white/[0.04] rounded-lg p-3">
              <p className={clsx("text-[12px] text-white/45 leading-relaxed", !summaryExpanded && "line-clamp-2")}>
                {summaryData?.summary}
              </p>
              <button
                onClick={() => setSummaryExpanded((p) => !p)}
                className="text-[10px] uppercase tracking-widest text-white/25 hover:text-white/60 mt-1.5 transition-colors"
              >
                {summaryExpanded ? "Collapse" : "Expand"}
              </button>
            </div>
          )}
        </div>

        {/* Contact Info */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.04]">
            <span className="text-[10px] uppercase tracking-widest text-white/45 font-medium">Contact Info</span>
          </div>
          <div className="space-y-2.5">
            {/* Email */}
            <div className="flex items-center gap-2.5">
              <Mail className="w-3.5 h-3.5 text-white/25 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] uppercase tracking-widest text-white/25">Email</p>
                {editing ? (
                  <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com"
                    className="text-[12px] text-white/90 bg-transparent border-b border-white/[0.1] outline-none w-full" />
                ) : (
                  <p className="text-[12px] text-white/90 truncate">{contact.email || "—"}</p>
                )}
              </div>
              {!editing && contact.email && <CopyButton text={contact.email} />}
            </div>
            {/* Phone */}
            <div className="flex items-center gap-2.5">
              <Phone className="w-3.5 h-3.5 text-white/25 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] uppercase tracking-widest text-white/25">Phone</p>
                {editing ? (
                  <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 123-4567"
                    className="text-[12px] text-white/90 bg-transparent border-b border-white/[0.1] outline-none w-full" />
                ) : (
                  <p className="text-[12px] text-white/90">{contact.phone || "—"}</p>
                )}
              </div>
              {!editing && contact.phone && <CopyButton text={contact.phone} />}
            </div>
            {/* Company */}
            <div className="flex items-center gap-2.5">
              <Users className="w-3.5 h-3.5 text-white/25 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] uppercase tracking-widest text-white/25">Company</p>
                {editing ? (
                  <input value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} placeholder="Company name"
                    className="text-[12px] text-white/90 bg-transparent border-b border-white/[0.1] outline-none w-full" />
                ) : (
                  <p className="text-[12px] text-white/90">{contact.company || "—"}</p>
                )}
              </div>
            </div>
            {/* Role */}
            <div className="flex items-center gap-2.5">
              <Info className="w-3.5 h-3.5 text-white/25 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] uppercase tracking-widest text-white/25">Role</p>
                {editing ? (
                  <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Job title"
                    className="text-[12px] text-white/90 bg-transparent border-b border-white/[0.1] outline-none w-full" />
                ) : (
                  <p className="text-[12px] text-white/90">{contact.title || "—"}</p>
                )}
              </div>
            </div>
            {/* LinkedIn */}
            <div className="flex items-center gap-2.5">
              <Linkedin className="w-3.5 h-3.5 text-white/25 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] uppercase tracking-widest text-white/25">LinkedIn</p>
                {editing ? (
                  <input value={form.linkedin_url} onChange={(e) => setForm((p) => ({ ...p, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/..."
                    className="text-[12px] text-white/90 bg-transparent border-b border-white/[0.1] outline-none w-full" />
                ) : contact.linkedin_url ? (
                  <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
                    className="text-[12px] text-blue-400/80 hover:text-blue-400 truncate block transition-colors">
                    {contact.linkedin_url.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "").replace(/\/$/, "")}
                  </a>
                ) : (
                  <p className="text-[12px] text-white/45">—</p>
                )}
              </div>
              {!editing && contact.linkedin_url && <CopyButton text={contact.linkedin_url} />}
            </div>
            {/* Location */}
            <div className="flex items-center gap-2.5">
              <MapPin className="w-3.5 h-3.5 text-white/25 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] uppercase tracking-widest text-white/25">Location</p>
                {editing ? (
                  <input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} placeholder="City, State"
                    className="text-[12px] text-white/90 bg-transparent border-b border-white/[0.1] outline-none w-full" />
                ) : (
                  <p className="text-[12px] text-white/90">{contact.location || "—"}</p>
                )}
              </div>
            </div>
            {/* Last Touchpoint (read-only) */}
            <div className="flex items-center gap-2.5">
              <Clock className="w-3.5 h-3.5 text-white/25 shrink-0" />
              <div>
                <p className="text-[9px] uppercase tracking-widest text-white/25">Last Touchpoint</p>
                <p className="text-[12px] text-white/90">
                  {summaryLoading ? (
                    <span className="text-white/25 italic text-[11px]">...</span>
                  ) : summaryData?.lastContactDate ? (
                    formatRelative(summaryData.lastContactDate)
                  ) : (
                    <span className="text-white/45">None</span>
                  )}
                </p>
              </div>
            </div>
          </div>
          {/* Save / Cancel buttons */}
          {editing && (
            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} disabled={updateContact.isPending}
                className="px-4 py-2 rounded-full text-[10px] uppercase tracking-widest text-white/90 bg-white/[0.08] border border-white/[0.1] hover:bg-white/[0.12] transition-all disabled:opacity-50">
                {updateContact.isPending ? "Saving..." : "Save"}
              </button>
              <button onClick={() => {
                setEditing(false);
                setForm({ name: contact.name, email: contact.email, company: contact.company, title: contact.title, linkedin_url: contact.linkedin_url, phone: contact.phone ?? "", location: contact.location ?? "" });
              }} className="px-4 py-2 rounded-full text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-all">
                Cancel
              </button>
              {updateContact.error && (
                <p className="text-[11px] text-red-400/70 mt-2">{updateContact.error.message}</p>
              )}
            </div>
          )}
        </div>

        {/* Recent Interactions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.04]">
            <span className="text-[10px] uppercase tracking-widest text-white/45 font-medium">Recent Interactions</span>
          </div>
          {interactionsLoading ? (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="w-4 h-4 animate-spin text-white/25" />
              <span className="text-[13px] text-white/45 italic">Loading interactions...</span>
            </div>
          ) : !interactions || interactions.length === 0 ? (
            <p className="text-[13px] text-white/25">No interactions yet. Sync your email to see activity.</p>
          ) : (
            <div className="space-y-0">
              {interactions.slice(0, 8).map((interaction, i) => (
                <div key={interaction.id} className="flex gap-3 relative">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center shrink-0 w-5">
                    <div className={clsx(
                      "w-2 h-2 rounded-full mt-1.5 shrink-0",
                      interaction.type === "meeting" ? "bg-[#4a90e2]" : interaction.type === "email_sent" ? "bg-[#e25c5c]" : "bg-white/25"
                    )} />
                    {i < Math.min(interactions.length, 8) - 1 && (
                      <div className="w-px flex-1 bg-white/[0.06] mt-1" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-4 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-white/25 mb-1">
                      {new Date(interaction.occurred_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      <span className="ml-2 normal-case tracking-normal text-white/15">
                        {interaction.type === "meeting" ? "Meeting" : interaction.type === "email_sent" ? "Sent" : "Received"}
                      </span>
                    </p>
                    <p className="text-[13px] text-white/70 truncate">{interaction.subject || "No subject"}</p>
                    {interaction.snippet && (
                      <p className="text-[11px] text-white/25 mt-0.5 line-clamp-1">{interaction.snippet}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


        {/* Tags */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.04]">
            <span className="text-[10px] uppercase tracking-widest text-white/45 font-medium">Tags</span>
          </div>
          {contact.tags && contact.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {contact.tags.map((tag) => (
                <span key={tag} className="text-[11px] text-white/45 bg-white/[0.06] px-3 py-1 rounded-full">{tag}</span>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-white/25">No tags</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tag Dropdown ────────────────────────────────────────────

const TAG_OPTIONS = ["personal", "ex-colleague", "potential hire", "potential employer", "investor", "mentor"] as const;

function TagDropdown({ contactId, existingTags }: { contactId: string; existingTags: string[] }) {
  const [open, setOpen] = useState(false);
  const addTag = useAddTag();
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] uppercase tracking-widest text-white/90 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] transition-all"
      >
        <Tag className="w-3 h-3" />
        Add Tag
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-[#1a1a1a] border border-white/[0.1] rounded-lg shadow-xl z-50 min-w-[160px] overflow-hidden py-1">
          {TAG_OPTIONS.map((tag) => {
            const already = existingTags.includes(tag);
            return (
              <button
                key={tag}
                disabled={already || addTag.isPending}
                onClick={async () => {
                  try {
                    await addTag.mutateAsync({ contactId, tag });
                  } catch {}
                  setOpen(false);
                }}
                className={clsx(
                  "w-full text-left px-3 py-1.5 text-[11px] capitalize transition-colors",
                  already
                    ? "text-white/15 cursor-default"
                    : "text-white/70 hover:bg-white/[0.06] hover:text-white/90"
                )}
              >
                {tag}{already ? " ✓" : ""}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Copy Button ─────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1 rounded text-white/15 hover:text-white/50 transition-colors shrink-0"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3 h-3 text-green-400/70" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ─── Warmth Info Tooltip ─────────────────────────────────────

function WarmthInfoTip() {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex ml-1">
      <Info
        className="w-3 h-3 text-white/20 hover:text-white/50 cursor-help transition-colors"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      />
      {show && (
        <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 rounded-lg bg-[#1a1a1a] border border-white/[0.1] px-3 py-2.5 text-left z-[100] shadow-xl">
          <span className="block text-[10px] uppercase tracking-widest text-white/60 font-medium mb-1.5">Warmth Score</span>
          <span className="block text-[10px] text-white/45 leading-relaxed mb-1.5">
            Measures relationship health (0–100) based on communication recency and frequency.
          </span>
          <span className="block text-[9px] text-white/30 leading-relaxed space-y-0.5">
            <span className="flex justify-between"><span>70–100</span><span className="text-green-400/70">Warm</span></span>
            <span className="flex justify-between"><span>40–69</span><span className="text-yellow-400/70">Lukewarm</span></span>
            <span className="flex justify-between"><span>0–39</span><span className="text-red-400/70">Cold</span></span>
          </span>
        </span>
      )}
    </span>
  );
}

// ─── Status Banner ────────────────────────────────────────────

function StatusBanner({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div className="text-[11px] text-white/45 bg-white/[0.04] rounded-lg px-3 py-2">
      {message}
      <button onClick={onDismiss} className="ml-2 text-white/25 hover:text-white/60">
        <X className="w-3 h-3 inline" />
      </button>
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#141414] border border-white/[0.1] rounded-2xl p-6 w-[360px] shadow-2xl">
        <h3 className="text-[14px] font-medium text-white/90 mb-2">{title}</h3>
        <p className="text-[12px] text-white/45 leading-relaxed mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full text-[10px] uppercase tracking-widest text-white/70 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-full text-[10px] uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dark Field ──────────────────────────────────────────────

function DarkField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-white/25 mb-1.5">{label}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/[0.04] border border-transparent rounded-lg px-3 py-2 text-[13px] text-white/90 focus:outline-none focus:border-white/[0.15] transition-colors"
      />
    </div>
  );
}
