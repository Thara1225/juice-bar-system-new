function generateToken(orderId) {
  return `A${String(orderId).padStart(3, "0")}`;
}

module.exports = { generateToken };