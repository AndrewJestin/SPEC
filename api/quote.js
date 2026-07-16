const EMAIL_TO = "info@spec-exterior.com";

const SERVICE_LABELS = {
  house_soft_wash: "House Washing (Soft Wash)",
  roof_soft_wash: "Roof Cleaning (Soft Wash)",
  driveway_cleaning: "Driveway Cleaning",
  sidewalk_cleaning: "Sidewalk Cleaning",
  patio_cleaning: "Patio Cleaning",
  retaining_wall_cleaning: "Retaining Wall Cleaning",
  pool_deck_cleaning: "Pool Deck Cleaning",
  porch_cleaning: "Porch Cleaning",
  deck_cleaning: "Deck Cleaning",
  fence_cleaning: "Fence Cleaning",
  gutter_cleaning: "Gutter Cleaning",
  gutter_brightening: "Gutter Brightening",
  window_cleaning: "Window Cleaning",
  spider_web_removal: "Spider Web Removal",
  oxidation_removal: "Oxidation Removal",
  rust_stain_removal: "Rust Stain Removal",
  red_clay_stain_removal: "Red Clay Stain Removal",
  oil_stain_treatment: "Oil Stain Treatment",
};

function sendJson(response, statusCode, body) {
  response.status(statusCode).json(body);
}

function clean(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    return { success: false, reason: "missing-secret" };
  }

  const params = new URLSearchParams();
  params.append("secret", secret);
  params.append("response", token);

  if (ip) {
    params.append("remoteip", ip);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: params,
  });

  return response.json();
}

function buildEmailHtml(payload) {
  const service = SERVICE_LABELS[payload.service] || payload.service || "Not selected";

  return `
    <h1>New SPEC quote request</h1>
    <p><strong>Name:</strong> ${escapeHtml(payload.name)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(payload.phone)}</p>
    <p><strong>Address:</strong> ${escapeHtml(payload.address)}</p>
    <p><strong>Service:</strong> ${escapeHtml(service)}</p>
    <p><strong>Size:</strong> ${escapeHtml(payload.size || "Not sure")}</p>
    <p><strong>Stories:</strong> ${escapeHtml(payload.stories || "Not sure")}</p>
    <p><strong>Details:</strong></p>
    <p>${escapeHtml(payload.details || "No details provided.")}</p>
  `;
}

function buildEmailText(payload) {
  const service = SERVICE_LABELS[payload.service] || payload.service || "Not selected";

  return [
    "New SPEC quote request",
    "",
    `Name: ${payload.name}`,
    `Phone: ${payload.phone}`,
    `Address: ${payload.address}`,
    `Service: ${service}`,
    `Size: ${payload.size || "Not sure"}`,
    `Stories: ${payload.stories || "Not sure"}`,
    "",
    "Details:",
    payload.details || "No details provided.",
  ].join("\n");
}

async function sendEmail(payload) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = "SPEC Website <quote@spec-exterior.com>";

  if (!apiKey) {
    return { ok: false, reason: "missing-api-key" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: EMAIL_TO,
      reply_to: EMAIL_TO,
      subject: `New quote request from ${payload.name}`,
      html: buildEmailHtml(payload),
      text: buildEmailText(payload),
    }),
  });

  const responseText = await response.text();

  return { ok: response.ok, status: response.status, body: responseText };
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { message: "Method not allowed." });
  }

  const payload = request.body || {};
  const name = clean(payload.name);
  const phone = clean(payload.phone);
  const address = clean(payload.address);
  const service = clean(payload.service);
  const turnstileToken = clean(payload.turnstileToken);

  if (!name || !phone || !address || !service) {
    return sendJson(response, 400, { message: "Please complete all required fields." });
  }

  if (!turnstileToken) {
    return sendJson(response, 400, { message: "Please complete the CAPTCHA." });
  }

  const verification = await verifyTurnstile(turnstileToken, request.headers["x-forwarded-for"]);

  if (!verification.success) {
    return sendJson(response, 400, { message: "CAPTCHA verification failed. Please try again." });
  }

  const emailResult = await sendEmail({
    name,
    phone,
    address,
    service,
    size: clean(payload.size),
    stories: clean(payload.stories),
    details: clean(payload.details),
  });

  if (!emailResult.ok) {
    console.error("Resend email failed", {
      reason: emailResult.reason,
      status: emailResult.status,
      body: emailResult.body,
    });

    return sendJson(response, 500, { message: "Could not send the request. Please contact us directly." });
  }

  return sendJson(response, 200, { message: "Request sent." });
};
