// Deployed Cloud Function URLs
const API_BASE = "https://api-s423t4cfia-uc.a.run.app";

const ENDPOINTS = {
  addCourse: `${API_BASE}/addCourse`,
  startAssigned: `${API_BASE}/startAssignedCampaign`,
  startBroadcast: `${API_BASE}/startDepartmentBroadcast`,
  updateDelta: `${API_BASE}/updateCampaignDelta`,
  reminders: `${API_BASE}/sendReminders`,
};

// dashboard link
const DASHBOARD_URL = "#";

function setStatus(id, msg) {
  document.getElementById(id).innerText = msg;
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function addCourse() {
  try {
    setStatus("addCourseStatus", "Status: adding course...");
    const payload = {
      term_id: document.getElementById("termId").value.trim(),
      department: document.getElementById("department").value.trim(),
      course_id: document.getElementById("courseId").value.trim(),
      course_name: document.getElementById("courseName").value.trim(),
      instructor_id: document.getElementById("instructorId").value.trim(), // optional
      target_mode: document.getElementById("targetMode").value,
    };
    const out = await postJSON(ENDPOINTS.addCourse, payload);
    setStatus("addCourseStatus", `✅ Added. ${out.message || ""}`);
  } catch (e) {
    setStatus("addCourseStatus", `❌ Error: ${e.message}`);
  }
}

async function startAssignedCampaign() {
  try {
    setStatus("campaignStatus", "Status: starting assigned campaign...");
    const payload = { term_id: document.getElementById("campaignTerm").value.trim() };
    const out = await postJSON(ENDPOINTS.startAssigned, payload);
    setStatus("campaignStatus", `✅ Assigned campaign started. ${out.message || ""}`);
  } catch (e) {
    setStatus("campaignStatus", `❌ Error: ${e.message}`);
  }
}

async function startDepartmentBroadcast() {
  const term = document.getElementById("campaignTerm").value.trim();
  const isDepartmentMode = document.getElementById("departmentBroadcastCheck").checked;
  const department = document.getElementById("campaignDepartment").value.trim();

  if (!term) {
    document.getElementById("campaignStatus").innerHTML =
      "❌ Please enter a Term ID first.";
    return;
  }

  if (!isDepartmentMode) {
    document.getElementById("campaignStatus").innerHTML =
      "❌ Please check Department Broadcast first.";
    return;
  }

  if (!department) {
    document.getElementById("campaignStatus").innerHTML =
      "❌ Please select a department.";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/startDepartmentBroadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        term_id: term,
        department: department
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      document.getElementById("campaignStatus").innerHTML =
        `❌ Error: ${data.error || "Request failed"}`;
      return;
    }

    document.getElementById("campaignStatus").innerHTML =
      `✅ ${data.message} Emails sent: ${data.sent || 0}, skipped: ${data.skipped || 0}`;
  } catch (e) {
    document.getElementById("campaignStatus").innerHTML =
      `❌ Error: ${e.message || "Request failed"}`;
  }
}
async function updateDelta() {
  try {
    setStatus("campaignStatus", "Status: running delta update...");
    const payload = { term_id: document.getElementById("campaignTerm").value.trim() };
    const out = await postJSON(ENDPOINTS.updateDelta, payload);
    setStatus("campaignStatus", `✅ Delta update done. ${out.message || ""}`);
  } catch (e) {
    setStatus("campaignStatus", `❌ Error: ${e.message}`);
  }
}

async function sendReminders() {
  try {
    setStatus("campaignStatus", "Status: sending reminders...");
    const payload = { term_id: document.getElementById("campaignTerm").value.trim() };
    const out = await postJSON(ENDPOINTS.reminders, payload);
    setStatus("campaignStatus", `✅ Reminders sent. ${out.message || ""}`);
  } catch (e) {
    setStatus("campaignStatus", `❌ Error: ${e.message}`);
  }
}

function openDashboard() {
  window.open(DASHBOARD_URL, "_blank");
  setStatus("dashboardStatus", "Dashboard: opened ✅");
}


// Apps Script web app URL
const INSTRUCTOR_LIST_URL = "https://script.google.com/macros/s/AKfycbw3IcLNtfsFqdmplBxyA8ur9uck3MzGU8yRW80f_5X9c0VWzPyCK_eyGriRhoQrhny6LA/exec";

async function loadInstructorDropdown() {
  try {
    const res = await fetch(INSTRUCTOR_LIST_URL);
    const text = await res.text();

    console.log("Raw response:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Response is not valid JSON");
    }

    const select = document.getElementById("instructorId");
    if (!select) return;

    select.innerHTML = `<option value="">Select instructor</option>`;

    data.forEach((id) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = id;
      select.appendChild(option);
    });
  } catch (e) {
    console.error("Failed to load instructor dropdown:", e);

    const status = document.getElementById("addCourseStatus");
    if (status) {
      status.innerHTML = "❌ Could not load instructor list.";
    }
  }
}

window.addEventListener("DOMContentLoaded", loadInstructorDropdown);



async function updateDelta() {
  const term = document.getElementById("campaignTerm").value.trim();

  if (!term) {
    document.getElementById("campaignStatus").innerHTML =
      "❌ Please enter a Term ID first.";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/updateCampaignDelta`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ term_id: term })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      document.getElementById("campaignStatus").innerHTML =
        `❌ Error: ${data.error || "Request failed"}`;
      return;
    }

    document.getElementById("campaignStatus").innerHTML =
      `✅ ${data.message} Emails sent: ${data.sent || 0}, skipped: ${data.skipped || 0}`;
  } catch (e) {
    document.getElementById("campaignStatus").innerHTML =
      `❌ Error: ${e.message || "Request failed"}`;
  }
}


async function sendReminders() {
  const term = document.getElementById("campaignTerm").value.trim();

  if (!term) {
    document.getElementById("campaignStatus").innerHTML =
      "❌ Please enter a Term ID first.";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/sendReminders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ term_id: term })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      document.getElementById("campaignStatus").innerHTML =
        `❌ Error: ${data.error || "Request failed"}`;
      return;
    }

    document.getElementById("campaignStatus").innerHTML =
      `✅ ${data.message} Reminder emails sent: ${data.reminders_sent || 0}, skipped: ${data.skipped || 0}`;
  } catch (e) {
    document.getElementById("campaignStatus").innerHTML =
      `❌ Error: ${e.message || "Request failed"}`;
  }
}


const DEPARTMENT_LIST_URL = "https://script.google.com/macros/s/AKfycbyOiWqgaq6HAe5N-anAXhASzOQKNVVBFdje8AdBIPATauWK4m_tQfcgxmrNycCUvxQA4w/exec";

function toggleDepartmentDropdown() {
  const checkbox = document.getElementById("departmentBroadcastCheck");
  const dropdown = document.getElementById("campaignDepartment");

  if (!checkbox || !dropdown) return;

  if (checkbox.checked) {
    dropdown.disabled = false;
  } else {
    dropdown.value = "";
    dropdown.disabled = true;
  }
}

async function loadDepartmentDropdown() {
  try {
    const res = await fetch(DEPARTMENT_LIST_URL);
    const data = await res.json();

    const dropdown = document.getElementById("campaignDepartment");
    if (!dropdown) return;

    dropdown.innerHTML = `<option value="">Select department</option>`;

    data.forEach((dept) => {
      const option = document.createElement("option");
      option.value = dept;
      option.textContent = dept;
      dropdown.appendChild(option);
    });
  } catch (e) {
    console.error("Failed to load departments:", e);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  toggleDepartmentDropdown();
  loadDepartmentDropdown();
});