import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const USE_LAMBDA = process.env.REMOTION_USE_LAMBDA === 'true' || process.env.REMOTION_USE_LAMBDA === '1';
const AWS_REGION = process.env.REMOTION_AWS_REGION || 'us-east-1';

/** Whether rendering uses Remotion Lambda on AWS (vs local). */
export const isLambdaEnabled = USE_LAMBDA;

/** Render backend identifier: `'lambda'` (AWS) or `'local'`. */
export const renderBackend = USE_LAMBDA ? 'lambda' : 'local';

async function renderVideoLocal({ compositionId, inputProps, onProgress }) {
  const { bundle } = await import('@remotion/bundler');
  const { renderMedia, selectComposition } = await import('@remotion/renderer');

  const tmpDir = path.join(process.cwd(), 'tmp');
  await fs.mkdir(tmpDir, { recursive: true }).catch(() => {});

  const outputPath = path.join(tmpDir, `video-${Date.now()}.mp4`);
  const remotionRoot = path.resolve(__dirname, '../../../Remotion/src/index.ts');

  console.log('📦 Bundling...');
  const bundleLocation = await bundle({
    entryPoint: remotionRoot,
    webpackOverride: (config) => config,
  });

  console.log('🎯 Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
  });

  console.log('🎥 Rendering video...');
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    inputProps,
    outputLocation: outputPath,
    onProgress: ({ progress }) => {
      const percent = Math.round(progress * 100);
      process.stdout.write(`\r⏳ Generating: ${percent}%`);
      if (onProgress) onProgress(percent);
    },
  });

  console.log('\n✅ Render complete!');
  return outputPath;
}

async function renderVideoLambda({ compositionId, inputProps, onProgress }) {
  const { getFunctions, renderMediaOnLambda, getRenderProgress } = await import('@remotion/lambda/client');

  const serveUrl = process.env.REMOTION_SERVE_URL;
  if (!serveUrl) {
    throw new Error('REMOTION_SERVE_URL is required when using Remotion Lambda. Deploy your site with: npx remotion lambda sites create <entry-point> --site-name=my-video');
  }

  let functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
  if (!functionName) {
    console.log('🔍 Fetching compatible Lambda function...');
    const functions = await getFunctions({
      region: AWS_REGION,
      compatibleOnly: true,
    });
    if (!functions.length) {
      throw new Error(
        'No compatible Remotion Lambda function found. Deploy one with: npx remotion lambda functions deploy'
      );
    }
    functionName = functions[0].functionName;
    console.log(`📌 Using function: ${functionName}`);
  }

  const tmpDir = path.join(process.cwd(), 'tmp');
  await fs.mkdir(tmpDir, { recursive: true }).catch(() => {});

  console.log('🚀 Starting render on Lambda...');
  const { renderId, bucketName } = await renderMediaOnLambda({
    region: AWS_REGION,
    functionName,
    serveUrl,
    composition: compositionId,
    inputProps: inputProps || {},
    codec: 'h264',
    imageFormat: 'jpeg',
    maxRetries: 1,
    privacy: 'public',
  });

  console.log(`📊 Render ID: ${renderId}, polling progress...`);

  const pollIntervalMs = 1500;
  let progress;

  while (true) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName,
      region: AWS_REGION,
    });

    const percent = Math.round((progress.overallProgress ?? 0) * 100);
    process.stdout.write(`\r⏳ Lambda: ${percent}%`);
    if (onProgress) onProgress(percent);

    if (progress.done) {
      console.log('\n✅ Lambda render complete!');
      break;
    }
    if (progress.fatalErrorEncountered) {
      const errMsg = progress.errors?.map((e) => e.message).join('; ') || 'Unknown error';
      throw new Error(`Lambda render failed: ${errMsg}`);
    }
  }

  const outputFileUrl = progress.outputFile;
  if (!outputFileUrl) {
    throw new Error('Lambda finished but no output file URL returned');
  }

  console.log('📥 Downloading video from S3...');
  const res = await fetch(outputFileUrl);
  if (!res.ok) {
    throw new Error(`Failed to download render: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const outputPath = path.join(tmpDir, `video-${Date.now()}.mp4`);
  await fs.writeFile(outputPath, buffer);

  return outputPath;
}

/**
 * Renders a Remotion composition to an MP4 file.
 * Uses Remotion Lambda on AWS when REMOTION_USE_LAMBDA is set; otherwise renders locally.
 *
 * @param {Object} options
 * @param {string} options.compositionId - Composition ID (e.g. 'ProductHero')
 * @param {Object} options.inputProps - Props for the composition (must be JSON-serializable for Lambda)
 * @param {function(number): void} [options.onProgress] - Callback with progress 0-100
 * @returns {Promise<string>} Path to the rendered MP4 file
 */
export async function renderVideo({ compositionId, inputProps, onProgress }) {
  if (USE_LAMBDA) {
    return renderVideoLambda({ compositionId, inputProps, onProgress });
  }
  return renderVideoLocal({ compositionId, inputProps, onProgress });
}
