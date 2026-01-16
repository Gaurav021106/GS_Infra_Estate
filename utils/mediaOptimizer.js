const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

// Set the path to the ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Helper: Delete a file safely
 */
const deleteFile = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) console.error(`⚠️ Failed to delete original file: ${filePath}`, err.message);
  });
};

/**
 * Optimizes an Image
 * - Format: WebP (Superior compression over JPEG/PNG)
 * - Size: Max 1920px width/height (Full HD limit)
 * - Quality: 75% (Best balance for real estate photos)
 */
const optimizeImage = async (filePath) => {
  try {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const name = path.basename(filePath, ext);
    // Create new filename: image-123.jpg -> image-123-opt.webp
    const optimizedPath = path.join(dir, `${name}-opt.webp`);

    await sharp(filePath)
      .resize(1920, 1920, { 
        fit: 'inside',             // Maintain aspect ratio
        withoutEnlargement: true   // Don't upscale small images
      })
      .webp({ 
        quality: 75,               // Good quality, low file size
        effort: 4                  // CPU effort for compression (0-6)
      })
      .toFile(optimizedPath);

    // Remove the huge original file
    deleteFile(filePath);

    return optimizedPath;
  } catch (error) {
    console.error(`❌ Image optimization error for ${filePath}:`, error);
    return filePath; // Fallback to original if it fails
  }
};

/**
 * Optimizes a Video
 * - Resolution: 720p (Perfect for mobile/web, much smaller than 1080p/4k)
 * - Codec: H.264 (Universal compatibility)
 * - Compression: CRF 28 (Aggressive but decent quality)
 */
const optimizeVideo = (filePath) => {
  return new Promise((resolve) => {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const name = path.basename(filePath, ext);
    const optimizedPath = path.join(dir, `${name}-opt.mp4`);

    ffmpeg(filePath)
      .output(optimizedPath)
      .videoCodec('libx264')
      .size('?x720') // Scale height to 720px, auto-calculate width
      .outputOptions([
        '-crf 28',          // Constant Rate Factor (Lower is better quality, Higher is lower size. 28 is good for web)
        '-preset veryfast', // Compress quickly
        '-movflags +faststart', // Essential for web: allows video to play before fully downloading
        '-an'               // OPTIONAL: Removes audio to save more space. Remove this line if audio is needed.
      ])
      .on('end', () => {
        deleteFile(filePath); // Remove original
        resolve(optimizedPath);
      })
      .on('error', (err) => {
        console.error(`❌ Video optimization error for ${filePath}:`, err.message);
        resolve(filePath); // Fallback to original
      })
      .run();
  });
};

/**
 * Main function to process all uploaded files
 */
const processUploads = async (files) => {
  const processed = {};

  // 1. Process Images
  if (files.images && files.images.length > 0) {
    processed.imageUrls = [];
    console.log(`🖼️ Optimizing ${files.images.length} images...`);
    for (const file of files.images) {
      const newPath = await optimizeImage(file.path);
      processed.imageUrls.push(`/uploads/${path.basename(newPath)}`);
    }
  }

  // 2. Process Videos
  if (files.videos && files.videos.length > 0) {
    processed.videoUrls = [];
    console.log(`🎥 Optimizing ${files.videos.length} videos...`);
    for (const file of files.videos) {
      const newPath = await optimizeVideo(file.path);
      processed.videoUrls.push(`/uploads/${path.basename(newPath)}`);
    }
  }

  // 3. Process Virtual Tour (Video)
  if (files.virtualTourFile && files.virtualTourFile[0]) {
    console.log('🎥 Optimizing Virtual Tour...');
    const newPath = await optimizeVideo(files.virtualTourFile[0].path);
    processed.virtualTourUrl = `/uploads/${path.basename(newPath)}`;
  }

  // 4. Process 3D Map
  // (3D files are hard to compress safely server-side without breaking textures. 
  // We keep the original but relying on GZIP/Brotli compression in index.js for delivery)
  if (files.map3dFile && files.map3dFile[0]) {
    processed.map3dUrl = `/uploads/${files.map3dFile[0].filename}`;
  }

  return processed;
};

module.exports = { processUploads };