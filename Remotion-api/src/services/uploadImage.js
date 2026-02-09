import fs from 'fs/promises';
import { supabase } from '../services/supabase.js';

export async function uploadImage(filePath, fileName) {
  const buffer = await fs.readFile(filePath);

  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(fileName, buffer, {
      contentType: 'image/png', // adjust for jpeg if needed
      upsert: true,
    });

  if (error) throw error;

  const { publicUrl } = supabase.storage
    .from('product-images')
    .getPublicUrl(data.path);

  return publicUrl;ss
}
