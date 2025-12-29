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
      city: { type: String, required: true, index: true }, // Dehradun, Rishikesh, Mussorie, etc.
        state: { type: String, required: true, index: true }, // Uttarakhand
          locality: { type: String, index: true }, // Specific area within city
            pincode: { type: String, index: true }, // Postal code for location
              searchTags: [String], // Location-based search tags for SEO
                seoMetaDescription: String, // Meta description for search engines
  },
  { timestamps: true }

);
// Add to your Property model (models/Property.js)

propertySchema.index({ category: 1, createdAt: -1 }); // Compound index
propertySchema.index({ location: 'text', title: 'text' }); // Search index
propertySchema.index({ city: 1, state: 1, locality: 1 }); // Location-based search for Dehradun, Rishikesh
propertySchema.index({ city: 'text', state: 'text', locality: 'text', title: 'text', description: 'text', searchTags: 'text' }); // Full-text search


module.exports = mongoose.model('Property', propertySchema);
