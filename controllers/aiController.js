const { GoogleGenerativeAI } = require('@google/generative-ai');

const scanCampaignImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Lütfen bir görsel yükleyin.' });
        }

        // 1. Gemini API'yi Başlat
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // 2. 🔥 ŞİMŞEK HIZI: Resmi Cloudinary'den indirmek yerine direkt RAM'den okuyoruz!
        const imageBase64 = req.file.buffer.toString("base64");
        
        const imagePart = {
            inlineData: { data: imageBase64, mimeType: req.file.mimetype }
        };

        // 3. Yapay Zeka Komutu
        const prompt = `
            Sen bir kampanya ve indirim kuponu okuma uzmanısın. 
            Ekteki görsele bak ve SADECE şu 5 bilgiyi bularak geçerli bir JSON formatında döndür:
            1. "operator": Operatörün adı (Vodafone, Turkcell, Türk Telekom vb. Yoksa null yaz)
            2. "brand": Kampanyayı sunan markanın adı (Trendyol, Opet, Madame Coco vb.)
            3. "expiryDate": Kampanyanın son kullanma tarihi (Sadece YYYY-MM-DD formatında yaz. Bulamazsan boş bırak)
            4. "conditions": Kampanyanın şartları (Örn: "1000 TL ve üzeri alışverişlerde geçerli". Kısa ve öz yaz)
            5. "code": Kampanyanın şifresi veya gizli kodu (Kesinlikle doğru harf/rakamları al)

            ÖNEMLİ: Asla fazladan açıklama metni yazma. Sadece süslü parantez { } içinde parse edilebilir saf JSON döndür.
        `;

        // 4. Gemini'a Gönder ve Yanıtı Temizle
        const result = await model.generateContent([prompt, imagePart]);
        let responseText = result.response.text();

        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const campaignData = JSON.parse(responseText);

        res.status(200).json({
            success: true,
            data: campaignData
        });

    } catch (error) {
        console.error("🚨 Yapay Zeka Tarama Hatası:", error.message);
        
        // EĞER HATA HALA 403 İSE, BU KESİNLİKLE GOOGLE API ANAHTARI HATASIDIR!
        if (error.message.includes('403')) {
            return res.status(500).json({ 
                success: false, 
                message: 'Google Gemini API Anahtarınız engellenmiş veya geçersiz. Lütfen Google AI Studio üzerinden yeni bir GEMINI_API_KEY alın.', 
                error: error.message 
            });
        }

        res.status(500).json({ 
            success: false, 
            message: 'Görsel analiz edilemedi. Lütfen daha net bir görsel seçin.', 
            error: error.message 
        });
    }
};

module.exports = { scanCampaignImage };