const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const Property = require('../models/property');

// ======================= MEMORY OPTIMIZATION =======================
// 1. Disable Sharp's internal cache to prevent heap spikes
sharp.cache(false);
// 2. Limit Sharp to 1 thread to play nice with shared vCPU
sharp.concurrency(1);

// [CRITICAL FIX] Disable Video Optimization on low-memory instances
// Set this to true ONLY if you have >2GB RAM
const ENABLE_VIDEO_OPTIMIZATION = false;

// Set the path to the ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Helper: Delete a file safely
 */
const deleteFile = (filePath) => {
  fs.unlink(filePath, (err) => {
    // Ignore ENOENT (file not found) errors
    if (err && err.code !== 'ENOENT') console.error(`⚠️ Failed to delete original file: ${filePath}`, err.message);
  });
};

/**
 * Helper: Get Raw URLs immediately (for instant UI response)
 */
const getRawUrls = (files) => {
  const processed = {
    imageUrls: [],
    videoUrls: [],
    virtualTourUrl: null,
    map3dUrl: null
  };

  if (files.images) {
    processed.imageUrls = files.images.map(f => `/uploads/${f.filename}`);
  }
  if (files.videos) {
    processed.videoUrls = files.videos.map(f => `/uploads/${f.filename}`);
  }
  if (files.virtualTourFile && files.virtualTourFile[0]) {
    processed.virtualTourUrl = `/uploads/${files.virtualTourFile[0].filename}`;
  }
  if (files.map3dFile && files.map3dFile[0]) {
    processed.map3dUrl = `/uploads/${files.map3dFile[0].filename}`;
  }

  return processed;
};

/**
 * Optimizes an Image
 */
const optimizeImage = async (filePath) => {
  try {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const name = path.basename(filePath, ext);
    const optimizedPath = path.join(dir, `${name}-opt.webp`);

    // [MEMORY] Resize with 'inside' avoids complex cropping memory usage
    await sharp(filePath)
      .resize(1920, 1920, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      // [FIX] Lower effort to 0 (fastest, least memory) vs default 4 or previous 3
      .webp({ quality: 75, effort: 0 }) 
      .toFile(optimizedPath);

    // Remove original after optimization
    deleteFile(filePath);

    return optimizedPath;
  } catch (error) {
    console.error(`❌ Image optimization error for ${filePath}:`, error);
    return filePath; // Fallback to original
  }
};

/**
 * Optimizes a Video
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
      .size('?x720')
      .outputOptions([
        '-crf 28',
        '-preset ultrafast', // [FIX] Changed to ultrafast for min CPU/RAM usage
        '-movflags +faststart',
        '-an' // Strip audio to save space
      ])
      .on('end', () => {
        deleteFile(filePath);
        resolve(optimizedPath);
      })
      .on('error', (err) => {
        console.error(`❌ Video optimization error for ${filePath}:`, err.message);
        resolve(filePath);
      })
      .run();
  });
};

/**
 * Background Optimization Task
 * OPTIMIZATION: Processes ALL media sequentially to minimize RAM usage.
 */
const optimizeBackground = async (propertyId, files) => {
  console.log(`🚀 Starting background optimization for Property ID: ${propertyId}`);
  
  const updates = {};
  const pullQueries = {}; // To remove raw URLs
  const pushQueries = {}; // To add optimized URLs

  try {
    // 1. Process Images (SEQUENTIAL LOOP)
    if (files.images && files.images.length > 0) {
      console.log(`🖼️ Optimizing ${files.images.length} images...`);
      
      const rawUrls = files.images.map(f => `/uploads/${f.filename}`);
      const optimizedPaths = [];

      // Use for...of to process one by one
      for (const file of files.images) {
        // [MEMORY] Trigger GC before heavy operation if exposed
        if (global.gc) global.gc();

        const result = await optimizeImage(file.path);
        optimizedPaths.push(result);
      }

      const optimizedUrls = optimizedPaths.map(p => `/uploads/${path.basename(p)}`);

      pullQueries.imageUrls = { $in: rawUrls };
      pushQueries.imageUrls = { $each: optimizedUrls };
    }

    // 2. Process Videos (SKIPPED BY DEFAULT TO SAVE RAM)
    if (files.videos && files.videos.length > 0) {
      if (ENABLE_VIDEO_OPTIMIZATION) {
        console.log(`🎥 Optimizing ${files.videos.length} videos...`);
        const rawUrls = files.videos.map(f => `/uploads/${f.filename}`);
        const optimizedUrls = [];
        
        for (const file of files.videos) {
          if (global.gc) global.gc();
          const newPath = await optimizeVideo(file.path);
          optimizedUrls.push(`/uploads/${path.basename(newPath)}`);
        }

        pullQueries.videoUrls = { $in: rawUrls };
        pushQueries.videoUrls = { $each: optimizedUrls };
      } else {
         console.log('⚠️ Video optimization skipped (Memory Preservation Mode)');
      }
    }

    // 3. Process Virtual Tour (Video-based)
    if (files.virtualTourFile && files.virtualTourFile[0] && ENABLE_VIDEO_OPTIMIZATION) {
      console.log('🎥 Optimizing Virtual Tour...');
      const rawUrl = `/uploads/${files.virtualTourFile[0].filename}`;
      const newPath = await optimizeVideo(files.virtualTourFile[0].path);
      updates.virtualTourUrl = `/uploads/${path.basename(newPath)}`;
    }

    // 4. Execute DB Updates safely
    if (pullQueries.imageUrls || pullQueries.videoUrls || Object.keys(updates).length > 0) {
      const prop = await Property.findById(propertyId);
      if (prop) {
        
        // Handle Images
        if (pullQueries.imageUrls) {
          prop.imageUrls = prop.imageUrls.filter(url => !pullQueries.imageUrls.$in.includes(url));
          prop.imageUrls.push(...pushQueries.imageUrls.$each);
        }

        // Handle Videos
        if (pullQueries.videoUrls) {
          prop.videoUrls = prop.videoUrls.filter(url => !pullQueries.videoUrls.$in.includes(url));
          prop.videoUrls.push(...pushQueries.videoUrls.$each);
        }
        
        if (updates.virtualTourUrl) prop.virtualTourUrl = updates.virtualTourUrl;
        
        await prop.save();
      }
    }

    console.log(`✅ Background optimization complete for Property: ${propertyId}`);
    
    // [MEMORY] Final cleanup
    if (global.gc) global.gc();

  } catch (err) {
    console.error('❌ Background optimization failed:', err);
  }
};

module.exports = { getRawUrls, optimizeBackground };