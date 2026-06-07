const API = window.location.origin;

const SIGNUP_STEPS = [
  { title: "Request", desc: "POST /auth/signup-with-email with email + password JSON body." },
  { title: "Validate", desc: "Zod signupSchema — valid email, password min 8 characters." },
  { title: "Duplicate check", desc: "prisma.user.findUnique — reject if email already registered." },
  { title: "Hash password", desc: "bcrypt.hash(password, 10) — never store plaintext." },
  { title: "Create user + session", desc: "Transaction: User row + Session row (IP, user-agent, 30d expiry)." },
  { title: "Issue JWTs", desc: "Access token (15m) + refresh token (7d) signed with separate secrets." },
  { title: "Store refresh hash", desc: "SHA-256(refreshToken) saved in Token table linked to sessionId." },
  { title: "Set cookie + respond", desc: "httpOnly refreshToken cookie + JSON { accessToken } in body." },
];

const SIGNIN_STEPS = [
  { title: "Request", desc: "POST /auth/signin-with-email with email + password." },
  { title: "Validate", desc: "Zod signinSchema — same rules as signup." },
  { title: "Find user", desc: "prisma.user.findUnique by email — 401 if not found." },
  { title: "Verify password", desc: "bcrypt.compare against stored hash — 401 on mismatch." },
  { title: "New session", desc: "Create Session row for this device (IP, user-agent)." },
  { title: "Issue JWTs", desc: "Fresh access + refresh tokens bound to new sessionId." },
  { title: "Store refresh hash", desc: "Hashed refresh token persisted on Token model." },
  { title: "Set cookie + respond", desc: "httpOnly cookie + { accessToken } JSON response." },
];

const REFRESH_STEPS = [
  { title: "Cookie sent", desc: "Browser sends httpOnly refreshToken cookie automatically." },
  { title: "Hash lookup", desc: "SHA-256(cookie value) matched in Token table via findFirst." },
  { title: "Token expiry", desc: "DB token.expiresAt must be in the future." },
  { title: "Session check", desc: "Linked Session row exists and session.expiresAt valid." },
  { title: "Verify JWT", desc: "jwt.verify with REFRESH_TOKEN_SECRET, type must be refresh." },
  { title: "New access token", desc: "Sign fresh 15m access JWT with userId + sessionId." },
  { title: "Rotate refresh", desc: "New refresh JWT, update hash in DB, Set-Cookie." },
  { title: "Respond", desc: "200 { accessToken } — client stores new access token." },
];

const LOGOUT_STEPS = [
  { title: "Cookie sent", desc: "POST /auth/logout — browser sends refreshToken cookie." },
  { title: "Hash lookup", desc: "SHA-256(cookie) used to find Token row in database." },
  { title: "Delete tokens", desc: "deleteMany on Token where sessionId matches." },
  { title: "Delete session", desc: "Session row removed — this device is signed out." },
  { title: "Clear cookie", desc: "Clear-Cookie: refreshToken with matching httpOnly flags." },
  { title: "Respond", desc: "200 { message: \"Logged out successfully\" } — client drops access token from memory." },
];

let consoleLog = [];
let hasRefreshCookie = false;

function $(sel) {
  return document.querySelector(sel);
}

function $$(sel) {
  return document.querySelectorAll(sel);
}

function log(type, label, data) {
  const entry = { ts: new Date().toISOString(), type, label, data };
  consoleLog.unshift(entry);
  if (consoleLog.length > 40) consoleLog.pop();
  renderConsole();
}

function renderConsole() {
  const el = $("#console-output");
  if (!el) return;
  if (!consoleLog.length) {
    el.textContent = "// Awaiting API activity…";
    return;
  }
  el.textContent = consoleLog
    .map((e) => {
      const payload =
        typeof e.data === "string" ? e.data : JSON.stringify(e.data, null, 2);
      return `[${e.ts}] ${e.type.toUpperCase()} · ${e.label}\n${payload}`;
    })
    .join("\n\n—\n\n");
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function decodeJwt(token) {
  try {
    const [header, payload, sig] = token.split(".");
    const decode = (part) =>
      JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return {
      header: decode(header),
      payload: decode(payload),
      signature: sig.slice(0, 24) + "…",
    };
  } catch {
    return null;
  }
}

function renderJwtPreview(token, containerId) {
  const el = document.getElementById(containerId);
  if (!el || !token) {
    if (el) el.innerHTML = '<span class="muted">No token yet</span>';
    return;
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    el.textContent = token;
    return;
  }
  el.innerHTML = `<span class="jwt-part header">${parts[0]}</span>.<span class="jwt-part payload">${parts[1]}</span>.<span class="jwt-part sig">${parts[2].slice(0, 32)}…</span>`;

  const decoded = decodeJwt(token);
  const meta = document.getElementById(containerId + "-meta");
  if (meta && decoded) {
    meta.innerHTML = `
      <dl>
        <dt>Header</dt><dd>${JSON.stringify(decoded.header)}</dd>
        <dt>Payload</dt><dd>${JSON.stringify(decoded.payload, null, 2)}</dd>
        <dt>Expires</dt><dd>${decoded.payload.exp ? new Date(decoded.payload.exp * 1000).toLocaleString() : "—"}</dd>
      </dl>`;
  }
}

function buildTimeline(containerId, steps) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = steps
    .map(
      (s, i) => `
    <div class="timeline-step" data-step="${i}">
      <div class="step-num">${String(i + 1).padStart(2, "0")}</div>
      <div>
        <p class="step-title">${s.title}</p>
        <p class="step-desc">${s.desc}</p>
      </div>
    </div>`
    )
    .join("");
}

function setStep(prefix, index) {
  document.querySelectorAll(`#${prefix}-timeline .timeline-step`).forEach((el, i) => {
    el.classList.remove("active", "done");
    if (i < index) el.classList.add("done");
    if (i === index) el.classList.add("active");
  });
}

function resetTimeline(prefix) {
  document.querySelectorAll(`#${prefix}-timeline .timeline-step`).forEach((el) => {
    el.classList.remove("active", "done");
  });
}

async function animateSteps(prefix, steps) {
  for (let i = 0; i < steps.length; i++) {
    setStep(prefix, i);
    await sleep(380);
  }
  document.querySelector(`#${prefix}-timeline .timeline-step:last-child`)?.classList.add("done");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function markCookieSet() {
  hasRefreshCookie = true;
  const status = $("#cookie-status");
  if (status) {
    status.textContent = "refreshToken set (httpOnly — not readable from JS)";
    status.style.color = "var(--success)";
  }
  for (const id of ["refresh-cookie-hint", "logout-cookie-hint"]) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = "Cookie status: set from last sign up / sign in";
      el.style.color = "var(--success)";
    }
  }
  checkSession();
}

function markCookieCleared() {
  hasRefreshCookie = false;
  const status = $("#cookie-status");
  if (status) {
    status.textContent = "Cleared — logged out";
    status.style.color = "var(--muted)";
  }
  $("#last-access-token").textContent = "—";
  for (const id of ["refresh-cookie-hint", "logout-cookie-hint"]) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = "Cookie cleared — sign in again to get a new session";
      el.style.color = "var(--muted)";
    }
  }
  checkSession();
}

function onAuthSuccess(accessToken) {
  renderJwtPreview(accessToken, "signup-jwt");
  $("#last-access-token").textContent = accessToken.slice(0, 48) + "…";
  markCookieSet();
  loadDatabase();
}

function renderResult(el, status, body) {
  const badgeClass =
    status >= 500 ? "badge-5xx" : status >= 400 ? "badge-4xx" : "badge-2xx";
  el.innerHTML = `
    <p><span class="badge ${badgeClass}">${status}</span></p>
    <pre class="console-body" style="max-height:120px;margin-top:12px">${JSON.stringify(body, null, 2)}</pre>`;
}

async function runSignup(dryRun = false) {
  const email = $("#signup-email").value.trim();
  const password = $("#signup-password").value;
  const btn = $("#signup-run");
  const resultEl = $("#signup-result");

  resetTimeline("signup");
  btn.disabled = true;
  resultEl.innerHTML = "";

  if (dryRun) {
    await animateSteps("signup", SIGNUP_STEPS);
    btn.disabled = false;
    return;
  }

  setStep("signup", 0);
  log("request", "POST /auth/signup-with-email", { email, password: "••••••••" });

  try {
    setStep("signup", 1);
    const res = await fetch(`${API}/auth/signup-with-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    for (let i = 2; i < 7; i++) setStep("signup", i);
    await sleep(600);

    const body = await res.json().catch(() => ({}));
    log("response", `HTTP ${res.status}`, body);
    setStep("signup", 7);
    renderResult(resultEl, res.status, body);

    if (res.ok && body.accessToken) {
      renderJwtPreview(body.accessToken, "signup-jwt");
      onAuthSuccess(body.accessToken);
    }
  } catch (err) {
    log("error", "Network", String(err));
    resultEl.innerHTML = `<p class="badge badge-5xx">Network error</p><p>${err.message}</p>`;
  }

  btn.disabled = false;
}

async function runSignin(dryRun = false) {
  const email = $("#signin-email").value.trim();
  const password = $("#signin-password").value;
  const btn = $("#signin-run");
  const resultEl = $("#signin-result");

  resetTimeline("signin");
  btn.disabled = true;
  resultEl.innerHTML = "";

  if (dryRun) {
    await animateSteps("signin", SIGNIN_STEPS);
    btn.disabled = false;
    return;
  }

  setStep("signin", 0);
  log("request", "POST /auth/signin-with-email", { email, password: "••••••••" });

  try {
    const res = await fetch(`${API}/auth/signin-with-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    for (let i = 2; i < 7; i++) setStep("signin", i);
    await sleep(600);

    const body = await res.json().catch(() => ({}));
    log("response", `HTTP ${res.status}`, body);
    setStep("signin", 7);
    renderResult(resultEl, res.status, body);

    if (res.ok && body.accessToken) {
      renderJwtPreview(body.accessToken, "signin-jwt");
      onAuthSuccess(body.accessToken);
    }
  } catch (err) {
    log("error", "Network", String(err));
    resultEl.innerHTML = `<p class="badge badge-5xx">Network error</p><p>${err.message}</p>`;
  }

  btn.disabled = false;
}

async function runRefresh(dryRun = false) {
  const btn = $("#refresh-run");
  const resultEl = $("#refresh-result");

  resetTimeline("refresh");
  btn.disabled = true;
  resultEl.innerHTML = "";

  if (dryRun) {
    await animateSteps("refresh", REFRESH_STEPS);
    btn.disabled = false;
    return;
  }

  setStep("refresh", 0);
  log("request", "POST /auth/refresh-token", "(httpOnly cookie sent automatically)");

  try {
    const res = await fetch(`${API}/auth/refresh-token`, {
      method: "POST",
      credentials: "include",
    });

    for (let i = 1; i < 7; i++) setStep("refresh", i);
    await sleep(500);

    const body = await res.json().catch(() => ({}));
    log("response", `HTTP ${res.status}`, body);
    setStep("refresh", 7);
    renderResult(resultEl, res.status, body);

    if (res.ok && body.accessToken) {
      renderJwtPreview(body.accessToken, "refresh-jwt");
      $("#last-access-token").textContent = body.accessToken.slice(0, 48) + "…";
      markCookieSet();
      loadDatabase();
    } else if (res.status === 401) {
      const hint = $("#refresh-cookie-hint");
      if (hint) {
        hint.textContent = "Cookie missing or invalid — sign up or sign in first";
        hint.style.color = "var(--m-red)";
      }
    }
  } catch (err) {
    log("error", "Network", String(err));
    resultEl.innerHTML = `<p class="badge badge-5xx">Network error</p><p>${err.message}</p>`;
  }

  btn.disabled = false;
}

async function runLogout(dryRun = false, resultTarget = "#logout-result") {
  const btn = $("#logout-run");
  const quickBtn = $("#logout-quick");
  const resultEl = $(resultTarget);

  resetTimeline("logout");
  if (btn) btn.disabled = true;
  if (quickBtn) quickBtn.disabled = true;
  if (resultEl) resultEl.innerHTML = "";

  if (dryRun) {
    await animateSteps("logout", LOGOUT_STEPS);
    if (btn) btn.disabled = false;
    if (quickBtn) quickBtn.disabled = false;
    return;
  }

  setStep("logout", 0);
  log("request", "POST /auth/logout", "(httpOnly cookie sent automatically)");

  try {
    const res = await fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    for (let i = 1; i < LOGOUT_STEPS.length - 1; i++) setStep("logout", i);
    await sleep(400);

    const body = await res.json().catch(() => ({}));
    log("response", `HTTP ${res.status}`, body);
    setStep("logout", LOGOUT_STEPS.length - 1);
    if (resultEl) renderResult(resultEl, res.status, body);

    if (res.ok) {
      markCookieCleared();
      loadDatabase();
    }
  } catch (err) {
    log("error", "Network", String(err));
    if (resultEl) {
      resultEl.innerHTML = `<p class="badge badge-5xx">Network error</p><p>${err.message}</p>`;
    }
  }

  if (btn) btn.disabled = false;
  if (quickBtn) quickBtn.disabled = false;
}

function renderDbTable(title, columns, rows, emptyMsg) {
  if (!rows.length) {
    return `
      <section class="db-section">
        <div class="db-section-head"><h2>${title}</h2><span class="db-count">0 rows</span></div>
        <div class="db-table-wrap"><p class="db-empty">${emptyMsg}</p></div>
      </section>`;
  }

  const thead = columns.map((c) => `<th>${c.label}</th>`).join("");
  const tbody = rows
    .map((row) => {
      const cls = row._expired ? ' class="row-expired"' : "";
      const cells = columns.map((c) => `<td>${c.render(row)}</td>`).join("");
      return `<tr${cls}>${cells}</tr>`;
    })
    .join("");

  return `
    <section class="db-section">
      <div class="db-section-head">
        <h2>${title}</h2>
        <span class="db-count">${rows.length} row${rows.length === 1 ? "" : "s"}</span>
      </div>
      <div class="db-table-wrap">
        <table class="db-table">
          <thead><tr>${thead}</tr></thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>
    </section>`;
}

async function loadDatabase() {
  const container = $("#db-content");
  const countsEl = $("#db-counts");
  if (!container) return;

  container.innerHTML = '<p class="db-loading">Loading database…</p>';

  try {
    const res = await fetch(`${API}/auth/demo/db`, { credentials: "include" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      container.innerHTML = `<p class="db-error">Failed to load: ${data.error ?? res.status}</p>`;
      return;
    }

    log("response", "GET /auth/demo/db", { counts: data.counts });

    if (countsEl) {
      countsEl.innerHTML = `
        <span class="db-count">Users: ${data.counts.users}</span>
        <span class="db-count">Sessions: ${data.counts.sessions}</span>
        <span class="db-count">Tokens: ${data.counts.tokens}</span>`;
    }

    const users = data.users.map((u) => ({ ...u, _expired: false }));
    const sessions = data.sessions.map((s) => ({ ...s, _expired: s.expired }));
    const tokens = data.tokens.map((t) => ({ ...t, _expired: t.expired }));

    container.innerHTML =
      renderDbTable(
        "User",
        [
          { label: "Email", render: (r) => r.email },
          { label: "ID", render: (r) => r.id.slice(0, 8) + "…" },
          { label: "Password", render: (r) => r.password },
          { label: "Created", render: (r) => fmtDate(r.createdAt) },
        ],
        users,
        "No users yet — run Sign Up"
      ) +
      renderDbTable(
        "Session",
        [
          { label: "User", render: (r) => r.userEmail },
          { label: "ID", render: (r) => r.id.slice(0, 8) + "…" },
          { label: "IP", render: (r) => r.ipAddress || "—" },
          { label: "Tokens", render: (r) => String(r.tokenCount) },
          { label: "Expires", render: (r) => fmtDate(r.expiresAt) },
          {
            label: "Status",
            render: (r) =>
              r.expired
                ? '<span class="status-tag expired">Expired</span>'
                : '<span class="status-tag active">Active</span>',
          },
        ],
        sessions,
        "No sessions yet — sign up or sign in"
      ) +
      renderDbTable(
        "Token",
        [
          { label: "User", render: (r) => r.userEmail },
          { label: "Session", render: (r) => r.sessionId.slice(0, 8) + "…" },
          { label: "Hash", render: (r) => r.token },
          { label: "Expires", render: (r) => fmtDate(r.expiresAt) },
          {
            label: "Status",
            render: (r) =>
              r.expired
                ? '<span class="status-tag expired">Expired</span>'
                : '<span class="status-tag active">Active</span>',
          },
        ],
        tokens,
        "No refresh tokens stored yet"
      );
  } catch (err) {
    container.innerHTML = `<p class="db-error">Network error: ${err.message}</p>`;
  }
}

async function checkSession() {
  const pill = $("#auth-status");
  if (!pill) return;

  const label = pill.querySelector(".auth-label");
  pill.classList.remove("logged-in", "logged-out");

  try {
    const res = await fetch(`${API}/auth/session`, { credentials: "include" });
    const data = await res.json().catch(() => ({ loggedIn: false }));

    if (data.loggedIn) {
      hasRefreshCookie = true;
      pill.classList.add("logged-in");
      label.textContent = data.email
        ? `Signed in · ${data.email}`
        : "Signed in";
    } else {
      hasRefreshCookie = false;
      pill.classList.add("logged-out");
      label.textContent = "Not signed in";
    }
  } catch {
    label.textContent = "Session unknown";
  }
}

async function checkHealth() {
  const pill = $("#server-status");
  try {
    const res = await fetch(`${API}/health`);
    if (res.ok) {
      pill.classList.add("online");
      pill.querySelector(".status-label").textContent = "Server online";
    } else {
      pill.querySelector(".status-label").textContent = `Server ${res.status}`;
    }
  } catch {
    pill.querySelector(".status-label").textContent = "Server offline";
  }
}

function initTabs() {
  $$("header .nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$("header .nav-tab").forEach((t) => t.classList.remove("active"));
      $$(".panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.panel).classList.add("active");
      if (tab.dataset.panel === "panel-database") loadDatabase();
    });
  });
}

function init() {
  buildTimeline("signup-timeline", SIGNUP_STEPS);
  buildTimeline("signin-timeline", SIGNIN_STEPS);
  buildTimeline("refresh-timeline", REFRESH_STEPS);
  buildTimeline("logout-timeline", LOGOUT_STEPS);

  $("#signup-run")?.addEventListener("click", () => runSignup(false));
  $("#signup-walk")?.addEventListener("click", () => runSignup(true));
  $("#signin-run")?.addEventListener("click", () => runSignin(false));
  $("#signin-walk")?.addEventListener("click", () => runSignin(true));
  $("#refresh-run")?.addEventListener("click", () => runRefresh(false));
  $("#refresh-walk")?.addEventListener("click", () => runRefresh(true));
  $("#logout-run")?.addEventListener("click", () => runLogout(false));
  $("#logout-walk")?.addEventListener("click", () => runLogout(true));
  $("#logout-quick")?.addEventListener("click", () =>
    runLogout(false, "#logout-quick-result")
  );
  $("#db-refresh")?.addEventListener("click", loadDatabase);
  $("#console-clear")?.addEventListener("click", () => {
    consoleLog = [];
    renderConsole();
  });

  initTabs();
  checkHealth();
  checkSession();
  loadDatabase();
  renderConsole();
}

document.addEventListener("DOMContentLoaded", init);
