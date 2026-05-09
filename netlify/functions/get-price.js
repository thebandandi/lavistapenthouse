const axios = require('axios');

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { checkIn, checkOut } = JSON.parse(event.body);
    const listingId = "1034347605075023527";
    
    // 1. Construct the URL to your listing with the specific dates
    const url = `https://www.airbnb.com/rooms/${listingId}?check_in=${checkIn}&check_out=${checkOut}`;

    // 2. Fetch the page data
    // Note: We use a User-Agent header so Airbnb sees us as a standard browser
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const html = response.data;

    // 3. Extract the price using a Regular Expression (looking for the price string in the metadata)
    // This looks for patterns like "$350" or "350" followed by "per night"
    const priceMatch = html.match(/"amount":(\d+),"amountFormatted":"\$(\d+)"/);
    
    let airbnbRate = null;

    if (priceMatch && priceMatch[1]) {
      airbnbRate = parseInt(priceMatch[1]);
    }

    // --- SAFETY CHECK ---
    // If Airbnb blocks the scrape or the price isn't found, we stay in INQUIRY mode
    if (!airbnbRate || isNaN(airbnbRate)) {
      console.log("Price not found for dates, defaulting to Inquiry.");
      return {
        statusCode: 200,
        body: JSON.stringify({ mode: "INQUIRY" })
      };
    }

    // --- CALCULATION (Direct Booking Logic) ---
    const CLEANING_FEE = 75;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const nights = Math.round((end - start) / 86400000);
    
    const subtotal = airbnbRate * nights;
    const discount = Math.round(subtotal * 0.05); // Your 5% direct discount
    const total = subtotal + CLEANING_FEE - discount;

    return {
      statusCode: 200,
      body: JSON.stringify({
        mode: "BOOK",
        rate: airbnbRate,
        total: total,
        nights: nights,
        discountTotal: discount
      })
    };

  } catch (error) {
    console.error("Scraper Error:", error.message);
    return {
      statusCode: 200,
      body: JSON.stringify({ mode: "INQUIRY", error: "Sync temporarily unavailable" })
    };
  }
};
