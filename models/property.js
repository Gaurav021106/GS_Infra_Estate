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

    // Media
    map3dUrl: String,          // stored as /uploads/...
    virtualTourUrl: String,    // stored as /uploads/...
    imageUrls: [String],       // each is /uploads/filename.ext
    videoUrls: [String],       // each is /uploads/filename.ext

    // Location + SEO fields
    city:  { type: String, required: true, index: true }, // Dehradun, Rishikesh, etc.
    state: { type: String, required: true, index: true }, // Uttarakhand
    locality: { type: String, index: true },              // Specific area within city
    pincode:  { type: String, index: true },              // Postal code
    searchTags: [String],                                 // Location-based search tags
    seoMetaDescription: String,                           // Meta description for SEO
  },
  { timestamps: true }
);

// ======================= EXISTING INDEXES =======================

// Sort latest in listings
propertySchema.index({ category: 1, createdAt: -1 });

// Text search on main fields
propertySchema.index({ location: 'text', title: 'text' });

// City/state/locality filters
propertySchema.index({ city: 1, state: 1, locality: 1 });

// Full‑text search across content + location tags
propertySchema.index({
  city: 'text',
  state: 'text',
  locality: 'text',
  title: 'text',
  description: 'text',
  searchTags: 'text',
});

// ======================= 🚀 PRODUCTION INDEXES =======================

// 1. City + Category + Featured (ESR: Equality‑Sort‑Range)
propertySchema.index({
  city: 1,        // = city filter
  category: 1,    // = type filter
  createdAt: -1,  // newest first
});

// 2. Price + Category (Budget filtering)
propertySchema.index({
  category: 1,    // Equality
  price: 1,       // Range ($gte/$lte)
});

// 3. Status filtering (available only)
propertySchema.index({ status: 1 });

// 4. (locality has field-level index already)

// 5. City + Status + Recent (Related properties)
propertySchema.index({
  city: 1,
  status: 1,
  createdAt: -1,
});

// 6. (pincode has field-level index already)

// ======================= COMPOUND SORT INDEXES =======================

// City + type + budget
propertySchema.index({
  city: 1,
  category: 1,
  price: 1,
});

// City + locality + newest
propertySchema.index({
  city: 1,
  locality: 1,
  createdAt: -1,
});

// ======================= MODEL EXPORT =======================
// Prevent OverwriteModelError when files are reloaded (nodemon, etc.)
module.exports =
  mongoose.models.Property || mongoose.model('Property', propertySchema);
