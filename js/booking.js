/* =====================================================================
   KRAKEN CODE — BOOKING UI LOGIC (client side)
   Talks to /api/book (Vercel function). Set window.BOOKING_API_URL before
   this script if the API lives on another origin.
   ===================================================================== */
(function () {
  const API = window.BOOKING_API_URL || '/api/book';
  const TZ = 'Asia/Karachi';
  const CLOSED_WEEKDAYS = [0];           // Sunday
  const MIN_LEAD_HOURS = 2;
  const MAX_AHEAD_DAYS = 60;
  const SLOT_START = 9 * 60, SLOT_END = 18 * 60, SLOT_MIN = 30;

  const $ = (id) => document.getElementById(id);
  const form = $('bookingForm');
  if (!form) return;

  const els = {
    services: $('bkServices'), date: $('bkDate'), slots: $('bkSlots'),
    name: $('bkName'), email: $('bkEmail'), phone: $('bkPhone'), company: $('bkCompany'),
    notes: $('bkNotes'), hp: $('bkWebsite'), error: $('bkError'), submit: $('bkSubmit'),
    success: $('bkSuccess'), ref: $('bkRef'), again: $('bkAgain'),
  };

  const state = { service: null, date: null, time: null };

  /* ---------- PKT helpers ---------- */
  function pkParts(ts) {
    const p = {};
    for (const { type, value } of new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(ts))) p[type] = value;
    return { y: +p.year, mo: +p.month, d: +p.day, h: p.hour === '24' ? 0 : +p.hour, mi: +p.minute };
  }
  const pad = (n) => String(n).padStart(2, '0');
  function pkToday() { const p = pkParts(Date.now()); return `${p.y}-${pad(p.mo)}-${pad(p.d)}`; }
  function addDays(dateStr, n) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  }
  function weekdayOf(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); }
  function slotList() {
    const out = [];
    for (let m = SLOT_START; m + SLOT_MIN <= SLOT_END; m += SLOT_MIN) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
    return out;
  }
  function slotIsPast(dateStr, time) {
    // wall time in PKT → epoch (iterative offset solve)
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [h, mi] = time.split(':').map(Number);
    const target = Date.UTC(y, mo - 1, d, h, mi, 0);
    let ts = target;
    for (let i = 0; i < 3; i++) {
      const p = pkParts(ts);
      ts += target - Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, 0);
    }
    return ts < Date.now() + MIN_LEAD_HOURS * 3600 * 1000;
  }

  /* ---------- step 1: services ---------- */
  els.services.addEventListener('click', (e) => {
    const btn = e.target.closest('.bk-service');
    if (!btn) return;
    els.services.querySelectorAll('.bk-service').forEach(b => b.classList.toggle('selected', b === btn));
    state.service = btn.dataset.slug;
    hideError();
  });

  /* ---------- step 2: date + slots ---------- */
  els.date.min = pkToday();
  els.date.max = addDays(pkToday(), MAX_AHEAD_DAYS);
  els.date.addEventListener('change', () => {
    state.date = els.date.value;
    state.time = null;
    if (!state.date) return;
    if (CLOSED_WEEKDAYS.includes(weekdayOf(state.date))) {
      els.slots.innerHTML = '<div class="bk-slots-hint bk-closed">We’re closed on Sundays — please pick another day. 🙏</div>';
      return;
    }
    els.slots.innerHTML = '<div class="bk-slots-hint">Checking availability…</div>';
    fetch(`${API}?date=${state.date}`)
      .then(r => r.json())
      .then(data => renderSlots(data.booked || [], data.past || []))
      .catch(() => renderSlots([], []));   // server re-validates on submit
    hideError();
  });

  function renderSlots(booked, past) {
    els.slots.innerHTML = '';
    slotList().forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bk-slot';
      b.textContent = t;
      const taken = booked.includes(t) || past.includes(t) || slotIsPast(state.date, t);
      if (taken) { b.disabled = true; b.classList.add('taken'); b.title = booked.includes(t) ? 'Already booked' : 'Unavailable'; }
      b.addEventListener('click', () => {
        els.slots.querySelectorAll('.bk-slot').forEach(x => x.classList.toggle('selected', x === b));
        state.time = t;
        hideError();
      });
      els.slots.appendChild(b);
    });
  }

  /* ---------- errors / submit ---------- */
  function showError(msg) { els.error.textContent = msg; els.error.hidden = false; }
  function hideError() { els.error.hidden = true; }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    if (!state.service) return showError('Please choose a service (step 1).');
    if (!state.date) return showError('Please pick a date (step 2).');
    if (CLOSED_WEEKDAYS.includes(weekdayOf(state.date))) return showError('We’re closed on Sundays — please pick another day.');
    if (!state.time) return showError('Please pick a time slot (step 2).');
    if (els.name.value.trim().length < 2) return showError('Please enter your full name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(els.email.value.trim())) return showError('Please enter a valid email address.');

    els.submit.disabled = true;
    els.submit.querySelector('span').textContent = 'Reserving your slot…';
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: state.service, date: state.date, time: state.time,
          name: els.name.value.trim(), email: els.email.value.trim(),
          phone: els.phone.value.trim(), company: els.company.value.trim(),
          notes: els.notes.value.trim(), website: els.hp.value,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        showError(data.message || 'That slot was just taken — please pick another time.');
        els.date.dispatchEvent(new Event('change'));
        return;
      }
      if (!res.ok || !data.ok) {
        showError((data.errors && data.errors.join(' · ')) || data.message || 'Something went wrong — please try again.');
        return;
      }
      els.ref.textContent = data.ref;
      form.hidden = true;
      els.success.hidden = false;
      els.success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      showError('Network error — please check your connection and try again.');
    } finally {
      els.submit.disabled = false;
      els.submit.querySelector('span').textContent = 'Confirm Appointment';
    }
  });

  els.again.addEventListener('click', () => {
    form.reset();
    form.hidden = false;
    els.success.hidden = true;
    state.service = state.date = state.time = null;
    els.services.querySelectorAll('.bk-service').forEach(b => b.classList.remove('selected'));
    els.slots.innerHTML = '<div class="bk-slots-hint">Select a date to see available slots.</div>';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
