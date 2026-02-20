import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import videoRoutes from './routes/videos.js';
import videoShopifyRoutes from './routes/videos_shopify.js';
import taskRoutes from './routes/tasks.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// More specific path first so /videos_shopify is not matched by /videos
app.use('/videos_shopify', videoShopifyRoutes);
app.use('/videos', videoRoutes);
app.use('/tasks', taskRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
