const QUOTE_ENDPOINT = "/api/quote";
const GOOGLE_REVIEWS_ENDPOINT = "/api/google-reviews";

const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const menuButton = document.querySelector("[data-menu-button]");
const form = document.querySelector("[data-quote-form]");
const formStatus = document.querySelector("[data-form-status]");
const reviewsSummary = document.querySelector("[data-google-reviews-summary]");
const reviewsPanel = document.querySelector("[data-google-reviews-panel]");
const serviceSelect = form.querySelector("select[name='service']");
const sizeSelect = form.querySelector("[data-size-select]");
const sizeLabel = form.querySelector("[data-size-label]");
const formOpenedAt = Date.now();

// The "Approximate size" field means something different depending on the
// service — a house's square footage isn't the same scale as a patio's, and
// window cleaning is priced by count, not area. Swap the field's label and
// options based on the selected service instead of using one generic
// small/medium/large scale for everything.
const HOUSE_SCALE_SERVICES = new Set(["house_soft_wash", "roof_soft_wash", "gutter_cleaning", "gutter_brightening"]);
const AREA_SCALE_SERVICES = new Set(["patio_cleaning", "deck_cleaning", "porch_cleaning", "pool_deck_cleaning"]);
const COUNT_SCALE_SERVICES = new Set(["window_cleaning"]);

const SIZE_FIELD_CONFIG = {
  house: {
    label: "Approximate home size",
    options: [
      { value: "", label: "Not sure" },
      { value: "small", label: "Small house (~1,000–1,800 sq ft)" },
      { value: "medium", label: "Medium house (~1,800–3,000 sq ft)" },
      { value: "large", label: "Large house (~3,000–4,500 sq ft)" },
    ],
  },
  area: {
    label: "Approximate square footage",
    options: [
      { value: "", label: "Not sure" },
      { value: "small", label: "Under 300 sq ft" },
      { value: "medium", label: "300–500 sq ft" },
      { value: "large", label: "500–800 sq ft" },
    ],
  },
  count: {
    label: "Number of windows",
    options: [
      { value: "", label: "Not sure" },
      { value: "1-10", label: "1–10 windows" },
      { value: "11-20", label: "11–20 windows" },
      { value: "21-30", label: "21–30 windows" },
      { value: "31-plus", label: "31+ windows" },
    ],
  },
  default: {
    label: "Approximate size",
    options: [
      { value: "", label: "Not sure" },
      { value: "small", label: "Small" },
      { value: "medium", label: "Medium" },
      { value: "large", label: "Large" },
    ],
  },
};

function sizeCategoryForService(service) {
  if (HOUSE_SCALE_SERVICES.has(service)) return "house";
  if (AREA_SCALE_SERVICES.has(service)) return "area";
  if (COUNT_SCALE_SERVICES.has(service)) return "count";
  return "default";
}

function updateSizeField() {
  const config = SIZE_FIELD_CONFIG[sizeCategoryForService(serviceSelect.value)];
  sizeLabel.textContent = config.label;
  sizeSelect.innerHTML = config.options
    .map((opt) => `<option value="${opt.value}">${opt.label}</option>`)
    .join("");
}

serviceSelect.addEventListener("change", updateSizeField);
updateSizeField();

const updateHeader = () => {
  header.classList.toggle("scrolled", window.scrollY > 20);
};

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

menuButton.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("open");
  header.classList.toggle("menu-open", isOpen);
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
});

nav.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    nav.classList.remove("open");
    header.classList.remove("menu-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation");
  }
});

function starsForRating(rating) {
  const rounded = Math.round(Number(rating || 0));
  return "★★★★★".slice(0, rounded).padEnd(5, "☆");
}

function formatReviewTime(value) {
  const time = String(value || "").trim();
  if (!time) return "Google review";

  const normalized = time.toLowerCase();
  if (normalized === "in the last week") return "Last week";
  if (normalized === "in the last month") return "Last month";
  if (normalized === "in the last year") return "Last year";
  if (normalized.startsWith("in the last ")) {
    return time.replace(/^in the last\s+/i, "Last ");
  }
  if (normalized.startsWith("in ")) {
    return time.replace(/^in\s+/i, "");
  }

  return time.charAt(0).toUpperCase() + time.slice(1);
}

function renderGoogleReviews(data) {
  if (!reviewsSummary || !reviewsPanel) return;

  if (!data.configured) {
    reviewsSummary.innerHTML = "<strong>Google Business Profile is active.</strong><span>Reviews are collected directly through Google's review system.</span>";
    return;
  }

  if (data.rating && data.userRatingCount) {
    reviewsSummary.innerHTML = `<strong>${data.rating.toFixed(1)} on Google</strong><span>${data.userRatingCount} customer review${data.userRatingCount === 1 ? "" : "s"}</span>`;
  } else {
    reviewsSummary.innerHTML = "<strong>Google Business Profile is active.</strong><span>Customer reviews will appear here as they are published.</span>";
  }

  if (!Array.isArray(data.reviews) || data.reviews.length === 0) return;

  reviewsPanel.innerHTML = "";
  reviewsPanel.classList.add("has-reviews");

  data.reviews.slice(0, 5).forEach((review) => {
    const card = document.createElement("article");
    card.className = "review-card";

    const header = document.createElement("div");
    header.className = "review-card-header";

    const reviewer = document.createElement("div");
    reviewer.className = "reviewer";

    const avatar = review.authorPhoto ? document.createElement("img") : document.createElement("span");
    avatar.className = "reviewer-avatar";
    if (review.authorPhoto) {
      avatar.src = review.authorPhoto;
      avatar.alt = "";
      avatar.loading = "lazy";
      avatar.referrerPolicy = "no-referrer";
    } else {
      avatar.textContent = (review.authorName || "G").trim().charAt(0).toUpperCase();
    }

    const reviewerText = document.createElement("div");
    reviewerText.className = "reviewer-text";

    const author = document.createElement(review.authorUri ? "a" : "strong");
    author.textContent = review.authorName;
    if (review.authorUri) {
      author.href = review.authorUri;
      author.target = "_blank";
      author.rel = "noopener";
    }

    const meta = document.createElement("span");
    meta.className = "review-meta";
    meta.textContent = formatReviewTime(review.relativeTime);

    reviewerText.append(author, meta);
    reviewer.append(avatar, reviewerText);

    const rating = document.createElement("span");
    rating.className = "review-stars";
    rating.textContent = starsForRating(review.rating);

    header.append(reviewer, rating);

    const text = document.createElement("p");
    text.textContent = review.text || "Review published on Google.";

    card.append(header, text);
    reviewsPanel.append(card);
  });
}

async function loadGoogleReviews() {
  if (!reviewsSummary || !reviewsPanel) return;

  try {
    const response = await fetch(GOOGLE_REVIEWS_ENDPOINT);
    const data = await response.json();
    renderGoogleReviews(data);
  } catch (error) {
    reviewsSummary.innerHTML = "<strong>Google Business Profile is active.</strong><span>Reviews are collected directly through Google's review system.</span>";
  }
}

loadGoogleReviews();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const botField = String(formData.get("website") || "").trim();
  const turnstileToken = String(formData.get("cf-turnstile-response") || "");
  const filledTooFast = Date.now() - formOpenedAt < 2500;

  if (botField || filledTooFast) {
    formStatus.textContent = "Please try again.";
    return;
  }

  if (!turnstileToken) {
    formStatus.textContent = "Please complete the CAPTCHA.";
    return;
  }

  const stories = formData.get("stories");
  const payload = {
    name: String(formData.get("name") || ""),
    phone: String(formData.get("phone") || ""),
    address: String(formData.get("address") || ""),
    service: String(formData.get("service") || ""),
    size: String(formData.get("size") || "") || null,
    stories: stories ? Number(stories) : null,
    details: String(formData.get("details") || ""),
    turnstileToken,
  };

  formStatus.textContent = "Sending your request...";

  try {
    const response = await fetch(QUOTE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    formStatus.textContent = response.ok
      ? "Thanks. Your request has been sent. We'll follow up shortly."
      : result.message || "Please try again or contact us directly.";
  } catch (err) {
    formStatus.textContent = "Please try again or contact us directly.";
  }

  form.reset();
  if (window.turnstile) {
    window.turnstile.reset();
  }
});
