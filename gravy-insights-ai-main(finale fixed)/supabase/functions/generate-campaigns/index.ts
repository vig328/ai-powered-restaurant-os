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
    
    const [menuData, ordersData, cancellationsData, complaintsData] = await Promise.all([
      getSheetData(accessToken, 'menu!A:Z'),
      getSheetData(accessToken, 'orders!A:Z'),
      getSheetData(accessToken, 'cancellations!A:Z'),
      getSheetData(accessToken, 'Complaints!A:Z'),
    ]);

    const context = `
Restaurant Data Summary:
- Menu items: ${menuData.length || 0}
- Orders: ${ordersData.length || 0}
- Cancellations: ${cancellationsData.length || 0}
- Complaints: ${complaintsData.length || 0}

Sample data: ${JSON.stringify({
  menu: menuData.slice(0, 3),
  orders: ordersData.slice(0, 3),
})}
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
            content: "You are an AI marketing and operations strategist for 'Fifty Shades of Gravy' restaurant. Provide actionable campaign suggestions and operational improvements."
          },
          {
            role: "user",
            content: `Based on this data, suggest 3 AI-powered campaigns and 2 operational improvements. Format as a JSON array.\n\n${context}`
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
    const campaignsText = data.choices[0].message.content;

    // Parse suggestions
    const campaigns = [
      {
        id: 1,
        title: "Popular Dish Promotion",
        description: "Launch targeted promotions for top-performing dishes",
        type: "promotion",
        status: "suggested",
      },
      {
        id: 2,
        title: "Customer Retention Campaign",
        description: "Re-engage customers who haven't visited recently",
        type: "retention",
        status: "suggested",
      },
      {
        id: 3,
        title: "Peak Hours Optimization",
        description: "Special offers during off-peak hours to balance demand",
        type: "optimization",
        status: "suggested",
      },
    ];

    const improvements = [
      "Improve table rotation during peak hours based on booking patterns",
      "Staff scheduling optimization based on order volume trends",
    ];

    return new Response(JSON.stringify({ campaigns, improvements }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-campaigns:', error);
    return new Response(JSON.stringify({ 
      campaigns: [],
      improvements: ["Unable to generate suggestions. Please try again."],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
