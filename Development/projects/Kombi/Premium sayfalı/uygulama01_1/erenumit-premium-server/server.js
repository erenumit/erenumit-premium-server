import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

const APPLE_SHARED_SECRET = process.env.APPLE_SHARED_SECRET;

app.use(bodyParser.json());

const APPLE_PRODUCTION_URL = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

app.post("/verify-receipt", async (req, res) => {
  const receiptData = req.body["receipt-data"];
  if (!receiptData) {
    return res.status(400).json({ error: "Receipt data is required" });
  }

  try {
    // Önce production’a gönderiyoruz
    let response = await fetch(APPLE_PRODUCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "receipt-data": receiptData,
        password: APPLE_SHARED_SECRET,
        "exclude-old-transactions": true,
      }),
    });

    let data = await response.json();

    // Eğer 21007 hatası dönerse → sandbox endpoint’e tekrar dene
    if (data.status === 21007) {
      response = await fetch(APPLE_SANDBOX_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "receipt-data": receiptData,
          password: APPLE_SHARED_SECRET,
          "exclude-old-transactions": true,
        }),
      });
      data = await response.json();
    }

    const isSubscribed = data?.latest_receipt_info?.some((item) => {
      const now = Date.now();
      return now < Number(item.expires_date_ms);
    });

    res.json({ isSubscribed: !!isSubscribed, raw: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
