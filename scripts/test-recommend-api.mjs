const baseUrl = process.env.API_BASE_URL
  ? process.env.API_BASE_URL.replace(/\/$/, '')
  : 'http://localhost:3000';

const endpoint = process.env.API_RECOMMEND_URL || `${baseUrl}/api/recommend`;

const payload = {
  inventory: [
    { name: 'Eggs', expiration_date: '2026-03-10', category: 'dairy' },
    { name: 'Spinach', expiration_date: '2026-03-06', category: 'produce' },
    { name: 'Chicken breast', expiration_date: '2026-03-07', category: 'meat' },
  ],
  restrictions: ['allergy_nuts'],
  top_k: 6,
  debug: false,
  provider_enabled: true,
};

const run = async () => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const data = text ? JSON.parse(text) : {};
  const count = Array.isArray(data.recommendations) ? data.recommendations.length : 0;

  console.log('✅ RecipeRec API call succeeded');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Mode: ${data.mode || 'unknown'}`);
  console.log(`Recommendations: ${count}`);
  if (data.inventory_summary) {
    console.log('Inventory summary:', data.inventory_summary);
  }
};

run().catch(error => {
  console.error('❌ RecipeRec API call failed');
  console.error(error?.message || error);
  process.exitCode = 1;
});
