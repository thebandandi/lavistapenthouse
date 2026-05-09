const axios = require('axios');

exports.handler = async (event, context) => {
  // This allows the function to be called from your website without CORS issues
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTION'
  };

  // Handle pre-flight requests from the browser
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  // Get dates from either URL parameters (GET) or Body (POST)
  const checkIn = event.queryStringParameters.checkIn || (event.body && JSON.parse(event.body).checkIn);
  const checkOut = event.queryStringParameters.checkOut || (event.body && JSON.parse(event.body).checkOut);

  if (!checkIn || !checkOut) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing dates' })
    };
  }

  try {
    // REPLACE THIS with your actual Airbnb Room ID
    const listingId = "YOUR_LISTING_ID"; 
    const url = `https://www.airbnb.com/rooms/${listingId}?check_in=${checkIn}&check_out=${checkOut}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html'
      },
      timeout: 8000 // 8 second timeout
    });

    // AIRBNB SCRAPING LOGIC
    // We look for the "price" inside the raw HTML
    const html = response.data;
    const priceMatch = html.match(/"amount":(\d+),"amountFormatted":"\$(\d+)"/);

    if (priceMatch) {
      const nightlyPrice = parseInt(priceMatch[1]);
      const d1 = new Date(checkIn);
      const d2 = new Date(checkOut);
      const nights = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          available: true,
          nightlyPrice: nightlyPrice,
          totalPrice: nightlyPrice * nights,
          nights: nights
        })
      };
    }

    throw new Error("Price not found");

  } catch (error) {
    console.error('Scraper Error:', error.message);
    return {
      statusCode: 200, // Return 200 so the UI handles the fallback gracefully
      headers,
      body: JSON.stringify({ available: false, message: "Use inquiry fallback" })
    };
  }
};
