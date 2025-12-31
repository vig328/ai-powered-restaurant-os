import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPREADSHEET_ID = "1lkhDLVTjQ2rq-LTlwIUlNC1jNdAyuqUe56LUDPDB9p8";

async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwtHeader = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  const now = Math.floor(Date.now() / 1000);
  const jwtClaimSet = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const jwtClaimSetEncoded = btoa(JSON.stringify(jwtClaimSet))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;
  
  const privateKey = serviceAccount.private_key;
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKey.substring(pemHeader.length, privateKey.length - pemFooter.length).replace(/\s/g, "");
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signatureInput)
  );
  
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  const jwt = `${signatureInput}.${signatureBase64}`;
  
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function getSheetData(accessToken: string, range: string) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  const result = await response.json();
  return result.values || [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccount = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY') || '{}');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const accessToken = await getAccessToken(serviceAccount);
    
    const [menuData, ordersData, bookingsData] = await Promise.all([
      getSheetData(accessToken, 'menu!A:Z'),
      getSheetData(accessToken, 'orders!A:Z'),
      getSheetData(accessToken, 'bookings!A:Z'),
    ]);

    const context = `
Menu items: ${menuData.length || 0}
Recent orders: ${ordersData.length || 0}
Bookings: ${bookingsData.length || 0}

Sample menu: ${JSON.stringify(menuData.slice(0, 5))}
Sample orders: ${JSON.stringify(ordersData.slice(0, 5))}
`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an AI assistant for 'Fifty Shades of Gravy' restaurant. Provide concise, actionable insights for pricing, upselling, demand forecasting, and table optimization."
          },
          {
            role: "user",
            content: `Based on this restaurant data, provide 4 AI insights (one for each category: pricing suggestions, upsell combos, demand forecasting, table utilization). Keep each insight to 2-3 sentences.\n\n${context}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const insightsText = data.choices[0].message.content;

    // Parse the insights into structured format
    const insights = {
      pricing: insightsText.split('\n')[0] || "Analyze pricing based on demand patterns",
      upsell: insightsText.split('\n')[1] || "Consider combo offers for popular items",
      demand: insightsText.split('\n')[2] || "Track peak hours for better staffing",
      tables: insightsText.split('\n')[3] || "Optimize table turnover during rush hours",
    };

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-ai-insights:', error);
    return new Response(JSON.stringify({ 
      pricing: "Unable to generate insights. Please try again.",
      upsell: "Unable to generate insights. Please try again.",
      demand: "Unable to generate insights. Please try again.",
      tables: "Unable to generate insights. Please try again.",
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
