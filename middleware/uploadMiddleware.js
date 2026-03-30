const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 1. Klasör Kontrolü: Eğer 'uploads' klasörü yoksa otomatik oluşturur
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 2. Güvenli Disk Depolama Motoru (Local Storage)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir + '/'); // Resimleri sunucudaki uploads klasörüne indir
    },
    filename: function (req, file, cb) {
        // Resim isimleri çakışmasın diye sonuna rastgele sayılar ve tarih ekliyoruz
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'takas-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// 3. Multer Motorunu Başlat
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Maksimum 5MB sınırımız kalsın
    fileFilter: (req, file, cb) => {
        // Sadece resim formatlarına izin ver
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Sadece görsel dosyaları yüklenebilir!'), false);
        }
    }
});

module.exports = upload;