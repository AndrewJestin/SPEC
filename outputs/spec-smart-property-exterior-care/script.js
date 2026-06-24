const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const menuButton = document.querySelector("[data-menu-button]");
const form = document.querySelector("[data-quote-form]");
const formStatus = document.querySelector("[data-form-status]");
const captchaQuestion = document.querySelector("[data-captcha-question]");
const formOpenedAt = Date.now();
const captchaA = Math.floor(Math.random() * 6) + 3;
const captchaB = Math.floor(Math.random() * 5) + 2;
const captchaAnswer = captchaA + captchaB;

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

captchaQuestion.textContent = `What is ${captchaA} + ${captchaB}?`;

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const botField = String(formData.get("website") || "").trim();
  const humanAnswer = Number(formData.get("human-check"));
  const filledTooFast = Date.now() - formOpenedAt < 2500;

  if (botField || filledTooFast) {
    formStatus.textContent = "Please try again.";
    return;
  }

  if (humanAnswer !== captchaAnswer) {
    formStatus.textContent = "Please complete the human check.";
    return;
  }

  formStatus.textContent = "Thanks. Your request is ready to be connected to your preferred booking method.";
  form.reset();
  captchaQuestion.textContent = `What is ${captchaA} + ${captchaB}?`;
});
