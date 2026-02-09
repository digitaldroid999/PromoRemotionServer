import fs from 'fs/promises';
import { supabase } from '../services/supabase.js';

export async function uploadVideo(filePath, jobId) {
  const buffer = await fs.readFile(filePath);

  const { data, error } = await supabase.storage
    .from('generated-videos')
    .upload(`${jobId}.mp4`, buffer, {
      contentType: 'video/mp4',
      upsert: true,
    });

  if (error) throw error;

  const { publicUrl } = supabase.storage
    .from('generated-videos')
    .getPublicUrl(data.path);

  return publicUrl;
}
