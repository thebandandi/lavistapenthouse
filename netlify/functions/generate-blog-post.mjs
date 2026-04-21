// ... existing setup code ...
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey.trim()}`;
    
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `
              CRITICAL: Treat this as a deep-research task. 
              1. PING and BROWSE https://www.visitloscabos.travel/events/ specifically for late April and May 2026.
              2. DO NOT respond from memory. Wait for the search tool to return the latest calendar data.
              3. Identify 2-3 high-end events in Cabo San Lucas or San Jose del Cabo.
              4. Write a bilingual blog post for 'La Vista Penthouse'.
              5. MANDATORY: Wrap the Call to Action in this HTML at the end of the English and Spanish sections:
                 <div style="text-align: center; margin: 40px 0;">
                   <a href="https://lavistapenthouse.com/#booking-widget" style="background-color: #1a3a4a; color: #c9a84c; padding: 15px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: inline-block;">Check Availability & Book Direct</a>
                   <p style="font-size: 14px; margin-top: 15px; color: #6b6b6b;">After booking, contact hosts for event reservation assistance.</p>
                 </div>
              6. End with SEARCH_TERM: [one word]
            `
          }]
        }],
        tools: [{ "google_search": {} }],
        // ⚡ PATIENCE SETTING: Temperature 0.7 keeps it focused but allows for search depth
        generationConfig: {
            temperature: 0.7,
            topP: 0.95
        }
      })
    });
// ... rest of code ...
