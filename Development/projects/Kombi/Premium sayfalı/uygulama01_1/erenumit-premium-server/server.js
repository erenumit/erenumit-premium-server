import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// App Store Shared Secret (Render ortam değişkeni olarak ekleyebilirsin)
const APPLE_SHARED_SECRET = process.env.APPLE_SHARED_SECRET;

app.use(bodyParser.json());

app.post("/verify-receipt", async (req, res) => {
  const { "receipt-data": receiptData } = req.body;
  if (!receiptData) {
    return res.status(400).json({ error: "Receipt data is required" });
  }

  try {
    const response = await fetch("https://buy.itunes.apple.com/verifyReceipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "receipt-data": receiptData,
        "password": APPLE_SHARED_SECRET,
        "exclude-old-transactions": true
      }),
    });

    const data = await response.json();

    const isSubscribed = data?.latest_receipt_info?.some(item => {
      const now = Date.now() / 1000;
      return now < Number(item.expires_date_ms) / 1000;
    });

    res.json({ isSubscribed: !!isSubscribed, raw: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
