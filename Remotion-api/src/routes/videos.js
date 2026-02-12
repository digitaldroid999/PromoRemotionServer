import express from 'express';
import fs from 'fs/promises';
import { TEMPLATE_MAP } from '../templates/templateMap.js';
import { renderVideo } from '../render/renderVideo.js';
import { supabase } from '../services/supabase.js';
import { createTask, updateTask } from '../utils/taskManager.js';

const router = express.Router();

// Helper: Transform product data based on template
function transformProductData(template, product) {
  if (typeof product === 'string') {
    product = JSON.parse(product);
  }

  // Extract base fields from product
  const name = product.name || product.title || '';
  const price = product.price || product.salePrice || '$0.00';
  const rating = product.rating || 4.5;
  const reviewCount = product.reviewCount || 0;

  // Transform based on template type
  switch (template) {
    case 'product-modern-v1':
      // ProductHero template expects: title, price, rating
      return {
        title: name,
        price: price,
        rating: rating,
      };
    
    case 'product-minimal-v1':
      // FullScreenSocialProof template expects: title, salePrice/originalPrice, rating, reviewCount, reviews
      return {
        title: name.toUpperCase(),
        originalPrice: product.originalPrice || '$99.00',
        salePrice: price,
        rating: rating,
        reviewCount: reviewCount,
        reviews: product.reviews || [
          '🔥 HIGHLY RECOMMENDED!',
          'EXCELLENT QUALITY!',
          'WORTH EVERY PENNY!',
          'FAST DELIVERY!',
          'PERFECT PRODUCT!'
        ],
      };
    
    default:
      // Fallback: return original product data
      return product;
  }
}

// Helper: upload video to Supabase
async function uploadVideo(filePath, fileName) {
  const buffer = await fs.readFile(filePath);

  const { data, error } = await supabase.storage
    .from('temp')
    .upload(`uploaded_videos/${fileName}`, buffer, { contentType: 'video/mp4', upsert: true });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('temp')
    .getPublicUrl(`uploaded_videos/${fileName}`);

  return publicUrl;
}

// Background video generation processor
async function processVideoGeneration(taskId, template, product, imageUrl) {
  try {
    const compositionId = TEMPLATE_MAP[template];

    console.log(`🎬 [${taskId}] Starting video generation...`);
    console.log(`Template: ${template}`);
    console.log(`Image URL: ${imageUrl}`);

    // Update status to processing
    await updateTask(taskId, {
      status: 'processing',
      stage: 'bundling',
      progress: 10,
    });

    // Transform product data for the specific template
    const transformedProduct = transformProductData(template, product);
    console.log(`🔄 [${taskId}] Transformed product data:`, JSON.stringify(transformedProduct, null, 2));

    const inputProps = {
      product: transformedProduct,
      imageUrl,
    };

    console.log(`📦 [${taskId}] Bundling Remotion project...`);
    await updateTask(taskId, {
      status: 'processing',
      stage: 'rendering',
      progress: 30,
    });

    const videoPath = await renderVideo({ compositionId, inputProps });

    console.log(`☁️  [${taskId}] Uploading video to Supabase...`);
    await updateTask(taskId, {
      status: 'processing',
      stage: 'uploading',
      progress: 80,
    });

    const videoUrl = await uploadVideo(videoPath, `video-${Date.now()}.mp4`);

    console.log(`🧹 [${taskId}] Cleaning up temporary files...`);
    await fs.unlink(videoPath);

    console.log(`✅ [${taskId}] Video generation completed!`);
    await updateTask(taskId, {
      status: 'completed',
      stage: 'done',
      progress: 100,
      videoUrl,
    });
  } catch (err) {
    console.error(`❌ [${taskId}] Video generation failed:`, err);
    await updateTask(taskId, {
      status: 'failed',
      stage: 'error',
      error: err.message,
    });
  }
}

router.post('/', async (req, res) => {
  try {
    console.log('📥 [REQUEST] POST /videos');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    
    const { template, product, imageUrl } = req.body;
    console.log(`Received request for template: ${template}`);
    console.log(`Received request for product: ${product}`);

    // Validation
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

    // Create task
    const task = await createTask({
      template,
      product: typeof product === 'string' ? JSON.parse(product) : product,
      imageUrl,
      status: 'pending',
      stage: 'queued',
      progress: 0,
    });

    // Start processing in background (don't await)
    processVideoGeneration(task.id, template, product, imageUrl).catch(err => {
      console.error('Unhandled error in video generation:', err);
    });

    // Return task ID immediately
    const successResponse = {
      taskId: task.id,
      status: 'pending',
      message: 'Video generation started. Use /tasks/:taskId to check status.',
    };
    
    console.log('✅ [RESPONSE] 200:', JSON.stringify(successResponse, null, 2));
    res.json(successResponse);
  } catch (err) {
    console.error('❌ Failed to create video generation task:', err);
    const errorResponse = { error: 'Failed to create task', details: err.message };
    console.log('❌ [RESPONSE] 500:', errorResponse);
    res.status(500).json(errorResponse);
  }
});

export default router;
