/* ============ SafeTemp HVAC ============ */

/*
 * EMAIL SETUP: set this to the inbox that should receive form submissions.
 * Forms are delivered with FormSubmit (https://formsubmit.co), a free service
 * that needs no account. The FIRST submission sends an activation email to this
 * address. Click the link in it once, and every later submission goes to your inbox.
 */
const SAFETEMP_EMAIL = "curtis.lozano89@gmail.com";
const FORM_ENDPOINT = `https://formsubmit.co/ajax/${SAFETEMP_EMAIL}`;

/* ---------- Mobile nav ---------- */
const navToggle = document.getElementById("navToggle");
const nav = document.getElementById("nav");
navToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", open);
});
nav.querySelectorAll("a").forEach(a =>
  a.addEventListener("click", () => {
    nav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  })
);

document.getElementById("year").textContent = new Date().getFullYear();

/* ---------- Thermostat ---------- */
const dial = document.getElementById("dial");
const dialFill = document.getElementById("dialFill");
const setTempEl = document.getElementById("setTemp");
const dialMode = document.getElementById("dialMode");
const ARC = 395.8; // 270° of a r=84 circle
const MIN = 60, MAX = 85;
let temp = 72;

function renderDial() {
  setTempEl.textContent = temp;
  const pct = (temp - MIN) / (MAX - MIN);
  dialFill.style.strokeDasharray = `${Math.max(pct * ARC, 1)} 527.8`;
}
document.getElementById("tempUp").addEventListener("click", () => { temp = Math.min(MAX, temp + 1); renderDial(); });
document.getElementById("tempDown").addEventListener("click", () => { temp = Math.max(MIN, temp - 1); renderDial(); });
document.querySelectorAll(".mode").forEach(btn =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const mode = btn.dataset.mode;
    dial.dataset.mode = mode;
    dialMode.textContent = mode === "heat" ? "Heating to" : "Cooling to";
    temp = mode === "heat" ? 70 : 72;
    renderDial();
  })
);
renderDial();

/* ---------- Date strip (next 14 days, Sundays disabled) ---------- */
const dateStrip = document.getElementById("dateStrip");
const preferredDate = document.getElementById("preferredDate");
const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const monFmt = new Intl.DateTimeFormat("en-US", { month: "short" });
const longFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

for (let i = 0; i < 14; i++) {
  const d = new Date();
  d.setDate(d.getDate() + i);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "date-btn";
  btn.setAttribute("role", "radio");
  btn.setAttribute("aria-checked", "false");
  btn.dataset.value = longFmt.format(d);
  btn.innerHTML = `<span class="dw">${i === 0 ? "Today" : i === 1 ? "Tmrw" : dayFmt.format(d)}</span><span class="dd">${d.getDate()}</span><span class="dm">${monFmt.format(d)}</span>`;
  if (d.getDay() === 0) btn.disabled = true; // Closed Sundays (edit to taste)
  btn.addEventListener("click", () => {
    dateStrip.querySelectorAll(".date-btn").forEach(b => b.setAttribute("aria-checked", "false"));
    btn.setAttribute("aria-checked", "true");
    preferredDate.value = btn.dataset.value;
    btn.closest("fieldset").classList.remove("invalid");
  });
  dateStrip.appendChild(btn);
}

/* ---------- Deep links: "Book a repair →" pre-selects the service/office ---------- */
document.querySelectorAll("[data-service]").forEach(link =>
  link.addEventListener("click", () => {
    const input = document.querySelector(`#serviceChips input[value="${link.dataset.service}"]`);
    if (input) input.checked = true;
  })
);
document.querySelectorAll("[data-office]").forEach(link =>
  link.addEventListener("click", () => { document.getElementById("s-office").value = link.dataset.office; })
);

/* ---------- Form handling ---------- */
function validate(form) {
  let ok = true;
  form.querySelectorAll(".field").forEach(f => f.classList.remove("invalid"));
  form.querySelectorAll("fieldset").forEach(f => f.classList.remove("invalid"));

  form.querySelectorAll("input[required]:not([type=radio]), textarea[required]").forEach(el => {
    const bad = !el.value.trim() || (el.type === "email" && !/^\S+@\S+\.\S+$/.test(el.value));
    if (bad) { el.closest(".field").classList.add("invalid"); ok = false; }
  });

  // Radio groups
  const groups = new Set([...form.querySelectorAll("input[type=radio][required]")].map(r => r.name));
  groups.forEach(name => {
    if (!form.querySelector(`input[name="${name}"]:checked`)) {
      form.querySelector(`input[name="${name}"]`).closest("fieldset").classList.add("invalid");
      ok = false;
    }
  });

  // Date strip (schedule form only)
  if (form.id === "scheduleForm" && !preferredDate.value) {
    dateStrip.closest("fieldset").classList.add("invalid");
    ok = false;
  }
  return ok;
}

function mailtoFallback(data) {
  const subject = data._subject || "Website inquiry";
  const body = Object.entries(data)
    .filter(([k]) => !k.startsWith("_"))
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
    .join("\n");
  window.location.href = `mailto:${SAFETEMP_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function wireForm(form, successMsg) {
  const status = form.querySelector(".form-status");
  const submit = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async e => {
    e.preventDefault();
    status.className = "form-status";
    status.textContent = "";

    if (!validate(form)) {
      status.classList.add("err");
      status.textContent = "Please fill in the highlighted fields.";
      form.querySelector(".invalid")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    if (data._honey) return; // bot
    data._template = "table";
    data._captcha = "false";
    if (data.email) data._replyto = data.email;

    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = "Sending…";

    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === "false" || json.success === false) throw new Error(json.message || "Send failed");

      form.reset();
      if (form.id === "scheduleForm") {
        preferredDate.value = "";
        dateStrip.querySelectorAll(".date-btn").forEach(b => b.setAttribute("aria-checked", "false"));
      }
      status.classList.add("ok");
      status.textContent = successMsg;
    } catch (err) {
      status.classList.add("err");
      status.innerHTML = `We couldn't send that automatically. Please call <a href="tel:+13462687833">(346) 268-7833</a>, or <a href="#" class="mail-fallback">email it to us instead</a>.`;
      status.querySelector(".mail-fallback").addEventListener("click", ev => { ev.preventDefault(); mailtoFallback(data); });
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });
}

wireForm(document.getElementById("scheduleForm"), "✅ Request received! We'll call or text you shortly to confirm your appointment.");
wireForm(document.getElementById("contactForm"), "✅ Thanks! Your message is on its way. We'll get back to you soon.");
