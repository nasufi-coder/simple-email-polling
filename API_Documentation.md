# Simple Email Polling Service - API Documentation

## Overview
The Simple Email Polling Service provides a REST API for retrieving emails and 2FA codes from a configured email account. The service processes only unread emails from the last 5 minutes and automatically marks emails as read after extracting 2FA codes.

## Base URL
```
http://localhost:3001
```

## Authentication
No authentication required for API endpoints.

---

## API Endpoints

### 1. Get Last Email
**Endpoint:** `GET /api/last-email`

**Description:** Retrieves the most recent unread email from the last 5 minutes.

**Request:**
```bash
curl "http://localhost:3001/api/last-email"
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "email_account": "your-email@domain.com",
    "subject": "Email Subject",
    "from_address": "sender@domain.com",
    "body_text": "Email content...",
    "date": "2023-12-01T10:30:00.000Z",
    "uid": 12345,
    "created_at": "2023-12-01T10:31:00.000Z"
  }
}
```

**No Email Found:**
```json
{
  "success": true,
  "data": null,
  "message": "No emails found"
}
```

---

### 2. Get Last 2FA Code
**Endpoint:** `GET /api/last-code`

**Description:** Retrieves the most recent unused 2FA code from unread emails in the last 5 minutes. **Single-use**: The code is marked as used after retrieval and won't be returned again.

**Request:**
```bash
curl "http://localhost:3001/api/last-code"
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email_id": "uuid-string",
    "code": "123456",
    "used": false,
    "created_at": "2023-12-01T10:31:00.000Z",
    "subject": "Your verification code",
    "from_address": "noreply@service.com"
  }
}
```

**No Code Found:**
```json
{
  "success": true,
  "data": null,
  "message": "No codes found"
}
```

---

### 3. Get Last Code from Specific Sender
**Endpoint:** `GET /api/last-code-from/:fromAddress`

**Description:** Retrieves the most recent unused 2FA code from a specific email sender. **Single-use**: The code is marked as used after retrieval and won't be returned again.

**Parameters:**
- `fromAddress` (string): Email address of the sender

**Request:**
```bash
curl "http://localhost:3001/api/last-code-from/noreply@github.com"
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "email_id": "uuid-string",
    "code": "789012",
    "used": false,
    "created_at": "2023-12-01T10:31:00.000Z",
    "subject": "GitHub verification code",
    "from_address": "noreply@github.com"
  }
}
```

**No Code Found:**
```json
{
  "success": true,
  "data": null,
  "message": "No codes found from this sender"
}
```

---

### 4. Service Status
**Endpoint:** `GET /api/status`

**Description:** Returns the current status of the email service and connection information.

**Request:**
```bash
curl "http://localhost:3001/api/status"
```

**Response Format:**
```json
{
  "success": true,
  "status": "running",
  "email_service": {
    "connected": true,
    "email": "your-email@domain.com"
  },
  "timestamp": "2023-12-01T10:31:00.000Z"
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

**Server Error (500):**
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

---

## Important Notes

### Single-Use Codes
- 2FA codes are **single-use only**
- Once retrieved via `/api/last-code` or `/api/last-code-from/:fromAddress`, codes are marked as used
- Subsequent requests for the same code will return `null`
- New codes become available when new emails arrive

### Email Processing
- Only processes **unread emails** from the **last 5 minutes**
- Emails are automatically marked as **read** after 2FA code extraction
- Service uses real-time IMAP IDLE for instant email processing

### 2FA Code Patterns
The service automatically detects codes using these patterns:
- `code: 123456`
- `2fa: 123456`
- `verification: 123456`
- 6-digit numbers: `123456`
- 4-digit numbers: `1234`

### Data Retention
- Emails and codes older than **7 days** are automatically deleted
- Cleanup runs daily and on service startup

---

## Service Information
- **Version:** 1.0.0
- **Default Port:** 3001
- **Database:** SQLite (local file storage)
- **Email Protocol:** IMAP with TLS

---

## Root Endpoint
**Endpoint:** `GET /`

Returns service information and available endpoints:

```json
{
  "success": true,
  "message": "Simple Email Polling Service",
  "version": "1.0.0",
  "endpoints": [
    "GET /api/last-email - Get last email",
    "GET /api/last-code - Get last 2FA code",
    "GET /api/last-code-from/:fromAddress - Get last code from specific sender",
    "GET /api/status - Service status"
  ]
}
```