// setupIndexes.js - MongoDB Performance Indexes

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gs-infra';

// Helper: ignore "index already exists" errors (code 86)
function ignoreExistingIndex(err) {
  if (err && (err.code === 86 || err.codeName === 'IndexKeySpecsConflict')) {
    console.log('ℹ️ Index already exists, skipping.');
    return;
  }
  throw err;
}

async function main() {
  try {
    // Connect to MongoDB (same style as db.js)
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    const db = mongoose.connection;
    console.log('\n✅ Creating MongoDB indexes...\n');

    const prop = db.collection('properties');
    const alert = db.collection('alertsubscribers');

    // ===== Property indexes =====
    await prop
      .createIndex({ city: 1, active: 1 }, { background: true })
      .catch(ignoreExistingIndex);

    await prop
      .createIndex({ price: 1, category: 1 }, { background: true })
      .catch(ignoreExistingIndex);

    await prop
      .createIndex({ createdAt: -1 }, { background: true })
      .catch(ignoreExistingIndex);

    await prop
      .createIndex({ status: 1 }, { background: true })
      .catch(ignoreExistingIndex);

    await prop
      .createIndex({ city: 1, price: 1, active: 1 }, { background: true })
      .catch(ignoreExistingIndex);

    // ===== Alert indexes =====
    await alert
      .createIndex({ active: 1, email: 1 }, { background: true })
      .catch(ignoreExistingIndex);

    await alert
      .createIndex({ userId: 1 }, { background: true })
      .catch(ignoreExistingIndex);

    // DO NOT create { email: 1 } again; AlertSubscriber has unique email index via schema

    console.log('🎉 All indexes created successfully (existing ones skipped)!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error while creating indexes:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Safety timeout in case connection hangs
setTimeout(() => {
  console.error('❌ Connection timeout');
  process.exit(1);
}, 10000);

main();
