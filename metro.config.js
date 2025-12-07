const { getDefaultConfig } = require('expo/metro-config');

// Load environment variables from .env file
require('dotenv').config();

const config = getDefaultConfig(__dirname);

module.exports = config;
