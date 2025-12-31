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
    const accessToken = await getAccessToken(serviceAccount);
    
    const [menuData, ordersData, bookingsData, tablesData] = await Promise.all([
      getSheetData(accessToken, 'menu!A:Z'),
      getSheetData(accessToken, 'orders!A:Z'),
      getSheetData(accessToken, 'bookings!A:Z'),
      getSheetData(accessToken, 'table!A:Z'),
    ]);

    const menuCount = (menuData.length || 1) - 1;
    const ordersToday = (ordersData.length || 1) - 1;
    
    let revenueToday = 0;
    if (ordersData.length > 1) {
      const headers = ordersData[0];
      const priceIndex = headers.indexOf('Price');
      if (priceIndex !== -1) {
        ordersData.slice(1).forEach((row: any[]) => {
          const price = parseFloat(row[priceIndex] || '0');
          if (!isNaN(price)) revenueToday += price;
        });
      }
    }

    let pendingBookings = 0;
    if (bookingsData.length > 1) {
      const headers = bookingsData[0];
      const statusIndex = headers.indexOf('Status');
      if (statusIndex !== -1) {
        pendingBookings = bookingsData.slice(1).filter(
          (row: any[]) => row[statusIndex]?.toLowerCase() === 'pending'
        ).length;
      }
    }

    let occupiedTables = 0;
    let totalTables = 0;
    if (tablesData.length > 1) {
      const headers = tablesData[0];
      const availabilityIndex = headers.indexOf('Availability');
      totalTables = tablesData.length - 1;
      if (availabilityIndex !== -1) {
        occupiedTables = tablesData.slice(1).filter(
          (row: any[]) => row[availabilityIndex]?.toLowerCase() === 'occupied'
        ).length;
      }
    }

    return new Response(JSON.stringify({
      menuItems: menuCount,
      ordersToday,
      revenueToday,
      pendingBookings,
      occupiedTables,
      availableTables: totalTables - occupiedTables,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-analytics:', error);
    return new Response(JSON.stringify({ 
      menuItems: 0,
      ordersToday: 0,
      revenueToday: 0,
      pendingBookings: 0,
      occupiedTables: 0,
      availableTables: 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
