import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import videoRoutes from './routes/videos.js';
import videoShopifyRoutes from './routes/videos_shopify.js';
import taskRoutes from './routes/tasks.js';
import { renderBackend } from './render/renderVideo.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Use /shopify/videos so /videos never matches it (Express matches by prefix)
app.use('/shopify/videos', videoShopifyRoutes);
app.use('/videos', videoRoutes);
app.use('/tasks', taskRoutes);

app.get('/health', (req, res) => {
  res.set('X-Render-Backend', renderBackend);
  res.json({ status: 'ok', renderBackend });
});

// Identify server and whether it uses AWS Lambda or local rendering
app.get('/', (req, res) => {
  res.set('X-Service', 'Remotion-API');
  res.set('X-Render-Backend', renderBackend);
  res.json({
    service: 'Remotion API',
    renderBackend: renderBackend === 'lambda' ? 'aws' : 'local',
    message: renderBackend === 'lambda' ? 'Videos render on Remotion Lambda (AWS)' : 'Videos render locally',
  });
});

// 404 fallback (JSON so we know it's this API, not another server)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.method + ' ' + req.path });
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  console.log(`  Render backend: ${renderBackend === 'lambda' ? 'AWS Lambda' : 'local'}`);
  console.log('  GET  /              – service info + render backend (AWS vs local)');
  console.log('  GET  /health        – health + X-Render-Backend header');
  console.log('  POST /shopify/videos – start Shopify video generation');
  console.log('  GET  /shopify/videos – check this is Remotion API');
  console.log('  GET  /tasks/:id       – task status');
});
