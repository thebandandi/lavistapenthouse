const axios = require('axios');

export const handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { checkIn, checkOut } = JSON.parse(event.body);
    const listingId = "1034347605075023527";
    
    // Construct the Airbnb URL for the specific stay dates
    const url = `https://www.airbnb.com/rooms/${listingId}?check_in=${checkIn}&check_out=${checkOut}`;

    // Fetch the page using "Stealth Headers" to look like a real browser
    const response = await axios.get(url, {
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'referer': 'https://www.google.com/'
      },
      timeout: 8000 // Give it 8 seconds to respond
    });

    const html = response.data;
    
    // Attempt to extract the nightly rate from Airbnb's internal data 
    const priceMatch = html.match(/"amount":(\d+),"amountFormatted":"\$(\d+)"/);
    let airbnbRate = priceMatch ? parseInt(priceMatch[1]) : null;

    // --- SAFETY CHECK ---
    // If the price is missing (blocked or unavailable), switch to Inquiry mode
    if (!airbnbRate || isNaN(airbnbRate)) {
      console.log("Price not found or blocked by Airbnb. Switching to Inquiry mode.");
      return {
        statusCode: 200,
        body: JSON.stringify({ mode: "INQUIRY" })
      };
    }

    // --- CALCULATION LOGIC ---
    const CLEANING_FEE = 75;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const nights = Math.round((end - start) / 86400000);
    
    const subtotal = airbnbRate * nights;
    const discountTotal = Math.round(subtotal * 0.05); // 5% Direct Booking Discount
    const finalTotal = subtotal + CLEANING_FEE - discountTotal;

    return {
      statusCode: 200,
      body: JSON.stringify({
        mode: "BOOK",
        rate: airbnbRate,
        total: finalTotal,
        nights: nights,
        discountTotal: discountTotal
      })
    };

  } catch (error) {
    // If anything crashes (network error, etc.), default to Inquiry
    console.error("Scraper Error:", error.message);
    return {
      statusCode: 200,
      body: JSON.stringify({ mode: "INQUIRY" })
    };
  }
};
