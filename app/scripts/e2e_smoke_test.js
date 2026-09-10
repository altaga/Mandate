import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = 'http://localhost:8090';
const ADMIN_KEY = process.env.ADMIN_API_KEY;

function toDataUri(filePath) {
  const buffer = fs.readFileSync(filePath);
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

async function main() {
  const primary = toDataUri(path.join(__dirname, 'utils', 'sample_face_primary.jpg'));
  const secondary = toDataUri(path.join(__dirname, 'utils', 'sample_face_secondary.jpg'));

  console.log('1) Extracting real 128-d vector from primary photo via /api/extract...');
  const extractRes = await fetch(`${BASE_URL}/api/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ADMIN_KEY },
    body: JSON.stringify({ imageBase64: primary })
  });
  const extractData = await extractRes.json();
  if (!extractData.success) throw new Error('extract failed: ' + JSON.stringify(extractData));
  console.log('   OK, vector length:', extractData.faceVector.length);

  const testUserId = 'e2e_smoke_' + Date.now();
  console.log('2) Enrolling test user via POST /api/db/users...');
  const enrollRes = await fetch(`${BASE_URL}/api/db/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ADMIN_KEY },
    body: JSON.stringify({
      id: testUserId,
      name: 'E2E Smoke Test',
      email: 'e2e-smoke@test.local',
      walletAddress: '0xE2E0000000000000000000000000000000E2E0',
      faceVector: extractData.faceVector,
      worldNullifier: null,
      enrolledAt: new Date().toISOString()
    })
  });
  const enrollData = await enrollRes.json();
  if (!enrollData.success) throw new Error('enroll failed: ' + JSON.stringify(enrollData));
  console.log('   OK, enrolled', testUserId);

  console.log('3) Recognizing SAME photo via /api/recognize (expect MATCH on', testUserId, ')...');
  const matchRes = await fetch(`${BASE_URL}/api/recognize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ADMIN_KEY },
    body: JSON.stringify({ imageBase64: primary, threshold: 0.85 })
  });
  const matchData = await matchRes.json();
  console.log('   success:', matchData.success, 'matchConfidence:', matchData.matchConfidence, 'identifiedUser:', matchData.identifiedUser?.id);

  console.log('4) Recognizing DIFFERENT photo via /api/recognize (expect NO match on', testUserId, ')...');
  const noMatchRes = await fetch(`${BASE_URL}/api/recognize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ADMIN_KEY },
    body: JSON.stringify({ imageBase64: secondary, threshold: 0.85 })
  });
  const noMatchData = await noMatchRes.json();
  console.log('   success:', noMatchData.success, 'matchConfidence:', noMatchData.matchConfidence, 'identifiedUser:', noMatchData.identifiedUser?.id);

  console.log('\n=== RESULT ===');
  const pass1 = matchData.success && matchData.identifiedUser?.id === testUserId;
  const pass2 = !(noMatchData.identifiedUser?.id === testUserId);
  console.log('Same-photo recognition correctly matched test user:', pass1);
  console.log('Different-photo recognition correctly did NOT match test user:', pass2);
}

main().catch(err => { console.error('FAILED:', err); process.exit(1); });
