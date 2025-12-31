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
    const { sheet } = payload as { sheet: keyof typeof sheetNames };
    const sheetName = sheetNames[sheet];

    if (!sheetName) {
      return new Response(JSON.stringify({ error: `Invalid sheet type: ${sheet}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine row index from either id (e.g., "menu_12") or explicit rowIndex
    let idx: number | undefined = undefined;
    if (typeof payload.rowIndex === 'number') {
      idx = payload.rowIndex; // zero-based index relative to data rows (excluding header)
    } else if (typeof payload.id === 'string') {
      const parts = payload.id.split('_');
      const last = parts[parts.length - 1];
      const parsed = parseInt(last, 10);
      if (!Number.isNaN(parsed)) idx = parsed;
    }

    if (idx === undefined || idx < 0) {
      return new Response(JSON.stringify({ error: 'Missing or invalid id/rowIndex' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceAccount = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY') || '{}');
    const accessToken = await getAccessToken(serviceAccount);

    // Fetch full sheet to get headers and current row
    const getResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}!A:Z`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await getResponse.json();
    const rows: any[][] = result.values || [];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Sheet is empty' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headers = rows[0] as string[];
    const actualRowIndex = idx + 2; // account for header row and 1-based indexing
    const existingRow = rows[actualRowIndex - 1] || [];

    const updates: Record<string, any> = (payload.updates ?? payload.data ?? {}) as Record<string, any>;
    if (!updates || typeof updates !== 'object') {
      return new Response(JSON.stringify({ error: 'Missing updates/data object' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build ordered values array aligning to headers; fall back to existing values
    const values = headers.map((header: string, i: number) => {
      const updateVal = Object.prototype.hasOwnProperty.call(updates, header)
        ? updates[header]
        : undefined;
      const finalVal = updateVal !== undefined ? updateVal : (existingRow[i] ?? '');
      return `${finalVal ?? ''}`; // ensure string
    });

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}!A${actualRowIndex}:Z${actualRowIndex}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [values] }),
      }
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in update-sheet-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
