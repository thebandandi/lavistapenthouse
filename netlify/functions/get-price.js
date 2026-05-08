// This function will eventually hook into your PM's software or an Airbnb scraper
// For now, it provides the secure bridge to Stripe
export async function handler(event) {
  const { checkIn, checkOut } = JSON.parse(event.body);

  // STRATEGY: 
  // 1. Fetch current 'Master' rate from a Netlify Blob or simple scraping logic
  // 2. For now, we use a 'Dynamic Base' that you can update in one place (.env)
  const baseRate = parseFloat(process.env.AIRBNB_MASTER_RATE || 550);
  
  // Calculate nights
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const nights = (end - start) / (1000 * 60 * 60 * 24);

  // Apply "Direct Discount" logic (e.g., 5% off Airbnb)
  const directRate = baseRate * 0.95;
  const total = directRate * nights;

  return {
    statusCode: 200,
    body: JSON.stringify({
      total: total.toFixed(2),
      rate: directRate.toFixed(2),
      nights: nights
    })
  };
}
