export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { checkIn, checkOut } = JSON.parse(event.body);
    
    // --- AIRBNB / DPGO INTEGRATION POINT ---
    // Currently, we are setting this to null to simulate a "Price not found" 
    // or as a placeholder until your PM sets up the sync.
    let airbnbNightlyRate = null; 

    // TODO: Insert your Airbnb Scraper or PMS API call here
    // Example: airbnbNightlyRate = await fetchAirbnbPrice(checkIn);

    if (!airbnbNightlyRate) {
      // Logic: No price found = Inquiry Mode
      return {
        statusCode: 200,
        body: JSON.stringify({ mode: "INQUIRY", message: "Contact for Pricing" })
      };
    }

    // --- IF PRICE EXISTS, PROCEED WITH INSTANT BOOK LOGIC ---
    const CLEANING_FEE = 75;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const nights = Math.round((end - start) / 86400000);
    
    const subtotal = airbnbNightlyRate * nights;
    const discount = Math.round(subtotal * 0.05);
    const finalTotal = subtotal + CLEANING_FEE - discount;

    return {
      statusCode: 200,
      body: JSON.stringify({
        mode: "BOOK",
        rate: airbnbNightlyRate,
        total: finalTotal,
        nights: nights
      })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

