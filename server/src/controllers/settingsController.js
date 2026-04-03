const pool = require("../config/db");

const MAX_LOGO_FIELD_LENGTH = 7_000_000;

const normalizeLogoValue = (logoValue) => {
  if (!logoValue) {
    return null;
  }

  const normalized = String(logoValue).trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length > MAX_LOGO_FIELD_LENGTH) {
    throw new Error("Logo image is too large. Please use a smaller file.");
  }

  const isDataImage = normalized.startsWith("data:image/");
  const isHttpUrl = normalized.startsWith("http://") || normalized.startsWith("https://");

  if (!isDataImage && !isHttpUrl) {
    throw new Error("Invalid logo format. Upload an image file or use a valid URL.");
  }

  return normalized;
};

const getBusinessSettings = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, business_name, logo_url, contact_number, address, updated_at
       FROM business_settings
       WHERE id = 1`
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Business settings not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching business settings:", error.message);
    res.status(500).json({ error: "Failed to fetch business settings" });
  }
};

const updateBusinessSettings = async (req, res) => {
  try {
    const {
      business_name,
      logo_url,
      contact_number,
      address,
    } = req.body;

    if (!business_name || !String(business_name).trim()) {
      return res.status(400).json({ error: "business_name is required" });
    }

    const normalizedLogo = normalizeLogoValue(logo_url);

    const result = await pool.query(
      `UPDATE business_settings
       SET business_name = $1,
           logo_url = $2,
           contact_number = $3,
           address = $4,
           updated_at = NOW()
       WHERE id = 1
       RETURNING id, business_name, logo_url, contact_number, address, updated_at`,
      [
        String(business_name).trim(),
        normalizedLogo,
        contact_number ? String(contact_number).trim() : null,
        address ? String(address).trim() : null,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating business settings:", error.message);
    res.status(500).json({ error: error.message || "Failed to update business settings" });
  }
};

module.exports = {
  getBusinessSettings,
  updateBusinessSettings,
};
