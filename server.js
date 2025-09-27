import dotenv from "dotenv";
dotenv.config({ path: "apple.env" });

import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

const APPLE_SHARED_SECRET = process.env.APPLE_SHARED_SECRET;

if (!APPLE_SHARED_SECRET) {
  console.error("❌ APPLE_SHARED_SECRET env değişkeni bulunamadı!");
  process.exit(1);
} else {
  console.log("✅ Shared secret yüklendi");
}

app.use(bodyParser.json());

const APPLE_PRODUCTION_URL = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

// Yardımcı fonksiyon: Receipt doğrulama
async function validateReceipt(url, receiptData) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "receipt-data": receiptData,
      password: APPLE_SHARED_SECRET,
      "exclude-old-transactions": true,
    }),
  });

  const data = await response.json();
  return data;
}

// Endpoint: /verify-receipt
app.post("/verify-receipt", async (req, res) => {
  const receiptData = req.body["receipt-data"];
  if (!receiptData) {
    console.log("❌ Receipt data gelmedi");
    return res.status(400).json({ error: "Receipt data is required" });
  }

  console.log("📥 Receipt data alındı");

  try {
    // Öncelikle sandbox veya production makbuzunu kontrol eden döngü
    let data = await validateReceipt(APPLE_PRODUCTION_URL, receiptData);
    console.log("📦 Production yanıt:", data);

    if (data.status === 21007) {
      // Sandbox makbuzu production endpoint'e gönderildi → sandbox endpoint’e yönlendir
      console.log("🔄 Sandbox makbuzu, sandbox endpoint’e yönlendiriliyor");
      data = await validateReceipt(APPLE_SANDBOX_URL, receiptData);
      console.log("📦 Sandbox yanıt:", data);
    } else if (data.status === 21008) {
      // Production makbuzu sandbox endpoint’e gönderildi → production endpoint’e yönlendir
      console.log("🔄 Production makbuzu, production endpoint’te tekrar deneniyor");
      data = await validateReceipt(APPLE_PRODUCTION_URL, receiptData);
      console.log("📦 Production tekrar yanıt:", data);
    }

    if (data.status !== 0) {
      console.error("❌ Geçersiz makbuz:", data.status);
      return res.status(400).json({ isSubscribed: false, raw: data });
    }

    // Abonelik kontrolü: En son expiration date
    const latestExpirationDateMs = data?.latest_receipt_info?.reduce((maxDate, item) => {
      const expiresMs = Number(item.expires_date_ms || 0);
      return expiresMs > maxDate ? expiresMs : maxDate;
    }, 0);

    const isSubscribed = latestExpirationDateMs ? Date.now() < latestExpirationDateMs : false;
    console.log(`✅ Abonelik durumu: ${isSubscribed}`);

    res.json({ isSubscribed, raw: data });

  } catch (error) {
    console.error("❌ Doğrulama hatası:", error);
    res.status(500).json({ isSubscribed: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
