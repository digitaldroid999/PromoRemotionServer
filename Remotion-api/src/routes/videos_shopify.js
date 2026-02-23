import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { TEMPLATE_MAP } from '../templates/templateMap.js';
import { renderVideo } from '../render/renderVideo.js';
import { createTask, updateTask } from '../utils/taskManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Base directory for Shopify app generated videos (relative to this file)
const SHOPIFY_PUBLIC_BASE = path.join(__dirname, '../../../../../ShopifyApp/ShopifyApp-PromoNexAI-/public/generated_video');

// Helper: Transform product data based on template
function transformProductData(template, product) {
  if (typeof product === 'string') {
    product = JSON.parse(product);
  }

  const name = product.name || product.title || '';
  const price = product.price || product.salePrice || '$0.00';
  const rating = product.rating || 4.5;
  const reviewCount = product.reviewCount || 0;

  const parsePrice = (priceStr) => {
    if (typeof priceStr === 'number') return priceStr;
    if (!priceStr) return 0;
    const cleanPrice = priceStr.toString().replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleanPrice);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatPrice = (amount) => {
    if (typeof amount === 'string' && amount.includes('$')) return amount;
    const numAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    return isNaN(numAmount) ? '$0.00' : `$${numAmount.toFixed(2)}`;
  };

  switch (template) {
    case 'product-modern-v1':
      return { title: name, price: price, rating: rating };

    case 'product-minimal-v1': {
      const salePriceNum = parsePrice(price);
      const originalPriceNum = product.originalPrice
        ? parsePrice(product.originalPrice)
        : salePriceNum * 1.5;
      return {
        title: name.toUpperCase(),
        originalPrice: formatPrice(originalPriceNum),
        salePrice: formatPrice(salePriceNum),
        rating: rating,
        reviewCount: reviewCount,
        reviews: product.reviews || [
          '🔥 HIGHLY RECOMMENDED!',
          'EXCELLENT QUALITY!',
          'WORTH EVERY PENNY!',
          'FAST DELIVERY! TRY IT!',
          'PERFECT PRODUCT!',
        ],
      };
    }

    default:
      return product;
  }
}

// Helper: save video to Shopify app public folder and return relative URL
async function saveVideoToShopify(filePath, userId, shortId, fileName) {
  const dir = path.join(SHOPIFY_PUBLIC_BASE, String(userId), String(shortId));
  await fs.mkdir(dir, { recursive: true });
  const destPath = path.join(dir, fileName);
  await fs.copyFile(filePath, destPath);
  return `/generated_video/${userId}/${shortId}/${fileName}`;
}

// Background video generation processor (Shopify: local save, no Supabase)
async function processVideoGenerationShopify(taskId, template, product, imageUrl, userId, shortId) {
  try {
    const compositionId = TEMPLATE_MAP[template];

    console.log(`🎬 [${taskId}] Starting Shopify video generation...`);
    console.log(`Template: ${template}`);
    console.log(`Image URL: ${imageUrl}`);

    await updateTask(taskId, {
      status: 'processing',
      stage: 'bundling',
      progress: 10,
    });

    const transformedProduct = transformProductData(template, product);
    console.log(`🔄 [${taskId}] Transformed product data:`, JSON.stringify(transformedProduct, null, 2));

    const inputProps = { product: transformedProduct, imageUrl };

    console.log(`📦 [${taskId}] Bundling Remotion project...`);
    await updateTask(taskId, {
      status: 'processing',
      stage: 'rendering',
      progress: 30,
    });

    // Render video with real-time progress updates
    const videoPath = await renderVideo({ 
      compositionId, 
      inputProps,
      onProgress: async (percent) => {
        // Update task with real rendering progress (30% to 80% range)
        // Map 0-100% rendering to 30-80% overall progress
        const overallProgress = 30 + Math.round((percent / 100) * 50);
        await updateTask(taskId, {
          status: 'processing',
          stage: 'rendering',
          progress: overallProgress,
        });
      }
    });

    const fileName = `video-${Date.now()}.mp4`;
    console.log(`💾 [${taskId}] Saving video to Shopify app public folder...`);
    await updateTask(taskId, {
      status: 'processing',
      stage: 'uploading',
      progress: 80,
    });

    const videoUrl = await saveVideoToShopify(videoPath, userId, shortId, fileName);

    console.log(`🧹 [${taskId}] Cleaning up temporary files...`);
    await fs.unlink(videoPath);

    console.log(`✅ [${taskId}] Shopify video generation completed!`);
    const completedTask = await updateTask(taskId, {
      status: 'completed',
      stage: 'done',
      progress: 100,
      videoUrl,
    });
    console.log(`✅ [${taskId}] Task updated to completed. Video URL: ${videoUrl}`);
    console.log(`📦 [${taskId}] Final task state:`, JSON.stringify(completedTask, null, 2));
  } catch (err) {
    console.error(`❌ [${taskId}] Shopify video generation failed:`, err);
    await updateTask(taskId, {
      status: 'failed',
      stage: 'error',
      error: err.message,
    });
  }
}

// GET so callers can verify this is the Remotion API (not React Router)
router.get('/', (_req, res) => {
  res.set('X-Service', 'Remotion-API');
  res.json({
    service: 'Remotion API',
    message: 'Use POST to start video generation',
    postBody: { template: 'string', product: 'object', imageUrl: 'string', user_id: 'string', short_id: 'string' },
  });
});

router.post('/', async (req, res) => {
  try {
    console.log('📥 [REQUEST] POST /shopify/videos');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    const { template, product, imageUrl, user_id, short_id } = req.body;
    console.log(`Received request for template: ${template}`);

    if (!TEMPLATE_MAP[template]) {
      const errorResponse = { error: 'Invalid template' };
      console.log('❌ [RESPONSE] 400:', errorResponse);
      return res.status(400).json(errorResponse);
    }

    if (!imageUrl) {
      const errorResponse = { error: 'Product imageUrl is required' };
      console.log('❌ [RESPONSE] 400:', errorResponse);
      return res.status(400).json(errorResponse);
    }

    if (!product) {
      const errorResponse = { error: 'Product data is required' };
      console.log('❌ [RESPONSE] 400:', errorResponse);
      return res.status(400).json(errorResponse);
    }

    if (!user_id) {
      const errorResponse = { error: 'user_id is required' };
      console.log('❌ [RESPONSE] 400:', errorResponse);
      return res.status(400).json(errorResponse);
    }

    if (!short_id) {
      const errorResponse = { error: 'short_id is required' };
      console.log('❌ [RESPONSE] 400:', errorResponse);
      return res.status(400).json(errorResponse);
    }

    const task = await createTask({
      template,
      product: typeof product === 'string' ? JSON.parse(product) : product,
      imageUrl,
      user_id,
      short_id,
      status: 'pending',
      stage: 'queued',
      progress: 0,
    });

    processVideoGenerationShopify(task.id, template, product, imageUrl, user_id, short_id).catch(
      (err) => console.error('Unhandled error in Shopify video generation:', err)
    );

    const successResponse = {
      taskId: task.id,
      status: 'pending',
      message: 'Video generation started. Use /tasks/:taskId to check status.',
    };

    console.log('✅ [RESPONSE] 200:', JSON.stringify(successResponse, null, 2));
    res.json(successResponse);
  } catch (err) {
    console.error('❌ Failed to create Shopify video generation task:', err);
    const errorResponse = { error: 'Failed to create task', details: err.message };
    console.log('❌ [RESPONSE] 500:', errorResponse);
    res.status(500).json(errorResponse);
  }
});

export default router;
