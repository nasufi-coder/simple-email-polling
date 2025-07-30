# Simple Email Polling Service

A minimal email aggregation service with only essential endpoints.

## Features

- **Single email account** - Connect to one Gmail account
- **Real-time listening** - IMAP IDLE for new emails
- **Unread emails only** - Only processes unread emails from last 5 minutes
- **Simple 2FA extraction** - Basic pattern matching with auto-read marking
- **Auto cleanup** - Marks emails as read after extracting 2FA codes
- **Sender filtering** - Get codes from specific email addresses
- **Database cleanup** - Automatically removes old emails (7+ days)
- **4 simple endpoints** - No email parameter needed (uses configured account)

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure email**
   ```bash
   cp .env.example .env
   # Edit .env with your Gmail credentials
   ```

3. **Start service**
   ```bash
   npm start
   ```

## API Endpoints

### GET /api/last-email
Get the most recent unread email (from last 5 minutes).

```bash
curl "http://localhost:3001/api/last-email"
```

### GET /api/last-code
Get the most recent 2FA code (from unread emails in last 5 minutes).

```bash
curl "http://localhost:3001/api/last-code"
```

### GET /api/last-code-from/:fromAddress
Get the most recent 2FA code from a specific sender.

```bash
curl "http://localhost:3001/api/last-code-from/noreply@github.com"
```

### GET /api/status
Service status and connection info.

```bash
curl "http://localhost:3001/api/status"
```

## Configuration

Edit `.env` file:
```env
EMAIL=your-email@gmail.com
PASSWORD=your-16-char-app-password
HOST=imap.gmail.com
PORT=993
TLS=true
```

## Technologies

- **Node.js** + **Express.js**
- **node-imap** for email connections
- **SQLite** for simple storage
- **mailparser** for email parsing

## Simple and Fast

- Minimal dependencies
- Single account support
- No complex filtering
- Runs on port 3001