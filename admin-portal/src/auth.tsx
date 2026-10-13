import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { auth } from "./firebase";
import { Authority } from "./types";

type Session = { user: User | null; authority: Authority; signIn: (mobile: string, password: string) => Promise<void>; signOut: () => Promise<void> };
const AuthContext = createContext<Session | null>(null);

function mobileToEmail(value: string) {
  const digits = value.replace(/\D/g, "");
  const normalized = digits.startsWith("63") ? digits : digits.startsWith("0") ? `63${digits.slice(1)}` : `63${digits}`;
  return `${normalized}@tasklink.local`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authority, setAuthority] = useState<Authority>("loading");

  useEffect(() => {
    if (!auth) { setAuthority("guest"); return; }
    return onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) { setUser(null); setAuthority("guest"); return; }
      try {
        const token = await nextUser.getIdTokenResult();
        setUser(nextUser);
        setAuthority(token.claims.superadmin === true ? "superadmin" : token.claims.admin === true ? "admin" : "denied");
      } catch { setUser(null); setAuthority("guest"); }
    }, () => { setUser(null); setAuthority("guest"); });
  }, []);

  return <AuthContext.Provider value={{
    user, authority,
    signIn: async (mobile, password) => { if (!auth) throw new Error("Firebase is not configured."); await signInWithEmailAndPassword(auth, mobileToEmail(mobile), password); },
    signOut: async () => { if (auth) await signOut(auth); }
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("AuthProvider is missing."); return value; }
