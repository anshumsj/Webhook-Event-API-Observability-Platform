const ApiKey = require('../models/ApiKey');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const generateRandomString = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

const generateApiKey = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'API Key name is required', requestId: req.requestId } });
    }

    const userId = req.user.id;

    // Generate raw key: hk_test_ + 32 chars
    const rawSecret = generateRandomString();
    const rawKey = `hk_test_${rawSecret}`;
    const keyPrefix = rawKey.substring(0, 16); // hk_test_ + 8 chars for identification

    // Hash the raw secret for storage
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(rawKey, salt);

    const apiKey = new ApiKey({
      userId,
      name,
      keyPrefix,
      hash
    });

    await apiKey.save();

    // Return the raw key ONLY ONCE
    res.status(201).json({
      _id: apiKey._id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      rawKey,
      createdAt: apiKey.createdAt
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error generating API key', requestId: req ? req.requestId : 'unknown' } });
  }
};

const listApiKeys = async (req, res) => {
  try {
    const userId = req.user.id;
    const apiKeys = await ApiKey.find({ userId, revokedAt: null })
      .select('-hash')
      .sort({ createdAt: -1 });

    res.status(200).json(apiKeys);
  } catch (error) {
    console.error('Error listing API keys:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error listing API keys', requestId: req ? req.requestId : 'unknown' } });
  }
};

const revokeApiKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const apiKey = await ApiKey.findOne({ _id: id, userId });
    if (!apiKey) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API key not found', requestId: req ? req.requestId : 'unknown' } });
    }

    if (apiKey.revokedAt) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'API key is already revoked', requestId: req ? req.requestId : 'unknown' } });
    }

    apiKey.revokedAt = new Date();
    await apiKey.save();

    res.status(200).json({ error: { code: 'ERROR', message: 'API key revoked successfully', requestId: req ? req.requestId : 'unknown' } });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error revoking API key', requestId: req ? req.requestId : 'unknown' } });
  }
};

module.exports = {
  generateApiKey,
  listApiKeys,
  revokeApiKey
};
