// ==========================================
// 1. MODÜLLER VE YAPILANDIRMA
// ==========================================
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// .env dosyasını yükle
dotenv.config();

// ==========================================
// 2. UYGULAMA VE SERVER BAŞLATMA
// ==========================================
const app = express();
const server = http. Rios.createServer(app); // Socket.io için http server gerekli

// ==========================================
// 3. GÜVENLİK AYARLARI (HELMET & CORS)
// ==========================================

// Helmet: Güvenlik başlıklarını ayarlar (Vercel/Google Auth uyumlu hali)
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Google Auth ve harici scriptlerin çalışması için
}));

// CORS: Vercel'den gelen isteklere izin ver
app.use(cors({
    origin: ['https://takaskupon-frontend.vercel.app', 'https://takaskupon-frontend-alpaygp0.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 4. SOCKET.IO AYARLARI (REAL-TIME)
// ==========================================
const io = new Server(server, {
    cors: {
        origin: ['https://takaskupon-frontend.vercel.app'],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Socket bağlantı yönetimi
io.on('connection', (socket) => {
    console.log('📡 Bir kullanıcı bağlandı:', socket.id);
    
    socket.on('register', (userId) => {
        socket.join(userId);
        console.log(`👤 Kullanıcı odasına katıldı: ${userId}`);
    });

    socket.on('disconnect', () => {
        console.log('❌ Kullanıcı ayrıldı');
    });
});

// io nesnesini route'larda kullanabilmek için app'e ekle
app.set('socketio', io);

// ==========================================
// 5. HIZ SINIRLANDIRMA (RATE LIMIT)
// ==========================================
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { message: "Çok fazla istek attınız, lütfen biraz dinlenin." }
});
app.use(generalLimiter);

// ==========================================
// 6. ROTALAR VE STATİK DOSYALAR
// ==========================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const authRoutes = require('./routes/authRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const aiRoutes = require('./routes/aiRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/ai', aiRoutes);

// Canlılık Kontrolü (Health Check)
app.get('/', (req, res) => {
    res.json({ success: true, message: "🚀 TakasKupon API Motoru Yayında!" });
});

// ==========================================
// 7. HATA YAKALAYICI
// ==========================================
app.use((err, req, res, next) => {
    console.error("🚨 Sunucu Hatası:", err.message);
    res.status(500).json({ success: false, message: 'Sunucu tarafında bir hata oluştu.' });
});

// ==========================================
// 8. VERİTABANI VE BAŞLATMA
// ==========================================
const PORT = process.env.PORT || 10000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Sunucu ${PORT} portunda aktif!`);
    
    if (process.env.MONGO_URI) {
        mongoose.connect(process.env.MONGO_URI)
            .then(() => {
                console.log('✅ MongoDB Bağlantısı Başarılı!');
                
                // CronJob'ları başlat (Eğer varsa)
                try {
                    const startCronJobs = require('./utils/cronJobs');
                    startCronJobs();
                } catch (e) {
                    console.log("ℹ️ CronJob modülü aktif değil.");
                }
            })
            .catch(err => console.error('❌ MongoDB Hatası:', err.message));
    }
});
