"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import { Loader2, ChevronDown, X, Monitor } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  permissions_denied: "Account not connected. You cancelled the authorization.",
  insufficient_permissions: "Account not connected. Please provide all required permissions (Gmail and Calendar access).",
  missing_params: "Account not connected. The authorization response was incomplete.",
  google_connect_failed: "Account not connected. Something went wrong during authorization.",
};

type ConnectedAccount = {
  id: string;
  provider: string;
  account_email: string;
  connected_at: string;
};

export default function ConnectPage() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const errorCode = searchParams.get("error");
  const connected = searchParams.get("connected");
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.google_connect_failed : null;

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await apiClient.get<{ user: { connected_accounts: ConnectedAccount[] } }>("/api/auth/me");
      setAccounts(res.user?.connected_accounts ?? []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleConnect = async (provider: string) => {
    setActionLoading(`connect-${provider}`);
    try {
      if (provider === "google") {
        const res = await apiClient.get<{ url: string }>("/api/auth/google/login");
        window.location.href = res.url;
      }
    } catch {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (accountId: string, provider: string) => {
    setActionLoading(accountId);
    try {
      if (provider === "google") {
        await apiClient.post("/api/auth/google/disconnect", { accountId });
      }
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    } catch {} finally {
      setActionLoading(null);
    }
  };

  const googleAccounts = accounts.filter((a) => a.provider === "google");

  return (
    <div
      className="flex-1 rounded-3xl border border-white/[0.06] bg-[#0d0d0d] flex flex-col overflow-hidden"
      style={{ boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-white/45 font-medium">Connect Accounts</span>
      </div>

      {/* Status banners */}
      {(errorMessage || (connected && !errorCode)) && (
        <div className="px-6 pb-3 shrink-0">
          {errorMessage && (
            <div className="text-[11px] text-red-400/80 bg-red-500/10 rounded-lg px-3 py-2">
              {errorMessage}
            </div>
          )}
          {connected && !errorCode && (
            <div className="text-[11px] text-green-400/80 bg-green-500/10 rounded-lg px-3 py-2">
              Account connected successfully.
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ProviderTile
            provider="google"
            label="Google"
            icon={<GoogleIcon />}
            accounts={googleAccounts}
            loading={loading}
            actionLoading={actionLoading}
            onConnect={() => handleConnect("google")}
            onDisconnect={(id) => handleDisconnect(id, "google")}
          />
        </div>

        <p className="text-[10px] text-white/25 mt-6">
          We only request read-only access. Your data is encrypted and never shared.
        </p>
      </div>
    </div>
  );
}

function ProviderTile({
  provider,
  label,
  icon,
  accounts,
  loading,
  actionLoading,
  onConnect,
  onDisconnect,
}: {
  provider: string;
  label: string;
  icon: React.ReactNode;
  accounts: ConnectedAccount[];
  loading: boolean;
  actionLoading: string | null;
  onConnect: () => void;
  onDisconnect: (accountId: string) => void;
}) {
  const hasAccounts = accounts.length > 0;
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const closeDropdown = useCallback(() => setDisconnectOpen(false), []);
  useClickOutside(dropdownRef, closeDropdown, disconnectOpen);

  const handleDisconnectClick = () => {
    if (accounts.length === 1) {
      onDisconnect(accounts[0].id);
    } else {
      setDisconnectOpen((prev) => !prev);
    }
  };

  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        {icon}
        <span className="text-[13px] font-medium text-white/90">{label}</span>
      </div>

      {/* Connected accounts list */}
      {loading ? (
        <div className="px-4 py-4 flex justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-white/25" />
        </div>
      ) : hasAccounts ? (
        <div className="px-4 py-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest text-white/25 font-medium">Linked Accounts</p>
          {accounts.map((account) => (
            <p key={account.id} className="text-[12px] text-white/70">{account.account_email}</p>
          ))}
        </div>
      ) : (
        <div className="px-4 py-4">
          <p className="text-[12px] text-white/25">No accounts connected</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 py-3 border-t border-white/[0.06] flex items-center gap-2">
        <button
          onClick={onConnect}
          disabled={actionLoading === `connect-${provider}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest text-white/90 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all disabled:opacity-50"
          style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.2)" }}
        >
          {actionLoading === `connect-${provider}` && <Loader2 className="w-3 h-3 animate-spin" />}
          Connect
        </button>

        {hasAccounts && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={handleDisconnectClick}
              disabled={!!actionLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest text-red-400/80 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50"
            >
              {actionLoading && actionLoading !== `connect-${provider}` && <Loader2 className="w-3 h-3 animate-spin" />}
              Disconnect
              {accounts.length > 1 && <ChevronDown className="w-3 h-3" />}
            </button>

            {disconnectOpen && accounts.length > 1 && (
              <div className="absolute top-full left-0 mt-1 bg-[#1a1a1a] border border-white/[0.08] rounded-lg shadow-lg z-10 min-w-[200px] overflow-hidden">
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => { setDisconnectOpen(false); onDisconnect(account.id); }}
                    disabled={actionLoading === account.id}
                    className="w-full text-left px-3 py-2 text-[12px] text-white/70 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    {account.account_email}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
