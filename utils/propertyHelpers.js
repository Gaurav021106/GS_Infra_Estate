function makeSlug(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

function splitByCategory(props) {
  return {
    flats: props.filter(p => p.category === 'flat_house'),
    plots: props.filter(p => p.category === 'plot'),
    agri: props.filter(p => p.category === 'agri'),
  };
}

function generateOTP() {
  const crypto = require('crypto');
  return String(crypto.randomInt(100000, 1000000));
}

// Generate location-based search tags for SEO
function generateLocationSearchTags(city, state, locality) {
  const tags = [];
  
  // City variations
  if (city) {
    tags.push(city);
    tags.push(`${city} properties`);
    tags.push(`Buy in ${city}`);
    tags.push(`Sell in ${city}`);
  }
  
  // Locality variations
  if (locality) {
    tags.push(locality);
    tags.push(`${locality} ${city}`);
    tags.push(`Properties in ${locality}`);
  }
  
  // State variations
  if (state) {
    tags.push(`${state} properties`);
    tags.push(`Real estate in ${state}`);
  }
  
  // Popular searches for Dehradun & Rishikesh
  if (city === 'Dehradun') {
    tags.push('Dehradun flats', 'Dehradun villas', 'Property in Dehradun', 'Buy flats Dehradun');
  }
  if (city === 'Rishikesh') {
    tags.push('Rishikesh property', 'Rishikesh apartments', 'Real estate Rishikesh');
  }
  
  return [...new Set(tags)]; // Remove duplicates
}

// Generate SEO meta description for property listings
function generateSeoMetaDescription(title, city, category, price) {
  const desc = `${title} in ${city}. ${category} properties in ${city}. ₹${price}. Browse top rated properties with photos and details.`;
  return desc.substring(0, 160); // Google displays ~160 characters
}

module.exports = { makeSlug, splitByCategory, generateOTP, generateLocationSearchTags, generateSeoMetaDescription };