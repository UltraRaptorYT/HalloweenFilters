"use client";

import { FormEvent, useState } from "react";

export default function EmailSignup({ photoId }: { photoId: string }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent) {
      setMessage("Please check the box if you want to receive email updates.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/photos/${photoId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save your email.");
      setSaved(true);
      setMessage("You’re signed up for Afterglow event follow-up and occasional updates.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your email.");
    } finally {
      setSaving(false);
    }
  }

  return <form className="email-signup" onSubmit={(event) => void submit(event)}>
    <p className="email-signup-eyebrow">STAY IN THE LOOP</p>
    <h2>Get occasional email updates</h2>
    <p className="email-signup-copy">Get follow-up from this event and occasional news, offers, and updates about future Afterglow experiences.</p>
    <label className="email-signup-label" htmlFor="share-email">Email address</label>
    <input id="share-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} disabled={saved} placeholder="you@example.com" />
    <label className="email-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={saved} /><span>I agree to receive event follow-up and occasional news, offers, and updates from Afterglow by email.</span></label>
    <button type="submit" disabled={saving || saved}>{saved ? "SIGNED UP" : saving ? "SAVING…" : "SIGN ME UP"}</button>
    {message && <p className="email-signup-message" role="status">{message}</p>}
  </form>;
}
