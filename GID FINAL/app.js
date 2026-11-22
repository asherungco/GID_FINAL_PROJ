"use strict";
/* ============================================================
   Data
   ============================================================ */
const PRODUCTS = [
  { id: "cappuccino", name: "Cappuccino",       price: 120, cats: ["Hot"],          type: "drink", rating: 4.8, reviews: 120, time: "5-8 min", tag: "Bestseller", desc: "Rich espresso with steamed milk and a velvety foam, finished with a touch of latte art." },
  { id: "iced-latte", name: "Iced Latte",       price: 130, cats: ["Iced"],         type: "drink", rating: 4.7, reviews: 96,  time: "4-6 min", desc: "Smooth espresso poured over cold milk and plenty of ice." },
  { id: "matcha",     name: "Matcha Latte",     price: 140, cats: ["Iced", "Tea"],  type: "drink", rating: 4.9, reviews: 88,  time: "5-7 min", desc: "Stone-ground matcha whisked with milk and served over ice." },
  { id: "croissant",  name: "Butter Croissant", price: 95,  cats: ["Food"],         type: "food",  rating: 4.6, reviews: 64,  time: "2-3 min", desc: "Flaky, golden and baked fresh every morning." },
  { id: "americano",  name: "Iced Americano",   price: 110, cats: ["Iced"],         type: "drink", rating: 4.5, reviews: 72,  time: "3-5 min", desc: "Bold espresso over ice with chilled water. Clean and refreshing." },
  { id: "muffin",     name: "Blueberry Muffin", price: 85,  cats: ["Food"],         type: "food",  rating: 4.7, reviews: 51,  time: "2-3 min", desc: "Soft, buttery muffin loaded with juicy blueberries." }
];
const CATEGORIES = ["All", "Hot", "Iced", "Tea", "Food"];
const SIZES = [{ k: "S", label: "Small", d: -20 }, { k: "M", label: "Medium", d: 0 }, { k: "L", label: "Large", d: 20 }];
const MILKS = ["Whole", "Oat", "Almond"];
const SHOT_PRICE = 25, SERVICE_FEE = 10, DELIVERY_FEE = 30;
const PAYMENTS = [
  { k: "cash",    label: "Cash",     sub: "Pay at the counter" },
  { k: "ewallet", label: "E-wallet", sub: "Pay with your e-wallet" },
  { k: "card",    label: "Card",     sub: "Credit or debit card" }
];

/* ============================================================
   Helpers + persistence
   ============================================================ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const peso = n => "P " + n.toLocaleString("en-PH");
const byId = id => PRODUCTS.find(p => p.id === id);
const store = {
  get(k, d) { try { const v = localStorage.getItem("brewgo." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("brewgo." + k, JSON.stringify(v)); return true; } catch { return false; } },
  clear() { try { Object.keys(localStorage).filter(k => k.startsWith("brewgo.")).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ } }
};
const toHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
async function passwordHash(password, saltHex) {
  if (!window.crypto || !window.crypto.subtle) throw new Error("Secure password hashing is unavailable in this browser.");
  const salt = Uint8Array.from(saltHex.match(/.{2}/g), byte => parseInt(byte, 16));
  const key = await window.crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await window.crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, key, 256);
  return toHex(new Uint8Array(bits));
}
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

const state = {
  cat: "All", q: "",
  detail: { id: "cappuccino", size: "M", milk: "Whole", shot: false, qty: 1 },
  cart: store.get("cart", []),
  orders: store.get("orders", []),
  fav: new Set(store.get("fav", [])),
  user: store.get("user", null),
  authMode: "login",
  authNotice: "",
  fulfil: "pickup", pay: "ewallet", lastOrder: null
};
const save = () => { store.set("cart", state.cart); store.set("orders", state.orders); store.set("fav", [...state.fav]); };

/* ============================================================
   Icons + art (inline SVG, no image files needed)
   ============================================================ */
const ic = {
  search: '<svg class="i" viewBox="0 0 24 24"><path d="M10 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14ZM15.5 15.5 21 21"/></svg>',
  home:   '<svg class="i" viewBox="0 0 24 24"><path d="M3 11 12 3l9 8v9h-6v-6H9v6H3Z"/></svg>',
  orders: '<svg class="i" viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z M9 8h6 M9 12h6"/></svg>',
  bag:    '<svg class="i" viewBox="0 0 24 24"><path d="M5 8h14l1 13H4Z M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  user:   '<svg class="i" viewBox="0 0 24 24"><path d="M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM4 21q0-6 8-6t8 6"/></svg>',
  back:   '<svg class="i" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  chev:   '<svg class="i" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  plus:   '<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  minus:  '<svg class="i" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  check:  '<svg class="i" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  pin:    '<svg class="i" viewBox="0 0 24 24"><path d="M12 21Q5 13 5 9a7 7 0 0 1 14 0q0 4-7 12ZM12 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/></svg>',
  phone:  '<svg class="i" viewBox="0 0 24 24"><path d="M6 3h4l2 5-2.5 1.8Q11 13 14.2 14.5L16 12l5 2v4q0 3-3 3Q5 20 3 6q0-3 3-3Z"/></svg>',
  mail:   '<svg class="i" viewBox="0 0 24 24"><path d="M3 6h18v12H3Z M3 6l9 7 9-7"/></svg>',
  chat:   '<svg class="i" viewBox="0 0 24 24"><path d="M4 5h16v11h-9l-5 4v-4H4Z"/></svg>',
  heart:  '<svg class="i" viewBox="0 0 24 24"><path d="M12 20Q3 14 3 8.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 9 1.5Q21 14 12 20Z"/></svg>',
  star:   '<svg class="i fill" viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.3l7.1-.7Z"/></svg>',
  reset:  '<svg class="i" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5"/></svg>'
};

const cubes = [[48, 24, 10, 14], [60, 22, 10, -12], [68, 30, 9, 22], [52, 34, 9, -20]]
  .map(([cx, cy, s, d]) => `<rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" rx="2" transform="rotate(${d} ${cx} ${cy})" fill="#fff" fill-opacity=".55" stroke="#fff" stroke-opacity=".9" stroke-width=".8"/>`).join("");
const glass = (top, grad, straw) => `
  <path d="M40 16h34l-4 49q0 4-4 4H48q-4 0-4-4Z" fill="#fff" fill-opacity=".35" stroke="#fff" stroke-opacity=".9" stroke-width="1.2"/>
  <path d="M41.5 28h31l-.9 13H42.4Z" fill="${top}"/>
  <path d="M42.4 41h29.2l-1.8 24q0 2.5-3.8 2.5H48q-3.8 0-3.8-2.5Z" fill="url(#${grad})"/>
  <path d="M65 3 58 46" stroke="${straw}" stroke-width="3" stroke-linecap="round"/>${cubes}
  <path d="M46 20l2 42" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>`;
const seg = (cx, cy, w, h, d) => `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" transform="rotate(${d} ${cx} ${cy})" fill="url(#gGold)" stroke="#9C5A1C" stroke-width="1"/>`;
const ART = {
  cappuccino: `
    <ellipse cx="57" cy="62" rx="39" ry="7.5" fill="url(#gSauc)" stroke="#CFC8C0"/><ellipse cx="57" cy="62" rx="28" ry="4.5" fill="#E6E1DA"/>
    <path d="M84 38Q100 38 98 48Q96 58 80 55" fill="none" stroke="#EEEAE4" stroke-width="5" stroke-linecap="round"/>
    <path d="M31 34h52q0 30-26 30T31 34Z" fill="url(#gCup)"/>
    <ellipse cx="57" cy="34" rx="26" ry="6.5" fill="#6B4223"/><ellipse cx="57" cy="34" rx="21" ry="4.5" fill="#E8CFA9"/>
    <path d="M57 38Q46 33 51 31Q56 29 57 33Q58 29 63 31Q68 33 57 38Z" fill="#8B5A2B"/>
    <path d="M50 26Q46 20 50 14Q54 8 50 3M62 26Q58 20 62 14Q66 8 62 3" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2.2" stroke-linecap="round"/>`,
  "iced-latte": glass("#F6EDDF", "gLatte", "#D8573F"),
  matcha: glass("#F4F1E4", "gMatcha", "#FFFFFF"),
  americano: glass("#5A3A22", "gAmer", "#8B5A2B"),
  croissant: `
    ${seg(27, 52, 18, 12, 55)}${seg(87, 52, 18, 12, -55)}${seg(36, 40, 24, 22, 32)}${seg(78, 40, 24, 22, -32)}${seg(57, 35, 30, 32, 0)}
    <path d="M50 24Q52 36 50 46M64 24Q62 36 64 46" fill="none" stroke="#9C5A1C" stroke-opacity=".8" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M48 26Q57 21 66 26" fill="none" stroke="#FFE3B0" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/>`,
  muffin: `
    <ellipse cx="57" cy="34" rx="29" ry="18" fill="url(#gDome)" stroke="#9C5A1C"/>
    <path d="M37 42h40l-5 24q-.5 3-4 3H46q-3.500 0-4-3Z" fill="#EBD3A0" stroke="#C9A765"/>
    <path d="M45 43 47 68M51.600 43 52.700 68M58 43V68M64.600 43 63.400 68" stroke="#C9A765" stroke-opacity=".8" stroke-width=".9" stroke-linecap="round"/>
    ${[[45, 32], [57, 26], [68, 33], [52, 38], [63, 39], [40, 38]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#4A4E94" stroke="#2F3270" stroke-width=".8"/>`).join("")}
    <path d="M40 28Q48 19 62 19" fill="none" stroke="#FFE3B0" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/>`
};
const artSVG = id => `<svg viewBox="0 0 114 82" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${byId(id).name}">
  <rect width="114" height="82" fill="url(#gBg)"/><ellipse cx="57" cy="68" rx="38" ry="4.500" fill="#3B2412" opacity=".18"/>${ART[id]}</svg>`;
const PHOTOS = {
  cappuccino: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=88",
  "iced-latte": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=88",
  matcha: "https://images.unsplash.com/photo-1515823662972-da6a2e4d3002?auto=format&fit=crop&w=900&q=88",
  americano: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=88",
  croissant: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=900&q=88",
  muffin: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=900&q=88"
};
const productPhoto = id => `<img class="product-photo" src="${PHOTOS[id]}" alt="${byId(id).name}" loading="lazy" referrerpolicy="no-referrer">`;
const LOGO = `<svg viewBox="0 0 512 512" role="img" aria-label="BrewGo logo"><rect width="512" height="512" rx="112" fill="#8B5A2B"/>
  <g fill="none" stroke="#F3E9DD" stroke-width="15" stroke-linecap="round">
    <path d="M196 196Q178 168 196 144Q214 120 196 94"/><path d="M256 204Q238 176 256 152Q274 128 256 102"/><path d="M316 196Q298 168 316 144Q334 120 316 94"/></g>
  <path d="M138 236H374V296Q374 372 298 394H214Q138 372 138 296Z" fill="#F3E9DD"/>
  <path d="M374 258H396Q434 258 434 298Q434 338 396 338H360" fill="none" stroke="#F3E9DD" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="160" y="410" width="192" height="16" rx="8" fill="#F3E9DD"/>
  <path d="M230 282L290 316L230 350Z" fill="#8B5A2B" stroke="#8B5A2B" stroke-width="14" stroke-linejoin="round"/></svg>`;

/* ============================================================
   Router (slide / fade transitions, browser back button works)
   ============================================================ */
const app = $("#app");
const TAB_SCREENS = ["home", "orders", "profile"];
const screenEls = {};
$$(".screen").forEach(el => { screenEls[el.id.slice(2)] = el; });
let stack = [];
let transitionTimer;

function setState(el, st) { el.dataset.state = st; el.inert = st !== "active"; }

function transition(from, to, mode) {
  const t = screenEls[to], f = from ? screenEls[from] : null;
  clearTimeout(transitionTimer);
  $$(".screen").forEach(el => { if (el !== t && el !== f) setState(el, "hidden"); });
  RENDER[to]();
  if (!f || mode === "fade") {
    t.dataset.anim = "fade"; setState(t, "active");
    if (f && f !== t) { f.dataset.anim = "fade"; setState(f, "hidden"); }
  } else if (mode === "push") {
    t.dataset.anim = "slide"; f.dataset.anim = "slide";
    setState(t, "right"); void t.offsetWidth; setState(t, "active"); setState(f, "left");
  } else { /* pop */
    t.dataset.anim = "slide"; f.dataset.anim = "slide";
    setState(t, "left"); void t.offsetWidth; setState(t, "active"); setState(f, "right");
  }
  transitionTimer = setTimeout(() => {
    $$(".screen").forEach(el => { if (el !== t) setState(el, "hidden"); });
  }, 400);
  app.dataset.tabs = TAB_SCREENS.includes(to) ? "true" : "false";
  updateTabs(to);
}
function go(to, mode = "push") {
  const from = stack[stack.length - 1];
  if (from === to && mode === "push") return;
  if (mode === "push") { stack.push(to); history.pushState({ n: stack.length }, ""); }
  else { stack = [to]; history.replaceState({ n: 1 }, ""); }
  transition(from, to, mode);
}
function back() { if (stack.length > 1) history.back(); else go("home", "fade"); }
window.addEventListener("popstate", () => {
  if (stack.length > 1) { const from = stack.pop(); transition(from, stack[stack.length - 1], "pop"); }
});

/* ============================================================
   Small UI helpers
   ============================================================ */
let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.innerHTML = ic.check + "<span></span>"; el.lastChild.textContent = msg;
  el.classList.add("show"); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1900);
}
const cartCount = () => state.cart.reduce((n, i) => n + i.qty, 0);
function updateBadges(bump) {
  const n = cartCount();
  $$("[data-badge]").forEach(b => {
    b.textContent = n; b.hidden = n === 0;
    if (bump) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
  });
}
function renderTabs() {
  const items = [["home", "Home", ic.home], ["orders", "Orders", ic.orders], ["cart", "Cart", ic.bag], ["profile", "Profile", ic.user]];
  $("#tabs").innerHTML = items.map(([k, l, i]) =>
    `<button class="tab" data-act="tab" data-t="${k}" aria-label="${l}"><span class="ind">${i}${k === "cart" ? '<span class="badge" data-badge hidden></span>' : ""}</span>${l}</button>`).join("");
}
function updateTabs(cur) {
  $$(".tab").forEach(t => { if (t.dataset.t === cur) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current"); });
}

/* ============================================================
   Pricing
   ============================================================ */
const unitPrice = (p, size, shot) => p.price + (p.type === "drink" ? SIZES.find(s => s.k === size).d + (shot ? SHOT_PRICE : 0) : 0);
const itemOptions = i => byId(i.id).type === "drink" ? `${SIZES.find(s => s.k === i.size).label}  |  ${i.milk} milk${i.shot ? "  |  Extra shot" : ""}` : "Freshly baked";
function totals() {
  const subtotal = state.cart.reduce((n, i) => n + i.unit * i.qty, 0);
  const delivery = state.fulfil === "delivery" && subtotal ? DELIVERY_FEE : 0;
  const fee = subtotal ? SERVICE_FEE : 0;
  return { subtotal, fee, delivery, total: subtotal + fee + delivery };
}
function addToCart(item) {
  const key = [item.id, item.size, item.milk, item.shot].join("|");
  const found = state.cart.find(i => i.key === key);
  if (found) found.qty += item.qty; else state.cart.push({ ...item, key });
  save(); updateBadges(true);
}

/* ============================================================
   Screens
   ============================================================ */
const RENDER = {
  splash() {
    screenEls.splash.innerHTML = `
      <div class="splash">
        <div class="center"><div class="logo">${LOGO}</div><h1>BrewGo</h1><p>Coffee, ordered ahead</p></div>
        <div class="start-prompt"><p>Your next favorite coffee is just a tap away.</p><button class="btn" data-act="start">Brew Now <span aria-hidden="true"><svg class="start-cup" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Z"/><path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2M8 5c0-1 .8-1.3.8-2.3M12 5c0-1 .8-1.3.8-2.3M3 21h14"/></svg></span></button></div>
      </div>`;
  },

  login() {
    const creating = state.authMode === "signup";
    screenEls.login.innerHTML = `
      <div class="login-screen">
        <div class="login-decor login-decor-one"></div><div class="login-decor login-decor-two"></div>
        <div class="login-wrap">
          <div class="login-brand"><span class="login-mark">${LOGO}</span><div><b>BrewGo</b><span>GOOD COFFEE. GOOD MOOD.</span></div></div>
          <form class="login-card" id="login-form">
            <span class="login-kicker">${creating ? "JOIN BREWGO" : "YOUR COFFEE, YOUR WAY"}</span>
            <h1>${creating ? "Make every coffee break yours." : "Good coffee starts here."}</h1>
            <p class="login-intro">${creating ? "Create an account to get started." : "Log in or create an account to order your favorites."}</p>
            ${state.authNotice ? `<p class="auth-success" role="status">${escapeHTML(state.authNotice)}</p>` : ""}
            <p class="auth-error" id="auth-error" role="alert" hidden></p>
            ${creating ? `<label for="login-name">Your name</label>
            <input class="field" id="login-name" name="name" autocomplete="name" placeholder="Your name" required>` : ""}
            <label for="login-identifier">Email</label>
            <input class="field" id="login-identifier" name="identifier" type="email" autocomplete="email" required>
            <label for="login-password">Password</label>
            <input class="field" id="login-password" name="password" type="password" autocomplete="${creating ? "new-password" : "current-password"}" minlength="${creating ? 8 : 1}" required>
            <button class="btn" type="submit">${creating ? "Create account" : "Log in"} <span aria-hidden="true">→</span></button>
            ${creating ? `<button class="auth-switch" type="button" data-act="auth-mode" data-mode="login">Already have an account? <b>Log in</b></button>` : `<button class="btn secondary auth-create" type="button" data-act="auth-mode" data-mode="signup">Create account</button>`}
          </form>
          <p class="login-footer">Freshly made, just for you <span aria-hidden="true">☕</span></p>
        </div>
      </div>`;
    $("#login-form", screenEls.login).addEventListener("submit", async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const identifier = $("#login-identifier", form).value.trim();
      const identifierKey = identifier.toLowerCase();
      const password = $("#login-password", e.currentTarget).value;
      const name = creating ? $("#login-name", form).value.trim() : "";
      const error = $("#auth-error", form);
      const button = $('button[type="submit"]', form);
      if (!identifier || !password || (creating && !name)) return;
      error.hidden = true;
      button.disabled = true;
      try {
        const accounts = store.get("accounts", []);
        if (!Array.isArray(accounts)) {
          error.textContent = "Saved account data is invalid. Clear this browser’s BrewGo data and try again.";
          error.hidden = false;
          return;
        }
        let account;
        if (creating) {
          if (password.length < 8) {
            error.textContent = "Use a password with at least 8 characters.";
            error.hidden = false;
            return;
          }
          if (accounts.some(a => a.identifier.toLowerCase() === identifierKey)) {
            error.textContent = "An account with that email already exists. Log in instead.";
            error.hidden = false;
            return;
          }
          const salt = toHex(window.crypto.getRandomValues(new Uint8Array(16)));
          account = { identifier, name, salt, hash: await passwordHash(password, salt) };
          if (!store.set("accounts", [...accounts, account])) {
            error.textContent = "This browser couldn’t save your account. Check storage permissions and try again.";
            error.hidden = false;
            return;
          }
          state.authMode = "login";
          state.authNotice = "Account created successfully. Log in to continue.";
          RENDER.login();
          return;
        } else {
          account = accounts.find(a => a.identifier.toLowerCase() === identifierKey);
          if (!account || await passwordHash(password, account.salt) !== account.hash) {
            error.textContent = "Email or password is incorrect.";
            error.hidden = false;
            return;
          }
        }
        state.user = { identifier: account.identifier, name: account.name };
        if (!store.set("user", state.user)) {
          error.textContent = "Your account is saved, but this browser couldn’t save the signed-in session.";
          error.hidden = false;
          state.user = null;
          return;
        }
        state.authNotice = "";
        state.authMode = "login";
        go("home", "fade");
      } catch (error) {
        $("#auth-error", form).textContent = "Could not securely save or check your password in this browser.";
        $("#auth-error", form).hidden = false;
      } finally {
        button.disabled = false;
      }
    });
  },

  home() {
    const el = screenEls.home;
    const sc = $(".scroll", el), top = sc ? sc.scrollTop : 0;
    el.innerHTML = `<div class="scroll has-tabs">
      <header class="home-head">
        <div><p class="muted">${greeting()}</p><h1>What are we brewing?</h1></div>
        <button class="icon-btn" data-act="cart" aria-label="Open cart">${ic.bag}<span class="badge" data-badge hidden></span></button>
      </header>
      <label class="search">${ic.search}<span class="sr-only">Search</span><input id="q" type="search" enterkeyhint="search" placeholder="Search coffee, tea, pastries" autocomplete="off" value="${state.q.replace(/"/g, "&quot;")}"></label>
      <section class="promo" aria-label="Promotion">
        <div class="promo-copy"><h2>Morning Brew</h2><p>20% off your<br>first order</p><button class="pill-btn" data-act="open" data-id="cappuccino">Order now</button></div>
        <div class="promo-art">${productPhoto("cappuccino")}</div>
      </section>
      <div class="chips" role="group" aria-label="Categories">${CATEGORIES.map(c => `<button class="chip${c === state.cat ? " is-active" : ""}" data-act="cat" data-c="${c}" aria-pressed="${c === state.cat}">${c}</button>`).join("")}</div>
      <div class="sec-head"><h2 id="grid-title"></h2><button class="link" data-act="all">See all</button></div>
      <div class="grid" id="grid"></div></div>`;
    $("#q", el).addEventListener("input", e => { state.q = e.target.value; renderGrid(); });
    renderGrid(); updateBadges();
    if (top) $(".scroll", el).scrollTop = top;
  },

  detail() {
    const el = screenEls.detail, d = state.detail, p = byId(d.id), drink = p.type === "drink";
    const prev = $(".sheet", el), keep = prev ? prev.scrollTop : 0;
    const unit = unitPrice(p, d.size, d.shot), fav = state.fav.has(p.id);
    el.innerHTML = `
      <div class="hero">${productPhoto(p.id)}</div>
      <div class="hero-top">
        <button class="icon-btn plain" data-act="back" aria-label="Back">${ic.back}</button>
        <button class="fav icon-btn plain ${fav ? "on" : ""}" data-act="fav" data-id="${p.id}" aria-pressed="${fav}" aria-label="Favorite">${ic.heart}</button>
      </div>
      ${p.tag ? `<span class="tag">${ic.star}${p.tag}</span>` : ""}
      <div class="sheet">
        <div class="title-row"><h1>${p.name}</h1><b>${peso(unit)}</b></div>
        <div class="meta">${ic.star}<strong>${p.rating}</strong><span>(${p.reviews} reviews)  |  ${p.time}</span></div>
        <p class="desc">${p.desc}</p>
        ${drink ? `
          <h2>Size</h2>
          <div class="opts">${SIZES.map(s => `<button class="opt${s.k === d.size ? " is-active" : ""}" data-act="size" data-k="${s.k}" aria-pressed="${s.k === d.size}"><b>${s.label}</b><span>${peso(p.price + s.d + (d.shot ? SHOT_PRICE : 0))}</span></button>`).join("")}</div>
          <h2>Milk</h2>
          <div class="chip-row">${MILKS.map(m => `<button class="chip${m === d.milk ? " is-active" : ""}" data-act="milk" data-m="${m}" aria-pressed="${m === d.milk}">${m}</button>`).join("")}</div>
          <button class="extra" data-act="shot" aria-pressed="${d.shot}"><div><b>Extra espresso shot</b><span>+ ${peso(SHOT_PRICE)}</span></div><span class="switch"><i></i></span></button>` : ""}
      </div>
      <div class="bar">
        <div class="qty"><button data-act="dq" data-d="-1" aria-label="Decrease quantity">${ic.minus}</button><b aria-live="polite">${d.qty}</b><button class="plus" data-act="dq" data-d="1" aria-label="Increase quantity">${ic.plus}</button></div>
        <button class="btn" data-act="add">Add to cart  |  ${peso(unit * d.qty)}</button>
      </div>`;
    if (keep) $(".sheet", el).scrollTop = keep;
  },

  checkout() {
    const el = screenEls.checkout;
    const sc = $(".scroll", el), keep = sc ? sc.scrollTop : 0;
    const head = `<div class="top"><button class="icon-btn" data-act="back" aria-label="Back">${ic.back}</button><h1>Checkout</h1></div>`;
    if (!state.cart.length) {
      el.innerHTML = `<div class="scroll">${head}<div class="empty"><div class="empty-art">${ic.bag}</div><h2>Your cart is empty</h2><p>Pick something tasty from the menu and it will show up here.</p><button class="btn" data-act="menu">Browse the menu</button></div></div>`;
      return;
    }
    const t = totals();
    el.innerHTML = `<div class="scroll has-bar">${head}
      <div class="stack">
        <h2>Order summary</h2>
        <div class="panel">${state.cart.map(i => `
          <div class="line"><div class="thumb">${productPhoto(i.id)}</div>
            <div class="info"><b>${byId(i.id).name}</b><span>${itemOptions(i)}</span></div>
            <div class="right"><b>${peso(i.unit * i.qty)}</b>
              <div class="mini"><button data-act="ci" data-key="${i.key}" data-d="-1" aria-label="Remove one ${byId(i.id).name}">${ic.minus}</button><span>${i.qty}</span><button data-act="ci" data-key="${i.key}" data-d="1" aria-label="Add one ${byId(i.id).name}">${ic.plus}</button></div></div></div>`).join("")}</div>
        <h2>Pickup or delivery</h2>
        <div class="seg" role="group"><button data-act="fulfil" data-k="pickup" class="${state.fulfil === "pickup" ? "is-active" : ""}" aria-pressed="${state.fulfil === "pickup"}">Pickup</button><button data-act="fulfil" data-k="delivery" class="${state.fulfil === "delivery" ? "is-active" : ""}" aria-pressed="${state.fulfil === "delivery"}">Delivery</button></div>
        <div class="place"><span class="pin">${ic.pin}</span><div>${state.fulfil === "pickup" ? "<b>BrewGo - Ayala Avenue</b><span>Ready in about 10 minutes</span>" : "<b>Deliver to your saved address</b><span>Arrives in 25-35 minutes  |  + " + peso(DELIVERY_FEE) + "</span>"}</div></div>
        <h2>Payment method</h2>
        <div class="stack" style="gap:10px">${PAYMENTS.map(p => `<button class="pay${p.k === state.pay ? " is-active" : ""}" data-act="pay" data-k="${p.k}" aria-pressed="${p.k === state.pay}"><span class="radio"></span><div><b>${p.label}</b><span>${p.sub}</span></div></button>`).join("")}</div>
        <div class="totals">
          <div class="row"><span>Subtotal</span><b>${peso(t.subtotal)}</b></div>
          <div class="row"><span>Service fee</span><b>${peso(t.fee)}</b></div>
          ${t.delivery ? `<div class="row"><span>Delivery fee</span><b>${peso(t.delivery)}</b></div>` : ""}
          <hr><div class="row grand"><span>Total</span><b>${peso(t.total)}</b></div>
        </div>
        <p class="help">Need help?<button data-act="contact">Contact Us</button></p>
      </div></div>
      <div class="bar"><button class="btn" data-act="place">Place Order  |  ${peso(t.total)}</button></div>`;
    if (keep) $(".scroll", el).scrollTop = keep;
  },

  confirm() {
    const o = state.lastOrder; if (!o) { screenEls.confirm.innerHTML = ""; return; }
    screenEls.confirm.innerHTML = `<div class="scroll"><div class="confirm">
      <div class="ok"><span class="ring"></span><span class="disc"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span></div>
      <h1 class="a">Order placed!</h1>
      <p class="a">Order #${o.id} is being prepared.<br>We'll let you know when it's ready.</p>
      <div class="thumbs a">${o.items.slice(0, 3).map(i => `<div class="thumb">${productPhoto(i.id)}</div>`).join("")}</div>
      <div class="panel a">
        <div class="row"><span>${o.fulfil === "pickup" ? "Pickup at" : "Delivery"}</span><b>${o.fulfil === "pickup" ? "BrewGo - Ayala Avenue" : "Saved address"}</b></div>
        <div class="row"><span>${o.fulfil === "pickup" ? "Ready in" : "Arrives in"}</span><b>${o.fulfil === "pickup" ? "About 10 minutes" : "25-35 minutes"}</b></div>
        <div class="row"><span>Payment</span><b>${PAYMENTS.find(p => p.k === o.pay).label}</b></div>
        <div class="row t"><span>Total paid</span><b>${peso(o.total)}</b></div>
      </div>
      <div class="actions"><button class="btn" data-act="home">Back to Home</button><button class="btn secondary" data-act="track">Track order</button></div>
    </div></div>`;
  },

  orders() {
    const list = state.orders;
    screenEls.orders.innerHTML = `<div class="scroll has-tabs"><div class="top"><h1>Your orders</h1></div>
      ${list.length ? `<div class="stack">${list.map(o => {
        const live = Date.now() - o.ts < 10 * 60 * 1000;
        return `<article class="order"><div class="order-top"><b>#${o.id}</b><span class="status${live ? "" : " done"}">${live ? "Being prepared" : "Completed"}</span></div>
          <p class="items">${o.items.map(i => `${i.qty} x ${byId(i.id).name}`).join(", ")}</p>
          <div class="order-bot"><span>${new Date(o.ts).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}  |  ${o.fulfil === "pickup" ? "Pickup" : "Delivery"}</span><b>${peso(o.total)}</b></div></article>`; }).join("")}</div>`
      : `<div class="empty"><div class="empty-art">${ic.orders}</div><h2>No orders yet</h2><p>Your placed orders will show up here.</p><button class="btn" data-act="menu">Browse the menu</button></div>`}</div>`;
  },

  profile() {
    const user = state.user;
    const profileName = user && user.name ? escapeHTML(user.name) : user ? "Your account" : "Guest profile";
    const profileIdentifier = user ? escapeHTML(user.identifier) : "You’re browsing as a guest";
    const avatarText = user ? escapeHTML((user.name || user.identifier).charAt(0).toUpperCase()) : ic.user;
    screenEls.profile.innerHTML = `<div class="scroll has-tabs">
      <div class="profile-head"><div class="avatar">${avatarText}</div><h1>${profileName}</h1>
      <p class="muted">${profileIdentifier}</p></div>
      ${user ? `<button class="btn secondary signout" data-act="logout">Log out</button>` : `<button class="btn signout" data-act="login">Log in</button>`}
      <div class="menu">
        <button class="menu-item" data-act="tab" data-t="orders"><span class="ic">${ic.orders}</span><div><b>Order history</b><span>${state.orders.length} order${state.orders.length === 1 ? "" : "s"}</span></div>${ic.chev.replace('class="i"', 'class="i go"')}</button>
        <button class="menu-item" data-act="favs"><span class="ic">${ic.heart}</span><div><b>Favorites</b><span>${state.fav.size} saved drink${state.fav.size === 1 ? "" : "s"} and treats</span></div>${ic.chev.replace('class="i"', 'class="i go"')}</button>
        <button class="menu-item" data-act="contact"><span class="ic">${ic.chat}</span><div><b>Contact Us</b><span>We're here to help</span></div>${ic.chev.replace('class="i"', 'class="i go"')}</button>
        <button class="menu-item" data-act="reset"><span class="ic">${ic.reset}</span><div><b>Reset demo data</b><span>Clear cart, orders and favorites</span></div></button>
      </div></div>`;
  },

  contact() {
    screenEls.contact.innerHTML = `<div class="scroll"><div class="top"><button class="icon-btn" data-act="back" aria-label="Back">${ic.back}</button><h1>Contact Us</h1></div>
      <div class="stack">
        <p class="desc muted">We're here to help with your order. Reach us any way you like.</p>
        <a class="menu-item" href="tel:+639000000000"><span class="ic">${ic.phone}</span><div><b>Call us</b><span>+63 900 000 0000</span></div></a>
        <a class="menu-item" href="mailto:support@brewgo.app"><span class="ic">${ic.mail}</span><div><b>Email</b><span>support@brewgo.app</span></div></a>
        <div class="menu-item"><span class="ic">${ic.chat}</span><div><b>Live chat</b><span>Daily, 8am to 10pm</span></div></div>
        <h2>Send us a message</h2>
        <form id="contact-form" class="stack" novalidate style="gap:12px">
          <input class="field" id="c-name" placeholder="Your name" autocomplete="name" aria-label="Your name">
          <p class="err" id="e-name"></p>
          <textarea class="field" id="c-msg" rows="4" placeholder="How can we help?" aria-label="Message"></textarea>
          <p class="err" id="e-msg"></p>
          <button class="btn" type="submit">Send message</button>
        </form>
      </div></div>`;
    $("#contact-form").addEventListener("submit", e => {
      e.preventDefault();
      const n = $("#c-name"), m = $("#c-msg");
      const okN = n.value.trim().length >= 2, okM = m.value.trim().length >= 5;
      n.classList.toggle("bad", !okN); m.classList.toggle("bad", !okM);
      $("#e-name").textContent = okN ? "" : "Please enter your name."; $("#e-msg").textContent = okM ? "" : "Please write a short message.";
      if (okN && okM) { toast("Message sent. We'll reply soon."); n.value = ""; m.value = ""; }
    });
  }
};

function renderGrid() {
  const grid = $("#grid"); if (!grid) return;
  const q = state.q.trim().toLowerCase();
  const list = PRODUCTS.filter(p => (state.cat === "All" || p.cats.includes(state.cat)) && (!q || p.name.toLowerCase().includes(q)));
  $("#grid-title").textContent = q ? `Results for "${state.q.trim()}"` : state.cat === "All" ? "Popular now" : state.cat === "Iced" ? "Iced drinks" : state.cat === "Hot" ? "Hot drinks" : state.cat === "Tea" ? "Tea" : "Food";
  grid.innerHTML = list.length ? list.map((p, i) => {
    const fav = state.fav.has(p.id);
    return `<article class="card" style="--i:${i}" data-act="open" data-id="${p.id}" tabindex="0" role="button" aria-label="${p.name}, ${peso(p.price)}">
      <div class="card-art">${productPhoto(p.id)}<span class="rating">${ic.star}${p.rating}</span>
        <button class="fav${fav ? " on" : ""}" data-act="fav" data-id="${p.id}" aria-pressed="${fav}" aria-label="Favorite ${p.name}">${ic.heart}</button></div>
      <h4>${p.name}</h4>
      <div class="card-row"><b>${peso(p.price)}</b><button class="add" data-act="quick" data-id="${p.id}" aria-label="Quick add ${p.name}">${ic.plus}</button></div></article>`;
  }).join("") : `<div class="empty no-results"><div class="empty-art">${ic.search}</div><h2>Nothing found</h2><p>Try another word or category.</p></div>`;
}

/* ============================================================
   Actions (event delegation)
   ============================================================ */
const ACTIONS = {
  back,
  open({ id }) { state.detail = { id, size: "M", milk: "Whole", shot: false, qty: 1 }; go("detail"); },
  cart() { go("checkout"); },
  tab({ t }) { t === "cart" ? go("checkout") : go(t, "fade"); },
  menu() { state.cat = "All"; state.q = ""; go("home", "fade"); },
  home() { go("home", "fade"); },
  all() { state.cat = "All"; state.q = ""; const q = $("#q"); if (q) q.value = ""; $$(".chip[data-c]").forEach(c => { const on = c.dataset.c === "All"; c.classList.toggle("is-active", on); c.setAttribute("aria-pressed", on); }); renderGrid(); },
  cat({ c }) {
    state.cat = c;
    $$(".chip[data-c]").forEach(b => { const on = b.dataset.c === c; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on); });
    renderGrid();
  },
  fav({ id }, e) {
    e.stopPropagation();
    state.fav.has(id) ? state.fav.delete(id) : state.fav.add(id); save();
    const on = state.fav.has(id);
    $$(`.fav[data-id="${id}"]`).forEach(b => { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); b.classList.remove("pulse"); void b.offsetWidth; b.classList.add("pulse"); });
    if (on) toast("Added to favorites");
  },
  favs() { state.cat = "All"; state.q = ""; toast(state.fav.size ? `${state.fav.size} favorite${state.fav.size === 1 ? "" : "s"} saved` : "Tap the heart on a product to save it"); },
  quick({ id }, e) {
    e.stopPropagation();
    const p = byId(id);
    addToCart({ id, size: "M", milk: "Whole", shot: false, qty: 1, unit: unitPrice(p, "M", false) });
    toast(`${p.name} added to cart`);
  },
  size({ k }) { state.detail.size = k; RENDER.detail(); },
  milk({ m }) { state.detail.milk = m; RENDER.detail(); },
  shot() { state.detail.shot = !state.detail.shot; RENDER.detail(); },
  dq({ d }) { state.detail.qty = Math.min(20, Math.max(1, state.detail.qty + Number(d))); RENDER.detail(); },
  add() {
    const d = state.detail, p = byId(d.id);
    addToCart({ id: d.id, size: d.size, milk: d.milk, shot: d.shot, qty: d.qty, unit: unitPrice(p, d.size, d.shot) });
    toast(`${p.name} added to cart`);
    go("checkout");
  },
  ci({ key, d }) {
    const i = state.cart.find(x => x.key === key); if (!i) return;
    i.qty += Number(d);
    if (i.qty <= 0) state.cart = state.cart.filter(x => x !== i);
    save(); updateBadges(); RENDER.checkout();
  },
  fulfil({ k }) { state.fulfil = k; RENDER.checkout(); },
  pay({ k }) { state.pay = k; RENDER.checkout(); },
  contact() { go("contact"); },
  place() {
    if (!state.cart.length) return;
    const t = totals();
    const order = { id: String(1000 + Math.floor(Math.random() * 9000)), ts: Date.now(), items: state.cart.map(({ id, size, milk, shot, qty, unit }) => ({ id, size, milk, shot, qty, unit })), fulfil: state.fulfil, pay: state.pay, total: t.total };
    state.orders.unshift(order); state.lastOrder = order; state.cart = []; save(); updateBadges();
    go("confirm", "fade");
  },
  track() { go("orders", "fade"); },
  start() { state.authMode = "login"; state.authNotice = ""; go("login", "fade"); },
  login() { state.authMode = "login"; go("login"); },
  "auth-mode"({ mode }) { state.authMode = mode === "signup" ? "signup" : "login"; state.authNotice = ""; RENDER.login(); },
  logout() { state.user = null; state.authMode = "login"; store.set("user", null); go("login", "fade"); },
  reset() { const accounts = store.get("accounts", []); store.clear(); store.set("accounts", accounts); store.set("user", state.user); state.cart = []; state.orders = []; state.fav = new Set(); state.lastOrder = null; updateBadges(); RENDER.profile(); toast("Demo data cleared"); }
};
app.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (el && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el.dataset, e);
});
app.addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches('.card[role="button"]')) { e.preventDefault(); e.target.click(); }
});

/* ============================================================
   Boot
   ============================================================ */
renderTabs(); updateBadges();
history.replaceState({ n: 1 }, "");
stack = ["splash"];
RENDER.splash(); setState(screenEls.splash, "active");
Object.keys(screenEls).forEach(k => { if (k !== stack[0]) screenEls[k].inert = true; });
