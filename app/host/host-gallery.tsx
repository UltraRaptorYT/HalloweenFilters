"use client";

import { useState } from "react";
import Link from "next/link";

type Photo = { id: string; share_url: string; created_at: string };
type Signup = { email: string; created_at: string };

export default function HostGallery() {
  const [passcode, setPasscode] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  async function loadPhotos() {
    if (!passcode.trim()) {
      setMessage("Enter the host passcode.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/host/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load shared photos.");
      setPhotos(result.photos);
      setSignups(result.signups ?? []);
      setAuthorized(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load shared photos.");
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  }

  async function deletePhoto(photoId: string) {
    if (!window.confirm("Delete this photo and its QR link?")) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/host/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, photoId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not delete photo.");
      setPhotos((current) => current.filter((photo) => photo.id !== photoId));
      setMessage("Photo and QR link deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete photo.");
    } finally {
      setLoading(false);
    }
  }

  function downloadSignups() {
    const quote = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
    const csv = ["email,consented_at", ...signups.map((signup) => `${quote(signup.email)},${quote(signup.created_at)}`)].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "afterglow-email-signups.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="host-page">
      <header className="host-topbar"><Link href="/" className="host-wordmark">AFTERGLOW</Link><span>PHOTO CONTROLS</span></header>
      <section className="host-content">
        <p className="host-eyebrow">HOST ACCESS</p>
        <h1>{authorized ? "Shared photos" : "Manage photos"}</h1>
        <p className="host-intro">Enter the global host passcode to review shared photos and remove any that should no longer be available.</p>
        <form className="host-access-form" onSubmit={(event) => { event.preventDefault(); void loadPhotos(); }}>
          <label htmlFor="host-passcode">Host passcode</label>
          <div className="host-access-row">
            <input id="host-passcode" type="password" autoComplete="current-password" value={passcode} onChange={(event) => setPasscode(event.target.value)} placeholder="Passcode" />
            <button type="submit" disabled={loading}>{loading ? "PLEASE WAIT" : authorized ? "REFRESH" : "OPEN GALLERY"}</button>
          </div>
        </form>
        {message && <p className="host-message" role="status">{message}</p>}
        {authorized && <div className="host-gallery-heading"><h2>Shared photos</h2><span>{photos.length} {photos.length === 1 ? "PHOTO" : "PHOTOS"}</span></div>}
        {authorized && photos.length === 0 && <div className="host-empty">No photos have been shared yet.</div>}
        {authorized && photos.length > 0 && <ul className="host-photo-list">{photos.map((photo) => <li key={photo.id}>
          <div><strong>{new Date(photo.created_at).toLocaleString()}</strong><a href={photo.share_url} target="_blank" rel="noreferrer">OPEN SHARE PAGE ↗</a></div>
          <button className="host-delete" disabled={loading} onClick={() => void deletePhoto(photo.id)}>DELETE</button>
        </li>)}</ul>}
        {authorized && <section className="host-signups">
          <div className="host-gallery-heading"><h2>Email signups</h2><span>{signups.length} {signups.length === 1 ? "SIGNUP" : "SIGNUPS"}</span></div>
          <p className="host-signups-note">Guests who checked the consent box on a shared photo page.</p>
          {signups.length > 0 ? <><ul className="host-signup-list">{signups.map((signup) => <li key={`${signup.email}-${signup.created_at}`}><span>{signup.email}</span><time dateTime={signup.created_at}>{new Date(signup.created_at).toLocaleString()}</time></li>)}</ul><button className="host-export" onClick={downloadSignups}>DOWNLOAD EMAILS CSV</button></> : <div className="host-empty">No one has opted in yet.</div>}
        </section>}
        <Link href="/" className="host-back">← RETURN TO THE BOOTH</Link>
      </section>
    </main>
  );
}
