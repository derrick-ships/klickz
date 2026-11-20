"use client";
import { useEffect, useLayoutEffect, useId, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export function AccountSignIn({
  db, onSignedIn, showEmailLinkHint = true, initialNotice = "",
}: {
  db: SupabaseClient;
  onSignedIn?: () => void;
  showEmailLinkHint?: boolean;
  initialNotice?: string;
}) {
  const statusId = useId();
  const emailInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const nextFocus = useRef<"email" | "code" | null>(null);
  const [mode, setMode] = useState<"email" | "password" | "signup">("email");
  const [step, setStep] = useState<"entry" | "code">("entry");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState(initialNotice);
  const [authError, setAuthError] = useState(!!initialNotice);
  const [busy, setBusy] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!retryAt) return;
    const update = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  useLayoutEffect(() => {
    const target = nextFocus.current;
    nextFocus.current = null;
    if (target === "email") emailInput.current?.focus();
    if (target === "code") codeInput.current?.focus();
  });

  function showCode(message: string) {
    nextFocus.current = "code";
    setStep("code");
    setPassword("");
    setStatus(message);
  }
  function changeMode(next: typeof mode) {
    nextFocus.current = "email";
    setMode(next);
    setStep("entry");
    setPassword("");
    setCode("");
    setStatus("");
    setAuthError(false);
  }
  async function sendEmail() {
    if (pending.current || Date.now() < retryAt || !emailInput.current?.reportValidity()) return;
    pending.current = true;
    setBusy(true);
    setStatus("");
    setAuthError(false);
    setPassword("");
    try {
      const { error } = await db.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: location.origin + "/connect" },
      });
      if (error) {
        setAuthError(true);
        if (error.status === 429) {
          setRetryAt(Date.now() + 60_000);
          setRemaining(60);
          showCode("The sign-in email limit has been reached. Use a link or code you already received, or wait before requesting another email.");
        } else {
          setStatus("Could not send the sign-in email. Check your connection and try again. You can still use a code you already received or sign in with your password.");
        }
        return;
      }
      setRetryAt(Date.now() + 60_000);
      setRemaining(60);
      setCode("");
      showCode("");
    } catch {
      setAuthError(true);
      setStatus("Could not send the sign-in email. Check your connection and try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function verify() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setStatus("");
    setAuthError(false);
    try {
      const result = step === "code"
        ? await db.auth.verifyOtp({ email: email.trim(), token: code, type: "email" })
        : mode === "signup"
          ? await db.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: location.origin + "/connect" } })
          : await db.auth.signInWithPassword({ email: email.trim(), password });
      setPassword("");
      if (result.error) {
        setAuthError(true);
        setStatus(step === "code"
          ? "That code could not be verified. Check the digits, or request a new email if it expired. Use only the newest link or code."
          : mode === "signup"
            ? "Could not create the account. Check your details, or use an email sign-in link."
            : "Sign-in failed. Check your email and password. Your password was cleared; enter it again, or use an email sign-in link.");
        if (step === "code") codeInput.current?.focus();
      } else if (result.data.session) {
        setCode("");
        onSignedIn?.();
      } else {
        setStatus("Check your email to confirm your account. Then come back here to sign in.");
      }
    } catch {
      setPassword("");
      setAuthError(true);
      setStatus("Could not complete sign-in. Check your connection and try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const sending = step === "entry" && mode === "email";
  const sendLabel = "Send code";
  return (
    <form className="account-form signin-form" aria-busy={busy} onSubmit={e => {
      e.preventDefault();
      void (sending ? sendEmail() : verify());
    }}>
      <h2>{step === "code" ? "Check your email" : mode === "signup" ? "Create your free account" : "Sign in to OpenPikzels"}</h2>
      {step === "entry" && <p>Enter your email to sign in or create an account.</p>}
      <label hidden={step === "code"}>Email
        <input ref={emailInput} type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false}
          readOnly={step === "code"} disabled={busy} aria-describedby={status ? statusId : undefined}
          value={email} onChange={e => { setEmail(e.target.value); setAuthError(false); setStatus(""); }} />
      </label>
      {step === "entry" && mode !== "email" && <label>
        Password{mode === "signup" ? " (at least 8 characters)" : ""}
        <input type="password" minLength={mode === "signup" ? 8 : undefined} required disabled={busy}
          autoComplete={mode === "signup" ? "new-password" : "current-password"} aria-describedby={status ? statusId : undefined}
          value={password} onChange={e => setPassword(e.target.value)} />
      </label>}
      <p id={statusId} role="status" className={authError ? "account-inline-error" : "signin-status"}>{status}</p>
      {step === "code" && <label>Email sign-in code
        <input ref={codeInput} aria-describedby={status ? statusId : undefined} aria-invalid={authError || undefined}
          inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8}
          required disabled={busy} value={code} onChange={e => { setCode(e.target.value.replace(/[^0-9]/g, "")); setAuthError(false); }} />
      </label>}
      <button type="submit" className="primary-button" disabled={busy || (sending && remaining > 0)}>
        {busy ? sending ? "Sending email…" : step === "code" ? "Verifying…" : "Signing in…"
          : sending ? remaining > 0 ? "Request another email shortly" : sendLabel
          : step === "code" ? "Sign in" : mode === "signup" ? "Create account" : "Sign in with password"}
      </button>
      {step === "code" && <>
        <button type="button" className="neutral-button" disabled={busy || remaining > 0} onClick={() => void sendEmail()}>
          {remaining > 0 ? "Send again in " + remaining + "s" : "Send again"}
        </button>
        <button type="button" className="neutral-button" disabled={busy} onClick={() => changeMode("email")}>Change email</button>
      </>}
      {/* copy-law: advanced */}
      <details className="signin-alternatives"><summary>More options</summary>
      <button type="button" className="quiet-button" disabled={busy} onClick={() => changeMode(mode === "email" || step === "code" ? "password" : "email")}>
        {mode === "email" || step === "code" ? "Use password instead" : showEmailLinkHint ? "Use an email link instead" : "Use an email code instead"}
      </button>
      {step === "entry" && mode === "email" && <button type="button" className="quiet-button" disabled={busy} onClick={() => {
        if (!emailInput.current?.checkValidity()){setAuthError(true);setStatus("Enter your email address first so we can verify the code for the right account.");emailInput.current?.focus();return;}
        setAuthError(false);
        showCode("Enter the code from your latest sign-in email. This does not send another email.");
      }}>I already have a code</button>}
      {step === "entry" && mode !== "email" && <button type="button" className="quiet-button" disabled={busy} onClick={() => changeMode(mode === "signup" ? "password" : "signup")}>
        {mode === "signup" ? "Already have an account? Sign in" : "Create an account with a password"}
      </button>}
      </details>
      {/* copy-law: end */}
      {step === "entry" && remaining > 0 && <p>Wait {remaining}s before trying again.</p>}
    </form>
  );
}
