const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// 1. ÇEVRE DEĞİŞKENLERİNİ YÜKLE
dotenv.config();

// 2. EXPRESS VE HTTP SERVER BAŞLATMA
const app = express();
const server = http.createServer(app);

// 3. GÜVENLİK (HELMET & CORS)
// Helmet ayarlarını Vercel ve Google Auth ile uyumlu hale getiriyoruz
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, 
}));

// CORS: Vercel adresine tam yetki veriyoruz
app.use(cors({
    origin: ['https://takaskupon-frontend.vercel.app', 'https://takaskupon-frontend-alpaygp0.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. SOCKET.IO MOTORU (Hata Veren Kısım Burasıydı)
const io = new Server(server, {
    cors: {
        origin: 'https://takaskupon-frontend.vercel.app',
        methods: ["GET", "POST"],
        credentials: true
    },
    allowEIO3: true,
    path: '/socket.io/' // Vercel'in dosyayı bulabilmesi için yolu netleştiriyoruz
});

io.on('connection', (socket) => {
    console.log('📡 Bir kullanıcı bağlandı:', socket.id);
    socket.on('register', (userId) => {
        socket.join(userId);
    });
});

app.set('socketio', io);

// 5. HIZ SINIRLANDIRMA (RATE LIMIT)
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { message: "Çok fazla istek attınız." }
});
app.use(generalLimiter);

// 6. ROTALAR
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const authRoutes = require('./routes/authRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const aiRoutes = require('./routes/aiRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/ai', aiRoutes);

// Sağlık Kontrolü
app.get('/', (req, res) => {
    res.json({ success: true, message: "🚀 TakasKupon API Motoru Yayında!" });
});

// 7. HATA YAKALAYICI
app.use((err, req, res, next) => {
    console.error("🚨 Sunucu Hatası:", err.message);
    res.status(500).json({ success: false, message: 'Sunucu hatası.' });
});

// ==========================================
// 8. VERİTABANI VE BAŞLATMA
// ==========================================
const PORT = process.env.PORT || 10000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Sunucu ${PORT} portunda aktif!`);
    
    if (process.env.MONGO_URI) {
        // İŞTE SİHİRLİ DOKUNUŞ BURASI (family: 4 eklendi)
        mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000, // 5 saniyede cevap alamazsa hatayı bas
            family: 4 // ZORUNLU: Node.js'i IPv4 kullanmaya zorla (Atlas uyuşmazlığını çözer)
        })
            .then(() => {
                console.log('✅ MongoDB Bağlantısı Başarılı!');
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
