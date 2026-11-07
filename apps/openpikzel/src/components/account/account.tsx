"use client";
import { useEffect, useState } from "react";
import {
  createClient,
  type SupabaseClient,
  type Session,
} from "@supabase/supabase-js";
import { BrandScene } from "@/components/brand-scene";
import type { Config } from "@/lib/types";
export function useAccount(isolated = false) {
  const [db, setDb] = useState<SupabaseClient | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [config, setConfig] = useState<Config | null>(null),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true,
      unsubscribe = () => {};
    void fetch("/api/config")
      .then((r) => r.json())
      .then(async (c: Config) => {
        if (!active) return;
        setConfig(c);
        if (c.cloud) {
          const client = createClient(
            c.supabaseUrl,
            c.supabaseKey,
            isolated
              ? {
                  auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false,
                  },
                }
              : undefined,
          );
          setDb(client);
          const { data } = await client.auth.getSession();
          if (!active) return;
          setSession(data.session);
          const sub = client.auth.onAuthStateChange((_, s) => setSession(s));
          unsubscribe = () => sub.data.subscription.unsubscribe();
        }
        setReady(true);
      })
      .catch(() => {
        setReady(true);
        setError("Account settings could not load.");
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [isolated]);
  return { db, session, config, error, setError, ready };
}
export function AccountSignIn({
  db,
  onSignedIn,
}: {
  db: SupabaseClient;
  onSignedIn?: () => void;
}) {
  const [signup, setSignup] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="account-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setStatus("");
        try {
          const result = signup
            ? await db.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: location.origin + "/connect" },
              })
            : await db.auth.signInWithPassword({ email, password });
          setPassword("");
          if (result.error)
            throw new Error(
              signup
                ? "Could not create the account. Check your details or try signing in."
                : "Sign-in failed. Check your email and password.",
            );
          if (!result.data.session)
            setStatus(
              "Check your email to confirm your account, then sign in.",
            );
          else onSignedIn?.();
        } catch (e) {
          setStatus(e instanceof Error ? e.message : "Account action failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>
        {signup ? "Create your free account" : "Sign in to your workspace"}
      </h2>
      <p>
        Private creations and personas. Connect your own API keys after signing
        in.
      </p>
      <label>
        Email
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          minLength={8}
          required
          autoComplete={signup ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button className="primary-button" disabled={busy}>
        {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
      </button>
      <button
        type="button"
        className="neutral-button"
        disabled={busy}
        onClick={() => {
          setSignup(!signup);
          setStatus("");
        }}
      >
        {signup
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
      <p role="status">{status}</p>
    </form>
  );
}
export const copyInstructions = `Connect to OpenPikzels using the remote MCP URL shown on this page. Sign in and review the Allow/Deny consent screen. Never put API keys in chat; connect them in OpenPikzels Settings. Start with get_workspace. Use list_profiles/get_profile for persona references and list_creations to inspect existing work. Use upload_reference for an image created in ChatGPT, then score_thumbnail with its actual title. Use get_fix_prompt to return a copyable prompt for editing it in ChatGPT without generating another image through an API. Only use generate_thumbnail or one_click_fix when I request an API-rendered image, with my chosen provider, quality and batch. Keep the same requestId across an uncertain retry, and check history after a timeout. Scores are visual rubrics, not a promise of CTR. Use open_studio for the interactive HTML interface when supported.`;
export function ConnectionsPage() {
  const { db, session, config, error, setError, ready } = useAccount();
  const [connections, setConnections] = useState<
      { provider: string; suffix: string }[]
    >([]),
    [grants, setGrants] = useState<
      {
        id: string;
        client_name: string;
        scope: string[];
        revoked_at: string | null;
      }[]
    >([]),
    [provider, setProvider] = useState("openai"),
    [key, setKey] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function api(path: string, method = "GET", body?: unknown) {
    const fresh = await db?.auth.getSession();
    if (!fresh?.data.session) throw new Error("Sign in again.");
    const r = await fetch(path, {
      method,
      headers: {
        Authorization: `Bearer ${fresh.data.session.access_token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Could not complete.");
    return data;
  }
  async function refresh() {
    const [c, g] = await Promise.all([
      api("/api/providers"),
      api("/api/oauth/grants"),
    ]);
    setConnections(c.connections);
    setGrants(g.grants);
  }
  useEffect(() => {
    if (session) void refresh().catch((e) => setError(e.message));
  }, [session?.user.id]);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-page">
      <header className="account-header">
        <a href="/" className="brand">
          ▧ OpenPikzels
        </a>
        <a href="/">Back to studio</a>
      </header>
      <div className="account-intro">
        <p className="eyebrow">Your workspace · Your keys</p>
        <h1>Make it yours.</h1>
        <p>
          Sign in, connect a provider, and create. API providers bill your own
          account for the requests you make.
        </p>
      </div>
      <BrandScene scene="aperture" />
      {!ready ? (
        <p role="status">Loading account…</p>
      ) : !db ? (
        <p>
          Cloud account setup is pending.{" "}
          <a href="/">Continue with local drafts.</a>
        </p>
      ) : !session ? (
        <AccountSignIn db={db} />
      ) : (
        <>
          <section className="account-panel">
            <span className="step-label">01 / Connect your providers</span>
            <h2>Choose what powers your studio</h2>
            <p>
              OpenAI or Google for images and titles. Jev for five-pillar
              scoring. You can connect any combination and remove it anytime.
            </p>
            <div className="provider-setup">
            <form
              className="account-form key-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  const submitted = key;
                  setKey("");
                  await api("/api/providers", "POST", {
                    provider,
                    key: submitted,
                  });
                  await refresh();
                  setNotice(
                    "Connected. Your key is encrypted and is never sent to an agent.",
                  );
                });
              }}
            >
              <label>
                Provider
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                >
                  <option value="openai">OpenAI</option>
                  <option value="google">Google</option>
                  <option value="jev">Jev AI</option>
                </select>
              </label>
              <label>
                Your API key
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  minLength={12}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Paste your key securely"
                />
              </label>
              <button
                className="primary-button"
                disabled={busy || !config?.secureConnections}
              >
                {busy ? "Saving…" : "Connect key"}
              </button>
            </form>
            <div className="provider-grid">
              {[
                ["openai", "OpenAI", "Sunburst / Flare, titles and vision"],
                ["google", "Google", "Gemini image models, titles and vision"],
                ["jev", "Jev AI", "Image + title scores across five pillars"],
              ].map(([id, name, detail]) => {
                const c = connections.find((x) => x.provider === id);
                return (
                  <article key={id}>
                    <h3>{name}</h3>
                    <p>{detail}</p>
                    <strong>
                      {c
                        ? "Connected · ••••" + c.suffix
                        : "Use your own API key"}
                    </strong>
                    {c && (
                      <button
                        className="neutral-button"
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            await api("/api/providers", "DELETE", {
                              provider: id,
                            });
                            await refresh();
                          })
                        }
                      >
                        Disconnect {name}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
            </div>

            {!config?.secureConnections && (
              <p>Encrypted key storage is awaiting server activation.</p>
            )}
            <p className="dialog-footnote">
              Keys are encrypted at rest, isolated to your account and used only
              on the server. We show only the last four characters. Provider
              credits are separate from a ChatGPT or Gemini subscription.
              Connecting a key makes no billable test request.
            </p>
            <a className="primary-button inline-link" href="/">
              Open studio
            </a>
          </section>
          <section className="account-panel">
            <span className="step-label">02 / Connect your agent</span>
            <h2>Your studio, inside your chat</h2>
            <p>
              Paste this remote MCP URL into a client that supports Streamable
              HTTP and OAuth. Review the branded consent screen before allowing
              access.
            </p>
            {config?.ownerGate && (
              <p>
                The private preview is owner-only. Public MCP connections become
                available after domain and public-launch setup.
              </p>
            )}
            <code className="copy-url">
              {config?.mcpUrl || "MCP URL is loading…"}
            </code>
            <button
              className="neutral-button"
              onClick={() =>
                void action(async () => {
                  await navigator.clipboard.writeText(
                    config?.mcpUrl || location.origin + "/mcp",
                  );
                  setNotice("MCP URL copied.");
                })
              }
            >
              Copy MCP URL
            </button>
            <p>
              Read access covers your library and references. Write access saves
              uploads and edits. AI access can use your provider credits. Revoke
              access below anytime.
            </p>
            <h3>Instructions for your agent</h3>
            <textarea
              readOnly
              rows={8}
              aria-label="Agent instructions"
              value={copyInstructions}
            />
            <button
              className="neutral-button"
              onClick={() =>
                void action(async () => {
                  await navigator.clipboard.writeText(copyInstructions);
                  setNotice("Agent instructions copied.");
                })
              }
            >
              Copy instructions
            </button>
            <p>
              The interactive HTML studio appears in hosts supporting MCP Apps.
              Other clients receive the same tools and text results.
            </p>
          </section>
          <section className="account-panel">
            <h2>Connected agents</h2>
            {!grants.length ? (
              <p>No agents connected yet.</p>
            ) : (
              grants.map((g) => (
                <div className="grant-row" key={g.id}>
                  <div>
                    <strong>{g.client_name}</strong>
                    <p>{g.scope.join(" · ")}</p>
                  </div>
                  <button
                    className="neutral-button"
                    disabled={busy || !!g.revoked_at}
                    onClick={() =>
                      void action(async () => {
                        await api("/api/oauth/grants", "DELETE", { id: g.id });
                        await refresh();
                      })
                    }
                  >
                    {g.revoked_at ? "Revoked" : "Revoke access"}
                  </button>
                </div>
              ))
            )}
            <button
              className="neutral-button"
              onClick={() => void db.auth.signOut({ scope: "local" })}
            >
              Sign out
            </button>
          </section>
        </>
      )}
      {error && (
        <p className="dialog-error" role="alert">
          {error}
        </p>
      )}
      <p role="status">{notice}</p>
    </main>
  );
}
