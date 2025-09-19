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

app.post("/verify-receipt", async (req, res) => {
  const receiptData = req.body["receipt-data"];
  if (!receiptData) {
    console.log("❌ Receipt data gelmedi");
    return res.status(400).json({ error: "Receipt data is required" });
  }

  console.log("📥 Receipt data alındı");

  try {
    // İlk olarak Production endpoint'ini dene
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
    console.log("📦 Production yanıt:", data);

    // Eğer sandbox verisi gerekiyorsa 21007 hatası ile gelir
    // Bu hatayı aldıktan sonra sandbox endpoint’e yönlendirilir
    if (data.status === 21007) {
      console.log("🔄 Sandbox testi gerekiyor, sandbox endpoint’e yönlendiriliyor");
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
      console.log("📦 Sandbox yanıt:", data);
    }

    // Abonelik durumu kontrolü
    const latestExpirationDateMs = data?.latest_receipt_info?.reduce((maxDate, item) => {
      const expiresMs = Number(item.expires_date_ms || 0);
      return expiresMs > maxDate ? expiresMs : maxDate;
    }, 0);

    const isSubscribed = latestExpirationDateMs ? Date.now() < latestExpirationDateMs : false;

    console.log(`✅ Abonelik durumu: ${isSubscribed}`);

    // Başarılı doğrulama (status 0) veya zaten hata varsa, yanıtı gönder
    if (data.status === 0 || data.status === 21002) {
      res.json({ isSubscribed: !!isSubscribed, raw: data });
    } else {
      res.status(500).json({ isSubscribed: false, raw: data, error: "Doğrulama başarısız oldu" });
    }

  } catch (error) {
    console.error("❌ Doğrulama hatası:", error);
    res.status(500).json({ isSubscribed: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});