const { url, anonKey } = window.SUPABASE_CONFIG;
const REST_URL = `${url}/rest/v1`;
const STORAGE_URL = `${url}/storage/v1`;
const PASSPORTS_BUCKET = "passports";
// Mirrors the bucket's allowed_mime_types (see the restrict_passports_mime_types
// migration) so a rejected file is caught client-side with a clear message
// instead of surfacing a raw Storage API error after a full upload attempt.
const ALLOWED_PASSPORT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Every request needs both headers: `apikey` identifies the calling
// project/role to PostgREST, `Authorization` is what Postgres RLS policies
// evaluate against. For this anon-only demo they're the same value.
const REST_HEADERS = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
};

async function restGet(path) {
  const res = await fetch(`${REST_URL}/${path}`, { headers: REST_HEADERS });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function restInsert(table, row) {
  const res = await fetch(`${REST_URL}/${table}`, {
    method: "POST",
    headers: {
      ...REST_HEADERS,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  const body = await res.json();
  if (!res.ok) {
    // PostgREST surfaces Postgres/RLS errors as { message, code, hint } — pass
    // the message straight through so denied writes are self-explanatory.
    throw new Error(body.message || `INSERT into ${table} failed: ${res.status}`);
  }
  return body;
}

// Keeps storage object keys predictable and URL-safe: strip everything but
// alphanumerics/dot/dash/underscore, fall back to a generic name if that
// empties the string out (e.g. a filename that was all emoji/unicode).
function sanitizeFileName(name) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "passport";
}

async function storageUpload(path, file) {
  const res = await fetch(`${STORAGE_URL}/object/${PASSPORTS_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      ...REST_HEADERS,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Upload failed: ${res.status}`);
  }
}

// Storage's "list" endpoint returns entries whose `name` is just the leaf
// file name relative to the given prefix, not the full object key.
async function storageListLatest(prefix) {
  const res = await fetch(`${STORAGE_URL}/object/list/${PASSPORTS_BUCKET}`, {
    method: "POST",
    headers: { ...REST_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({
      prefix,
      limit: 1,
      sortBy: { column: "created_at", order: "desc" },
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `List failed: ${res.status}`);
  }
  const entries = await res.json();
  return entries[0] ? `${prefix}${entries[0].name}` : null;
}

// The bucket is private, so previews need a time-limited signed URL rather
// than a public one — creating it still goes through the same RLS "select"
// policy as any other read.
async function storageSignedUrl(path, expiresInSeconds = 3600) {
  const res = await fetch(`${STORAGE_URL}/object/sign/${PASSPORTS_BUCKET}/${path}`, {
    method: "POST",
    headers: { ...REST_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Sign failed: ${res.status}`);
  }
  const { signedURL } = await res.json();
  return `${STORAGE_URL}${signedURL}`;
}

function formatDepartAt(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function fillTable(tbodyId, rows, rowToCells) {
  const tbody = document.querySelector(`#${tbodyId} tbody`);
  tbody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const cell of rowToCells(row)) {
      const td = document.createElement("td");
      td.textContent = cell;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

function fillSelect(selectId, rows, valueKey, labelFn) {
  const select = document.getElementById(selectId);
  select.innerHTML = "";
  for (const row of rows) {
    const option = document.createElement("option");
    option.value = row[valueKey];
    option.textContent = labelFn(row);
    select.appendChild(option);
  }
}

// Customers get a richer row than plain text cells (thumbnail + upload
// control), so they're built by hand rather than through fillTable().
function renderCustomersTable(rows) {
  const tbody = document.querySelector("#customers-table tbody");
  tbody.innerHTML = "";
  for (const customer of rows) {
    const tr = document.createElement("tr");

    for (const value of [customer.id, customer.name, customer.email]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    }

    const passportTd = document.createElement("td");
    passportTd.className = "passport-cell";

    const thumb = document.createElement("img");
    thumb.className = "passport-thumb";
    thumb.hidden = true;
    thumb.alt = `Passport for ${customer.name}`;

    const msg = document.createElement("span");
    msg.className = "passport-msg";
    msg.textContent = "Checking…";

    const label = document.createElement("label");
    label.className = "upload-btn";
    label.textContent = "Upload";
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ALLOWED_PASSPORT_MIME_TYPES.join(",");
    input.addEventListener("change", () => {
      const file = input.files[0];
      input.value = "";
      if (file) handlePassportUpload(customer.id, file, { thumb, msg });
    });
    label.appendChild(input);

    passportTd.append(thumb, msg, label);
    tr.appendChild(passportTd);
    tbody.appendChild(tr);

    refreshPassportPreview(customer.id, { thumb, msg });
  }
}

// Best-effort load of whatever passport is already on file for a customer —
// runs independently per row so one failure doesn't affect the rest of the
// table. Not awaited by the caller.
async function refreshPassportPreview(customerId, { thumb, msg }) {
  try {
    const path = await storageListLatest(`${customerId}/`);
    if (!path) {
      thumb.hidden = true;
      msg.className = "passport-msg";
      msg.textContent = "No passport";
      return;
    }
    const signedUrl = await storageSignedUrl(path);
    thumb.src = signedUrl;
    thumb.hidden = false;
    msg.className = "passport-msg";
    msg.textContent = "";
  } catch (err) {
    thumb.hidden = true;
    msg.className = "passport-msg error";
    msg.textContent = "Couldn't load preview";
    console.error(`Passport preview failed for customer ${customerId}:`, err);
  }
}

async function handlePassportUpload(customerId, file, { thumb, msg }) {
  if (!ALLOWED_PASSPORT_MIME_TYPES.includes(file.type)) {
    msg.className = "passport-msg error";
    msg.textContent = "Please choose a JPEG, PNG, or WebP image.";
    return;
  }

  msg.className = "passport-msg";
  msg.textContent = "Uploading…";

  // Every upload gets a fresh key (timestamp + sanitized name) rather than
  // overwriting in place — that only needs an insert policy, not update, and
  // matches this app's no-update/no-delete privilege model throughout.
  const path = `${customerId}/${Date.now()}-${sanitizeFileName(file.name)}`;

  try {
    await storageUpload(path, file);
    const signedUrl = await storageSignedUrl(path);
    thumb.src = signedUrl;
    thumb.hidden = false;
    msg.className = "passport-msg success";
    msg.textContent = "Uploaded";
  } catch (err) {
    msg.className = "passport-msg error";
    msg.textContent = err.message;
  }
}

// Drives the loading / empty / error / loaded states for one panel: the
// <p id="{name}-status"> text+class, and whether <table id="{name}-table">
// is shown at all. Kept in one place so every panel behaves consistently.
function setPanelState(name, state, message) {
  const status = document.getElementById(`${name}-status`);
  const table = document.getElementById(`${name}-table`);
  status.className = "panel-status";
  switch (state) {
    case "loading":
      status.textContent = message ?? "Loading…";
      table.hidden = true;
      break;
    case "empty":
      status.textContent = message ?? "Nothing here yet.";
      status.classList.add("empty");
      table.hidden = true;
      break;
    case "error":
      status.textContent = message ?? "Something went wrong.";
      status.classList.add("error");
      table.hidden = true;
      break;
    case "loaded":
      status.textContent = "";
      table.hidden = false;
      break;
  }
}

let customers = [];
let flights = [];

async function loadCustomers() {
  setPanelState("customers", "loading");
  try {
    customers = await restGet("customers?select=id,name,email&order=id");
    if (customers.length === 0) {
      setPanelState("customers", "empty", "No customers yet.");
      return;
    }
    renderCustomersTable(customers);
    fillSelect("customer-select", customers, "id", (c) => c.name);
    setPanelState("customers", "loaded");
  } catch (err) {
    setPanelState("customers", "error", `Failed to load customers: ${err.message}`);
    throw err;
  }
}

async function loadFlights() {
  setPanelState("flights", "loading");
  try {
    flights = await restGet("flights?select=id,destination,depart_at&order=depart_at");
    if (flights.length === 0) {
      setPanelState("flights", "empty", "No flights yet.");
      return;
    }
    fillTable("flights-table", flights, (f) => [f.id, f.destination, formatDepartAt(f.depart_at)]);
    fillSelect("flight-select", flights, "id", (f) => `${f.destination} — ${formatDepartAt(f.depart_at)}`);
    setPanelState("flights", "loaded");
  } catch (err) {
    setPanelState("flights", "error", `Failed to load flights: ${err.message}`);
    throw err;
  }
}

async function loadBookings() {
  setPanelState("bookings", "loading");
  try {
    // PostgREST resource embedding follows the customer_id / flight_id
    // foreign keys server-side, so this one request returns joined names
    // instead of three round trips + manual joins in JS.
    const bookings = await restGet(
      "bookings?select=id,customers(name),flights(destination,depart_at)&order=id"
    );
    if (bookings.length === 0) {
      setPanelState("bookings", "empty", "No bookings yet.");
      return;
    }
    fillTable("bookings-table", bookings, (b) => [
      b.id,
      b.customers?.name ?? "—",
      b.flights?.destination ?? "—",
      b.flights ? formatDepartAt(b.flights.depart_at) : "—",
    ]);
    setPanelState("bookings", "loaded");
  } catch (err) {
    setPanelState("bookings", "error", `Failed to load bookings: ${err.message}`);
    throw err;
  }
}

// Enables the booking form only once both dropdowns have real options to
// offer — otherwise a submit would insert a booking against nothing.
function updateBookingFormAvailability() {
  const submitButton = document.getElementById("booking-submit");
  const status = document.getElementById("booking-status");
  if (customers.length === 0 || flights.length === 0) {
    submitButton.disabled = true;
    status.className = "empty";
    status.textContent = "Add at least one customer and one flight before creating a booking.";
  } else {
    submitButton.disabled = false;
    status.className = "";
    status.textContent = "";
  }
}

async function handleBookingSubmit(event) {
  event.preventDefault();
  const status = document.getElementById("booking-status");
  const submitButton = document.getElementById("booking-submit");
  const customerId = document.getElementById("customer-select").value;
  const flightId = document.getElementById("flight-select").value;

  status.textContent = "Booking…";
  status.className = "";
  submitButton.disabled = true;

  try {
    await restInsert("bookings", {
      customer_id: Number(customerId),
      flight_id: Number(flightId),
    });
    status.textContent = "Booking created.";
    status.className = "success";
    await loadBookings();
  } catch (err) {
    status.textContent = err.message;
    status.className = "error";
  } finally {
    submitButton.disabled = false;
  }
}

async function init() {
  document.getElementById("booking-form").addEventListener("submit", handleBookingSubmit);

  const results = await Promise.allSettled([loadCustomers(), loadFlights()]);
  updateBookingFormAvailability();
  await loadBookings();

  const failed = results.find((r) => r.status === "rejected");
  if (failed) {
    // Individual panels already show their own error state; re-throw so
    // this is also visible in the console during development.
    console.error("Initial load had failures:", failed.reason);
  }
}

init();
