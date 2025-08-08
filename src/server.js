require('dotenv').config();
const express = require('express');
const SimpleDatabase = require('./database');
const SimpleEmailService = require('./emailService');

const app = express();
const port = process.env.PORT || 3001;

// Initialize database
const database = new SimpleDatabase();

// Email configuration
const emailConfig = {
  email: process.env.EMAIL,
  password: process.env.PASSWORD,
  host: process.env.HOST,
  port: parseInt(process.env.PORT_IMAP) || 993,
  tls: process.env.TLS === 'true'
};

// Initialize email service
const emailService = new SimpleEmailService(emailConfig, database);

app.use(express.json());

// Get last email
app.get('/api/last-email', async (req, res) => {
  try {
    const emailAccount = emailConfig.email;
    const email = await database.getLastEmail(emailAccount);
    
    if (!email) {
      return res.json({
        success: true,
        data: null,
        message: 'No emails found'
      });
    }
    
    res.json({
      success: true,
      data: email
    });
  } catch (error) {
    console.error('Error getting last email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get last email'
    });
  }
});

// Get last 2FA code
app.get('/api/last-code', async (req, res) => {
  try {
    const emailAccount = emailConfig.email;
    const code = await database.getLastCode(emailAccount);
    
    if (!code) {
      return res.json({
        success: true,
        data: null,
        message: 'No codes found'
      });
    }
    
    res.json({
      success: true,
      data: code
    });
  } catch (error) {
    console.error('Error getting last code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get last code'
    });
  }
});

// Get last code from specific sender
app.get('/api/last-code-from/:fromAddress', async (req, res) => {
  try {
    const emailAccount = emailConfig.email;
    const fromAddress = req.params.fromAddress;
    const code = await database.getLastCodeByFromAddress(emailAccount, fromAddress);
    
    if (!code) {
      return res.json({
        success: true,
        data: null,
        message: 'No codes found from this sender'
      });
    }
    
    res.json({
      success: true,
      data: code
    });
  } catch (error) {
    console.error('Error getting last code from sender:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get last code from sender'
    });
  }
});

// Get last code for specific "to" address (for forwarded emails)
app.get('/api/last-code-to/:toAddress', async (req, res) => {
  try {
    const toAddress = req.params.toAddress;
    const code = await database.getLastCodeByToAddress(toAddress);
    
    if (!code) {
      return res.json({
        success: true,
        data: null,
        message: 'No codes found for this recipient address'
      });
    }
    
    res.json({
      success: true,
      data: code
    });
  } catch (error) {
    console.error('Error getting last code for recipient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get last code for recipient'
    });
  }
});

// Service status
app.get('/api/status', (req, res) => {
  const status = emailService.getStatus();
  res.json({
    success: true,
    status: 'running',
    email_service: status,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Simple Email Polling Service',
    version: '1.0.0',
    endpoints: [
      'GET /api/last-email - Get last email',
      'GET /api/last-code - Get last 2FA code',
      'GET /api/last-code-from/:fromAddress - Get last code from specific sender',
      'GET /api/last-code-to/:toAddress - Get last code for specific recipient (forwarded emails)',
      'GET /api/status - Service status'
    ]
  });
});

// Start email service
async function startService() {
  try {
    await emailService.connect();
    
    // Run initial cleanup
    await database.cleanupOldEmails(7);
    
    // Schedule daily cleanup at 2 AM
    setInterval(async () => {
      try {
        await database.cleanupOldEmails(7);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
    
  } catch (error) {
    console.error('Failed to start email service:', error);
  }
}

app.listen(port, () => {
  console.log(`Simple Email Service running on port ${port}`);
  startService();
});

module.exports = app;