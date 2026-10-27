import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

const bucket = "halloween-photos";
const maxPhotoBytes = 15 * 1024 * 1024;

function getTimestampedPhotoName(date = new Date()) {
  const timestamp = date.toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
  return `${timestamp}.png`;
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    return Response.json({ error: "Supabase photo storage is not configured. Add the URL and secret key to the server environment." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send a photo as multipart form data." }, { status: 400 });
  }
  const photo = form.get("photo");
  const requestedId = form.get("photoId");
  if (!(photo instanceof File) || photo.type !== "image/png" || photo.size === 0 || photo.size > maxPhotoBytes) {
    return Response.json({ error: "Choose a PNG photo smaller than 15 MB." }, { status: 400 });
  }
  if (requestedId !== null && (typeof requestedId !== "string" || !/^[0-9a-f-]{36}$/i.test(requestedId))) {
    return Response.json({ error: "Photo ID is invalid." }, { status: 400 });
  }

  const id = typeof requestedId === "string" ? requestedId : crypto.randomUUID();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const shareUrl = new URL(`/photos/${id}`, origin).toString();
  const supabase = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const photoPath = `${id}/${getTimestampedPhotoName()}`;
  const qrPath = `${id}/qr.png`;

  const { data: existing, error: existingError } = await supabase.from("photo_shares").select("id,share_url").eq("id", id).maybeSingle();
  if (existingError) return Response.json({ error: `Could not check photo status: ${existingError.message}` }, { status: 502 });
  if (existing) {
    const existingQr = await QRCode.toBuffer(existing.share_url, { type: "png", width: 560, margin: 2, errorCorrectionLevel: "M" });
    return Response.json({ id, shareUrl: existing.share_url, qrDataUrl: `data:image/png;base64,${existingQr.toString("base64")}` }, { headers: { "Cache-Control": "no-store" } });
  }

  const qrBytes = await QRCode.toBuffer(shareUrl, { type: "png", width: 560, margin: 2, errorCorrectionLevel: "M" });
  const photoUpload = await supabase.storage.from(bucket).upload(photoPath, await photo.arrayBuffer(), { contentType: "image/png", upsert: true });
  if (photoUpload.error) return Response.json({ error: `Could not save the photo: ${photoUpload.error.message}` }, { status: 502 });

  const { error: insertError } = await supabase.from("photo_shares").insert({ id, photo_path: photoPath, qr_path: qrPath, share_url: shareUrl });
  if (insertError) {
    await supabase.storage.from(bucket).remove([photoPath]);
    return Response.json({ error: `Could not save the photo record: ${insertError.message}` }, { status: 502 });
  }

  return Response.json({ id, shareUrl, qrDataUrl: `data:image/png;base64,${qrBytes.toString("base64")}` }, { headers: { "Cache-Control": "no-store" } });
}
