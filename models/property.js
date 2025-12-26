const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['flat_house', 'plot', 'agri'],
      required: true,
    },
    title: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    location: { type: String, required: true },
    suitableFor: [String],
    status: {
      type: String,
      enum: ['available', 'sold', 'on_hold'],
      default: 'available',
    },
    map3dUrl: String,          // stored as /uploads/...
    virtualTourUrl: String,    // stored as /uploads/...
    imageUrls: [String],       // each is /uploads/filename.ext
    videoUrls: [String],
  },
  { timestamps: true }
);
// Add to your Property model (models/Property.js)

propertySchema.index({ category: 1, createdAt: -1 }); // Compound index
propertySchema.index({ location: 'text', title: 'text' }); // Search index


module.exports = mongoose.model('Property', propertySchema);
