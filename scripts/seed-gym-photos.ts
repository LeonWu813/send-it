/**
 * One-time seeder script — populates gyms.cover_photo_url and gyms.google_place_id
 * by calling the Google Places API for each gym that lacks a cover photo.
 *
 * Run once before Phase 1 launch (AC-195).
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=xxx \
 *   SUPABASE_URL=xxx \
 *   SUPABASE_SERVICE_ROLE_KEY=xxx \
 *   npx ts-node scripts/seed-gym-photos.ts
 *
 * Requirements:
 *   - Node 18+ (uses native fetch)
 *   - GOOGLE_PLACES_API_KEY must be a server-side secret only. Never commit it
 *     to the repository or include it in any client-side environment file.
 *   - SUPABASE_SERVICE_ROLE_KEY is required for Storage uploads (bypasses RLS).
 *
 * The script is idempotent: gyms with a non-null cover_photo_url are skipped,
 * so it is safe to re-run if interrupted.
 */

import { createClient } from '@supabase/supabase-js';

// ── Environment ───────────────────────────────────────────────────────────────

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!GOOGLE_PLACES_API_KEY) {
  console.error('ERROR: GOOGLE_PLACES_API_KEY environment variable is not set.');
  process.exit(1);
}
if (!SUPABASE_URL) {
  console.error('ERROR: SUPABASE_URL environment variable is not set.');
  process.exit(1);
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is not set.');
  process.exit(1);
}

// ── Supabase client (service role — needed for Storage uploads) ───────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface GymRow {
  id: string;
  name: string;
  address_text: string;
}

interface PlacesTextSearchResult {
  candidates: Array<{ place_id: string }>;
  status: string;
}

interface PlaceDetailsResult {
  result: {
    photos?: Array<{ photo_reference: string }>;
  };
  status: string;
}

// ── Google Places REST helpers ────────────────────────────────────────────────

/**
 * Step 1: Text Search — resolve gym name + address to a place_id.
 * Uses the Places Text Search API (REST, no JS SDK).
 */
async function resolvePlaceId(gymName: string, address: string): Promise<string | null> {
  const query = encodeURIComponent(`${gymName} ${address}`);
  const url =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${query}` +
    `&inputtype=textquery` +
    `&fields=place_id` +
    `&key=${GOOGLE_PLACES_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Text Search HTTP error: ${response.status}`);
  }
  const data = (await response.json()) as PlacesTextSearchResult;

  if (data.status !== 'OK' || !data.candidates?.length) {
    console.warn(`  [Places] Text Search returned status=${data.status} for "${gymName}"`);
    return null;
  }

  return data.candidates[0].place_id;
}

/**
 * Step 2: Place Details — get the first photo_reference for a place_id.
 */
async function resolvePhotoReference(placeId: string): Promise<string | null> {
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=photos` +
    `&key=${GOOGLE_PLACES_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Place Details HTTP error: ${response.status}`);
  }
  const data = (await response.json()) as PlaceDetailsResult;

  if (data.status !== 'OK') {
    console.warn(`  [Places] Details returned status=${data.status} for place_id=${placeId}`);
    return null;
  }

  const photos = data.result?.photos;
  if (!photos?.length) {
    console.warn(`  [Places] No photos found for place_id=${placeId}`);
    return null;
  }

  return photos[0].photo_reference;
}

/**
 * Step 3: Place Photo — download the image bytes.
 * maxwidth=800 keeps file size reasonable.
 */
async function downloadPhoto(photoReference: string): Promise<Uint8Array> {
  const url =
    `https://maps.googleapis.com/maps/api/place/photo` +
    `?photoreference=${encodeURIComponent(photoReference)}` +
    `&maxwidth=800` +
    `&key=${GOOGLE_PLACES_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Place Photo HTTP error: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// ── Storage upload ────────────────────────────────────────────────────────────

/**
 * Step 4: Upload image bytes to Supabase Storage bucket "gym-photos".
 * Path: <gym_id>/cover.jpg
 * Returns the public URL.
 */
async function uploadToStorage(gymId: string, imageBytes: Uint8Array): Promise<string> {
  const storagePath = `${gymId}/cover.jpg`;

  const { error } = await supabase.storage
    .from('gym-photos')
    .upload(storagePath, imageBytes, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload error: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from('gym-photos').getPublicUrl(storagePath);
  return urlData.publicUrl;
}

// ── Database update ───────────────────────────────────────────────────────────

/**
 * Step 5: Write cover_photo_url and google_place_id back to the gyms row.
 */
async function updateGymRecord(gymId: string, coverPhotoUrl: string, placeId: string): Promise<void> {
  const { error } = await supabase
    .from('gyms')
    .update({ cover_photo_url: coverPhotoUrl, google_place_id: placeId })
    .eq('id', gymId);

  if (error) {
    throw new Error(`DB update error: ${error.message}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Seeder: fetching gyms with no cover photo...');

  const { data: gyms, error: fetchError } = await supabase
    .from('gyms')
    .select('id, name, address_text')
    .is('cover_photo_url', null);

  if (fetchError) {
    console.error('ERROR: Could not fetch gyms:', fetchError.message);
    process.exit(1);
  }

  const rows = (gyms ?? []) as GymRow[];
  console.log(`Seeder: ${rows.length} gym(s) need a cover photo.\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const gym of rows) {
    console.log(`Processing: ${gym.name} (${gym.id})`);

    try {
      // Step 1: resolve place_id
      const placeId = await resolvePlaceId(gym.name, gym.address_text);
      if (!placeId) {
        console.log(`  Skipped — no place_id found.\n`);
        skipCount++;
        continue;
      }
      console.log(`  place_id: ${placeId}`);

      // Step 2: get photo_reference
      const photoReference = await resolvePhotoReference(placeId);
      if (!photoReference) {
        console.log(`  Skipped — no photo_reference found.\n`);
        skipCount++;
        continue;
      }
      console.log(`  photo_reference: ${photoReference.slice(0, 40)}...`);

      // Step 3: download image
      const imageBytes = await downloadPhoto(photoReference);
      console.log(`  Downloaded: ${imageBytes.byteLength} bytes`);

      // Step 4: upload to Storage
      const publicUrl = await uploadToStorage(gym.id, imageBytes);
      console.log(`  Uploaded: ${publicUrl}`);

      // Step 5: update DB
      await updateGymRecord(gym.id, publicUrl, placeId);
      console.log(`  DB updated.\n`);

      successCount++;
    } catch (err) {
      console.error(`  ERROR for gym ${gym.id}:`, err instanceof Error ? err.message : err);
      errorCount++;
    }
  }

  console.log('────────────────────────────────────────');
  console.log(`Done. Success: ${successCount}  Skipped: ${skipCount}  Errors: ${errorCount}`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
