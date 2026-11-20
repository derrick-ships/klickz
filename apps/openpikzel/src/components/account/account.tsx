"use client";
import { useEffect, useRef, useState } from "react";
import { ModelsPanel } from "./models-panel";
import {
  createClient,
  type SupabaseClient,
  type Session,
} from "@supabase/supabase-js";
import { CodexConnection } from "./codex-connection";

import { AccountSignIn } from "./sign-in";
export { AccountSignIn } from "./sign-in";
import { takeSignInLinkError } from "@/lib/sign-in-link";

import type { Config } from "@/lib/types";
import { localAgentLinked } from "../../lib/oauth/scopes";
export function useAccount(isolated = false) {
  const [db, setDb] = useState<SupabaseClient | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [config, setConfig] = useState<Config | null>(null),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [signInNotice, setSignInNotice] = useState("");
  useEffect(() => {
    let active = true,
      unsubscribe = () => {};
    void fetch("/api/config")
      .then((r) => r.json())
      .then(async (c: Config) => {
        if (!active) return;
        setConfig(c);
        if (c.cloud) {
          if (!isolated) {
            const failedLink = takeSignInLinkError(location.href);
            if (failedLink) {
              setSignInNotice(failedLink.message);
              history.replaceState(history.state, "", failedLink.cleanUrl);
            }
          }
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
          const { data, error: sessionError } = await client.auth.getSession();
          if (!active) return;
          setSession(data.session);
          if (sessionError && !isolated) setSignInNotice("We could not finish signing you in. Request a new email below, or sign in with your password.");
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
  return { db, session, config, error, setError, ready, signInNotice };
}
export const copyInstructions = `Connect to OpenPikzels using the remote MCP URL shown on this page. Sign in and review the Allow/Deny consent screen. Never put API keys in chat; connect them in OpenPikzels Connections. Start with get_workspace. Use list_profiles/get_profile for persona references and list_creations to inspect existing work. Use upload_reference for an image created in ChatGPT, then score_thumbnail with its actual title. Use get_fix_prompt to return a copyable prompt for editing it in ChatGPT without generating another image through an API. Only use generate_thumbnail or one_click_fix when I request an API-rendered image, with my chosen provider, quality and batch. Keep the same requestId across an uncertain retry, and check history after a timeout. Scores are visual rubrics, not a promise of CTR. Use open_studio for the interactive HTML interface when supported.`;

export function ConnectionsPage() {
  const { db, session, config, error, setError, ready, signInNotice } = useAccount();
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
    [notice, setNotice] = useState(""),
    [showRevoked, setShowRevoked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [higgsfield, setHiggsfield] = useState(false), [higgsfieldTools, setHiggsfieldTools] = useState<string[]>([]);
  const [connectionRead, setConnectionRead] = useState<"loading" | "succeeded" | "failed">("loading");
  const connectionEpoch = useRef(0), connectionOwner = useRef("");
  connectionOwner.current = session?.user.id || "";

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
    const epoch = ++connectionEpoch.current, owner = connectionOwner.current;
    setConnectionRead("loading");
    try {
    const [c, g, h] = await Promise.all([
      api("/api/providers"),
      api("/api/oauth/grants"),
      config?.higgsfield ? api("/api/connections/higgsfield") : Promise.resolve({ connected: false }),
    ]);
    if (epoch !== connectionEpoch.current || owner !== connectionOwner.current) return;
    setConnections(c.connections);
    setGrants(g.grants);
    setHiggsfield(h.connected);
    setConnectionRead("succeeded");
    } catch (e) {
      if (epoch !== connectionEpoch.current || owner !== connectionOwner.current) return;
      setConnectionRead("failed");
      throw e;
    }
  }
  useEffect(() => {
    setConnections([]); setGrants([]); setHiggsfield(false); setHiggsfieldTools([]); setConnectionRead("loading");
    if (session) void refresh().catch((e) => setError(e.message));
    return () => { connectionEpoch.current++; };
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
      <div className="account-intro"><h1>{session ? "Set up your key" : "Welcome"}</h1></div>
      {!ready ? (
        <p role="status">Loading your connections…</p>
      ) : !db ? (
        <p>
          Cloud sign-in is not available here yet.{" "}
          <a href="/studio">Save drafts in this browser.</a>
        </p>
      ) : !session ? (
        <section id="api" className="account-panel"><AccountSignIn db={db} initialNotice={signInNotice} /></section>
      ) : (
        <>
          <section id="api" className="account-panel">
            {connectionRead === "succeeded" && connections.some(c => c.provider === "openai" || c.provider === "google") ? <><h2>You&apos;re ready.</h2><a className="primary-button inline-link" href="/studio">Start creating</a></> : <>
              <h2>1. Open OpenAI</h2>
              <a className="neutral-button inline-link" href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">Open OpenAI</a>
              <p>Sign in. Then tap &apos;Create new secret key&apos;.</p>
              <h2>2. Add credit</h2>
              <a className="neutral-button inline-link" href="https://platform.openai.com/settings/organization/billing" target="_blank" rel="noopener noreferrer">Add credit</a>
              <p>Add $5. It pays for your images.</p>
              <h2>3. Paste your key</h2><p>It starts with sk-</p>
              <form className="account-form key-form" onSubmit={e => { e.preventDefault();
                const submitted = key.trim();
                if (!submitted.startsWith("sk-") || submitted.length <= 3) { setKeyError("That doesn't look like a key. It starts with sk-."); return; }
                setKeyError(""); void action(async () => {
                await api("/api/providers", "POST", { provider: "openai", key: submitted });
                setKey(""); await refresh(); setSaved(true);
              }); }}>
                <label>Key<input type="password" autoComplete="off" spellCheck={false} required value={key} aria-invalid={!!keyError} aria-describedby={keyError ? "key-error" : undefined} onChange={e => { setKey(e.target.value); setKeyError(""); }} /></label>
                {keyError && <p id="key-error" className="account-inline-error" role="alert">{keyError}</p>}
                <p>We keep it private. You can remove it anytime.</p>
                <button type="submit" className="primary-button" disabled={busy || !config?.secureConnections}>{busy ? "Saving…" : "Save"}</button>
              </form>
              {!config?.secureConnections && <p>Saving is not available here yet.</p>}
            </>}
            {connectionRead === "failed" && <button type="button" className="neutral-button" disabled={busy} onClick={() => void action(refresh)}>Try again</button>}
            {/* copy-law: advanced */}<details><summary>Use a different AI</summary>
              <form className="account-form" onSubmit={e => { e.preventDefault(); void action(async () => {
                const submitted = key; setKey(""); await api("/api/providers", "POST", { provider, key: submitted }); await refresh(); setNotice("Key saved.");
              }); }}>
                <label>Choose AI<select value={provider} onChange={e => {setProvider(e.target.value); setKey("");}}><option value="openai">OpenAI</option><option value="google">Google</option><option value="anthropic">Claude</option><option value="jev">Jev</option><option value="youtube">YouTube</option></select></label>
                <label>Key<input type="password" autoComplete="off" required minLength={12} value={key} onChange={e => setKey(e.target.value)} /></label>
                <button type="submit" className="neutral-button" disabled={busy || !config?.secureConnections}>Save</button>
              </form>
            </details>
            {/* copy-law: end */}
            {connections.map(c => <div className="grant-row" key={c.provider}><span>{c.provider} · ••••{c.suffix}</span><button type="button" className="neutral-button" disabled={busy} onClick={() => void action(async () => { await api("/api/providers", "DELETE", {provider:c.provider}); await refresh(); setSaved(false); })}>Remove</button></div>)}
          </section>
          {/* copy-law: advanced */}
          <details><summary>For developers</summary>
          <ModelsPanel api={api} connected={{ openai: connections.some((c) => c.provider === "openai"), google: connections.some((c) => c.provider === "google"), anthropic: connections.some((c) => c.provider === "anthropic"), jev: connections.some((c) => c.provider === "jev") }} />
          <section id="higgsfield" className="account-panel">
            <h2>Higgsfield</h2>
            <p>Connect your own Higgsfield account through its secure sign-in page. Tokens stay encrypted. Generating through MCP uses your Higgsfield credits, including on Unlimited plans.</p>
            <p role="status">{!config?.higgsfield ? "Higgsfield connection is awaiting activation." : connectionRead === "loading" ? "Checking Higgsfield connection…" : connectionRead === "failed" ? "Higgsfield status unavailable." : higgsfield ? "Higgsfield is connected." : "Higgsfield is not connected."}</p>
            <div className="connection-actions">
              <button type="button" className={higgsfield ? "neutral-button" : "primary-button"} disabled={busy || connectionRead !== "succeeded" || !config?.secureConnections || !config?.higgsfield} onClick={() => void action(async () => {
                const result = await api("/api/connections/higgsfield", "POST", { action: "start" });
                location.assign(result.authorizationUrl);
              })}>{higgsfield ? "Reconnect Higgsfield" : "Connect Higgsfield"}</button>
              {higgsfield && connectionRead === "succeeded" && <>
                <button type="button" className="neutral-button" disabled={busy} onClick={() => void action(async () => {
                  const result = await api("/api/connections/higgsfield?check=true"); setHiggsfieldTools(result.tools.map((tool: { name: string }) => tool.name));
                  setNotice("Higgsfield connection checked. No generation was requested.");
                })}>Check Higgsfield connection</button>
                <button type="button" className="neutral-button" disabled={busy} onClick={() => void action(async () => {
                  await api("/api/connections/higgsfield", "DELETE"); setHiggsfieldTools([]); await refresh();
                  setNotice("Higgsfield disconnected from OpenPikzels. You can also revoke access in Higgsfield settings.");
                })}>Disconnect Higgsfield</button>
              </>}
            </div>
            {higgsfieldTools.length > 0 && <details><summary>Available Higgsfield tools ({higgsfieldTools.length})</summary><ul>{higgsfieldTools.map(name => <li key={name}>{name}</li>)}</ul></details>}
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
            <button type="button"
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
            <button type="button"
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
              Other clients receive the same tools and text results. <a href="/local-companion">Explore the local companion</a> for use with an official CLI.
            </p>
          </section>
          <section id="agents" className="account-panel">
            <h2>Connected agents</h2>
            {connectionRead === "loading" ? <p role="status">Loading connected agents…</p> : connectionRead === "failed" ? <p>Connected agents could not be loaded. Refresh connections to check.</p> : !grants.some(g => !g.revoked_at) && !showRevoked ? (
              <p>No agents connected yet.</p>
            ) : (
              grants.filter(g => !g.revoked_at || showRevoked).map((g) => (
                <div className="grant-row" key={g.id}>
                  <div>
                    <strong>{g.client_name}</strong>
                    <p>{!g.revoked_at && localAgentLinked([g]) ? "Local agent linked" : g.scope.join(" · ")}</p>
                  </div>
                  <button type="button"
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
            {grants.some(g => g.revoked_at) && <button type="button" className="neutral-button" onClick={() => setShowRevoked(!showRevoked)}>{showRevoked ? "Hide revoked" : `Show revoked (${grants.filter(g => g.revoked_at).length})`}</button>}
          </section>
          <CodexConnection key={session.user.id} signedIn enabled={!!config?.codexDevice} api={api} />
          </details>
          {/* copy-law: end */}
          <section className="account-panel"><h2>Account</h2><p>{session.user.email}</p><button type="button" className="neutral-button" onClick={() => void db.auth.signOut({ scope: "local" })}>Sign out</button></section>
        </>
      )}
      {error && (
        <p className="dialog-error" role="alert">
          {error}
        </p>
      )}
      <p role="status">{notice}</p>
      <a className="account-help" href="mailto:derrickserna.ca@gmail.com">Need help? Email us</a>
    </main>
  );
}
