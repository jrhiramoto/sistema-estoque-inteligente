// Vercel serverless function wrapper
const app = require('../dist/api-index.js').default;

module.exports = app;
