"use client";
import { useEffect, useState } from "react";
import { AccountSignIn, useAccount } from "./account";
import { scopeCopy, type Scope } from "../../lib/oauth/scopes";
export function Consent() {
  const { db, session, error, setError, ready } = useAccount(true);
  const [request, setRequest] = useState(""),
    [details, setDetails] = useState<{
      name: string;
      redirect: string;
      scope: string[];
    } | null>(null),
    [busy, setBusy] = useState(false),
    [requestState, setRequestState] = useState<"loading" | "valid" | "invalid">("loading");
  useEffect(() => {
    const token = new URLSearchParams(location.search).get("request") || "";
    setRequest(token);
    if (!token) { setRequestState("invalid"); return; }
    void fetch("/api/oauth/consent?request=" + encodeURIComponent(token))
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setDetails(data);
        setRequestState("valid");
      })
      .catch(() => setRequestState("invalid"));
  }, []);
  async function decide(decision: "allow" | "deny") {
    setBusy(true);
    setError("");
    try {
      const fresh = await db?.auth.getSession(),
        s = fresh?.data.session;
      const result = await fetch("/api/oauth/consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(s ? { Authorization: `Bearer ${s.access_token}` } : {}),
        },
        body: JSON.stringify({
          request,
          decision,
          ...(s ? { refreshToken: s.refresh_token } : {}),
        }),
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error);
      if (decision === "deny" && db) await db.auth.signOut({ scope: "local" });
      location.assign(data.redirect);
    } catch (e) {
      setError("Could not connect. Please try again.");
      setBusy(false);
    }
  }
  return (
    <main className="consent-page">
      <a href="/studio" className="brand">
        OpenPikzels<span className="wordmark-pixel" aria-hidden="true" />
      </a>
      <section className="account-panel">
        {requestState === "loading" ? <p role="status">Checking connection request…</p> : requestState === "invalid" ? <><h1>This connection expired</h1><p role="alert">Start the connection again from your AI app.</p><a className="neutral-button inline-link" href="/connect">Back to connections</a></> : <>
        <h1>Let {details?.name || "this app"} use your OpenPikzels?</h1>
        {/* copy-law: advanced */}
        <details><summary>Details</summary><p>Only allow apps you trust.</p>
        {details && (
          <>
            <dl className="consent-details">
              <dt>Redirect destination</dt>
              <dd>{new URL(details.redirect).origin}</dd>
            </dl>
            <ul className="consent-permissions">
              {details.scope.map((scope) => (
                <li key={scope}>
                  <strong>{(scopeCopy[scope as Scope] || scopeCopy["studio:ai"]).heading}</strong>
                  <p>{(scopeCopy[scope as Scope] || scopeCopy["studio:ai"]).detail}</p>
                </li>
              ))}
            </ul>
          </>
        )}
        </details>
        {/* copy-law: end */}
        {!ready ? (
          <p>Loading your account…</p>
        ) : !session && db ? (
          <>
            <AccountSignIn db={db} showEmailLinkHint={false} />
          </>
        ) : session ? (
          <p className="signed-in">Signed in as {session.user.email}</p>
        ) : (
          <p>Cloud sign-in is awaiting setup.</p>
        )}
        <div className="consent-actions">
          <button type="button"
            className="neutral-button"
            disabled={busy || !details}
            onClick={() => void decide("deny")}
          >
            Deny
          </button>
          <button type="button"
            className="primary-button"
            disabled={busy || !details || !session}
            onClick={() => void decide("allow")}
          >
            {busy ? "Connecting…" : "Allow"}
          </button>
        </div>
        {error && (
          <p role="alert" className="dialog-error">
            {error}
          </p>
        )}
        </>}
      </section>
    </main>
  );
}
