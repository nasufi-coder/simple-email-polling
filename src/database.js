const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class SimpleDatabase {
  constructor() {
    const dbDir = './data';
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new sqlite3.Database('./data/simple.db', (err) => {
      if (err) {
        console.error('Database error:', err);
      } else {
        console.log('Database connected');
        this.createTables();
      }
    });
  }

  createTables() {
    const createEmailsTable = `
      CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        email_account TEXT NOT NULL,
        subject TEXT,
        from_address TEXT,
        to_address TEXT,
        body_text TEXT,
        date TEXT,
        uid INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(email_account, uid)
      )
    `;

    const createCodesTable = `
      CREATE TABLE IF NOT EXISTS codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_id TEXT NOT NULL,
        code TEXT NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (email_id) REFERENCES emails (id)
      )
    `;
    
    // Add 'used' column to existing tables (migration)
    const addUsedColumn = `ALTER TABLE codes ADD COLUMN used BOOLEAN DEFAULT FALSE`;
    const addToAddressColumn = `ALTER TABLE emails ADD COLUMN to_address TEXT`;

    this.db.exec(createEmailsTable);
    this.db.exec(createCodesTable);
    
    // Try to add used column (for existing databases)
    this.db.run(addUsedColumn, (err) => {
      // Ignore error if column already exists
    });
    
    // Try to add to_address column (for existing databases)
    this.db.run(addToAddressColumn, (err) => {
      // Ignore error if column already exists
    });
  }

  insertEmail(email) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT OR IGNORE INTO emails (id, email_account, subject, from_address, to_address, body_text, date, uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      
      this.db.run(sql, [email.id, email.emailAccount, email.subject, email.fromAddress, email.toAddress, email.bodyText, email.date, email.uid], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  insertCode(emailId, code) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO codes (email_id, code) VALUES (?, ?)`;
      
      this.db.run(sql, [emailId, code], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  getLastEmail(emailAccount) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM emails WHERE email_account = ? ORDER BY created_at DESC LIMIT 1`;
      
      this.db.get(sql, [emailAccount], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  getLastCode(emailAccount) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT c.*, e.subject, e.from_address 
        FROM codes c 
        JOIN emails e ON c.email_id = e.id 
        WHERE e.email_account = ? AND c.used = FALSE
        ORDER BY c.created_at DESC 
        LIMIT 1
      `;
      
      this.db.get(sql, [emailAccount], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          // Mark code as used
          this.markCodeAsUsed(row.id);
          resolve(row);
        } else {
          resolve(null);
        }
      });
    });
  }

  getLastCodeByFromAddress(emailAccount, fromAddress) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT c.*, e.subject, e.from_address 
        FROM codes c 
        JOIN emails e ON c.email_id = e.id 
        WHERE e.email_account = ? AND e.from_address = ? AND c.used = FALSE
        ORDER BY c.created_at DESC 
        LIMIT 1
      `;
      
      this.db.get(sql, [emailAccount, fromAddress], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          // Mark code as used
          this.markCodeAsUsed(row.id);
          resolve(row);
        } else {
          resolve(null);
        }
      });
    });
  }

  getLastCodeByToAddress(toAddress) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT c.*, e.subject, e.from_address, e.to_address 
        FROM codes c 
        JOIN emails e ON c.email_id = e.id 
        WHERE e.to_address = ? AND c.used = FALSE
        ORDER BY c.created_at DESC 
        LIMIT 1
      `;
      
      this.db.get(sql, [toAddress], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          // Mark code as used
          this.markCodeAsUsed(row.id);
          resolve(row);
        } else {
          resolve(null);
        }
      });
    });
  }

  markCodeAsUsed(codeId) {
    const sql = `UPDATE codes SET used = TRUE WHERE id = ?`;
    this.db.run(sql, [codeId], (err) => {
      if (err) {
        console.error('Error marking code as used:', err);
      }
    });
  }

  cleanupOldEmails(olderThanDays = 7) {
    return new Promise((resolve, reject) => {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
      
      // Delete old codes first (foreign key constraint)
      const deleteCodesSQL = `
        DELETE FROM codes 
        WHERE email_id IN (
          SELECT id FROM emails WHERE created_at < ?
        )
      `;
      
      this.db.run(deleteCodesSQL, [cutoffDate], (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Then delete old emails
        const deleteEmailsSQL = `DELETE FROM emails WHERE created_at < ?`;
        
        this.db.run(deleteEmailsSQL, [cutoffDate], function(err) {
          if (err) reject(err);
          else {
            console.log(`Cleaned up ${this.changes} old emails`);
            resolve(this.changes);
          }
        });
      });
    });
  }
}

module.exports = SimpleDatabase;