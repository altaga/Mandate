import http from 'https';

const RPC_URL = 'https://rpc.testnet.arc.network';

function getNativeBalance(address) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [address, 'latest']
    });

    const req = http.request(RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.result) {
            // Convert Wei / hex balance to USDC
            const hex = parsed.result;
            const wei = BigInt(hex);
            // 18 decimals or 6 decimals standard format
            const usdcFormatted18 = (Number(wei) / 1e18).toFixed(6);
            const usdcFormatted6 = (Number(wei) / 1e6).toFixed(2);
            resolve({ rawHex: hex, rawWei: wei.toString(), usdc18: usdcFormatted18, usdc6: usdcFormatted6 });
          } else {
            resolve({ error: parsed.error });
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function check() {
  console.log('=== Querying Live Arc Testnet RPC (https://rpc.testnet.arc.network) ===');

  const buyer = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
  const merch = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';

  try {
    const buyerBal = await getNativeBalance(buyer);
    console.log(`Buyer (${buyer}):`, buyerBal);

    const merchBal = await getNativeBalance(merch);
    console.log(`Merchant (${merch}):`, merchBal);
  } catch (err) {
    console.error('RPC Error:', err.message);
  }
}

check();
