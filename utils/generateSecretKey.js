import crypto from 'crypto';

/**
 * Generate a secure random secret key for WooCommerce plugin
 * @returns {string} A 64-character hexadecimal secret key
 */
export const generateSecretKey = () => {
  // Generate 32 random bytes and convert to hex (64 characters)
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate a shorter API key format (similar to WooCommerce keys)
 * @returns {string} A key in format: backo_xxxxxxxxxxxxx
 */
export const generatePortalSecretKey = () => {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  return `backo_${randomBytes}`;
};

