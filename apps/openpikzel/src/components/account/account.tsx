"use client";
import { useEffect, useRef, useState } from "react";
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
              : { auth: { detectSessionInUrl: !new URL(location.href).searchParams.has("state") } },
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
        setError("Could not load your account. Refresh this page to try again.");
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
  showEmailLinkHint = true,
}: {
  db: SupabaseClient;
  onSignedIn?: () => void;
  showEmailLinkHint?: boolean;
}) {
  const [signup, setSignup] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [emailSent, setEmailSent] = useState(false),
    [code, setCode] = useState("");
  return (
    <form
      className="account-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setStatus("");
        try {
          const result = emailSent
            ? await db.auth.verifyOtp({ email, token: code, type: "email" })
            : signup
            ? await db.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: location.origin + "/connect" },
              })
            : await db.auth.signInWithPassword({ email, password });
          setPassword(""); setCode("");
          if (result.error)
            throw new Error(
              emailSent ? "That code expired or could not be verified. Request a new code and try again." : signup
                ? "Could not create the account. Check your details or try signing in."
                : "Sign-in failed. Check your email and password.",
            );
          if (!result.data.session)
            setStatus(
              "Check your email to confirm your account, then sign in.",
            );
          else onSignedIn?.();
        } catch (e) {
          setStatus(e instanceof Error ? e.message : "Could not complete this account request. Check your connection and try again.");
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
      {!emailSent && <label>
        Password{signup ? " (at least 8 characters)" : ""}
        <input
          type="password"
          minLength={8}
          required
          autoComplete={signup ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>}
      {emailSent && <label>Email sign-in code<input id="email-signin-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8} required value={code} onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ""))} /></label>}
      <button className="primary-button" disabled={busy}>
        {busy ? (emailSent ? "Verifying…" : signup ? "Creating account…" : "Signing in…") : emailSent ? "Verify code" : signup ? "Create account" : "Sign in"}
      </button>
      <button
        type="button"
        className="neutral-button"
        disabled={busy}
        onClick={() => {
          if (emailSent) { setEmailSent(false); setCode(""); } else setSignup(!signup);
          setStatus("");
        }}
      >
        {emailSent ? "Use password instead" : signup
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
      {!emailSent && <button type="button" className="neutral-button" disabled={busy} onClick={event => {
        const input = event.currentTarget.form?.querySelector<HTMLInputElement>('input[type="email"]');
        if (!input?.reportValidity()) return;
        setPassword(""); setEmailSent(true); setStatus("Enter the code from your latest sign-in email. This does not send another email.");
        requestAnimationFrame(() => document.getElementById("email-signin-code")?.focus());
      }}>I already have a code</button>}
      {<button type="button" className="neutral-button" disabled={busy} onClick={async (event) => {
        const input = event.currentTarget.form?.querySelector<HTMLInputElement>('input[type="email"]');
        if (!input?.reportValidity()) return;
        setBusy(true); setStatus(""); setPassword("");
        try {
          const result = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + "/connect" } });
          if (result.error) {
            if (result.error.status === 429) {
              setEmailSent(true);
              requestAnimationFrame(() => document.getElementById("email-signin-code")?.focus());
              setStatus("The sign-in email limit has been reached. If you already received a code, enter it here. Otherwise wait before requesting another email.");
              return;
            }
            throw new Error("Could not send the sign-in email. If you already received a code, choose I already have a code. Otherwise try again later.");
          }
          setEmailSent(true);
          requestAnimationFrame(() => document.getElementById("email-signin-code")?.focus());
          setStatus(showEmailLinkHint ? "Check your email for the sign-in code, then enter it here. You can also use the one-time link in that email." : "Enter the code from your email here to finish connecting this agent. The email link opens the main studio separately.");
        } catch (error) { setStatus(error instanceof Error ? error.message : "Could not send the sign-in email."); }
        finally { setBusy(false); }
      }}>{emailSent ? "Send a new sign-in code" : "Email me a sign-in code"}</button>}
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
  const [higgsfield, setHiggsfield] = useState(false), [higgsfieldTools, setHiggsfieldTools] = useState<string[]>([]);
  const callbackHandled = useRef(false);
  async function api(path: string, method = "GET", body?: unknown) {
    const fresh = await db?.auth.getSession();
    if (!fresh?.data.session) throw new Error("Your session ended. Sign in again to manage connections.");
    const r = await fetch(path, {
      method,
      headers: {
        Authorization: `Bearer ${fresh.data.session.access_token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Could not complete this action. Check your connection and try again.");
    return data;
  }
  async function refresh() {
    const [c, g, h] = await Promise.all([
      api("/api/providers"),
      api("/api/oauth/grants"),
      config?.higgsfield ? api("/api/connections/higgsfield") : Promise.resolve({ connected: false }),
    ]);
    setConnections(c.connections);
    setGrants(g.grants);
    setHiggsfield(h.connected);
  }
  useEffect(() => {
    if (session) void refresh().catch((e) => setError(e.message));
  }, [session?.user.id]);
  useEffect(() => {
    if (!session || callbackHandled.current) return;
    const params = new URLSearchParams(location.search), code = params.get("code"), state = params.get("state"), failure = params.get("error");
    if (!code && !failure) return;
    callbackHandled.current = true;
    history.replaceState(null, "", "/connect");
    if (failure) { setError("Higgsfield sign-in was not completed. You can connect again."); return; }
    if (!state) { setError("The sign-in state is missing. Connect Higgsfield again."); return; }
    void action(async () => {
      await api("/api/connections/higgsfield", "POST", { action: "finish", code, state });
      await refresh(); setNotice("Higgsfield connected. No generation credits were used.");
    });
  }, [session?.user.id]);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete this action. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-page">
      <header className="account-header">
        <a href="/studio" className="brand">
          OpenPikzels<span className="wordmark-pixel" aria-hidden="true" />
        </a>
        <a href="/studio">Back to studio</a>
      </header>
      <div className="account-intro">
        <h1>Connect your AI</h1>
        <p>
          Sign in and add your own API keys. Image generation and analysis use
          credits from your connected provider accounts.
        </p>
      </div>
      <BrandScene scene="aperture" />
      {!ready ? (
        <p role="status">Loading your connections…</p>
      ) : !db ? (
        <p>
          Cloud sign-in is not available here yet.{" "}
          <a href="/studio">Save drafts in this browser.</a>
        </p>
      ) : !session ? (
        <AccountSignIn db={db} />
      ) : (
        <>
          <section className="account-panel">
            <h2>Connect an API provider</h2>
            <p>
              Connect OpenAI or Google to generate images and titles. Connect
              Jev to score thumbnails. You can use either or both workflows.
            </p>
            <div className="provider-setup">
            <form
              className="account-form key-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  const submitted = key;
                  setKey("");
                  const result = await api("/api/providers", "POST", {
                    provider,
                    key: submitted,
                  });
                  await refresh();
                  setNotice(
                    result.kept ? "Your saved key is unchanged." : "API key saved securely. No test request was made. Your agent never receives the key.",
                  );
                });
              }}
            >
              <label>
                Provider
                <select
                  aria-label="Provider"
                  value={provider}
                  onChange={(e) => { setProvider(e.target.value); setKey(""); setNotice(""); }}
                >
                  <option value="openai">OpenAI</option>
                  <option value="google">Google</option><option value="youtube">YouTube Data API</option>
                  <option value="jev">Jev AI</option>
                </select>
              </label>
              <label>
                Your API key
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  required={!connections.some((c) => c.provider === provider)}
                  minLength={12}
                  aria-describedby="provider-key-help"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={connections.some((c) => c.provider === provider) ? "Leave empty to keep current key" : "Paste your key securely"}
                />
              </label>
              <p id="provider-key-help">Saved keys are never shown again. Leave empty to keep current key. To replace it, paste a new key.</p>
              <button
                className="primary-button"
                disabled={busy || !config?.secureConnections}
              >
                {busy ? "Saving…" : connections.some((c) => c.provider === provider) ? "Save connection" : "Connect key"}
              </button>
            </form>
            <div className="provider-grid">
              {[
                ["openai", "OpenAI", "Sunburst / Flare, titles and vision"],
                ["google", "Google", "Gemini image models, titles and vision"],
                ["jev", "Jev AI", "Image + title scores across five pillars"],
                ["youtube", "YouTube", "Channel metadata and thumbnail references · your own Data API key"],
              ].map(([id, name, detail]) => {
                const c = connections.find((x) => x.provider === id);
                return (
                  <article key={id}>
                    <h3>{name}</h3>
                    <p>{detail}</p>
                    <strong>
                      {c
                        ? "Connected · ••••" + c.suffix
                        : "Not connected"}
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
              <p>Key storage is not enabled here yet. You can continue with local drafts.</p>
            )}
            <p className="dialog-footnote">
              Keys are encrypted at rest, isolated to your account and used only
              on the server. We show only the last four characters. Provider
              credits are separate from a ChatGPT or Gemini subscription.
              Connecting a key makes no billable test request.
            </p>
            <a className="primary-button inline-link" href="/studio">
              Open studio
            </a>
          </section>
          <section className="account-panel">
            <h2>Higgsfield</h2>
            <p>Connect your own Higgsfield account through its secure sign-in page. Tokens stay encrypted. Generating through MCP uses your Higgsfield credits, including on Unlimited plans.</p>
            <p role="status">{!config?.higgsfield ? "Higgsfield connection is awaiting activation." : higgsfield ? "Higgsfield is connected." : "Higgsfield is not connected."}</p>
            <div className="connection-actions">
              <button className="primary-button" disabled={busy || !config?.secureConnections || !config?.higgsfield} onClick={() => void action(async () => {
                const result = await api("/api/connections/higgsfield", "POST", { action: "start" });
                location.assign(result.authorizationUrl);
              })}>{higgsfield ? "Reconnect Higgsfield" : "Connect Higgsfield"}</button>
              {higgsfield && <>
                <button className="neutral-button" disabled={busy} onClick={() => void action(async () => {
                  const result = await api("/api/connections/higgsfield?check=true"); setHiggsfieldTools(result.tools.map((tool: { name: string }) => tool.name));
                  setNotice("Higgsfield connection checked. No generation was requested.");
                })}>Check Higgsfield connection</button>
                <button className="neutral-button" disabled={busy} onClick={() => void action(async () => {
                  await api("/api/connections/higgsfield", "DELETE"); setHiggsfieldTools([]); await refresh();
                  setNotice("Higgsfield disconnected from OpenPikzels. You can also revoke access in Higgsfield settings.");
                })}>Disconnect Higgsfield</button>
              </>}
            </div>
            {higgsfieldTools.length > 0 && <details><summary>Available Higgsfield tools ({higgsfieldTools.length})</summary><ul>{higgsfieldTools.map(name => <li key={name}>{name}</li>)}</ul></details>}
          </section>
          <section className="account-panel">
            <h2>Use your Claude or Codex plan</h2>
            <p>Use the local companion to run the official Claude Code or Codex CLI with your own active login. Sign-in and subscription credentials stay in that CLI. You can also connect OpenPikzels through MCP inside your official agent. Image generation and Jev scoring use separate API credits.</p>
            <div className="connection-actions">
              <a className="primary-button inline-link" href="/local-companion">Set up local companion</a>
              <a className="neutral-button inline-link" href="https://claude.ai/" target="_blank" rel="noopener noreferrer">Open Claude</a>
              <a className="neutral-button inline-link" href="https://chatgpt.com/codex" target="_blank" rel="noopener noreferrer">Open Codex</a>
              <button className="neutral-button" onClick={() => void action(async () => { await navigator.clipboard.writeText(config?.mcpUrl || location.origin + "/mcp"); setNotice("MCP URL copied. Add it in your agent’s MCP connections and approve access."); })}>Copy agent connection URL</button>
            </div>
            <details><summary>About direct subscription sign-in</summary><p>A local app can launch an unmodified official CLI after you sign in through its own flow. OpenPikzels never collects or proxies that subscription token. Hosted ChatGPT plan integration has separate approval requirements; the local companion does not turn your subscription into a shared cloud API.</p></details>
          </section>
          <section className="account-panel">
            <h2 id="mcp">Connect your agent</h2>
            <p>
              Paste this MCP URL into your agent’s connection settings. Your
              client needs Streamable HTTP and OAuth support. Review its
              requested permissions before allowing access.
            </p>
            {config?.ownerGate && (
              <p>
                This preview is owner-only. Connections for other accounts are
                not enabled yet.
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
