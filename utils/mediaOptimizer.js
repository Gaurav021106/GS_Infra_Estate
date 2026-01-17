const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const Property = require('../models/property'); // Required for background updates

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

    await sharp(filePath)
      .resize(1920, 1920, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .webp({ quality: 75, effort: 4 })
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
        '-preset veryfast',
        '-movflags +faststart',
        '-an'
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
 * - Processes images in PARALLEL (Fast)
 * - Processes videos SEQUENTIALLY (Safe for CPU)
 * - Updates MongoDB automatically
 */
const optimizeBackground = async (propertyId, files) => {
  console.log(`🚀 Starting background optimization for Property ID: ${propertyId}`);
  
  const updates = {};
  const pullQueries = {}; // To remove raw URLs
  const pushQueries = {}; // To add optimized URLs

  try {
    // 1. Process Images (Parallel)
    if (files.images && files.images.length > 0) {
      console.log(`🖼️ Optimizing ${files.images.length} images in background...`);
      
      const rawUrls = files.images.map(f => `/uploads/${f.filename}`);
      const optimizedPaths = await Promise.all(files.images.map(file => optimizeImage(file.path)));
      const optimizedUrls = optimizedPaths.map(p => `/uploads/${path.basename(p)}`);

      // Prepare DB operations
      pullQueries.imageUrls = { $in: rawUrls };
      pushQueries.imageUrls = { $each: optimizedUrls };
    }

    // 2. Process Videos (Sequential to save CPU)
    if (files.videos && files.videos.length > 0) {
      console.log(`🎥 Optimizing ${files.videos.length} videos in background...`);
      
      const rawUrls = files.videos.map(f => `/uploads/${f.filename}`);
      const optimizedUrls = [];
      
      for (const file of files.videos) {
        const newPath = await optimizeVideo(file.path);
        optimizedUrls.push(`/uploads/${path.basename(newPath)}`);
      }

      pullQueries.videoUrls = { $in: rawUrls };
      pushQueries.videoUrls = { $each: optimizedUrls };
    }

    // 3. Process Virtual Tour
    if (files.virtualTourFile && files.virtualTourFile[0]) {
      console.log('🎥 Optimizing Virtual Tour...');
      const rawUrl = `/uploads/${files.virtualTourFile[0].filename}`;
      const newPath = await optimizeVideo(files.virtualTourFile[0].path);
      updates.virtualTourUrl = `/uploads/${path.basename(newPath)}`;
    }

    // 4. Execute DB Updates
    const dbOps = [];

    // If we have simple updates (virtual tour)
    if (Object.keys(updates).length > 0) {
      dbOps.push(Property.findByIdAndUpdate(propertyId, { $set: updates }));
    }

    // If we have arrays to update (images/videos) - We use $pull then $push to replace
    // Note: We use bulkWrite or separate updates. For simplicity, we do separate updates.
    if (pullQueries.imageUrls) {
      // We perform a "Swap" operation: remove old, add new.
      // Ideally, we'd just set the array if it was a create, but for updates, this is safer.
      const prop = await Property.findById(propertyId);
      if (prop) {
        // Filter out raw URLs and add optimized ones
        let newImages = prop.imageUrls.filter(url => !pullQueries.imageUrls.$in.includes(url));
        newImages = [...newImages, ...pushQueries.imageUrls.$each];
        
        let newVideos = prop.videoUrls.filter(url => !pullQueries.videoUrls?.$in.includes(url));
        if (pushQueries.videoUrls) {
          newVideos = [...newVideos, ...pushQueries.videoUrls.$each];
        }

        prop.imageUrls = newImages;
        prop.videoUrls = newVideos;
        if (updates.virtualTourUrl) prop.virtualTourUrl = updates.virtualTourUrl;
        
        await prop.save();
      }
    } else if (Object.keys(updates).length > 0) {
        // Just save the simple updates if no arrays involved
        await Property.findByIdAndUpdate(propertyId, updates);
    }

    console.log(`✅ Background optimization complete for Property: ${propertyId}`);

  } catch (err) {
    console.error('❌ Background optimization failed:', err);
  }
};

module.exports = { getRawUrls, optimizeBackground };