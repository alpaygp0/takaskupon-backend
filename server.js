// ==========================================
// 1. GEREKLİ PAKETLER (Sadece birer kez çağrılır)
// ==========================================
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Çevre değişkenlerini (.env) yükle
dotenv.config();

// ==========================================
// 2. UYGULAMAYI OLUŞTUR (Temel Atma)
// ==========================================
const app = express();

// ==========================================
// 3. GÜVENLİK VE ARA KATMANLAR (Sıralama Önemlidir)
// ==========================================
app.use(helmet()); // Kalkanı giydir
app.use(express.json()); // Gelen JSON verilerini oku
app.use(express.urlencoded({ extended: true }));

app.use(cors({
    origin: ['https://takaskupon-frontend.vercel.app'], // Sadece senin Vercel linkin
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true 
}));
// ==========================================
// 4. DDoS VE BRUTE FORCE KORUMASI (Rate Limiter)
// ==========================================
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 200, 
    message: { message: "Çok fazla istek attınız, lütfen biraz dinlenin." }
});
app.use(generalLimiter);

const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 saat
    max: 10, 
    message: { message: "Çok fazla başarısız deneme yaptınız. Güvenliğiniz için bu işlem 1 saatliğine kilitlendi." }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/register', authLimiter);

// ==========================================
// 5. YÜKLENEN GÖRSELLERİ DIŞARI AÇMA
// ==========================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// 6. API ROTALARI (Uç Noktalar)
// ==========================================
const authRoutes = require('./routes/authRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const aiRoutes = require('./routes/aiRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/ai', aiRoutes);

// Render'da linke tıklandığında uygulamanın çalıştığını gösteren test mesajı
app.get('/', (req, res) => {
    res.json({ 
        success: true, 
        message: "🚀 TakasKupon API Motoru Tıkır Tıkır Çalışıyor!" 
    });
});

// ==========================================
// 7. GLOBAL HATA YAKALAYICI
// ==========================================
app.use((err, req, res, next) => {
    console.error("🚨 Sunucu Hatası Yakalandı:", err.message);
    res.status(500).json({ 
        success: false, 
        message: 'İşlem sırasında bir hata oluştu.', 
        error: err.message 
    });
});

// ==========================================
// 8. VERİTABANI BAĞLANTISI VE MOTORU ATEŞLEME
// ==========================================
const PORT = process.env.PORT || 5000;

// 1. Önce Render için kapıları açıyoruz (Timeout hatasını önler)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Takas-App Motoru ${PORT} portunda çalışıyor!`);
    
    // 2. Sunucu ayaklandıktan sonra Veritabanına bağlanıyoruz
    if (!process.env.MONGO_URI) {
        console.error("❌ DİKKAT: MONGO_URI şifresi bulunamadı!");
        return;
    }

    mongoose.connect(process.env.MONGO_URI)
        .then(() => {
            console.log('✅ MongoDB Veritabanına Başarıyla Bağlanıldı!');
            
            // Temizlik robotunu başlat
            try {
                const startCronJobs = require('./utils/cronJobs');
                startCronJobs();
            } catch (error) {
                console.log("ℹ️ CronJob modülü bulunamadı, bu adım atlanıyor.");
            }
        })
        .catch((error) => {
            console.error('❌ MongoDB Bağlantı Hatası:', error.message);
        });
});
