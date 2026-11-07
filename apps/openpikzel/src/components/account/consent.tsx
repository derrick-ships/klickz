"use client";
import { useEffect, useState } from "react";
import { AccountSignIn, useAccount } from "./account";
export function Consent() {
  const { db, session, error, setError, ready } = useAccount(true);
  const [request, setRequest] = useState(""),
    [details, setDetails] = useState<{
      name: string;
      redirect: string;
      scope: string[];
    } | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const token = new URLSearchParams(location.search).get("request") || "";
    setRequest(token);
    void fetch("/api/oauth/consent?request=" + encodeURIComponent(token))
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setDetails(data);
      })
      .catch((e) => setError(e.message));
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
      setError(e instanceof Error ? e.message : "Consent could not complete.");
      setBusy(false);
    }
  }
  return (
    <main className="consent-page">
      <a href="/" className="brand">
        OpenPikzels<span className="wordmark-pixel" aria-hidden="true" />
      </a>
      <section className="account-panel">
        <h1>Allow {details?.name || "this client"} to use your studio?</h1>
        <p>
          This third-party client name is supplied by its developer. Approve
          only if you started this connection and trust the application.
        </p>
        {details && (
          <>
            <dl className="consent-details">
              <dt>Redirect destination</dt>
              <dd>{new URL(details.redirect).origin}</dd>
            </dl>
            <ul className="consent-permissions">
              {details.scope.map((scope) => (
                <li key={scope}>
                  <strong>
                    {scope === "studio:read"
                      ? "Read your workspace"
                      : scope === "studio:write"
                        ? "Save and edit your work"
                        : "Use your connected AI providers"}
                  </strong>
                  <p>
                    {scope === "studio:read"
                      ? "Access your thumbnails, scores, persona pictures and style references."
                      : scope === "studio:write"
                        ? "Upload references, create profiles, save scores and resize thumbnails. Originals are preserved."
                        : "Generate images, suggest titles, score and fix thumbnails using credits on your own API accounts."}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
        <p>
          API keys stay private. You can revoke this connection in Settings at
          any time. Access expires after 30 days.
        </p>
        {!ready ? (
          <p>Loading your account…</p>
        ) : !session && db ? (
          <>
            <p>
              Sign in here to create a separate session for this agent. Your
              studio session stays independent.
            </p>
            <AccountSignIn db={db} />
          </>
        ) : session ? (
          <p className="signed-in">Signed in as {session.user.email}</p>
        ) : (
          <p>Cloud sign-in is awaiting setup.</p>
        )}
        <div className="consent-actions">
          <button
            className="neutral-button"
            disabled={busy || !details}
            onClick={() => void decide("deny")}
          >
            Deny
          </button>
          <button
            className="primary-button"
            disabled={busy || !details || !session}
            onClick={() => void decide("allow")}
          >
            {busy ? "Connecting…" : "Allow access"}
          </button>
        </div>
        {error && (
          <p role="alert" className="dialog-error">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
