// .env dosyasındaki API anahtarını okumak için
require('dotenv').config();

async function checkAvailableModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        return console.log("❌ HATA: .env dosyasında GEMINI_API_KEY bulunamadı!");
    }

    console.log("🔍 Google sunucularına bağlanılıyor ve hesabındaki modeller aranıyor...\n");

    try {
        // Google'ın listeleme servisine doğrudan istek atıyoruz
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            console.log("❌ API Hatası:", data.error.message);
            return;
        }

        console.log("✅ KULLANABİLECEĞİN MODELLER (Görsel ve Metin Destekli Olanlar):");
        console.log("--------------------------------------------------");
        
        data.models.forEach(model => {
            // Sadece içerik üretebilen modelleri filtreliyoruz
            if (model.supportedGenerationMethods.includes("generateContent")) {
                // İsmin başındaki "models/" kısmını silip temiz bir liste veriyoruz
                const cleanName = model.name.replace('models/', '');
                console.log(`👉 ${cleanName}`);
            }
        });
        
        console.log("--------------------------------------------------");
        console.log("Lütfen bu listede yazan isimlerden birini kopyala ve aiController.js içine yapıştır.");

    } catch (error) {
        console.error("❌ Sunucuya ulaşılamadı:", error.message);
    }
}

checkAvailableModels();