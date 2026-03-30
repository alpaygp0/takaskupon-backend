const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
            return next(); // HATA BURADAYDI: Return ekledik, sunucu çökmeyecek.
        } catch (error) {
            return res.status(401).json({ message: 'Yetkisiz erişim, token geçersiz veya süresi dolmuş.' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Yetkisiz erişim, token bulunamadı.' });
    }
};

module.exports = { protect };