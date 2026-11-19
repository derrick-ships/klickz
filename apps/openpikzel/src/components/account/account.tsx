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

const providerGuides: Record<string, {name:string; purpose:string; url:string; steps:string[]}> = {
  openai: {name:"OpenAI",purpose:"Create images and title ideas.",url:"https://developers.openai.com/api/docs/quickstart",steps:["Open OpenAI’s official setup guide and sign in to your own API account.","Create an API key in the provider dashboard and review the account’s usage and billing settings.","Copy the key into the private field below, then connect it."]},
  google: {name:"Google",purpose:"Create images and title ideas with Gemini.",url:"https://ai.google.dev/gemini-api/docs/api-key",steps:["Open Google’s official API-key guide and sign in to Google AI Studio.","Choose your own project, create a Gemini API key and check its quota and billing settings.","Copy the key into the private field below, then connect it."]},
  jev: {name:"Jev AI",purpose:"Assess a thumbnail and its title across five creative pillars.",url:"https://docs.typesafe.ai/introduction/quickstart",steps:["Open the official TypeSafe guide for Jev and sign in to its console.","Create an API key in your own account and review its available usage.","Copy the key into the private field below, then connect it."]},
  youtube: {name:"YouTube",purpose:"Find channel details and thumbnail references. This does not generate images.",url:"https://developers.google.com/youtube/data/getting-started",steps:["Open the official YouTube Data API guide and choose your own Google Cloud project.","Enable YouTube Data API v3, create an API key and review its restrictions and quota.","Copy the key into the private field below, then connect it."]},
  anthropic: {name:"Claude",purpose:"Review images. Preferred when connected.",url:"https://docs.anthropic.com/en/api/getting-started",steps:["Open Anthropic’s official API guide and sign in to your own Claude API account.","Create an API key in the provider console and review the account’s usage and billing settings.","Copy the key into the private field below, then connect it."]}
};

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
  const [higgsfield, setHiggsfield] = useState(false), [higgsfieldTools, setHiggsfieldTools] = useState<string[]>([]);
  const [connectionRead, setConnectionRead] = useState<"loading" | "succeeded" | "failed">("loading");
  const connectionEpoch = useRef(0), connectionOwner = useRef("");
  connectionOwner.current = session?.user.id || "";
  const guide = providerGuides[provider];
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
      <div className="account-intro">
        <h1>{session ? "Connect your AI" : "Your studio starts here"}</h1>
        <p>
          {session ? "Connect the provider for the job you want to do. Image generation and analysis use your provider account; usage charges may apply." : "Sign in with your email. It’s free, and your thumbnails, faces and styles stay saved."}
        </p>
      </div>
      {session && <nav className="connections-index" aria-label="Connections sections"><a href="#api">API keys</a> · <a href="#models">Models</a> · <a href="#higgsfield">Higgsfield</a> · <a href="#mcp">Connect agent</a> · <a href="#agents">Connected agents</a> · <a href="#chatgpt">ChatGPT</a></nav>}
      {!ready ? (
        <p role="status">Loading your connections…</p>
      ) : !db ? (
        <p>
          Cloud sign-in is not available here yet.{" "}
          <a href="/studio">Save drafts in this browser.</a>
        </p>
      ) : !session ? (
        <section id="api" className="account-panel"><AccountSignIn db={db} initialNotice={signInNotice} /><p className="account-next" id="chatgpt"><span id="mcp"/>After you sign in, you’ll connect your AI account here. Then you can also use OpenPikzels from ChatGPT or Claude.</p></section>
      ) : (
        <>
          <section id="api" className="account-panel">
            <h2>Connect an API provider</h2>
            {connectionRead === "failed" && <div role="status"><p>Connection status unavailable. Refresh to check.</p><button type="button" className="neutral-button" disabled={busy} onClick={() => void action(refresh)}>Refresh connections</button></div>}

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
                  <option value="anthropic">Claude</option>
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
                  aria-describedby="provider-purpose provider-key-help provider-key-cost"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={connections.some((c) => c.provider === provider) ? "Leave empty to keep current key" : "Paste your key securely"}
                />
              </label>
              <div className="provider-key-guide" key={provider}>
                <p id="provider-purpose"><strong>{guide.name}</strong> — {guide.purpose}</p>
                <details><summary>How to get {provider === "openai" ? "an" : "a"} {guide.name} key</summary><p>An API key is private. It is not your password; keep it out of chat.</p><ol>{guide.steps.map(step => <li key={step}>{step}</li>)}</ol><a href={guide.url} target="_blank" rel="noopener noreferrer">Open {guide.name}’s official setup guide (new tab)</a></details>
                <p id="provider-key-cost">Provider usage may cost money. Check billing before generating. Saving a key makes no billable test request.</p>
              </div>
              <p id="provider-key-help">Your key is encrypted for your account and used on the server. Its full value is never shown again. Leave empty to keep current key; paste a new key to replace it.</p>
              <button type="submit"
                className="primary-button"
                disabled={busy || !config?.secureConnections}
              >
                {busy ? "Saving…" : connections.some((c) => c.provider === provider) ? "Save connection" : "Connect key"}
              </button>
            </form>
            <div className="provider-grid">
              {[
                ["openai", "OpenAI", "Sunburst / Flare, titles and vision"],
                ["anthropic", "Claude", "image review (preferred when connected)"],
                ["google", "Google", "Gemini image models, titles and vision"],
                ["jev", "Jev AI", "Image + title scores across five pillars"],
                ["youtube", "YouTube", "Channel metadata and thumbnail references · your own Data API key"],
              ].map(([id, name, detail]) => {
                const c = connections.find((x) => x.provider === id);
                return (
                  <article key={id}>
                    <h3>{name}</h3>
                    <p>{detail}</p>
                    <strong className={connectionRead === "succeeded" && c ? "connection-saved" : "connection-muted"}>
                      {connectionRead === "loading" ? "Checking connections…" : connectionRead === "failed" ? "Status unavailable" : c
                        ? "Key saved · ••••" + c.suffix
                        : "Not connected"}
                    </strong>
                    {c && connectionRead === "succeeded" && (
                      <button type="button"
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
              on the server. We show only the last four characters. API access
              and allowances depend on your provider account; check its current
              terms. Connecting a key makes no billable test request.
            </p>
            <a className="neutral-button inline-link" href="/studio">
              Open studio
            </a>
          </section>
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
          <section className="account-panel"><h2>Account</h2><p>{session.user.email}</p><button type="button" className="neutral-button" onClick={() => void db.auth.signOut({ scope: "local" })}>Sign out</button></section>
        </>
      )}
      {session && <CodexConnection key={session.user.id} signedIn enabled={!!config?.codexDevice} api={api} />}
      {error && (
        <p className="dialog-error" role="alert">
          {error}
        </p>
      )}
      <p role="status">{notice}</p>
    </main>
  );
}
