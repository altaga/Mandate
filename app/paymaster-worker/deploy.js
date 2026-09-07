const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_ENV = path.resolve(__dirname, '..', '.env');
require('dotenv').config({ path: ROOT_ENV });

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const PRIVATE_KEY = process.env.MANDATE_PAYMASTER_PRIVATE_KEY;
const BUYER_KEY = process.env.MANDATE_BUYER_PRIVATE_KEY;

if (!API_TOKEN || !ACCOUNT_ID || !PRIVATE_KEY || !BUYER_KEY) {
  console.error("Missing required environment variables. Check app/.env has CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, MANDATE_PAYMASTER_PRIVATE_KEY, and MANDATE_BUYER_PRIVATE_KEY defined.");
  process.exit(1);
}

fs.writeFileSync(
  '.dev.vars',
  `MANDATE_PAYMASTER_PRIVATE_KEY=${PRIVATE_KEY}\nMANDATE_BUYER_PRIVATE_KEY=${BUYER_KEY}`
);

const tomlPath = path.resolve(__dirname, 'wrangler.toml');
const tomlExamplePath = path.resolve(__dirname, 'wrangler.toml.example');

if (!fs.existsSync(tomlPath)) {
  if (fs.existsSync(tomlExamplePath)) {
    fs.copyFileSync(tomlExamplePath, tomlPath);
  } else {
    fs.writeFileSync(
      tomlPath,
      `name = "mandate-x402-paymaster"
main = "index.js"
compatibility_date = "2024-03-04"

# Secrets are injected via Cloudflare Secrets API or .dev.vars (local only).
# Do NOT commit secrets to [vars] in wrangler.toml.
# Run: npx wrangler secret put MANDATE_PAYMASTER_PRIVATE_KEY
# Run: npx wrangler secret put MANDATE_BUYER_PRIVATE_KEY
`
    );
  }
}

console.log("🚀 Deploying Paymaster via Wrangler...");
console.log("ℹ️  Setting secrets via Cloudflare Worker Secrets API...");
try {
  const setSecret = (name, value) => {
    try {
      execSync(`echo "${value}" | npx wrangler secret put ${name}`, {
        stdio: 'pipe',
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: API_TOKEN,
          CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
        }
      });
      console.log(`   ✓ Secret ${name} uploaded`);
    } catch (_) {
      console.warn(`   ⚠ Could not auto-upload secret ${name}. Run manually: npx wrangler secret put ${name}`);
    }
  };
  setSecret('MANDATE_PAYMASTER_PRIVATE_KEY', PRIVATE_KEY);
  setSecret('MANDATE_BUYER_PRIVATE_KEY', BUYER_KEY);

  execSync('npx wrangler deploy', {
    stdio: 'inherit',
    env: {
      ...process.env,
      CLOUDFLARE_API_TOKEN: API_TOKEN,
      CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
    }
  });
  console.log("✅ Deployed successfully!");
} catch (e) {
  console.error("❌ Deploy failed:", e.message);
}
