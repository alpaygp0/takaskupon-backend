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
const server = http.createServer(app);

// ==========================================
// 3. DİNAMİK CORS VE GÜVENLİK AYARLARI
// ==========================================

// Helmet: Vercel ve Google Auth ile uyumlu hale getirildi
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, 
}));

// Dinamik CORS Kuralı: İçinde 'vercel.app' geçen tüm linklere izin ver
const corsOptions = {
    origin: function (origin, callback) {
        // Eğer istek bir tarayıcıdan gelmiyorsa (postman vb.) veya vercel/localhost ise izin ver
        if (!origin || origin.includes('vercel.app') || origin.includes('localhost') || origin.includes('onrender.com')) {
            callback(null, true);
        } else {
            callback(new Error('CORS Policy: Bu adrese izin yok!'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
};

// Express için CORS'u uygula
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 4. SOCKET.IO MOTORU
// ==========================================
const io = new Server(server, {
    cors: corsOptions, // Dinamik CORS kuralını Socket.io'ya da uyguladık
    allowEIO3: true
});

io.on('connection', (socket) => {
    console.log('📡 Bir kullanıcı bağlandı:', socket.id);
    
    socket.on('register', (userId) => {
        socket.join(userId);
    });

    socket.on('disconnect', () => {
        console.log('❌ Kullanıcı ayrıldı:', socket.id);
    });
});

app.set('socketio', io);

// ==========================================
// 5. HIZ SINIRLANDIRMA (RATE LIMIT)
// ==========================================
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { message: "Çok fazla istek attınız." }
});
app.use(generalLimiter);

// ==========================================
// 6. ROTALAR
// ==========================================
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

// ==========================================
// 7. HATA YAKALAYICI
// ==========================================
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
        mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000, 
            family: 4 // Node.js'i IPv4 kullanmaya zorla (Atlas uyuşmazlığını çözer)
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
