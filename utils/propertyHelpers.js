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

module.exports = { makeSlug, splitByCategory, generateOTP };