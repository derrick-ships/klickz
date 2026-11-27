"use client";
import { usePathname } from "next/navigation";
import { useCallback } from "react";
import { AccountSignIn, useAccount } from "@/components/account/account";

export function useAuthApi() {
  const account = useAccount();

  const api = useCallback(
    async <T = unknown,>(
      path: string,
      method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" = "GET",
      body?: unknown,
    ): Promise<T> => {
      const fresh = await account.db?.auth.getSession();
      const token = fresh?.data.session?.access_token;
      if (!token) throw new Error("Sign in to continue.");
      const res = await fetch(path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || `Request failed (${res.status})`,
        );
      }
      return data as T;
    },
    [account.db],
  );

  return { ...account, api };
}

const NAV_ITEMS = [
  { href: "/", label: "Pre-Flight Studies" },
  { href: "/channels", label: "Channels & Minds" },
  { href: "/personas", label: "Creator Personas" },
  { href: "/studio", label: "Quick Studio" },
  { href: "/connect", label: "Keys & Models" },
];

export function AppShell({
  children,
  requireAuth = true,
}: {
  children: React.ReactNode;
  requireAuth?: boolean;
}) {
  const pathname = usePathname();
  const { db, session, ready, signInNotice } = useAccount();

  return (
    <div className="pf-shell">
      <header className="pf-nav">
        <a href="/" className="pf-nav-brand">
          <span className="pf-nav-dot" aria-hidden="true" />
          OpenPikzels
        </a>
        <nav className="pf-nav-links" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/" || pathname.startsWith("/studies")
                : pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                className="pf-nav-link"
                data-active={active}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </header>

      <main className="pf-main">
        {requireAuth && !ready ? (
          <p className="pf-muted">Loading workspace…</p>
        ) : requireAuth && !db ? (
          <div className="pf-card">
            <h2>Cloud setup pending</h2>
            <p className="pf-muted">
              Supabase environment variables are not configured yet. You can still
              use <a href="/studio">Quick Studio</a> locally.
            </p>
          </div>
        ) : requireAuth && !session && db ? (
          <div className="pf-card" style={{ maxWidth: 460, margin: "2rem auto" }}>
            <h1 style={{ marginTop: 0 }}>Sign in to OpenPikzels</h1>
            <p className="pf-muted" style={{ marginBottom: "1rem" }}>
              Pre-Flight Packaging &amp; Audience Intelligence Platform.
            </p>
            <AccountSignIn db={db} initialNotice={signInNotice} />
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
