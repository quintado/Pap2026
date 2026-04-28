const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        message: 'Muitas requisições deste IP. Tente novamente mais tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 30,
    skipSuccessfulRequests: true,
    message: {
        message: 'Muitas tentativas de login. Tente novamente em 5 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const createLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: {
        message: 'Limite de criações excedido. Tente novamente mais tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    globalLimiter,
    authLimiter,
    createLimiter
};
