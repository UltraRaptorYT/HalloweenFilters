import { createClient } from "@supabase/supabase-js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const consentText = "I agree to receive event follow-up and occasional news, offers, and updates from Afterglow by email.";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "This photo link is invalid." }, { status: 400 });

  let body: { email?: unknown; consent?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter an email address and choose whether to receive updates." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !emailPattern.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  if (body.consent !== true) return Response.json({ error: "Email updates require your consent." }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) return Response.json({ error: "Email signup is not configured." }, { status: 503 });

  const supabase = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: photo, error: photoError } = await supabase.from("photo_shares").select("id").eq("id", id).maybeSingle();
  if (photoError) return Response.json({ error: "Could not verify the photo link." }, { status: 502 });
  if (!photo) return Response.json({ error: "This photo link has expired or was removed." }, { status: 404 });

  const { error } = await supabase.from("photo_email_signups").upsert(
    { photo_id: id, email, consent_text: consentText },
    { onConflict: "photo_id,email", ignoreDuplicates: true },
  );
  if (error) return Response.json({ error: "Could not save your email right now." }, { status: 502 });
  return Response.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
}
