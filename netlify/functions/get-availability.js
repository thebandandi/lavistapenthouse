const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  // 1. Handle Preflight Requests
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    // 2. Connect to the "direct-bookings" store
    const store = getStore("direct-bookings");
    
    // 3. Get the list of all saved booking IDs
    const list = await store.list();
    const ranges = [];

    // 4. Loop through and grab the dates for each booking
    for (const item of list.blobs) {
      const data = await store.getJSON(item.key);
      if (data && data.checkin && data.checkout) {
        ranges.push([data.checkin, data.checkout]);
      }
    }

    // 5. Return the dates to your website's calendar
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        ranges: ranges,
        count: ranges.length 
      }),
    };

  } catch (err) {
    console.error("Calendar Sync Error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Database Connection Failed", 
        details: err.message 
      }),
    };
  }
};
