const { google } = require("googleapis");

export default async function handler(req, res) {
  try {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_EMAIL,
      null,
      (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Menu!A2:D999", // Dish, Category, Price, Time
    });

    const rows = response.data.values || [];

    const menuData = rows.map((r) => ({
      name: r[0],
      category: r[1],
      price: Number(r[2]),
      time: Number(r[3]),
    }));

    res.status(200).json(menuData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
