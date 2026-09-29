require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { verifyConnection } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const contentRoutes = require('./routes/contentRoutes');
const historyRoutes = require('./routes/historyRoutes');
const myRightsRoutes = require('./routes/myRightsRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/rights', myRightsRoutes);
app.use('/api/history', historyRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

verifyConnection().then(() => {
  app.listen(PORT, () => {
    console.log(`[server] DRM backend running on http://localhost:${PORT}`);
  });
});
