const express = require("express");
const { google } = require("googleapis");
require("dotenv").config();
// ====== CONFIG ======
const SHEET_ID = process.env.SHEET_ID;

const SHEETS = {
  instructors: "Instructors",
  courses: "Courses",
  courseRequests: "CourseRequests",
  campaigns: "Campaigns",
  tracking: "Tracking",
  responses: "Responses",
};

console.log("Using SHEET_ID:", SHEET_ID);
console.log("FORM_BASE_URL:", process.env.FORM_BASE_URL);
console.log("API_BASE_URL:", process.env.API_BASE_URL);
console.log("SENDER_EMAIL:", process.env.SENDER_EMAIL);

//Safe fallback link
function fallbackLink(token) {
  const api = process.env.API_BASE_URL || "";
  const base = process.env.FORM_BASE_URL || (api ? `${api}/instructor.html` : "");
  if (!base) return "";
  return `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

function submitUrl() {
  return `${process.env.API_BASE_URL}/submitResponse`;
}

// AUTHICATION
async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

// FUNCTIONS
function requireField(obj, field) {
  if (!obj[field] || String(obj[field]).trim() === "") {
    const err = new Error(`Missing required field: ${field}`);
    err.status = 400;
    throw err;
  }
}

function makeToken() {
  return `tok_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function readSheetAsObjects(sheets, rangeA1) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: rangeA1,
  });

  const values = resp.data.values || [];
  if (values.length < 2) return [];

  const headers = values[0].map((h) => String(h).trim());
  return values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i] ?? ""));
    return obj;
  });
}

async function appendRows(sheets, rangeA1, rows) {
  if (!rows.length) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: rangeA1,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
}

// GMAIL SENDER
async function getGmailClientOAuth() {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  );
  oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: "v1", auth: oAuth2Client });
}

function toBase64Url(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sendEmailMultipart({ to, subject, text, html, ampHtml }) {
  const boundary = "BOUNDARY_" + Date.now();

  const raw = [
    `From: ${process.env.SENDER_EMAIL}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,

    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    text,
    ``,

    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    html,
    ``,

    `--${boundary}`,
    `Content-Type: text/x-amp-html; charset=UTF-8`,
    ``,
    ampHtml,
    ``,

    `--${boundary}--`,
    ``,
  ].join("\r\n");

  const gmail = await getGmailClientOAuth();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: toBase64Url(raw) },
  });
}

//TEMPLATE HELPERS
function buildTextEmail({ term_id, campaign_id, courses, token }) {
  return `Instructor Availability Request
Term: ${term_id}
Campaign: ${campaign_id}

Open form (if AMP not supported):
${fallbackLink(token)}

Courses:
${courses.map((c) => `${c.course_id} - ${c.course_name || ""}`).join("\n")}
`;
}

function buildHtmlEmail({ term_id, campaign_id, courses, token }) {
  const base = process.env.API_BASE_URL;
  const formUrl = fallbackLink(token);

  const courseList = courses
    .map((c) => {
      const availableUrl = `${base}/quickResponse?token=${encodeURIComponent(token)}&course_id=${encodeURIComponent(c.course_id)}&response=available`;
      const notAvailableUrl = `${base}/quickResponse?token=${encodeURIComponent(token)}&course_id=${encodeURIComponent(c.course_id)}&response=not_available`;

      return `
        <div style="border-bottom:1px solid #e5e7eb;padding:14px 12px;">
          <div style="font-weight:600;color:#111827;margin-bottom:4px;">${c.course_id}</div>
          <div style="color:#4b5563;font-size:14px;margin-bottom:10px;">${c.course_name || ""}</div>

          <a href="${availableUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:8px 14px;border-radius:6px;font-weight:600;margin-right:8px;">
            ✔ Available
          </a>

          <a href="${notAvailableUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:8px 14px;border-radius:6px;font-weight:600;">
            ✖ Not Available
          </a>
        </div>
      `;
    })
    .join("");

  return `<!doctype html>
  <html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:680px;margin:30px auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:28px;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
        
        <h2 style="margin:0 0 12px 0;font-size:28px;color:#111827;">
          Instructor Availability Request
        </h2>

        <p style="margin:0 0 20px 0;color:#4b5563;font-size:15px;line-height:1.6;">
          Please confirm your availability for each course below.
          You may respond individually or open the full form for detailed input.
        </p>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:22px;">
          <div style="margin-bottom:6px;"><strong>Term:</strong> ${term_id}</div>
          <div><strong>Campaign:</strong> ${campaign_id}</div>
        </div>

        <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:18px;">
          <div style="padding:12px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-weight:600;">
            Requested Course(s)
          </div>

          ${courseList}
        </div>

        <div style="margin-top:10px;">
          <a href="${formUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
            Open Full Form
          </a>
        </div>

        <p style="margin:18px 0 0 0;color:#6b7280;font-size:13px;line-height:1.5;">
          You can respond separately for each course. Your latest response will be saved.
        </p>

      </div>
    </div>
  </body>
  </html>`;
}

async function findRowIndexByToken(sheets, token) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEETS.tracking}!A:L`,
  });

  const values = resp.data.values || [];
  if (values.length < 2) return -1;

  for (let i = 1; i < values.length; i++) {
    const rowToken = String(values[i][1] || "").trim(); // column B = token
    if (rowToken === token) return i + 1; // sheet row number
  }
  return -1;
}

async function updateTrackingStatusByToken(sheets, token, updates = {}) {
  const rowIndex = await findRowIndexByToken(sheets, token);
  if (rowIndex === -1) return false;

  const email_status = updates.sent_status || "responded";
  const response_status = updates.response_status || "responded";
  const responded_at = updates.responded_at || new Date().toISOString();

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEETS.tracking}!H${rowIndex}:K${rowIndex}`, 
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[email_status, response_status, "", responded_at]],
    },
  });

  return true;
}

async function sendSimpleConfirmationEmail({ to, term_id, course_name, response }) {
  const subject = `Response Received (${term_id})`;

  const text = `Thank you. Your response has been received.

Term: ${term_id}
Course: ${course_name}
Response: ${response}

No further action is required unless you would like to update your response.`;

  const html = `<!doctype html>
  <html>
  <body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px;color:#111827;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
      <h2 style="margin-top:0;">Response Received</h2>
      <p>Thank you. Your availability response has been recorded successfully.</p>
      <p><strong>Term:</strong> ${term_id}</p>
      <p><strong>Course:</strong> ${course_name}</p>
      <p><strong>Response:</strong> ${response}</p>
      <p style="color:#6b7280;">No further action is required unless you would like to update your response.</p>
    </div>
  </body>
  </html>`;

  await sendEmailMultipart({
    to,
    subject,
    text,
    html,
    ampHtml: html,
  });
}

//AMP + Advanced confirmation (Review → Confirm & Submit)
function buildAmpEmail({ term_id, campaign_id, email_type, token, courses }) {
  const blocks = courses
    .map(
      (c) => `
    <div class="card">
      <div class="title">${c.course_id} — ${c.course_name || ""}</div>

      <div class="row">
        <label>Availability</label>
        <select name="availability_${c.course_id}" required>
          <option value="">Select</option>
          <option value="Yes">Yes</option>
          <option value="Maybe">Maybe</option>
          <option value="No">No</option>
        </select>
      </div>

      <div class="row">
        <label>Comment (optional)</label>
        <input name="comments_${c.course_id}" placeholder="Optional comment">
      </div>
    </div>
  `
    )
    .join("");

  return `<!doctype html>
<html ⚡4email>
<head>
  <meta charset="utf-8">
  <script async src="https://cdn.ampproject.org/v0.js"></script>
  <script async custom-element="amp-form" src="https://cdn.ampproject.org/v0/amp-form-0.1.js"></script>
  <script async custom-element="amp-bind" src="https://cdn.ampproject.org/v0/amp-bind-0.1.js"></script>
  <style amp4email-boilerplate>body{visibility:hidden}</style>
  <style amp-custom>
    body{font-family:Arial,sans-serif;padding:12px}
    .title{font-size:16px;font-weight:700;margin:6px 0}
    .card{border:1px solid #ddd;border-radius:10px;padding:12px;margin:12px 0}
    .row{margin:10px 0}
    .btn{background:#111;color:#fff;border:0;padding:10px 12px;border-radius:8px}
    select,input{width:100%;padding:8px;border-radius:8px;border:1px solid #ccc}
    .success{background:#eaffea;border:1px solid #b6f0b6;padding:10px;border-radius:8px}
    .err{background:#ffecec;border:1px solid #ffb6b6;padding:10px;border-radius:8px}
  </style>
</head>
<body>
  <div class="title">Instructor Availability Request</div>
  <div>Term: ${term_id} · Campaign: ${campaign_id} · Type: ${email_type}</div>

  <amp-state id="ui"><script type="application/json">{"review":false,"submitted":false}</script></amp-state>

  <form method="post" action-xhr="${submitUrl()}"
        on="submit-success:AMP.setState({ui:{submitted:true}})">
    <input type="hidden" name="token" value="${token}">

    ${blocks}

    <div class="row">
      <button class="btn" type="button"
              on="tap:AMP.setState({ui:{review:true}})">Review Selection</button>
    </div>

    <div class="row" [hidden]="!ui.review">
      <div class="card">
        <div class="title">Please confirm</div>
        <div>Once submitted, your response is recorded.</div>
      </div>
    </div>

    <div class="row" [hidden]="!ui.review">
      <button class="btn" type="submit">Confirm & Submit</button>
    </div>

    <div class="row" [hidden]="!ui.submitted">
      <div class="success">✅ Submitted! Thank you.</div>
    </div>

    <div submit-error class="row">
      <div class="err">❌ Submit failed. Please try again or use fallback.</div>
    </div>
  </form>

  <div style="font-size:13px;color:#666">
    Fallback: <a href="${fallbackLink(token)}">Open availability form</a>
  </div>
</body></html>`;
}

// EXPRESS APP
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//AMP Email  + Normal 
const AMP_ALLOWED_ORIGINS = new Set([
  "https://mail.google.com",
  "https://mail.googleusercontent.com",
  "https://amp.gmail.dev", // AMP Playground
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // AMP requires specific origin echo + AMP headers
  if (origin && AMP_ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, AMP-Email-Sender");
  res.setHeader("Access-Control-Expose-Headers", "AMP-Access-Control-Allow-Source-Origin, AMP-Email-Allow-Sender");

  // AMP adds __amp_source_origin
  const sourceOrigin = req.query.__amp_source_origin;
  if (sourceOrigin) {
    res.setHeader("AMP-Access-Control-Allow-Source-Origin", sourceOrigin);
  }

  // AMP for Email: allow sender header (helps Gmail)
  if (process.env.SENDER_EMAIL) {
    res.setHeader("AMP-Email-Allow-Sender", process.env.SENDER_EMAIL);
  }

  if (req.method === "OPTIONS") return res.status(204).send("");
  next();
});


//  addCourse()
app.post("/addCourse", async (req, res) => {
  try {
    const body = req.body || {};

    requireField(body, "term_id");
    requireField(body, "course_id");
    requireField(body, "course_name");
    requireField(body, "department");
    requireField(body, "target_mode");

    const term_id = String(body.term_id).trim();
    const course_id = String(body.course_id).trim();
    const course_name = String(body.course_name).trim();
    const department = String(body.department).trim();
    const target_mode = String(body.target_mode).trim();
    const instructor_id = (body.instructor_id || "").toString().trim();

    const sheets = await getSheetsClient();

    const isAssigned = target_mode === "assigned" || instructor_id.length > 0;

    if (isAssigned) {
      if (!instructor_id) {
        return res.status(400).json({ error: "instructor_id is required for assigned mode" });
      }

      const values = [[term_id, instructor_id, course_id, course_name, department, "open"]];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${SHEETS.courses}!A:F`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });

      return res.json({
        ok: true,
        message: `Assigned course added to Courses for instructor ${instructor_id}.`,
        written_to: "Courses",
      });
    }

    const request_id = `REQ_${Date.now()}`;
    const created_at = new Date().toISOString();
    const values = [[request_id, term_id, course_id, course_name, department, "department", created_at, "open"]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEETS.courseRequests}!A:H`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    return res.json({
      ok: true,
      message: `Course request added for department ${department}.`,
      written_to: "CourseRequests",
      request_id,
    });
  } catch (err) {
    console.error("addCourse ERROR:", err);
    return res.status(err.status || 500).json({ error: err.message });
  }
});


//  startAssignedCampaign()  (creates tracking + sends email)
app.post("/startAssignedCampaign", async (req, res) => {
  try {
    const body = req.body || {};
    requireField(body, "term_id");

    const term_id = String(body.term_id).trim();
    const sheets = await getSheetsClient();

    // ✅ NEW: Block if an existing ASSIGNED campaign for this term still has PENDING responses
    const campaigns = await readSheetAsObjects(sheets, `${SHEETS.campaigns}!A:Z`);
    const trackingExisting = await readSheetAsObjects(sheets, `${SHEETS.tracking}!A:Z`);

    // Find latest assigned campaign for this term (if multiple exist, take latest by created_at)
    const assignedCampaigns = campaigns
      .filter(
        (c) =>
          String(c.term_id || "").trim() === term_id &&
          String(c.campaign_type || "").trim().toLowerCase() === "assigned"
      )
      .sort((a, b) => new Date(String(b.created_at || 0)) - new Date(String(a.created_at || 0)));

    if (assignedCampaigns.length > 0) {
      const existingCampaign = assignedCampaigns[0];
      const existingCampaignId = String(existingCampaign.campaign_id || "").trim();

      const stillPending = trackingExisting.some(
        (t) =>
          String(t.campaign_id || "").trim() === existingCampaignId &&
          String(t.response_status || "").trim().toLowerCase() === "pending"
      );

      if (stillPending) {
        return res.status(409).json({
          ok: false,
          message: `⚠️ Campaign already running for term ${term_id} (pending responses exist).`,
          existing_campaign_id: existingCampaignId,
          suggestion: "Use sendReminders() or wait until responses are received. For new courses, use updateCampaignDelta().",
        });
      }
    }
    // END NEW BLOCK

    const instructors = await readSheetAsObjects(sheets, `${SHEETS.instructors}!A:Z`);
    const courses = await readSheetAsObjects(sheets, `${SHEETS.courses}!A:Z`);

    const termCourses = courses.filter((c) => String(c.term_id).trim() === term_id);

    const map = new Map();
    for (const c of termCourses) {
      const iid = String(c.instructor_id || "").trim();
      if (!iid) continue;
      if (!map.has(iid)) map.set(iid, []);
      map.get(iid).push(c);
    }

    if (map.size === 0) {
      return res.json({ ok: true, message: `No assigned courses found for term ${term_id}.`, created: 0 });
    }

    const campaign_id = `${term_id}_ASSIGNED_${new Date().toISOString().slice(0, 10)}`;

    await appendRows(sheets, `${SHEETS.campaigns}!A:F`, [
      [campaign_id, term_id, "assigned", new Date().toISOString(), "admin", "Initial assigned campaign"],
    ]);

    const now = new Date().toISOString();
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const trackingRows = [];
    for (const [instructor_id, list] of map.entries()) {
      const token = makeToken();
      const courseIds = list.map((x) => String(x.course_id || "").trim()).filter(Boolean);

      trackingRows.push([
        campaign_id,
        token,
        "assigned",
        "direct",
        instructor_id,
        term_id,
        courseIds.join(","),
        "sent",
        "pending",
        now,
        "",
        expiry,
      ]);
    }

    await appendRows(sheets, `${SHEETS.tracking}!A:L`, trackingRows);

    let sent = 0;
    let skipped = 0;

    for (const row of trackingRows) {
      const instructor_id = String(row[4]).trim();
      const token = String(row[1]).trim();
      const course_ids_requested = String(row[6]).trim();

      const inst = instructors.find((i) => String(i.instructor_id || "").trim() === instructor_id);
      const to = String(inst?.email || inst?.Email || "").trim();

      if (!to) {
        skipped++;
        continue;
      }

      const courseIds = course_ids_requested.split(",").map((s) => s.trim()).filter(Boolean);

      const coursesForEmail = courses
        .filter(
          (c) =>
            String(c.term_id).trim() === term_id &&
            String(c.instructor_id).trim() === instructor_id &&
            courseIds.includes(String(c.course_id).trim())
        )
        .map((c) => ({
          course_id: String(c.course_id).trim(),
          course_name: String(c.course_name || "").trim(),
          department: String(c.department || "").trim(),
        }));

      try {
        await sendEmailMultipart({
          to,
          subject: `Availability Needed (${term_id})`,
          text: buildTextEmail({ term_id, campaign_id, courses: coursesForEmail, token }),
          html: buildHtmlEmail({ term_id, campaign_id, courses: coursesForEmail, token }),
          ampHtml: buildAmpEmail({ term_id, campaign_id, email_type: "assigned", token, courses: coursesForEmail }),
        });
        sent++;
      } catch (e) {
        console.error("Email failed:", to, e?.message || e);
      }
    }

    return res.json({
      ok: true,
      message: "Tracking created + email send attempted",
      created: trackingRows.length,
      sent,
      skipped,
      campaign_id,
    });
  } catch (err) {
    console.error("startAssignedCampaign ERROR:", err);
    return res.status(err.status || 500).json({ error: err.message });
  }
});


//  submitResponse()  (AMP + JSON supported)
app.post("/submitResponse", async (req, res) => {
  try {
    const body = req.body || {};
    requireField(body, "token");
    const token = String(body.token).trim();

    const sheets = await getSheetsClient();

    const trackingObjs = await readSheetAsObjects(sheets, `${SHEETS.tracking}!A:Z`);
    const instructors = await readSheetAsObjects(sheets, `${SHEETS.instructors}!A:Z`);

    const trackRow = trackingObjs.find((t) => String(t.token).trim() === token);

    if (!trackRow) return res.status(404).json({ error: "Invalid token" });

    const exp = new Date(String(trackRow.token_expiry || "").trim());
    if (!isNaN(exp.getTime()) && exp < new Date()) {
      return res.status(403).json({ error: "Token expired" });
    }

    const campaign_id = String(trackRow.campaign_id || "").trim();
    const email_type = String(trackRow.email_type || "").trim();
    const instructor_id = String(trackRow.instructor_id || "").trim();
    const term_id = String(trackRow.term_id || "").trim();

    const courseIds = String(trackRow.course_ids_requested || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    let responses = body.responses;

    if (typeof responses === "string") {
      try {
        responses = JSON.parse(responses);
      } catch {}
    }

    if (!Array.isArray(responses)) {
      responses = courseIds
        .map((cid) => ({
          course_id: cid,
          availability: String(body[`availability_${cid}`] || "").trim(),
          comments: String(body[`comments_${cid}`] || "").trim(),
        }))
        .filter((r) => r.availability);
    }

    if (!responses.length) {
      return res.status(400).json({ error: "No availability provided" });
    }

    const ts = new Date().toISOString();

    const rowsToAppend = responses.map((r) => [
      ts,
      campaign_id,
      email_type,
      instructor_id,
      term_id,
      String(r.course_id || "").trim(),
      String(r.availability || "").trim(),
      String(r.comments || "").trim(),
    ]);

    await appendRows(sheets, `${SHEETS.responses}!A:H`, rowsToAppend);

    // UPDATE TRACKING
    await updateTrackingStatusByToken(sheets, token, {
      sent_status: "responded",
      response_status: "responded",
      responded_at: ts,
    });

    // GET EMAIL PROPERLY
    const inst = instructors.find(
      (i) => String(i.instructor_id || "").trim() === instructor_id
    );

    const to =
      String(inst?.email || "").trim() ||
      String(inst?.Email || "").trim();

    console.log("Sending confirmation email to:", to);

    // SEND EMAIL ALWAYS
    if (to) {
      try {
        let summaryText = "";

        if (responses.length === 1) {
          summaryText = String(responses[0].availability || "").trim();
        } else {
          summaryText = responses
            .map((r) => `${r.course_id}: ${r.availability}`)
            .join(", ");
        }

        const coursesSheet = await readSheetAsObjects(sheets, `${SHEETS.courses}!A:Z`);

        let course_name = "Multiple Courses";
        if (responses.length === 1) {
          const course = coursesSheet.find(
            (c) =>
              String(c.course_id || "").trim() === String(responses[0].course_id || "").trim() &&
              String(c.term_id || "").trim() === term_id
          );
          course_name = String(course?.course_name || responses[0].course_id || "Course").trim();
        }

        await sendSimpleConfirmationEmail({
          to,
          term_id,
          course_name,
          response: summaryText,
        });

        console.log("✅ Confirmation email sent");
      } catch (e) {
        console.error("❌ Confirmation email failed:", e?.message || e);
      }
    } else {
      console.log("⚠️ No email found for instructor:", instructor_id);
    }

    return res.json({
      ok: true,
      saved: rowsToAppend.length,
      message: "Response submitted successfully",
    });
  } catch (err) {
    console.error("submitResponse ERROR:", err);
    return res.status(err.status || 500).json({ error: err.message || "Unknown error" });
  }
});

app.get("/r/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ error: "Missing token" });

    const sheets = await getSheetsClient();
    const tracking = await readSheetAsObjects(sheets, `${SHEETS.tracking}!A:Z`);
    const trackRow = tracking.find((t) => String(t.token).trim() === token);

    if (!trackRow) return res.status(404).json({ error: "Invalid token" });

    const exp = new Date(String(trackRow.token_expiry || "").trim());
    if (!isNaN(exp.getTime()) && exp < new Date()) {
      return res.status(403).json({ error: "Token expired" });
    }

    const courseIds = String(trackRow.course_ids_requested || "")
      .split(",").map(s => s.trim()).filter(Boolean);

    return res.json({
      ok: true,
      token,
      campaign_id: String(trackRow.campaign_id || "").trim(),
      term_id: String(trackRow.term_id || "").trim(),
      instructor_id: String(trackRow.instructor_id || "").trim(),
      email_type: String(trackRow.email_type || "").trim(),
      target_group: String(trackRow.target_group || "").trim(),
      course_ids_requested: courseIds,
    });
  } catch (err) {
    console.error("GET /r/:token ERROR:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
});

app.get("/quickResponse", async (req, res) => {
  try {
    const { token, response, course_id } = req.query;

    if (!token || !response || !course_id) {
      return res.status(400).send("Missing token, course_id, or response.");
    }

    const valid = ["available", "not_available"];
    if (!valid.includes(String(response).trim().toLowerCase())) {
      return res.status(400).send("Invalid response.");
    }

    const normalizedResponse = String(response).trim().toLowerCase();
    const normalizedCourseId = String(course_id).trim();

    const sheets = await getSheetsClient();
    const tracking = await readSheetAsObjects(sheets, `${SHEETS.tracking}!A:Z`);
    const instructors = await readSheetAsObjects(sheets, `${SHEETS.instructors}!A:Z`);
    const coursesSheet = await readSheetAsObjects(sheets, `${SHEETS.courses}!A:Z`);

    const trackRow = tracking.find(
      (t) => String(t.token).trim() === String(token).trim()
    );
    if (!trackRow) return res.status(404).send("Invalid token");

    const exp = new Date(String(trackRow.token_expiry || "").trim());
    if (!isNaN(exp.getTime()) && exp < new Date()) {
      return res.status(403).send("Token expired");
    }

    const allowedCourseIds = String(trackRow.course_ids_requested || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!allowedCourseIds.includes(normalizedCourseId)) {
      return res.status(400).send("Course not allowed for this token.");
    }

    const ts = new Date().toISOString();

    const row = [[
      ts,
      String(trackRow.campaign_id || "").trim(),
      String(trackRow.email_type || "").trim(),
      String(trackRow.instructor_id || "").trim(),
      String(trackRow.term_id || "").trim(),
      normalizedCourseId,
      normalizedResponse,
      "Quick response",
    ]];

    await appendRows(sheets, `${SHEETS.responses}!A:H`, row);

    await updateTrackingStatusByToken(sheets, token, {
      sent_status: "responded",
      response_status: "responded",
      responded_at: ts,
    });

    const inst = instructors.find(
      (i) =>
        String(i.instructor_id || "").trim() ===
        String(trackRow.instructor_id || "").trim()
    );
    const to = String(inst?.email || inst?.Email || "").trim();

    const course = coursesSheet.find(
      (c) =>
        String(c.course_id || "").trim() === normalizedCourseId &&
        String(c.term_id || "").trim() === String(trackRow.term_id || "").trim()
    );

    const course_name = String(course?.course_name || normalizedCourseId).trim();

    if (to) {
      try {
        await sendSimpleConfirmationEmail({
          to,
          term_id: String(trackRow.term_id || "").trim(),
          course_name,
          response: normalizedResponse,
        });
        console.log("✅ Quick response email sent");
      } catch (e) {
        console.error("❌ Quick response email failed:", e?.message || e);
      }
    } else {
      console.log("⚠️ No email found for instructor:", trackRow.instructor_id);
    }

    return res.send(`
      <!doctype html>
      <html>
        <head>
          <title>Response Submitted</title>
        </head>
        <body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;">
          <div style="max-width:520px;margin:80px auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:32px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
            <div style="font-size:42px;margin-bottom:12px;">✅</div>
            <h2 style="margin:0 0 10px 0;color:#111827;">Response Submitted</h2>
            <p style="margin:0 0 8px 0;color:#4b5563;">Your availability response has been recorded successfully.</p>
            <p style="margin:0;color:#111827;"><strong>Course:</strong> ${course_name}</p>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("quickResponse ERROR:", err);
    return res.status(500).send("Something went wrong.");
  }
});


app.post("/startDepartmentBroadcast", async (req, res) => {
  try {
    const body = req.body || {};
    requireField(body, "term_id");
    requireField(body, "department");

    const term_id = String(body.term_id).trim();
    const department = String(body.department).trim();

    const sheets = await getSheetsClient();

    const instructors = await readSheetAsObjects(sheets, `${SHEETS.instructors}!A:Z`);
    const courseRequests = await readSheetAsObjects(sheets, `${SHEETS.courseRequests}!A:Z`);

  const openRequests = courseRequests.filter(
  (r) =>
    String(r.term_id || "").trim() === term_id &&
    String(r.department || "").trim().toLowerCase() === department.toLowerCase() &&
    String(r.status || "").trim().toLowerCase() === "open"
);
    if (openRequests.length === 0) {
      return res.json({
        ok: true,
        message: `No open course requests found for ${department} in term ${term_id}.`,
        created: 0,
        sent: 0,
        skipped: 0
      });
    }

   const deptInstructors = instructors.filter(
  (i) =>
    String(i.department || "").trim().toLowerCase() === department.toLowerCase() &&
    String(i.status || "").trim().toLowerCase() === "active"
);

    if (deptInstructors.length === 0) {
      return res.json({
        ok: true,
        message: `No active instructors found in ${department}.`,
        created: 0,
        sent: 0,
        skipped: 0
      });
    }

    const campaign_id = `${term_id}_DEPARTMENT_${department.replace(/\s+/g, "_").toUpperCase()}_${new Date().toISOString().slice(0, 10)}`;

    await appendRows(sheets, `${SHEETS.campaigns}!A:F`, [
      [campaign_id, term_id, "department", new Date().toISOString(), "admin", `Department broadcast for ${department}`],
    ]);

    const now = new Date().toISOString();
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const trackingRows = [];
    let sent = 0;
    let skipped = 0;

    for (const inst of deptInstructors) {
      const instructor_id = String(inst.instructor_id || "").trim();
      const to = String(inst.email || inst.Email || "").trim();

      if (!instructor_id || !to) {
        skipped++;
        continue;
      }

      const token = makeToken();

      const coursesForEmail = openRequests.map((r) => ({
        course_id: String(r.course_id || "").trim(),
        course_name: String(r.course_name || "").trim(),
        department: String(r.department || "").trim(),
      }));

      const courseIds = coursesForEmail.map((c) => c.course_id);

      trackingRows.push([
        campaign_id,          // A campaign_id
        token,                // B token
        "department",         // C email_type
        department,           // D target_group
        instructor_id,        // E instructor_id
        term_id,              // F term_id
        courseIds.join(","),  // G course_ids_requested
        "sent",               // H sent_status
        "pending",            // I response_status
        now,                  // J sent_at
        "",                   // K responded_at
        expiry,               // L token_expiry
      ]);

      try {
        await sendEmailMultipart({
          to,
          subject: `Open Course Availability Needed (${term_id} - ${department})`,
          text: buildTextEmail({
            term_id,
            campaign_id,
            courses: coursesForEmail,
            token,
          }),
          html: buildHtmlEmail({
            term_id,
            campaign_id,
            courses: coursesForEmail,
            token,
          }),
          ampHtml: buildAmpEmail({
            term_id,
            campaign_id,
            email_type: "department",
            token,
            courses: coursesForEmail,
          }),
        });

        sent++;
      } catch (e) {
        console.error("Department email failed:", to, e?.message || e);
      }
    }

    await appendRows(sheets, `${SHEETS.tracking}!A:L`, trackingRows);

    return res.json({
      ok: true,
      message: `Department broadcast sent for ${department} in term ${term_id}.`,
      created: trackingRows.length,
      sent,
      skipped,
      campaign_id,
    });
  } catch (err) {
    console.error("startDepartmentBroadcast ERROR:", err);
    return res.status(err.status || 500).json({ error: err.message });
  }
});

app.post("/updateCampaignDelta", async (req, res) => {
  try {
    const body = req.body || {};
    requireField(body, "term_id");

    const term_id = String(body.term_id).trim();
    const sheets = await getSheetsClient();

    const instructors = await readSheetAsObjects(sheets, `${SHEETS.instructors}!A:Z`);
    const courses = await readSheetAsObjects(sheets, `${SHEETS.courses}!A:Z`);
    const tracking = await readSheetAsObjects(sheets, `${SHEETS.tracking}!A:Z`);
    const campaigns = await readSheetAsObjects(sheets, `${SHEETS.campaigns}!A:Z`);

    const termCourses = courses.filter(
      (c) => String(c.term_id || "").trim() === term_id
    );

    if (termCourses.length === 0) {
      return res.json({
        ok: true,
        message: `No assigned courses found for term ${term_id}.`,
        created: 0,
        sent: 0,
        skipped: 0,
      });
    }

    // Find latest assigned campaign for this term
    const assignedCampaigns = campaigns
      .filter(
        (c) =>
          String(c.term_id || "").trim() === term_id &&
          String(c.campaign_type || "").trim().toLowerCase() === "assigned"
      )
      .sort(
        (a, b) =>
          new Date(String(b.created_at || 0)) - new Date(String(a.created_at || 0))
      );

    if (assignedCampaigns.length === 0) {
      return res.status(409).json({
        ok: false,
        error: `No assigned campaign exists yet for term ${term_id}. Start assigned campaign first.`,
      });
    }

    const latestCampaignId = String(assignedCampaigns[0].campaign_id || "").trim();

    // Collect all course_ids already tracked for this term's assigned campaigns
    const alreadyTrackedCourseIds = new Set();

    tracking.forEach((t) => {
      const sameTerm = String(t.term_id || "").trim() === term_id;
      const sameType = String(t.email_type || "").trim().toLowerCase() === "assigned";

      if (!sameTerm || !sameType) return;

      const ids = String(t.course_ids_requested || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      ids.forEach((id) => alreadyTrackedCourseIds.add(id));
    });

    // Only new courses
    const newCourses = termCourses.filter(
      (c) => !alreadyTrackedCourseIds.has(String(c.course_id || "").trim())
    );

    if (newCourses.length === 0) {
      return res.json({
        ok: true,
        message: `No new courses found for term ${term_id}.`,
        created: 0,
        sent: 0,
        skipped: 0,
        base_campaign_id: latestCampaignId,
      });
    }

    // Group new courses by instructor
    const instructorMap = new Map();

    for (const c of newCourses) {
      const instructor_id = String(c.instructor_id || "").trim();
      if (!instructor_id) continue;

      if (!instructorMap.has(instructor_id)) {
        instructorMap.set(instructor_id, []);
      }

      instructorMap.get(instructor_id).push({
        course_id: String(c.course_id || "").trim(),
        course_name: String(c.course_name || "").trim(),
        department: String(c.department || "").trim(),
      });
    }

    if (instructorMap.size === 0) {
      return res.json({
        ok: true,
        message: `New courses exist, but none have instructor_id assigned.`,
        created: 0,
        sent: 0,
        skipped: 0,
        base_campaign_id: latestCampaignId,
      });
    }

    const deltaCampaignId = `${term_id}_DELTA_${new Date().toISOString().slice(0, 10)}`;

    await appendRows(sheets, `${SHEETS.campaigns}!A:F`, [
      [deltaCampaignId, term_id, "assigned", new Date().toISOString(), "admin", `Delta update from ${latestCampaignId}`],
    ]);

    const now = new Date().toISOString();
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const trackingRows = [];
    let sent = 0;
    let skipped = 0;

    for (const [instructor_id, list] of instructorMap.entries()) {
      const inst = instructors.find(
        (i) => String(i.instructor_id || "").trim() === instructor_id
      );

      const to = String(inst?.email || inst?.Email || "").trim();

      if (!to) {
        skipped++;
        continue;
      }

      const token = makeToken();
      const courseIds = list.map((x) => x.course_id);

      trackingRows.push([
        deltaCampaignId,          // A campaign_id
        token,                    // B token
        "assigned",               // C email_type
        "delta",                  // D target_group
        instructor_id,            // E instructor_id
        term_id,                  // F term_id
        courseIds.join(","),      // G course_ids_requested
        "sent",                   // H sent_status
        "pending",                // I response_status
        now,                      // J sent_at
        "",                       // K responded_at
        expiry,                   // L token_expiry
      ]);

      try {
        await sendEmailMultipart({
          to,
          subject: `New Course Availability Needed (${term_id})`,
          text: buildTextEmail({
            term_id,
            campaign_id: deltaCampaignId,
            courses: list,
            token,
          }),
          html: buildHtmlEmail({
            term_id,
            campaign_id: deltaCampaignId,
            courses: list,
            token,
          }),
          ampHtml: buildAmpEmail({
            term_id,
            campaign_id: deltaCampaignId,
            email_type: "assigned",
            token,
            courses: list,
          }),
        });

        sent++;
      } catch (e) {
        console.error("Delta email failed:", to, e?.message || e);
      }
    }

    await appendRows(sheets, `${SHEETS.tracking}!A:L`, trackingRows);

    return res.json({
      ok: true,
      message: "Delta campaign created and emails sent for newly added courses.",
      created: trackingRows.length,
      sent,
      skipped,
      campaign_id: deltaCampaignId,
      base_campaign_id: latestCampaignId,
      new_courses_found: newCourses.length,
    });
  } catch (err) {
    console.error("updateCampaignDelta ERROR:", err);
    return res.status(err.status || 500).json({ error: err.message });
  }
});


app.post("/sendReminders", async (req, res) => {
  try {
    const body = req.body || {};
    requireField(body, "term_id");

    const term_id = String(body.term_id).trim();
    const sheets = await getSheetsClient();

    const instructors = await readSheetAsObjects(sheets, `${SHEETS.instructors}!A:Z`);
    const courses = await readSheetAsObjects(sheets, `${SHEETS.courses}!A:Z`);
    const courseRequests = await readSheetAsObjects(sheets, `${SHEETS.courseRequests}!A:Z`);
    const tracking = await readSheetAsObjects(sheets, `${SHEETS.tracking}!A:Z`);

    const pendingRows = tracking.filter((t) => {
      const sameTerm = String(t.term_id || "").trim() === term_id;
      const pending = String(t.response_status || "").trim().toLowerCase() === "pending";
      const hasToken = String(t.token || "").trim() !== "";
      return sameTerm && pending && hasToken;
    });

    if (pendingRows.length === 0) {
      return res.json({
        ok: true,
        message: `No pending instructors found for term ${term_id}.`,
        reminders_sent: 0,
        skipped: 0,
      });
    }

    let reminders_sent = 0;
    let skipped = 0;

    for (const row of pendingRows) {
      const token = String(row.token || "").trim();
      const campaign_id = String(row.campaign_id || "").trim();
      const email_type = String(row.email_type || "").trim().toLowerCase();
      const instructor_id = String(row.instructor_id || "").trim();
      const target_group = String(row.target_group || "").trim();

      const inst = instructors.find(
        (i) => String(i.instructor_id || "").trim() === instructor_id
      );

      const to = String(inst?.email || inst?.Email || "").trim();

      if (!to) {
        skipped++;
        continue;
      }

      const courseIds = String(row.course_ids_requested || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      let coursesForEmail = [];

      if (email_type === "assigned") {
        coursesForEmail = courses
          .filter(
            (c) =>
              String(c.term_id || "").trim() === term_id &&
              String(c.instructor_id || "").trim() === instructor_id &&
              courseIds.includes(String(c.course_id || "").trim())
          )
          .map((c) => ({
            course_id: String(c.course_id || "").trim(),
            course_name: String(c.course_name || "").trim(),
            department: String(c.department || "").trim(),
          }));
      } else if (email_type === "department") {
        coursesForEmail = courseRequests
          .filter(
            (r) =>
              String(r.term_id || "").trim() === term_id &&
              courseIds.includes(String(r.course_id || "").trim())
          )
          .map((r) => ({
            course_id: String(r.course_id || "").trim(),
            course_name: String(r.course_name || "").trim(),
            department: String(r.department || "").trim(),
          }));
      }

      if (coursesForEmail.length === 0) {
        skipped++;
        continue;
      }

      try {
        await sendEmailMultipart({
          to,
          subject: `Reminder: Availability Needed (${term_id})`,
          text: buildTextEmail({
            term_id,
            campaign_id,
            courses: coursesForEmail,
            token,
          }),
          html: buildHtmlEmail({
            term_id,
            campaign_id,
            courses: coursesForEmail,
            token,
          }),
          ampHtml: buildAmpEmail({
            term_id,
            campaign_id,
            email_type,
            token,
            courses: coursesForEmail,
          }),
        });

        const rowIndex = await findRowIndexByToken(sheets, token);
        if (rowIndex !== -1) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `${SHEETS.tracking}!H${rowIndex}:J${rowIndex}`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: [["reminder_sent", "pending", new Date().toISOString()]],
            },
          });
        }

        reminders_sent++;
      } catch (e) {
        console.error("sendReminders email failed:", to, e?.message || e);
      }
    }

    return res.json({
      ok: true,
      message: "Reminder emails processed.",
      reminders_sent,
      skipped,
    });
  } catch (err) {
    console.error("sendReminders ERROR:", err);
    return res.status(err.status || 500).json({ error: err.message });
  }
});

// START SERVER (Cloud Run requirement)
//const PORT = process.env.PORT || 8080;
//app.listen(PORT, () => {
//  console.log("Cloud Run server listening on port", PORT);
//});

const functions = require("firebase-functions");

exports.api = functions.https.onRequest(app);



