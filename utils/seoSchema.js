const generatePropertySchema = (property) => {
  const category = property.category || 'flat_house';

  let schemaType = 'RealEstateListing';
  if (category === 'flat_house') schemaType = 'SingleFamilyResidence';
  if (category === 'plot') schemaType = 'LandParcel';
  if (category === 'agri') schemaType = 'LandParcel';

  const images = Array.isArray(property.imageUrls)
    ? property.imageUrls
    : property.imageUrls
    ? [property.imageUrls]
    : [];

  const baseUrl = process.env.BASE_URL || 'https://gsinfraandestates.com';

  return {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: property.title,
    description: property.description,
    image: images.map((path) =>
      path.startsWith('http') ? path : `${baseUrl}${path}`,
    ),
    offers: {
      '@type': 'Offer',
      price: property.price,
      priceCurrency: 'INR',
      availability:
        property.status === 'available'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/SoldOut',
      seller: {
        '@type': 'Organization',
        name: 'GS Infra & Estate',
      },
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: property.location,
      addressLocality: property.locality || property.city,
      addressRegion: property.state || 'Uttarakhand',
      addressCountry: 'IN',
      postalCode: property.pincode || '',
    },
    telephone: process.env.PHONE || '+91-XXXXXXXXXX',
    url: `${baseUrl}/property/${property.slug}-${property._id}`,
  };
};

const generateLocalBusinessSchema = (city) => {
  const slugCity = String(city || '').toLowerCase();
  const capitalizedCity = slugCity.charAt(0).toUpperCase() + slugCity.slice(1);
  const baseUrl = process.env.BASE_URL || 'https://gsinfraandestates.com';

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: `GS Infra & Estate - Real Estate Services in ${capitalizedCity}`,
    description: `Leading real estate services in ${capitalizedCity}, Uttarakhand. Specializing in residential, plot and agricultural properties.`,
    areaServed: {
      '@type': 'City',
      name: capitalizedCity,
      containedIn: {
        '@type': 'State',
        name: 'Uttarakhand',
      },
    },
    telephone: process.env.PHONE || '+91-XXXXXXXXXX',
    email: process.env.EMAIL || 'info@gsinfraandestates.com',
    address: {
      '@type': 'PostalAddress',
      addressLocality: capitalizedCity,
      addressRegion: 'Uttarakhand',
      addressCountry: 'IN',
    },
    priceRange: '₹₹',
    serviceType: ['Property Sales', 'Property Rental', 'Real Estate Consultation'],
    url: `${baseUrl}/properties-in-${slugCity}`,
  };
};

const generateBreadcrumbSchema = (breadcrumbs) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
};

const generateCollectionPageSchema = (city, propertyType, totalProperties) => {
  const pageTitle = propertyType
    ? `${propertyType} in ${city}`
    : `Properties in ${city}`;

  const baseUrl = process.env.BASE_URL || 'https://gsinfraandestates.com';

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: pageTitle,
    description: `Browse ${totalProperties} ${pageTitle.toLowerCase()} with GS Infra & Estate.`,
    url: baseUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: 'GS Infra & Estate',
      url: baseUrl,
    },
  };
};

module.exports = {
  generatePropertySchema,
  generateLocalBusinessSchema,
  generateBreadcrumbSchema,
  generateCollectionPageSchema,
};
