const cron = require('node-cron');
const Campaign = require('../models/Campaign'); // Model yolunu kendi klasör yapına göre kontrol et

const startCronJobs = () => {
    // '0 3 * * *' -> Her gece saat 03:00'te çalışır.
    // Eğer test etmek istersen geçici olarak '* * * * *' (her dakika çalışır) yapabilirsin.
    cron.schedule('0 3 * * *', async () => {
        console.log('🧹 [CRON] Temizlik Robotu Uyandı: Süresi dolan ilanlar taranıyor...');
        
        try {
            const now = new Date();
            
            // Veritabanında statüsü 'aktif' olup, son kullanma tarihi şu andan küçük olanları bul ve güncelle
            const result = await Campaign.updateMany(
                { status: 'aktif', expiryDate: { $lt: now } },
                { $set: { status: 'süresi_doldu' } }
            );

            if (result.modifiedCount > 0) {
                console.log(`✅ [CRON] Temizlik tamamlandı! ${result.modifiedCount} adet ilanın statüsü 'süresi_doldu' olarak güncellendi.`);
            } else {
                console.log('✅ [CRON] Temizlik tamamlandı. Süresi dolan yeni ilan bulunamadı.');
            }

        } catch (error) {
            console.error('❌ [CRON] Temizlik Robotu hata ile karşılaştı:', error);
        }
    });
};

module.exports = startCronJobs;