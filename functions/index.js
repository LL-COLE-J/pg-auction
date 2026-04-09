

const express = require("express");
const cors = require("cors");
const { onRequest } = require("firebase-functions/v2/https");
const { google } = require("googleapis");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// =====================
// 🔐 GOOGLE AUTH
// =====================
const serviceAccount = require("./key.json");

const auth = new google.auth.GoogleAuth({
  credentials: {
    ...serviceAccount,
    private_key: serviceAccount.private_key.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({ version: "v4", auth });

// 👉 PUT YOUR SHEET ID HERE
const SPREADSHEET_ID = "1fSC7dVwdVTcLnLkAg5g9Ko_CnpOYdLohKlwOX68NaNw";

// =====================
// ✅ ROOT TEST
// =====================
app.get("/", (req, res) => {
  res.send("API is working");
});

// =====================
// 📦 GET ITEMS
// =====================
app.get("/items", async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Auction!A2:H"
    });

    const rows = response.data.values || [];

    const items = rows.map(r => ({
      id: r[0],
      name: r[1],
      currentBid: Number(r[2]) || 0,
      bidIncrement: Number(r[3]) || 1,
      currentWinner: r[4] || "",
      currentWinnerName: r[5] || "",
      status: r[6] || "open",
      image: r[7] || ""
    }));

    res.json(items);
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

// =====================
// 💰 GET BIDS
// =====================
// =====================
// 💰 GET BIDS (BIDHISTORY SHEET)
// =====================
app.get("/bids", async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "BidHistory!A2:I"
    });

    const rows = response.data.values || [];

    const bids = rows.map(r => ({
      time: r[0],
      bidder: r[1],
      bidderName: r[2],
      itemId: r[3],
      itemName: r[4],
      amount: Number(r[5]) || 0,
      previousBid: Number(r[6]) || 0,
      reason: r[7] || "",
      status: r[8] || ""
    }));

    res.json(bids);
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

// =====================
// 🔥 PLACE BID
// =====================
app.post("/bid", async (req, res) => {
  try {
    const { itemId, amount, bidder } = req.body;

    if (!itemId || !amount || !bidder) {
      return res.json({ success: false, error: "Missing fields" });
    }

   // ✅ Add bid to BidHistory
await sheets.spreadsheets.values.append({
  spreadsheetId: SPREADSHEET_ID,
  range: "BidHistory!A:I",
  valueInputOption: "USER_ENTERED",
  requestBody: {
    values: [[
      new Date().toISOString(), // timestamp (A)
      bidder,                   // bidder_id (B)
      "",                       // bidder_name (C)
      itemId,                   // item_id (D)
      "",                       // item_name (E)
      amount,                   // bid_amount (F)
      "",                       // previous_bid (G)
      "",                       // reason (H)
      "valid"                   // status (I)
    ]]
  }
});

   // ✅ Update current bid in Auction sheet
const items = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: "Auction!A2:H"
});

const rows = items.data.values || [];
const index = rows.findIndex(r => r[0] == itemId);

if (index !== -1) {
  const rowNumber = index + 2;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Auction!C${rowNumber}`, // column C = current_bid
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[amount]]
    }
  });
}

    res.json({ success: true });

  } catch (err) {
    res.json({ success: false, error: err.toString() });
  }
});

// =====================
// 👥 GET GUESTS (MATCH YOUR SHEET)
// =====================
app.get("/guests", async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Guests!A2:E"
    });

    const rows = response.data.values || [];

    const guests = rows.map(r => ({
      id: r[0],
      name: r[1],
      bidderNumber: r[2],
      table: r[3],
      checked: r[4] || ""
    }));

    res.json(guests);
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

// =====================
// 🚨 EXPORT (GEN 2)
// =====================
exports.api = onRequest(
  { region: "us-central1" },
  app
);