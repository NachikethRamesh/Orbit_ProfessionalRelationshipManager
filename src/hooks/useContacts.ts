"use client";

/**
 * useContacts Hooks — Contact CRUD & Related Operations
 *
 * Provides TanStack Query hooks for every contact-related API call:
 * - Listing / filtering contacts
 * - Fetching a single contact by ID
 * - Creating, updating, deleting contacts
 * - Managing tags (add / remove)
 * - Enriching a contact via the Exa API
 *
 * All mutations automatically invalidate the relevant query caches
 * so the UI stays in sync without manual refetching.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { Contact, ContactFilters } from "@/lib/types";

// ─── Query Keys ──────────────────────────────────────────────
// Centralised keys make cache invalidation predictable.

const CONTACTS_KEY = ["contacts"] as const;

/** Build a query key that includes the active filters */
function contactsKey(filters?: ContactFilters) {
  return [...CONTACTS_KEY, filters ?? {}] as const;
}

// ─── Queries ─────────────────────────────────────────────────

/**
 * useContacts — fetch the full contacts list with optional filters.
 *
 * Builds a query-string from the provided filters and sends a
 * GET request to /api/contacts. The query key includes the filter
 * object so TanStack Query caches each filter combination separately.
 */
export function useContacts(filters?: ContactFilters) {
  return useQuery<Contact[]>({
    queryKey: contactsKey(filters),
    queryFn: async () => {
      /* Build query params from the filters object */
      const params = new URLSearchParams();
      if (filters?.search) params.set("search", filters.search);
      if (filters?.tag) params.set("tag", filters.tag);
      if (filters?.starred) params.set("starred", "true");
      if (filters?.sort_by) params.set("sort_by", filters.sort_by);
      if (filters?.sort_order) params.set("sort_order", filters.sort_order);

      const qs = params.toString();
      const url = `/api/contacts${qs ? `?${qs}` : ""}`;

      return apiClient.get<Contact[]>(url);
    },
  });
}

/**
 * useContact — fetch a single contact by its ID.
 *
 * Only enabled when an id is provided (avoids sending a request
 * with "undefined" in the URL).
 */
export function useContact(id: string | undefined) {
  return useQuery<Contact>({
    queryKey: ["contacts", id],
    queryFn: () => apiClient.get<Contact>(`/api/contacts/${id}`),
    /* Don't fire the request until we have a valid id */
    enabled: !!id,
  });
}

// ─── Mutations ───────────────────────────────────────────────

/**
 * useCreateContact — POST a new contact.
 *
 * On success, invalidates the contacts list cache so the new
 * contact appears immediately in any rendered list.
 */
export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation<Contact, Error, Partial<Contact>>({
    mutationFn: (data) => apiClient.post<Contact>("/api/contacts", data),
    onSuccess: () => {
      /* Refetch every contacts query regardless of filters */
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}

/**
 * useUpdateContact — PATCH an existing contact.
 *
 * Expects an object with `id` plus any fields to update.
 */
export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation<Contact, Error, Partial<Contact> & { id: string }>({
    mutationFn: ({ id, ...data }) =>
      apiClient.patch<Contact>(`/api/contacts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}

/**
 * useDeleteContact — DELETE a contact by ID.
 *
 * Removes the contact from the server and invalidates the cache.
 */
export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => apiClient.delete(`/api/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}

/**
 * useAddTag — POST a tag to a contact.
 *
 * Sends { tag: string } to /api/contacts/:id/tags.
 */
export function useAddTag() {
  const queryClient = useQueryClient();

  return useMutation<Contact, Error, { contactId: string; tag: string }>({
    mutationFn: ({ contactId, tag }) =>
      apiClient.post<Contact>(`/api/contacts/${contactId}/tags`, { tag }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}

/**
 * useRemoveTag — DELETE a tag from a contact.
 */
export function useRemoveTag() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { contactId: string; tag: string }>({
    mutationFn: ({ contactId, tag }) =>
      apiClient.delete(`/api/contacts/${contactId}/tags/${encodeURIComponent(tag)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}

/**
 * useBuildPRM — POST to import Google Contacts into the PRM.
 *
 * Calls /api/sync/contacts to pull people (not businesses) from all
 * connected Google accounts. Invalidates the contacts cache on success.
 */
export function useBuildPRM() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; imported: number; skipped: number; message: string },
    Error,
    void
  >({
    mutationFn: () =>
      apiClient.post("/api/sync/contacts", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}

/**
 * useSyncEmail — POST to sync Gmail for all connected accounts.
 *
 * Fetches recent emails, creates interaction records, then invalidates
 * both contacts and summary caches so the UI updates.
 */
export function useSyncEmail() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; syncedCount: number },
    Error,
    void
  >({
    mutationFn: () => apiClient.post("/api/sync/gmail", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["contact-summary"] });
    },
  });
}

/** useBulkDeleteContacts — POST to delete multiple selected contacts. */
export function useBulkDeleteContacts() {
  const queryClient = useQueryClient();

  return useMutation<{ deleted: number }, Error, string[]>({
    mutationFn: (ids) =>
      apiClient.post<{ deleted: number }>("/api/contacts/bulk-delete", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}

/** useDeleteAllContacts — DELETE all contacts in a single API call. */
export function useDeleteAllContacts() {
  const queryClient = useQueryClient();

  return useMutation<{ deleted: number }, Error, void>({
    mutationFn: () => apiClient.delete("/api/contacts"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}

/** useEnrichContact — POST to trigger Exa enrichment for a contact. */
export function useEnrichContact() {
  const queryClient = useQueryClient();

  return useMutation<Contact, Error, string>({
    mutationFn: (id) =>
      apiClient.post<Contact>(`/api/contacts/${id}/enrich`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}
