import { createClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_COI_BUCKET ?? "coi-files";

// Service-role client for server-only storage operations. Never expose to client.
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Returns the raw PDF bytes for a given storage key.
export async function downloadPDF(storageKey: string): Promise<Buffer> {
  const { data, error } = await getServiceClient()
    .storage.from(BUCKET)
    .download(storageKey);

  if (error) throw new Error(`Storage download failed: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

// Returns a short-lived signed URL for viewing a COI file.
export async function createSignedUrl(
  storageKey: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await getServiceClient()
    .storage.from(BUCKET)
    .createSignedUrl(storageKey, expiresInSeconds);

  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

// Returns a signed upload URL + the storage key for a new file.
// The caller registers the cert after the browser completes the upload.
export async function createUploadUrl(params: {
  accountId: string;
  filename: string;
  contentType?: string;
}): Promise<{ storageKey: string; uploadUrl: string }> {
  const ext = params.filename.split(".").pop() ?? "pdf";
  const storageKey = `${params.accountId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { data, error } = await getServiceClient()
    .storage.from(BUCKET)
    .createSignedUploadUrl(storageKey);

  if (error) throw new Error(`Upload URL failed: ${error.message}`);
  return { storageKey, uploadUrl: data.signedUrl };
}
