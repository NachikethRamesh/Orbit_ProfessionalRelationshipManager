"use client";

import { useState } from "react";

interface UseAuthReturn {
  session: { user: { id: string; email: string } } | null;
  user: { id: string; email: string } | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const LOCAL_USER = { id: "local-user", email: "local@orbit.local" };

export function useAuth(): UseAuthReturn {
  const [session] = useState({ user: LOCAL_USER });
  const [user] = useState(LOCAL_USER);

  return {
    session,
    user,
    loading: false,
    signInWithGoogle: async () => {},
    signOut: async () => {},
  };
}
