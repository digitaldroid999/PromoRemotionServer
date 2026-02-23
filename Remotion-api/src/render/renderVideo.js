import path from 'path';
import fs from 'fs/promises';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function renderVideo({ compositionId, inputProps, onProgress }) {
  const tmpDir = path.join(process.cwd(), 'tmp');
  try {
    await fs.mkdir(tmpDir, { recursive: true });
  } catch (err) {
    // Directory already exists
  }

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
      
      // Call the callback if provided for real-time progress updates
      if (onProgress) {
        onProgress(percent);
      }
    },
  });

  console.log('\n✅ Render complete!');
  return outputPath;
}
