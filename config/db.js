const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || '');
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // [VERIFICATION] Check if data can be fetched from MongoDB Cloud
    try {
      // 1. Check Database Version (confirms Admin access)
      const admin = new mongoose.mongo.Admin(mongoose.connection.db);
      const buildInfo = await admin.buildInfo();
      console.log(`🔌 MongoDB Cloud Version: ${buildInfo.version}`);

      // 2. Data Fetch Check (Counts items in 'properties' collection)
      // We use the raw collection to avoid model loading issues at startup
      const collection = mongoose.connection.db.collection('properties');
      const count = await collection.countDocuments();
      
      if (count >= 0) {
        console.log(`✅ DATA CHECK PASSED: Successfully fetched ${count} properties from MongoDB.`);
      } else {
        console.warn('⚠️ DATA CHECK WARNING: Connected, but no properties found.');
      }
    } catch (checkErr) {
      console.error('❌ DATA CHECK FAILED: Could not fetch data.', checkErr.message);
    }

  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = { connectDB, mongoose };