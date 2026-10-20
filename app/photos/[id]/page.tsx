import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import Image from "next/image";
import EmailSignup from "./email-signup";

export default function SharedPhoto({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<main className="share-page-loading">Opening your photo…</main>}><SharedPhotoContent params={params} /></Suspense>;
}

async function SharedPhotoContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) notFound();

  const supabase = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: record } = await supabase.from("photo_shares").select("photo_path").eq("id", id).maybeSingle();
  if (!record) notFound();
  const { data: signedPhoto, error } = await supabase.storage.from("halloween-photos").createSignedUrl(record.photo_path, 60 * 60);
  if (error || !signedPhoto) notFound();

  return (
    <main className="share-page">
      <article className="share-page-card">
        <p className="share-page-brand">AFTERGLOW · HALLOWEEN PHOTO BOOTH</p>
        {/* This image is served from a short-lived signed URL for the private storage bucket. */}
        <Image className="share-page-photo" src={signedPhoto.signedUrl} width={820} height={1000} unoptimized alt="Shared Halloween photo" />
        <a className="share-page-download" href={signedPhoto.signedUrl} download={`afterglow-${id}.png`}>DOWNLOAD PHOTO</a>
        <EmailSignup photoId={id} />
      </article>
    </main>
  );
}
