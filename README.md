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

1. Clone Repository
git clone <your-repo-url>
cd INSTRUCTORAVAILABILITYSYSTEM

2. Install Dependencies
npm install
cd admin-ui
npm install
cd cloud-functions
npm install

3. Setup Google Cloud
- Enable Gmail API
- Enable Google Sheets API
- Create Service Account
- Download JSON key
- Place in admin-ui/cloud-functions/

4. Configure Environment
Create .env file inside cloud-functions:
GOOGLE_APPLICATION_CREDENTIALS=./your-service-account.json

5. Run Firebase
firebase login
firebase emulators:start

6. Run Application
Open:
admin-ui/index.html
instructor-ui/index.html

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
