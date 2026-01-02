const Property = require('../models/property');

// Helper function to build location-based filter object
function getLocationFilter(req) {
  const filter = {};
  const { city, locality, state } = req.params;
  const { city: cityQuery, state: stateQuery, locality: localityQuery } = req.query;
  
  // Add filters from route parameters or query parameters
  if (city || cityQuery) {
    filter.city = new RegExp(`^${city || cityQuery}$`, 'i');
  }
  if (state || stateQuery) {
    filter.state = new RegExp(`^${state || stateQuery}$`, 'i');
  }
  if (locality || localityQuery) {
    filter.locality = new RegExp(`${locality || localityQuery}`, 'i');
  }
  
  return Object.keys(filter).length > 0 ? filter : {};
}

exports.listProperties = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const props = await Property.find(getLocationFilter(req))
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      ok: true,
      properties: props,
      page,
      hasMore: props.length === limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
};

exports.getProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).lean();
    if (!property)
      return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, property });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
};