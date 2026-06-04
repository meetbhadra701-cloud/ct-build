import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { runExtractionPipeline } from '../lib/extraction/pipeline.ts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const sql = postgres(process.env.DATABASE_URL, { prepare: false });

// 1. Get account + vendor
const [account] = await sql`SELECT id FROM accounts ORDER BY created_at DESC LIMIT 1`;
const [vendor] = await sql`SELECT id FROM vendors WHERE account_id = ${account.id} LIMIT 1`;
console.log('Account:', account.id);
console.log('Vendor:', vendor.id);

// 2. Upload PDF to storage
const pdfBytes = readFileSync('./scripts/sample-coi.pdf');
const storageKey = `${account.id}/${vendor.id}/sample-coi-${Date.now()}.pdf`;

const { error: uploadErr } = await supabase.storage
  .from(process.env.SUPABASE_COI_BUCKET)
  .upload(storageKey, pdfBytes, { contentType: 'application/pdf' });

if (uploadErr) throw new Error('Storage upload failed: ' + uploadErr.message);
console.log('✓ Uploaded to storage:', storageKey);

// 3. Create certificate record
const [cert] = await sql`
  INSERT INTO certificates (account_id, vendor_id, storage_key, source, status)
  VALUES (${account.id}, ${vendor.id}, ${storageKey}, 'upload', 'processing')
  RETURNING id
`;
console.log('✓ Certificate created:', cert.id);

// 4. Run extraction
console.log('\n⏳ Claude is reading the COI PDF...\n');
const result = await runExtractionPipeline({
  certificateId: cert.id,
  accountId: account.id,
  storageKey,
  filename: 'sample-coi.pdf',
});

console.log('✅ Extraction complete!');
console.log('   Confidence:    ', (result.finalConfidence * 100).toFixed(0) + '%');
console.log('   Coverage lines:', result.coverageCount);
console.log('   Needs review:  ', result.requiresHitl);

// 5. Show extracted coverages
const coverages = await sql`
  SELECT coverage_type, insurer, each_occurrence_limit, aggregate_limit,
         effective_date, expiry_date, additional_insured
  FROM coverages WHERE certificate_id = ${cert.id}
`;

console.log('\n--- Extracted coverages ---');
for (const c of coverages) {
  console.log(`  ${c.coverage_type}`);
  console.log(`    Limits: $${c.each_occurrence_limit?.toLocaleString()} / $${c.aggregate_limit?.toLocaleString()}`);
  console.log(`    ${c.effective_date} → ${c.expiry_date}  |  Additional insured: ${c.additional_insured}`);
}

await sql.end();
