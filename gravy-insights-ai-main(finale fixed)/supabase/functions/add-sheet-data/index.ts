import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPREADSHEET_ID = "1lkhDLVTjQ2rq-LTlwIUlNC1jNdAyuqUe56LUDPDB9p8";

const sheetNames: Record<string, string> = {
  menu: "menu",
  orders: "orders",
  users: "users",
  bookings: "bookings",
  advance_booking: "advance_booking",
  table: "table",
  cancellations: "cancellations",
  complaints: "Complaints",
  manager: "manager",
};

async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwtHeader = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  const now = Math.floor(Date.now() / 1000);
  const jwtClaimSet = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const jwtClaimSetEncoded = btoa(JSON.stringify(jwtClaimSet))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;
  
  const rawKey = serviceAccount.private_key as string;
  if (!rawKey) {
    throw new Error('Missing private_key in service account');
  }
  const normalizedKey = rawKey.replace(/\\n/g, '\n').trim();
  const pemBody = normalizedKey
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
  const normalizedPem = pemBody + '='.repeat((4 - (pemBody.length % 4)) % 4);
  const binaryDer = Uint8Array.from(atob(normalizedPem), c => c.charCodeAt(0));
  
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { sheet, data } = payload as { sheet: keyof typeof sheetNames; data: Record<string, any> };
    const sheetName = sheetNames[sheet];

    if (!sheetName) {
      return new Response(JSON.stringify({ error: `Invalid sheet type: ${sheet}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data || typeof data !== 'object') {
      return new Response(JSON.stringify({ error: 'Missing or invalid data object' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceAccount = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY') || '{}');
    const accessToken = await getAccessToken(serviceAccount);

    // Fetch sheet to get headers
    const getResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}!A1:Z1`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await getResponse.json();
    const rows: any[][] = result.values || [];
    
    let headers: string[];
    let values: string[];
    
    if (rows.length === 0 || !rows[0] || rows[0].length === 0) {
      // Sheet is empty or has no headers - add headers first, then data
      headers = Object.keys(data);
      values = headers.map((header: string) => {
        const value = data[header];
        return value !== undefined && value !== null ? `${value}` : '';
      });
      
      // Append both headers and data row
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}!A:Z:append?valueInputOption=RAW`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [headers, values] }),
        }
      );
    } else {
      // Sheet has headers - align data to existing headers
      headers = rows[0] as string[];
      values = headers.map((header: string) => {
        const value = data[header];
        return value !== undefined && value !== null ? `${value}` : '';
      });
      
      // Append the new row
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}!A:Z:append?valueInputOption=RAW`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [values] }),
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in add-sheet-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
