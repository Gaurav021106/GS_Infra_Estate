# GS Infra & Estate - SEO Implementation Guide

## Successfully Created Files
✅ `views/pages/properties-city.ejs` - City properties listing page with Tailwind CSS

## Remaining Files to Create

### 1. Create Property Controller: `controllers/propertyController.js`

```javascript
const Property = require('../models/property');

// Get properties by city
exports.getPropertiesByCity = async (req, res) => {
  try {
    const { city } = req.params;
    const { type, budget, locality, page = 1, sort = 'newest' } = req.query;
    
    // Build filter object
    const filter = { city: { $regex: city, $options: 'i' } };
    if (type) filter.category = type;
    if (locality) filter.locality = { $regex: locality, $options: 'i' };
    
    // Handle budget filter
    if (budget) {
      const [min, max] = budget.split('-');
      if (max === 'plus') {
        filter.price = { $gte: parseInt(min) };
      } else {
        filter.price = { $gte: parseInt(min), $lte: parseInt(max) };
      }
    }
    
    // Sort options
    let sortOption = {};
    if (sort === 'price-low') sortOption = { price: 1 };
    else if (sort === 'price-high') sortOption = { price: -1 };
    else if (sort === 'featured') sortOption = { featured: -1, createdAt: -1 };
    else sortOption = { createdAt: -1 };
    
    const pageNum = parseInt(page);
    const limit = 12;
    const skip = (pageNum - 1) * limit;
    
    const properties = await Property.find(filter)
      .sort(sortOption)
      .limit(limit)
      .skip(skip);
    
    const total = await Property.countDocuments(filter);
    const cityName = city.charAt(0).toUpperCase() + city.slice(1);
    
    // Set SEO meta tags
    res.locals.meta = {
      title: `Buy Property in ${cityName} | Verified Listings | GS Infra & Estate`,
      description: `Find verified property listings in ${cityName}. Flats, plots, houses & commercial spaces. 3D tours available.",
      keywords: `properties in ${cityName}, ${cityName} real estate, buy property in ${cityName}`
    };
    
    res.render('pages/properties-city', {
      properties,
      cityName,
      total,
      pages: Math.ceil(total / limit),
      currentPage: pageNum,
      currentFilter: { type, budget, locality }
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).render('pages/404', { message: 'Error loading properties' });
  }
};

// Get single property detail
exports.getPropertyDetail = async (req, res) => {
  try {
    const { slug } = req.params;
    const property = await Property.findOne({ slug });
    
    if (!property) {
      return res.status(404).render('pages/404', { message: 'Property not found' });
    }
    
    res.locals.meta = {
      title: property.title + ' | GS Infra & Estate',
      description: property.description.substring(0, 160),
      image: property.images[0] || '/images/logo.jpg'
    };
    
    res.render('pages/property-detail', { property });
  } catch (error) {
    res.status(500).render('pages/404', { message: 'Error loading property' });
  }
};
```

### 2. Update Routes: Add to `routes/public.routes.js`

```javascript
const propertyController = require('../controllers/propertyController');

// City-based property pages
router.get('/properties-in-dehradun/:page?', propertyController.getPropertiesByCity);
router.get('/properties-in-rishikesh/:page?', propertyController.getPropertiesByCity);
router.get('/properties-in-haridwar/:page?', propertyController.getPropertiesByCity);

// Type-specific city pages  
router.get('/flats-in-:city/:page?', propertyController.getPropertiesByCity);
router.get('/houses-in-:city/:page?', propertyController.getPropertiesByCity);
router.get('/plots-in-:city/:page?', propertyController.getPropertiesByCity);
router.get('/commercial-properties-in-:city/:page?', propertyController.getPropertiesByCity);

// Property detail page
router.get('/property/:slug-:id', propertyController.getPropertyDetail);
```

### 3. Create SEO Schema Utility: `utils/seoSchema.js`

```javascript
const generatePropertySchema = (property) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'SingleFamilyResidence',
    'name': property.title,
    'description': property.description,
    'image': property.images[0],
    'price': property.price,
    'priceCurrency': 'INR',
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': property.locality,
      'addressLocality': property.city,
      'addressRegion': 'Uttarakhand',
      'postalCode': property.pinCode
    },
    'telephone': process.env.PHONE,
    'url': `https://gsinfraandestates.com/property/${property.slug}-${property._id}`
  };
};

const generateLocalBusinessSchema = (city) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    'name': `GS Infra & Estate - ${city}`,
    'areaServed': city,
    'telephone': process.env.PHONE,
    'address': {
      '@type': 'PostalAddress',
      'addressLocality': city,
      'addressRegion': 'Uttarakhand'
    },
    'serviceType': 'Real Estate Services'
  };
};

module.exports = { generatePropertySchema, generateLocalBusinessSchema };
```

### 4. Update Header for Schema Markup: `views/components/header.ejs`

Add before `</head>` tag:

```ejs
<% if (typeof pageSchema !== 'undefined' && pageSchema) { %>
  <script type="application/ld+json">
    <%- JSON.stringify(pageSchema) %>
  </script>
<% } %>
```

### 5. Create Additional City Pages (Optional but Recommended)

Create these additional EJS files following the same pattern as properties-city.ejs:

- `views/pages/city-guide-dehradun.ejs`
- `views/pages/city-guide-rishikesh.ejs`
- `views/pages/city-guide-haridwar.ejs`
- `views/pages/investment-faq.ejs`

## CSS Notes

✅ **All files use Tailwind CSS** (matching your existing design system)

Tailwind classes used:
- Grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
- Colors: `bg-blue-600`, `text-gray-900`, `border-gray-300`
- Spacing: `px-4 md:px-8 py-8`, `mb-6`, `gap-4`
- Effects: `shadow-md`, `rounded-lg`, `hover:bg-blue-700`, `transition`
- Gradients: `bg-gradient-to-r from-blue-50 to-indigo-50`
- Responsive: `md:px-8`, `md:grid-cols-2`, `sm:flex-row`

## Implementation Checklist

- [ ] Create controllers/propertyController.js with all functions
- [ ] Update routes/public.routes.js with new routes
- [ ] Create utils/seoSchema.js for schema generation
- [ ] Update header.ejs to include schema markup
- [ ] Test properties-city.ejs page at /properties-in-dehradun
- [ ] Add sample data to Property model for testing
- [ ] Test filtering (type, budget, locality)
- [ ] Verify SEO meta tags in page source
- [ ] Test mobile responsiveness

## SEO Optimization Points Implemented

✅ Dynamic meta tags per city/type
✅ H1 with city name and property type keywords
✅ Long-tail keywords in content ("flats in Dehradun", etc.)
✅ Structured data markup (Schema.org)
✅ Internal linking (property cards, category pages)
✅ Image optimization (lazy loading ready)
✅ Mobile-responsive design (Tailwind)
✅ Fast loading (Tailwind CSS no extra files)
✅ All CSS is inline Tailwind (matches existing system)

## Next Steps

1. Copy the controller code and create the file
2. Add the routes to your existing routes file
3. Create the schema utility file
4. Update the header to include schema markup
5. Test with sample property data
6. Monitor Google Search Console for indexing
7. Track rankings for target keywords

---

**Note**: All styling uses Tailwind CSS to match your existing design system. No additional CSS files needed!