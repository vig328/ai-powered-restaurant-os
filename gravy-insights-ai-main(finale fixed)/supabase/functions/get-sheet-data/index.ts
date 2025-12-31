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
    const { sheet } = await req.json();
    const sheetName = sheetNames[sheet];
    
    console.log(`Fetching sheet: ${sheet} (mapped to: ${sheetName})`);
    
    if (!sheetName) {
      console.error(`Invalid sheet type: ${sheet}`);
      throw new Error(`Invalid sheet type: ${sheet}`);
    }

    const serviceAccount = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY') || '{}');
    const accessToken = await getAccessToken(serviceAccount);
    
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}!A:Z`;
    console.log(`Fetching from URL: ${sheetUrl}`);
    
    const response = await fetch(sheetUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Sheets API error for sheet "${sheetName}":`, response.status, errorText);
      throw new Error(`Failed to fetch sheet "${sheetName}": ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log(`Sheet "${sheetName}" response:`, JSON.stringify(result).substring(0, 200));
    
    const rows = result.values || [];
    
    if (rows.length === 0) {
      console.log(`Sheet "${sheetName}" is completely empty (no headers, no data)`);
      return new Response(JSON.stringify({ headers: [], rows: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const headers = rows[0] || [];
    console.log(`Sheet "${sheetName}" headers:`, headers);
    
    const data = rows.slice(1).map((row: any[], idx: number) => {
      const obj: Record<string, any> = { id: `${sheet}_${idx}` };
      headers.forEach((header: string, i: number) => {
        obj[header] = row[i] || '';
      });
      return obj;
    });
    
    console.log(`Sheet "${sheetName}" data rows count:`, data.length);
 
    return new Response(JSON.stringify({ headers, rows: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-sheet-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage, headers: [], rows: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
