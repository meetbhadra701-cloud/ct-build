// Test the production API end-to-end — sign in, get upload URL, upload PDF, create certificate, poll result
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const BASE = 'http://localhost:3001';
const VENDOR_ID = '980957e7-b9ff-4b81-aae4-1c46e847fccf';
const EMAIL = 'MeetBhadra701@gmail.com';
const PASSWORD = 'TestCOI2026!';

// 1. Sign in via Supabase to get access token
const supabase = createClient(
  'https://ylncnjleylmbzklmqafk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsbmNuamxleWxtYnprbG1xYWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0OTg2NjAsImV4cCI6MjA5NjA3NDY2MH0.6cg14QaXIx5hjyP-kIrLl69mJVlXXZUG-cKkYEb2bQM'
);

console.log('1. Signing in...');
const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (authErr) throw new Error('Auth failed: ' + authErr.message);
const token = auth.session.access_token;
console.log('   ✓ Signed in, got JWT');

const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

// 2. Get signed upload URL
console.log('\n2. Getting signed upload URL...');
const urlRes = await fetch(`${BASE}/api/certificates/upload-url`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ vendor_id: VENDOR_ID, filename: 'abc-plumbing-coi.pdf', content_type: 'application/pdf' })
});
const urlData = await urlRes.json();
if (!urlRes.ok) throw new Error('upload-url failed: ' + JSON.stringify(urlData));
console.log('   ✓ Storage key:', urlData.storage_key);

// 3. Upload PDF to Supabase Storage via signed URL
console.log('\n3. Uploading PDF to storage...');
const pdfBytes = readFileSync('./scripts/sample-coi.pdf');
const uploadRes = await fetch(urlData.upload_url, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/pdf' },
  body: pdfBytes
});
if (!uploadRes.ok) throw new Error('Upload failed: ' + uploadRes.status);
console.log('   ✓ PDF uploaded to private bucket');

// 4. Create certificate record (kicks off extraction job)
console.log('\n4. Creating certificate record...');
const certRes = await fetch(`${BASE}/api/certificates`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ vendor_id: VENDOR_ID, storage_key: urlData.storage_key, source: 'upload' })
});
const certData = await certRes.json();
if (!certRes.ok) throw new Error('Create cert failed: ' + JSON.stringify(certData));
const certId = certData.certificate.id;
console.log('   ✓ Certificate created:', certId);
console.log('   Status:', certData.certificate.status);

// 5. Poll until extraction completes
console.log('\n5. Waiting for extraction (Claude is reading the PDF)...');
let status = 'processing';
let attempts = 0;
while (status === 'processing' && attempts < 20) {
  await new Promise(r => setTimeout(r, 3000));
  const pollRes = await fetch(`${BASE}/api/certificates/${certId}`, { headers });
  const pollData = await pollRes.json();
  status = pollData.certificate.status;
  process.stdout.write(`   attempt ${++attempts}: ${status}\n`);
}

// 6. Final result
const finalRes = await fetch(`${BASE}/api/certificates/${certId}`, { headers });
const finalData = await finalRes.json();
console.log('\n--- RESULT ---');
console.log('Status:', finalData.certificate.status);
console.log('Coverages extracted:', finalData.coverages?.length ?? 0);
if (finalData.coverages?.length > 0) {
  for (const c of finalData.coverages) {
    console.log(`  ${c.coverage_type}: $${c.each_occurrence_limit?.toLocaleString()} / $${c.aggregate_limit?.toLocaleString()}`);
    console.log(`    ${c.effective_date} → ${c.expiry_date}  |  additional_insured: ${c.additional_insured}`);
  }
}
if (finalData.latest_compliance_result) {
  console.log('Compliance status:', finalData.latest_compliance_result.status);
}
