require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
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

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Simple Email Polling Service API',
      version: '1.0.0',
      description: 'A minimal email aggregation service with 2FA code extraction',
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? process.env.BASE_URL || `https://your-domain.com`
          : `http://localhost:${port}`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Local development server',
      },
    ],
  },
  apis: ['./src/server.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /api/last-email:
 *   get:
 *     summary: Get the most recent email
 *     description: Retrieves the most recently processed email from the configured account
 *     tags: [Emails]
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                     subject:
 *                       type: string
 *                     from_address:
 *                       type: string
 *                     to_address:
 *                       type: string
 *                     body_text:
 *                       type: string
 *                     date:
 *                       type: string
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/last-code:
 *   get:
 *     summary: Get the most recent unused 2FA code
 *     description: Retrieves the most recent unused 2FA code and marks it as used (single-use)
 *     tags: [2FA Codes]
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: integer
 *                     code:
 *                       type: string
 *                     subject:
 *                       type: string
 *                     from_address:
 *                       type: string
 *                     used:
 *                       type: boolean
 *                     created_at:
 *                       type: string
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/last-code-from/{fromAddress}:
 *   get:
 *     summary: Get the most recent unused 2FA code from a specific sender
 *     description: Retrieves the most recent unused 2FA code from a specific sender email address and marks it as used (single-use)
 *     tags: [2FA Codes]
 *     parameters:
 *       - in: path
 *         name: fromAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: The sender's email address
 *         example: noreply@github.com
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: integer
 *                     code:
 *                       type: string
 *                     subject:
 *                       type: string
 *                     from_address:
 *                       type: string
 *                     used:
 *                       type: boolean
 *                     created_at:
 *                       type: string
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/last-code-to/{toAddress}:
 *   get:
 *     summary: Get the most recent unused 2FA code for a specific recipient address
 *     description: Retrieves the most recent unused 2FA code sent to a specific recipient address (useful for forwarded emails). Extracts "To:" addresses from email body text only. Marks code as used (single-use).
 *     tags: [2FA Codes]
 *     parameters:
 *       - in: path
 *         name: toAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: The recipient's email address from forwarded email body
 *         example: user@example.com
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: integer
 *                     code:
 *                       type: string
 *                     subject:
 *                       type: string
 *                     from_address:
 *                       type: string
 *                     to_address:
 *                       type: string
 *                     used:
 *                       type: boolean
 *                     created_at:
 *                       type: string
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/status:
 *   get:
 *     summary: Get service status
 *     description: Returns the current status of the email polling service and connection information
 *     tags: [Service]
 *     responses:
 *       200:
 *         description: Service status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                   example: running
 *                 email_service:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                     email:
 *                       type: string
 *                     reconnectAttempts:
 *                       type: integer
 *                     isReconnecting:
 *                       type: boolean
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/api/status', (req, res) => {
  const status = emailService.getStatus();
  res.json({
    success: true,
    status: 'running',
    email_service: status,
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /:
 *   get:
 *     summary: Get API information
 *     description: Returns basic information about the API and available endpoints
 *     tags: [Service]
 *     responses:
 *       200:
 *         description: API information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 version:
 *                   type: string
 *                 endpoints:
 *                   type: array
 *                   items:
 *                     type: string
 *                 swagger_ui:
 *                   type: string
 */
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
    ],
    swagger_ui: `http://localhost:${port}/api-docs`
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