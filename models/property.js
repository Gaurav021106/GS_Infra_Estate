const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: [
        'residential_properties',   // Residential Properties
        'commercial_plots',         // Commercial Properties / plots
        'land_plots',               // Land & Plots
        'premium_investment',       // Premium & Investment
      ],
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

    // Media
    map3dUrl: String,
    virtualTourUrl: String,
    imageUrls: [String],
    videoUrls: [String],

    // Location + SEO
    city: { type: String, required: true, index: true },
    state: { type: String, required: true, index: true },
    locality: { type: String, index: true },
    pincode: { type: String, index: true },
    searchTags: [String],
    seoMetaDescription: String,
  },
  { timestamps: true }
);

// Indexes
propertySchema.index({ category: 1, createdAt: -1 });
propertySchema.index({ location: 'text', title: 'text' });
propertySchema.index({ city: 1, state: 1, locality: 1 });
propertySchema.index({
  city: 'text',
  state: 'text',
  locality: 'text',
  title: 'text',
  description: 'text',
  searchTags: 'text',
});
propertySchema.index({ city: 1, category: 1, createdAt: -1 });
propertySchema.index({ category: 1, price: 1 });
propertySchema.index({ status: 1 });

propertySchema.index({ city: 1, status: 1, createdAt: -1 });
propertySchema.index({ city: 1, category: 1, price: 1 });
propertySchema.index({ city: 1, locality: 1, createdAt: -1 });

// Performance optimization indexes for homepage queries
propertySchema.index({ status: 1, createdAt: -1 });  // For homepage queries
propertySchema.index({ featured: 1, status: 1 });    // For featured properties
propertySchema.index({ category: 1, status: 1 });    // For category filtering
propertySchema.index({ price: 1, status: 1 });       // For price filtering

module.exports =
  mongoose.models.Property || mongoose.model('Property', propertySchema);
