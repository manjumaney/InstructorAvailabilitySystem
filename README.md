# Instructor Availability System

## Overview
Interactive Email-Based Instructor Availability System that automates scheduling using email workflows, token-based responses, and a Power BI dashboard.

---

## Features
- Assigned and Broadcast Campaigns
- Dynamic Course Addition
- One-click Email Responses
- Token-based Authentication (no login)
- Multiple responses allowed (latest is considered)
- Automated Reminder Emails
- Confirmation Email after response
- Real-time Dashboard (Power BI)

---

## System Architecture
- Frontend: HTML, JavaScript (Admin + Instructor UI)
- Backend: Node.js + Firebase Cloud Functions
- Database: Google Sheets
- Email Service: Gmail API
- Dashboard: Power BI

---

## Setup Instructions

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd INSTRUCTORAVAILABILITYSYSTEM
```

### 2. Install dependencies

Install dependencies in the root project, admin UI, and cloud functions folders.

```bash
npm install
cd admin-ui
npm install
cd cloud-functions
npm install
cd ../..
```

### 3. Set up Google Cloud

In Google Cloud Console:

* Enable the Gmail API
* Enable the Google Sheets API
* Create a service account
* Download the JSON key file

Place the JSON key file inside:

```text
admin-ui/cloud-functions/
```

### 4. Configure environment variables

Create a `.env` file inside `admin-ui/cloud-functions/` and add:

```env
GOOGLE_APPLICATION_CREDENTIALS=./your-service-account.json
```

Replace `your-service-account.json` with the actual filename of your downloaded key.

If your project also uses deployed URLs and Gmail credentials, include them as needed:

```env
FORM_BASE_URL=...
API_BASE_URL=...
SENDER_EMAIL=...
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
```

### 5. Run Firebase

Log in to Firebase and start the emulator:

```bash
firebase login
firebase emulators:start
```

### 6. Run the application

Open the following files in the browser:

```text
admin-ui/index.html
instructor-ui/index.html
```

## Notes

* Make sure the required Google APIs are enabled before running the project.
* If running the deployed version, update the frontend API base URL to the live backend URL.

---

## Usage Flow
1. Admin creates campaign
2. Emails sent via Gmail API
3. Instructor responds
4. Data stored in Google Sheets
5. Dashboard updates in Power BI

---

## Security
- Token-based access
- No login required
- Secure mapping of responses

---

## Known Limitations
- AMP email not fully implemented
- Requires API permissions setup

---

## Future Improvements
- Full AMP email support
- AI-based scheduling
- Improved UI/UX
- Advanced analytics

---

## References
Google Cloud: https://cloud.google.com/
Gmail API: https://developers.google.com/gmail/api
Google Sheets API: https://developers.google.com/sheets/api
Firebase: https://firebase.google.com/
Power BI: https://powerbi.microsoft.com/
AMP Email: https://amp.dev/documentation/guides-and-tutorials/learn/email/
Node.js: https://nodejs.org/

---

## Authors
- MANJUMANEY CHOODALI MANEY
- STELIN MACWAN
