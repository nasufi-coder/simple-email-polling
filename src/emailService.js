const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const { v4: uuidv4 } = require('uuid');

class SimpleEmailService {
  constructor(config, database) {
    this.config = config;
    this.database = database;
    this.imap = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.heartbeatInterval = null;
    this.isReconnecting = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.imap = new Imap({
        user: this.config.email,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls,
        tlsOptions: { rejectUnauthorized: false },
        keepalive: true
      });

      this.imap.once('ready', () => {
        console.log(`Connected to ${this.config.email}`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.startListening();
        resolve();
      });

      this.imap.once('error', (err) => {
        console.error(`IMAP error:`, err);
        this.isConnected = false;
        this.handleConnectionError(err);
        reject(err);
      });

      this.imap.once('end', () => {
        console.log('Connection ended');
        this.isConnected = false;
        this.handleConnectionEnd();
      });

      this.imap.connect();
    });
  }

  startListening() {
    this.imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('Error opening inbox:', err);
        return;
      }

      console.log('Listening for emails...');
      
      // Listen for new emails
      this.imap.on('mail', () => {
        this.fetchLatestEmail();
      });

      // Keep connection alive with periodic heartbeat
      this.startHeartbeat();
    });
  }

  fetchLatestEmail() {
    if (!this.isConnected || !this.imap) {
      console.warn('Cannot fetch email: not connected');
      return;
    }

    // Search for unread emails from the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const searchCriteria = [
      'UNSEEN',
      ['SINCE', fiveMinutesAgo]
    ];
    
    this.imap.search(searchCriteria, (err, results) => {
      if (err) {
        console.error('Search error:', err.message);
        this.handleConnectionError(err);
        return;
      }
      
      if (!results || !results.length) {
        return;
      }

      const latestUid = results[results.length - 1];
      const fetch = this.imap.fetch([latestUid], { bodies: '', struct: true });

      fetch.on('error', (err) => {
        console.error('Fetch error:', err.message);
        this.handleConnectionError(err);
      });

      fetch.on('message', (msg) => {
        let buffer = '';
        let uid = null;

        msg.on('body', (stream) => {
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
          
          stream.on('error', (err) => {
            console.error('Stream error:', err.message);
          });
        });

        msg.once('attributes', (attrs) => {
          uid = attrs.uid;
        });

        msg.once('end', () => {
          this.processEmail(buffer, uid);
        });
      });
    });
  }

  async processEmail(rawEmail, uid) {
    try {
      const parsed = await simpleParser(rawEmail);
      
      const email = {
        id: uuidv4(),
        emailAccount: this.config.email,
        subject: parsed.subject || '',
        fromAddress: parsed.from?.value?.[0]?.address || '',
        toAddress: parsed.to?.value?.[0]?.address || '',
        bodyText: parsed.text || '',
        date: parsed.date?.toISOString() || new Date().toISOString(),
        uid: uid
      };

      const inserted = await this.database.insertEmail(email);
      if (inserted) {
        console.log(`New email: ${email.subject}`);
        this.extractCode(email, uid);
      }
    } catch (error) {
      console.error('Error processing email:', error);
    }
  }

  extractCode(email, uid) {
    const text = email.bodyText + ' ' + email.subject;
    
    // Simple patterns for 2FA codes
    const patterns = [
      /code[:\s]*(\d{4,8})/gi,
      /2fa[:\s]*(\d{4,8})/gi,
      /verification[:\s]*(\d{4,8})/gi,
      /\b(\d{6})\b/g,
      /\b(\d{4})\b/g
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        const code = matches[0].replace(/\D/g, '');
        if (code.length >= 4 && code.length <= 8) {
          this.database.insertCode(email.id, code);
          console.log(`Code extracted: ${code}`);
          
          // Mark email as read
          this.markEmailAsRead(uid);
          return;
        }
      }
    }
  }

  markEmailAsRead(uid) {
    this.imap.addFlags(uid, ['\\Seen'], (err) => {
      if (err) {
        console.error('Error marking email as read:', err);
      } else {
        console.log(`Email ${uid} marked as read`);
      }
    });
  }

  startHeartbeat() {
    // Clear existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Send NOOP command every 2 minutes to keep connection alive
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.imap) {
        if (this.imap.serverSupports && this.imap.serverSupports('IDLE')) {
          console.log('Connection alive (IDLE active)');
        } else {
          this.imap.noop((err) => {
            if (err) {
              console.error('Heartbeat failed:', err);
              this.handleConnectionError(err);
            } else {
              console.log('Heartbeat sent');
            }
          });
        }
      }
    }, 2 * 60 * 1000); // 2 minutes
  }

  handleConnectionError(err) {
    console.error(`Connection error for ${this.config.email}:`, err.message);
    this.cleanup();
    
    if (!this.isReconnecting) {
      this.scheduleReconnect();
    }
  }

  handleConnectionEnd() {
    console.log(`Connection ended for ${this.config.email}`);
    this.cleanup();
    
    if (!this.isReconnecting) {
      this.scheduleReconnect();
    }
  }

  cleanup() {
    this.isConnected = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.imap) {
      try {
        this.imap.removeAllListeners();
        if (this.imap.state !== 'disconnected') {
          this.imap.end();
        }
      } catch (err) {
        console.error('Error during cleanup:', err.message);
      }
      this.imap = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached for ${this.config.email}`);
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    const delay = Math.min(this.reconnectDelay * this.reconnectAttempts, 60000); // Max 1 minute
    console.log(`Reconnecting to ${this.config.email} in ${delay/1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.reconnect();
    }, delay);
  }

  async reconnect() {
    try {
      console.log(`Attempting to reconnect to ${this.config.email}...`);
      await this.connect();
      console.log(`Successfully reconnected to ${this.config.email}`);
    } catch (err) {
      console.error(`Reconnection failed for ${this.config.email}:`, err.message);
      this.isReconnecting = false;
      this.scheduleReconnect();
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      email: this.config.email,
      reconnectAttempts: this.reconnectAttempts,
      isReconnecting: this.isReconnecting
    };
  }
}

module.exports = SimpleEmailService;