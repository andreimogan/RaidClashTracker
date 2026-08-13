"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { signIn, type SignInState } from "./actions";

// Form-field convention from docs/reference/design-system.md.
const INPUT_CLS =
  "w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-gold/50";

const INITIAL: SignInState = { error: null };

export function LoginForm() {
  // useActionState keeps the failure message in place instead of bouncing it
  // through a query string, and hands back the pending flag for the spinner
  // (01-getting-started/07-mutating-data.md, "Showing a pending state").
  const [state, action, pending] = useActionState(signIn, INITIAL);

  // The email field is CONTROLLED on purpose, and the password deliberately is
  // not. React 19 requests a form reset as part of every action transition —
  // startHostTransition calls requestFormReset unconditionally before invoking
  // the action (node_modules/react-dom/cjs/react-dom-client.development.js,
  // `startHostTransition`) — so an uncontrolled input goes blank on a failed
  // attempt: a password manager won't refill without a page load, and the owner
  // retypes their address on every try, walking towards the rate limit. State
  // survives the reset because React re-renders the value from it.
  const [email, setEmail] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const wasPending = useRef(false);

  // Focus follows the failure. `disabled={pending}` makes the browser blur
  // whichever control was focused at submit time, so without this the caret
  // lands on <body> and a keyboard user is returned to the top of the document
  // with the error announced but nothing focused. Keyed on the pending edge
  // rather than on the message, so a second identical failure re-focuses too.
  useEffect(() => {
    if (wasPending.current && !pending && state.error) emailRef.current?.focus();
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form action={action} aria-busy={pending} className="mt-5 flex max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="stat-label">Email</span>
        <input
          ref={emailRef}
          name="email"
          type="email"
          autoComplete="username"
          required
          // This page is one form, and the field is otherwise the ninth
          // focusable element on it (sidebar, nav, the back link).
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          className={INPUT_CLS}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="stat-label">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          className={INPUT_CLS}
        />
      </label>

      {state.error && (
        <p role="alert" className="whitespace-pre-line text-xs text-down">
          {state.error}
        </p>
      )}

      <div>
        <button type="submit" disabled={pending} className="btn-accent bg-gold">
          {pending ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </form>
  );
}
