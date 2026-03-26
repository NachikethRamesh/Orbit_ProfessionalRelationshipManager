"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { Eye, EyeOff, Save, Check, Loader2 } from "lucide-react";

interface SettingsConfig {
  OPENAI_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  EXA_API_KEY: string;
  ENCRYPTION_KEY: string;
}

const KEY_META: { key: keyof SettingsConfig; label: string; secret: boolean; placeholder: string; readOnly?: boolean; note?: string; help: string; helpUrl?: string }[] = [
  {
    key: "OPENAI_API_KEY",
    label: "OpenAI API Key",
    secret: true,
    placeholder: "sk-...",
    help: "Go to platform.openai.com/api-keys and create a new secret key.",
    helpUrl: "https://platform.openai.com/api-keys",
  },
  {
    key: "GOOGLE_CLIENT_ID",
    label: "Google Client ID",
    secret: true,
    placeholder: "123456789.apps.googleusercontent.com",
    help: "Create OAuth 2.0 credentials in Google Cloud Console > APIs & Services > Credentials. Choose \"Web application\" type.",
    helpUrl: "https://console.cloud.google.com/apis/credentials",
  },
  {
    key: "GOOGLE_CLIENT_SECRET",
    label: "Google Client Secret",
    secret: true,
    placeholder: "GOCSPX-...",
    help: "Found alongside the Client ID in your Google Cloud OAuth 2.0 credential details.",
    helpUrl: "https://console.cloud.google.com/apis/credentials",
  },
  {
    key: "GOOGLE_REDIRECT_URI",
    label: "Google Redirect URI",
    secret: false,
    placeholder: "http://localhost:3000/api/auth/google/callback",
    readOnly: true,
    note: "Auto-populated",
    help: "Add this exact URL as an Authorized Redirect URI in your Google Cloud OAuth credential settings.",
  },
  {
    key: "EXA_API_KEY",
    label: "Exa API Key (Optional - For Enrichment)",
    secret: true,
    placeholder: "Leave blank to skip",
    help: "Sign up at exa.ai and copy your API key from the dashboard. Powers contact enrichment.",
    helpUrl: "https://exa.ai",
  },
  {
    key: "ENCRYPTION_KEY",
    label: "Encryption Key",
    secret: true,
    placeholder: "Auto-generated hex key",
    readOnly: true,
    note: "Auto-generated",
    help: "Used to encrypt stored OAuth tokens. Generated automatically — do not change unless re-connecting all accounts.",
  },
];

export default function SettingsPage() {
  const [masked, setMasked] = useState<SettingsConfig | null>(null);
  const [edits, setEdits] = useState<Partial<SettingsConfig>>({});
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiClient.get<{ settings: SettingsConfig }>("/api/settings");
      setMasked(res.settings);
    } catch {
      setError("Failed to load settings.");
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleChange = (key: keyof SettingsConfig, value: string) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (Object.keys(edits).length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.patch<{ settings: SettingsConfig; message: string }>("/api/settings", { updates: edits });
      setMasked(res.settings);
      setEdits({});
      setRevealed(new Set());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const toggleReveal = (key: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const getDisplayValue = (key: keyof SettingsConfig, meta: typeof KEY_META[number]) => {
    if (key in edits) return edits[key]!;
    if (!masked) return "";
    if (meta.secret && !revealed.has(key)) return masked[key];
    return masked[key];
  };

  const isEditing = (key: keyof SettingsConfig) => key in edits;

  const hasChanges = Object.keys(edits).length > 0;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
        <p className="text-white/40 text-sm mb-8">Manage your API keys and configuration</p>

        {/* Database Info */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">Database</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-white/50 text-sm font-mono">~/.orbit/orbit.db</p>
          </div>
        </section>

        {/* Configuration */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">Configuration</h2>
          {/* Hidden fields to absorb browser autofill */}
          <div aria-hidden="true" style={{ position: "absolute", opacity: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}>
            <input type="text" name="fake-user" tabIndex={-1} />
            <input type="password" name="fake-pass" tabIndex={-1} />
          </div>
          <div className="flex flex-col gap-3">
            {KEY_META.map((meta) => {
              const value = getDisplayValue(meta.key, meta);
              const editing = isEditing(meta.key);

              return (
                <div key={meta.key} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4 mb-1.5">
                    <label className="text-xs text-white/40 shrink-0">{meta.label}</label>
                    <p className="text-[11px] text-white/25 text-right leading-tight">
                      {meta.help}
                      {meta.helpUrl && (
                        <>
                          {" "}
                          <a
                            href={meta.helpUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-400/50 hover:text-orange-400 transition-colors underline underline-offset-2"
                          >
                            Open &rarr;
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={value}
                      placeholder={meta.placeholder}
                      onChange={(e) => handleChange(meta.key, e.target.value)}
                      readOnly={meta.readOnly}
                      name={`orbit-${meta.key}`}
                      className={`flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm font-mono placeholder:text-white/20 focus:outline-none transition-colors ${
                        meta.readOnly
                          ? "text-white/40 cursor-not-allowed"
                          : "text-white/80 focus:border-orange-400/40"
                      }`}
                      style={meta.secret && !revealed.has(meta.key) && !editing ? { WebkitTextSecurity: "disc", textSecurity: "disc" } as React.CSSProperties : undefined}
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      spellCheck={false}
                    />
                    {meta.secret && !meta.readOnly && (
                      <button
                        onClick={() => toggleReveal(meta.key)}
                        className="p-2 text-white/25 hover:text-white/60 transition-colors"
                        title={revealed.has(meta.key) ? "Hide" : "Show"}
                      >
                        {revealed.has(meta.key) ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                  {meta.note && (
                    <p className="text-[10px] text-white/25 mt-1">{meta.note}</p>
                  )}
                  {editing && (
                    <p className="text-[10px] text-orange-400/60 mt-1">Unsaved change</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Save button */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 disabled:hover:bg-orange-500/20"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? "Saving..." : saved ? "Saved" : "Save Changes"}
            </button>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {saved && <p className="text-sm text-green-400/60">Changes saved to ~/.orbit/.env</p>}
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">About</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-white/50 text-sm">Orbit PRM v1.0.0</p>
            <p className="text-white/30 text-xs mt-1">
              Open-source, locally-runnable. Your data stays on your machine. Built by{" "}
              <a
                href="https://nachikethramesh.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400/60 hover:text-orange-400 transition-colors"
              >
                Nachiketh Ramesh
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
