"use client";
import { useEffect, useLayoutEffect, useId, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createOtpScheduler } from "@/lib/otp-code";

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
  const verifyRef = useRef<(code: string) => void>(() => {});
  const scheduler = useRef<ReturnType<typeof createOtpScheduler> | null>(null);
  if (!scheduler.current) scheduler.current = createOtpScheduler(value => verifyRef.current(value));
  useEffect(() => () => scheduler.current?.cancel(), []);
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
    scheduler.current?.cancel();
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
          showCode("Too many emails. Wait a minute and try again.");
        } else {
          setStatus("Email not sent. Check your connection and try again.");
        }
        return;
      }
      setRetryAt(Date.now() + 60_000);
      setRemaining(60);
      setCode("");
      showCode("");
    } catch {
      setAuthError(true);
      setStatus("Email not sent. Check your connection and try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function verify(submittedCode = code) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setStatus("");
    setAuthError(false);
    try {
      const result = step === "code"
        ? await db.auth.verifyOtp({ email: email.trim(), token: submittedCode, type: "email" })
        : mode === "signup"
          ? await db.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: location.origin + "/connect" } })
          : await db.auth.signInWithPassword({ email: email.trim(), password });
      setPassword("");
      if (result.error) {
        setAuthError(true);
        setStatus(step === "code"
          ? "That code did not work. Try the newest code."
          : mode === "signup"
            ? "Could not create your account. Check your details."
            : "Sign-in failed. Check your email and password.");
        if (step === "code") nextFocus.current = "code";
      } else if (result.data.session) {
        setCode("");
        onSignedIn?.();
      } else {
        setStatus("Check your email to confirm your account. Then come back here to sign in.");
      }
    } catch {
      setPassword("");
      setAuthError(true);
      setStatus("Sign-in failed. Check your connection and try again.");
      if (step === "code") nextFocus.current = "code";
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  verifyRef.current = value => { void verify(value); };
  const sending = step === "entry" && mode === "email";
  const sendLabel = "Send code";
  return (
    <form className="account-form signin-form" aria-busy={busy} onPaste={e => {
      if (step !== "code" || pending.current) return;
      const value = e.clipboardData.getData("text").replace(/\D/g, "");
      if (!/^(?:\d{6}|\d{8})$/.test(value)) return;
      e.preventDefault(); setCode(scheduler.current!.input(value, true)); setAuthError(false);
    }} onSubmit={e => {
      e.preventDefault();
      scheduler.current?.cancel();
      void (sending ? sendEmail() : verify());
    }}>
      <h2>{step === "code" ? "Check your email" : mode === "signup" ? "Create your free account" : "Sign in to OpenPikzels"}</h2>
      {step === "entry" ? <p>Enter your email to sign in or create an account.</p> : <p>Check your email for a 6- or 8-digit code.</p>}
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
      {step === "entry" && <p id={statusId} role="status" className={authError ? "account-inline-error" : "signin-status"}>{status}</p>}
      {step === "code" && <label>Email sign-in code
        <input ref={codeInput} aria-describedby={status ? statusId : undefined} aria-invalid={authError || undefined}
          inputMode="numeric" autoComplete="one-time-code" pattern="([0-9]{6}|[0-9]{8})" minLength={6} maxLength={8}
          required disabled={busy} autoFocus value={code} onChange={e => { setCode(scheduler.current!.input(e.target.value, false)); setAuthError(false); }} />
      </label>}
      {step === "code" && <p id={statusId} role="status" className={authError ? "account-inline-error" : "signin-status"}>{status}</p>}
      <button type="submit" className="primary-button" disabled={busy || (sending && remaining > 0)}>
        {busy ? sending ? "Sending email…" : step === "code" ? "Verifying…" : "Signing in…"
          : sending ? remaining > 0 ? "Wait briefly" : sendLabel
          : step === "code" ? "Sign in" : mode === "signup" ? "Create account" : "Use password"}
      </button>
      {step === "code" && <>
        {remaining > 0 ? <p>Send again in {remaining}s</p> :
          <><p role="status">You can send again.</p><button type="button" className="neutral-button" disabled={busy} onClick={() => void sendEmail()}>Send again</button></>}
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
