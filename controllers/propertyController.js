// controllers/propertyController.js
const mongoose = require('mongoose');
const Property = require('../models/property');
const {
  generatePropertySchema,
  generateLocalBusinessSchema,
  generateBreadcrumbSchema,
  generateCollectionPageSchema,
} = require('../utils/seoSchema');

const PROPERTIES_PER_PAGE = 12;
const VALID_CITIES = ['dehradun', 'rishikesh', 'haridwar'];

const UI_TYPE_TO_CATEGORY = {
  residential: 'residential_properties',
  commercial: 'commercial_plots',
  plot: 'land_plots',
  land: 'land_plots',
  premium: 'premium_investment',
  investment: 'premium_investment',
};

const SLUG_TYPE_TO_CATEGORY = {
  residential: 'residential_properties',
  'commercial-plots': 'commercial_plots',
  'land-plots': 'land_plots',
  'premium-investment': 'premium_investment',
};

// [OPTIMIZATION] Listing fields reduced to minimal set
const LISTING_FIELDS = 'title price city locality imageUrls category status builtupArea plotSize'; 

const DETAIL_FIELDS =
  'title description price location city state locality pincode category suitableFor status imageUrls videoUrls map3dUrl virtualTourUrl searchTags seoMetaDescription createdAt contactName contactPhone contactEmail features amenities landmarks plotSize builtupArea dimensions facing roadWidth ownership priceNote mapEmbed';

// Build filter + sort from query params
const buildFilterAndSort = (req, extraFilter = {}) => {
  const { type, budget, locality, sort } = req.query;
  const filter = { ...extraFilter };

  if (type && UI_TYPE_TO_CATEGORY[type]) {
    filter.category = UI_TYPE_TO_CATEGORY[type];
  }

  if (budget) {
    const priceCond = {};
    if (budget === '0-30') {
      priceCond.$lte = 3000000;
    } else if (budget === '30-50') {
      priceCond.$gte = 3000000;
      priceCond.$lte = 5000000;
    } else if (budget === '50-100') {
      priceCond.$gte = 5000000;
      priceCond.$lte = 10000000;
    } else if (budget === '100-plus') {
      priceCond.$gte = 10000000;
    }
    if (Object.keys(priceCond).length) filter.price = priceCond;
  }

  if (locality) {
    filter.locality = new RegExp(locality, 'i');
  }

  let sortObj = { createdAt: -1 };
  if (sort === 'price-low') sortObj = { price: 1 };
  else if (sort === 'price-high') sortObj = { price: -1 };
  else if (sort === 'featured') sortObj = { featured: -1, createdAt: -1 };

  return { filter, sortObj };
};

// =======================
// /properties-in-:city/:page?
// =======================
const getPropertiesByCity = async (req, res) => {
  try {
    const slugCity =
      (req.params.city || '').toLowerCase() ||
      (req.path.match(/properties-in-([^/]+)/)?.[1] || '').toLowerCase();

    if (!slugCity || !VALID_CITIES.includes(slugCity)) {
      return res.status(404).render('pages/404', {
        pageTitle: '404 - City Not Found',
        message: 'City not found',
      });
    }

    const page = parseInt(req.params.page, 10) || 1;
    const skip = (page - 1) * PROPERTIES_PER_PAGE;

    const baseFilter = {
      city: new RegExp(`^${slugCity}$`, 'i'),
      state: 'Uttarakhand',
      status: 'available',
    };

    const { filter, sortObj } = buildFilterAndSort(req, baseFilter);

    const [properties, totalCount] = await Promise.all([
      Property.find(filter)
        .select(LISTING_FIELDS)
        .sort(sortObj)
        .skip(skip)

        .limit(PROPERTIES_PER_PAGE)
        .lean()
        .exec(),
      Property.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / PROPERTIES_PER_PAGE));
    const capitalizedCity =
      slugCity.charAt(0).toUpperCase() + slugCity.slice(1);

    const pageTitle = `Properties for Sale in ${capitalizedCity} | GS Infra & Estate`;
    const metaDescription =
      properties.length && properties[0]?.seoMetaDescription
        ? properties[0].seoMetaDescription
        : `Explore ${totalCount}+ verified properties in ${capitalizedCity}. Find flats, houses, plots & land in Uttarakhand.`;

    const breadcrumbs = [
      { name: 'Home', url: '/' },
      { name: capitalizedCity, url: `/properties-in-${slugCity}` },
    ];

    const schemas = [
      generateLocalBusinessSchema(slugCity),
      generateBreadcrumbSchema(breadcrumbs),
      generateCollectionPageSchema(capitalizedCity, null, totalCount),
    ];

    const baseUrl =
      process.env.BASE_URL || 'https://gsinfraandestates.com';

    res.set({
      'Cache-Control': 'public, max-age=300, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Vary': 'Accept-Encoding'
    });

      res.render('pages/property-listing', {
      pageTitle,
      metaDescription,
      properties,
      city: capitalizedCity,
      citySlug: slugCity,
      page,
      totalPages,
      totalCount,
      schemas,
      breadcrumbs,
      canonical: `${baseUrl}/properties-in-${slugCity}${
        page > 1 ? `/${page}` : ''
      }`,
      prevPage:
        page > 1
          ? `/properties-in-${slugCity}${page === 2 ? '' : `/${page - 1}`}`
          : null,
      nextPage:
        page < totalPages
          ? `/properties-in-${slugCity}/${page + 1}`
          : null,
      filters: {
        type: req.query.type || '',
        budget: req.query.budget || '',
        locality: req.query.locality || '',
        sort: req.query.sort || 'newest',
      },
    });
  } catch (err) {
    console.error('getPropertiesByCity error:', err);
    res.status(500).render('pages/500', {
      pageTitle: '500 - Server Error',
      message: 'Error loading properties',
    });
  }
};

// =======================
// /<type>-in-:city/:page?
// =======================
const getPropertiesByTypeAndCity = async (req, res) => {
  try {
    const typeParam = (req.params.type || '').toLowerCase();
    const slugCity = (req.params.city || '').toLowerCase();

    const VALID_TYPES = Object.keys(SLUG_TYPE_TO_CATEGORY);

    if (!VALID_TYPES.includes(typeParam) || !VALID_CITIES.includes(slugCity)) {
      return res.status(404).render('pages/404', {
        pageTitle: '404 - Not Found',
        message: 'Invalid property type or city',
      });
    }

    const page = parseInt(req.params.page, 10) || 1;
    const skip = (page - 1) * PROPERTIES_PER_PAGE;
    const category = SLUG_TYPE_TO_CATEGORY[typeParam];

    const baseFilter = {
      city: new RegExp(`^${slugCity}$`, 'i'),
      state: 'Uttarakhand',
      category,
      status: 'available',
    };

    const { filter, sortObj } = buildFilterAndSort(req, baseFilter);

    const [properties, totalCount] = await Promise.all([
      Property.find(filter)
        .select(LISTING_FIELDS)
        .sort(sortObj)
        .skip(skip)
        .limit(PROPERTIES_PER_PAGE)
        .lean()
        .exec(),
      Property.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / PROPERTIES_PER_PAGE));
    const capitalizedCity =
      slugCity.charAt(0).toUpperCase() + slugCity.slice(1);
    const prettyType = typeParam.replace(/-/g, ' ');
    const capitalizedType =
      prettyType.charAt(0).toUpperCase() + prettyType.slice(1);

    const pageTitle = `${capitalizedType} in ${capitalizedCity} | GS Infra & Estate`;
    const metaDescription =
      properties.length && properties[0]?.seoMetaDescription
        ? properties[0].seoMetaDescription
        : `Browse ${totalCount}+ ${prettyType} in ${capitalizedCity}. Verified listings with photos, prices & details.`;

    const breadcrumbs = [
      { name: 'Home', url: '/' },
      { name: capitalizedCity, url: `/properties-in-${slugCity}` },
      { name: capitalizedType, url: `/${typeParam}-in-${slugCity}` },
    ];

    const schemas = [
      generateLocalBusinessSchema(slugCity),
      generateBreadcrumbSchema(breadcrumbs),
      generateCollectionPageSchema(
        capitalizedCity,
        capitalizedType,
        totalCount
      ),
    ];

    const baseUrl =
      process.env.BASE_URL || 'https://gsinfraandestates.com';

    res.render('pages/property-listing', {
      pageTitle,
      metaDescription,
      properties,
      city: capitalizedCity,
      citySlug: slugCity,
      propertyType: capitalizedType,
      page,
      totalPages,
      totalCount,
      schemas,
      breadcrumbs,
      canonical: `${baseUrl}/${typeParam}-in-${slugCity}${
        page > 1 ? `/${page}` : ''
      }`,
      prevPage:
        page > 1
          ? `/${typeParam}-in-${slugCity}${
              page === 2 ? '' : `/${page - 1}`
            }`
          : null,
      nextPage:
        page < totalPages
          ? `/${typeParam}-in-${slugCity}/${page + 1}`
          : null,
      filters: {
        type: req.query.type || '',
        budget: req.query.budget || '',
        locality: req.query.locality || '',
        sort: req.query.sort || 'newest',
      },
    });
  } catch (err) {
    console.error('getPropertiesByTypeAndCity error:', err);
    res.status(500).render('pages/500', {
      pageTitle: '500 - Server Error',
      message: 'Error loading properties',
    });
  }
};

// =======================
// /property/:slug-:id
// =======================
const getPropertyDetail = async (req, res) => {
  try {
    let { slug, id } = req.params; // /property/:slug-:id

    // [FIX] Strict ID check
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.warn('Invalid property id in URL:', id);
      return res.status(404).render('pages/404', {
        pageTitle: '404 - Property Not Found',
        message: 'Property not found',
      });
    }

    const property = await Property.findById(id)
      .select(DETAIL_FIELDS)
      .lean()
      .exec();

    if (!property || property.status !== 'available') {
      return res.status(404).render('pages/404', {
        pageTitle: '404 - Property Not Found',
        message: 'Property not found',
      });
    }

    const correctSlug = String(property.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    if (slug !== correctSlug) {
      return res.redirect(301, `/property/${correctSlug}-${id}`);
    }

    const relatedProperties = await Property.find({
      _id: { $ne: property._id },
      city: property.city,
      status: 'available',
    })
      .select(LISTING_FIELDS)
      .limit(4)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const breadcrumbs = [
      { name: 'Home', url: '/' },
      {
        name: property.city,
        url: `/properties-in-${String(property.city).toLowerCase()}`,
      },
      { name: property.title, url: `/property/${correctSlug}-${id}` },
    ];

    const schemas = [
      generatePropertySchema(property),
      generateBreadcrumbSchema(breadcrumbs),
    ];

    const baseUrl =
      process.env.BASE_URL || 'https://gsinfraandestates.com';

    const pageTitle = `${property.title} | ${property.city} | GS Infra & Estate`;
    const metaDescription = (
      property.seoMetaDescription || property.description || ''
    ).substring(0, 155);

    res.render('pages/property-detail', {
      pageTitle,
      metaDescription,
      property,
      relatedProperties,
      schemas,
      breadcrumbs,
      canonical: `${baseUrl}/property/${correctSlug}-${id}`,
      referrer: req.headers.referer || '/' 
    });
  } catch (err) {
    console.error('getPropertyDetail error:', err);
    res.status(500).render('pages/500', {
      pageTitle: '500 - Server Error',
      message: 'Error loading property',
    });
  }
};

module.exports = {
  getPropertiesByCity,
  getPropertiesByTypeAndCity,
  getPropertyDetail,
};