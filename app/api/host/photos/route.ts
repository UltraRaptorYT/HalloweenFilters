import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const bucket = "halloween-photos";

function passcodeMatches(candidate: unknown) {
  const passcode = process.env.NEXT_PUBLIC_PASSCODE;
  if (typeof candidate !== "string" || !passcode) return false;
  const candidateBytes = Buffer.from(candidate);
  const passcodeBytes = Buffer.from(passcode);
  return candidateBytes.length === passcodeBytes.length && timingSafeEqual(candidateBytes, passcodeBytes);
}

async function getHostContext(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) return { response: Response.json({ error: "Photo storage is not configured." }, { status: 503 }) };
  const passcode = process.env.NEXT_PUBLIC_PASSCODE;
  if (!passcode) return { response: Response.json({ error: "Set NEXT_PUBLIC_PASSCODE in the server environment." }, { status: 503 }) };

  let body: { passcode?: unknown; photoId?: unknown };
  try {
    body = await request.json();
  } catch {
    return { response: Response.json({ error: "Enter the host passcode." }, { status: 400 }) };
  }
  if (!passcodeMatches(body.passcode)) return { response: Response.json({ error: "That passcode is not correct." }, { status: 401 }) };

  const supabase = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { supabase, body };
}

export async function POST(request: Request) {
  const context = await getHostContext(request);
  if ("response" in context) return context.response;
  const [{ data, error }, { data: signups, error: signupError }] = await Promise.all([
    context.supabase.from("photo_shares").select("id,share_url,created_at").order("created_at", { ascending: false }),
    context.supabase.from("photo_email_signups").select("email,created_at").order("created_at", { ascending: false }),
  ]);
  if (error) return Response.json({ error: `Could not load shared photos: ${error.message}` }, { status: 502 });
  if (signupError) return Response.json({ error: "Could not load email signups. Apply the latest Supabase migration and try again." }, { status: 502 });
  const uniqueSignups = Array.from(new Map((signups ?? []).map((signup) => [signup.email, signup])).values());
  return Response.json({ photos: data ?? [], signups: uniqueSignups }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const context = await getHostContext(request);
  if ("response" in context) return context.response;
  const { photoId } = context.body;
  if (typeof photoId !== "string" || !/^[0-9a-f-]{36}$/i.test(photoId)) {
    return Response.json({ error: "Select a photo to delete." }, { status: 400 });
  }
  const { data: photo, error: lookupError } = await context.supabase.from("photo_shares").select("photo_path,qr_path").eq("id", photoId).maybeSingle();
  if (lookupError || !photo) return Response.json({ error: "Photo not found." }, { status: 404 });
  const removed = await context.supabase.storage.from(bucket).remove([photo.photo_path, photo.qr_path]);
  if (removed.error) return Response.json({ error: `Could not remove photo files: ${removed.error.message}` }, { status: 502 });
  const { error } = await context.supabase.from("photo_shares").delete().eq("id", photoId);
  if (error) return Response.json({ error: `Could not remove photo record: ${error.message}` }, { status: 502 });
  return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
}
