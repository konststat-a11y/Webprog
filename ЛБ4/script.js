'use strict';

// Дані каталогу завантажуються тільки з JSON, без дублювання в JavaScript.
const state = { doctors: [], services: [], bookings: [], pending: null, chatService: null, storageAvailable: true };
const storageKey = 'linia-lab4-bookings-v1';
const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', maximumFractionDigits: 0 }).format(value);
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const dayLabels = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П’ятниця', 'Субота'];
const form = $('#appointment-form');
const doctorSelect = $('#doctor');
const serviceSelect = $('#service');
const dateInput = $('#visit-date');
const timeSelect = $('#visit-time');
const doctorModal = new bootstrap.Modal($('#doctor-modal'));
const confirmationModal = new bootstrap.Modal($('#confirm-modal'));

function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDay(date) === value ? date : null;
}
function formatDay(value) {
  return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'long' }).format(parseDay(value));
}
function normalizeTime(time) { return time.padStart(5, '0'); }
function doctorById(id) { return state.doctors.find(doctor => doctor.id === Number(id)); }
function serviceById(id) { return state.services.find(service => service.id === Number(id)); }

// Перевіряємо схему перед побудовою DOM, щоб помилки JSON були зрозумілими.
function validateData(doctors, services) {
  if (!Array.isArray(doctors) || !Array.isArray(services)) throw new Error('Очікуються масиви JSON.');
  const ids = new Set();
  for (const doctor of doctors) {
    if (!doctor || !Number.isInteger(doctor.id) || doctor.id < 1 || ids.has(doctor.id) ||
        !doctor.name || typeof doctor.name !== 'string' || !doctor.specialty || typeof doctor.specialty !== 'string' ||
        !Number.isInteger(doctor.experience) || doctor.experience < 0 ||
        typeof doctor.education !== 'string' || !Array.isArray(doctor.languages) ||
        !doctor.languages.every(language => typeof language === 'string') ||
        !/^assets\/[a-z0-9-]+\.jpg$/.test(doctor.photo) || !doctor.schedule || typeof doctor.schedule !== 'object' || Array.isArray(doctor.schedule)) {
      throw new Error('Некоректні поля лікаря в doctors.json.');
    }
    ids.add(doctor.id);
    for (const [day, times] of Object.entries(doctor.schedule)) {
      if (!weekdays.includes(day) || !Array.isArray(times) || !times.every(time => typeof time === 'string' && /^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(time))) {
        throw new Error('Некоректний розклад у doctors.json.');
      }
    }
  }
  const serviceIds = new Set();
  for (const service of services) {
    if (!service || !Number.isInteger(service.id) || service.id < 1 || serviceIds.has(service.id) ||
        typeof service.name !== 'string' || !service.name || typeof service.category !== 'string' ||
        !Number.isSafeInteger(service.price) || service.price < 0 || !Array.isArray(service.doctorIds) ||
        !service.doctorIds.length || !service.doctorIds.every(id => ids.has(id))) {
      throw new Error('Некоректні поля або зв’язки послуги в services.json.');
    }
    serviceIds.add(service.id);
  }
}

async function fetchJSON(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(path, { signal: controller.signal });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    try { return await response.json(); }
    catch { throw new Error(`${path}: некоректний синтаксис JSON.`); }
  } finally { clearTimeout(timer); }
}

async function loadData() {
  $('#data-status').hidden = false;
  $('#data-status').className = 'alert alert-info';
  $('#data-status').textContent = 'Завантажуємо лікарів і послуги…';
  $('#retry-load').hidden = true;
  $('#specialty-filter').disabled = true;
  $('#booking-fields').disabled = true;
  $('#chat-topic').disabled = true;
  $('#chat-send').disabled = true;
  $('#doctors-list').setAttribute('aria-busy', 'true');
  $('#calculator-services').setAttribute('aria-busy', 'true');
  try {
    const [doctors, services] = await Promise.all([fetchJSON('doctors.json'), fetchJSON('services.json')]);
    validateData(doctors, services);
    state.doctors = doctors;
    state.services = services;
    const filter = $('#specialty-filter');
    filter.replaceChildren(new Option('Усі спеціальності', ''));
    [...new Set(doctors.map(doctor => doctor.specialty))].forEach(specialty => filter.add(new Option(specialty, specialty)));
    filter.disabled = !doctors.length;
    renderDoctors();
    renderCalculator();
    doctorSelect.replaceChildren(new Option('Оберіть лікаря', ''));
    doctors.forEach(doctor => doctorSelect.add(new Option(`${doctor.name} — ${doctor.specialty}`, doctor.id)));
    dateInput.min = localDay();
    updateServices();
    updateTimes();
    const ready = doctors.length > 0 && services.length > 0;
    $('#booking-fields').disabled = !ready;
    $('#chat-topic').disabled = !ready;
    $('#chat-send').disabled = !ready;
    $('#data-status').hidden = ready;
    if (!ready) $('#data-status').textContent = 'Каталог порожній або немає послуг. Додайте дані до JSON, щоб увімкнути запис.';
  } catch (error) {
    $('#data-status').className = 'alert alert-danger';
    $('#data-status').textContent = location.protocol === 'file:'
      ? 'JSON не можна завантажити через file://. Запустіть сайт через Live Server у VS Code або GitHub Pages. Інструкція — README.md.'
      : `Не вдалося завантажити каталог. ${error.name === 'AbortError' ? 'Час очікування вичерпано.' : error.message} Перевірте JSON і повторіть спробу.`;
    $('#retry-load').hidden = false;
  } finally {
    $('#doctors-list').setAttribute('aria-busy', 'false');
    $('#calculator-services').setAttribute('aria-busy', 'false');
  }
}

function renderDoctors() {
  const specialty = $('#specialty-filter').value;
  const doctors = state.doctors.filter(doctor => !specialty || doctor.specialty === specialty);
  $('#catalog-count').textContent = `Знайдено лікарів: ${doctors.length}`;
  $('#doctors-list').innerHTML = doctors.length ? doctors.map(doctor => `
    <div class="col-md-4"><article class="card doctor-card h-100">
      <div class="doctor-image"><img src="${escapeHTML(doctor.photo)}" width="600" height="650" alt="Ілюстративний портрет: ${escapeHTML(doctor.specialty)}" loading="lazy"><span class="experience">Досвід: ${doctor.experience} р. (приклад)</span></div>
      <div class="card-body"><p class="doctor-specialty">${escapeHTML(doctor.specialty)}</p><h3 class="card-title">${escapeHTML(doctor.name)}</h3><p class="card-text">${escapeHTML(doctor.education)}</p>
        <div class="d-grid gap-2 mt-auto"><button type="button" class="btn btn-outline-primary" data-details="${doctor.id}">Детальніше<span class="visually-hidden">: ${escapeHTML(doctor.name)}</span></button><button type="button" class="btn btn-primary" data-book="${doctor.id}">Записатися<span class="visually-hidden">: ${escapeHTML(doctor.name)}</span></button></div>
      </div></article></div>`).join('') : '<p class="text-secondary">За цим фільтром лікарів немає.</p>';
}

function showDoctor(id) {
  const doctor = doctorById(id);
  if (!doctor) return;
  $('#doctor-modal-title').textContent = doctor.name;
  $('#doctor-modal-body').innerHTML = `<div class="row g-4"><div class="col-sm-4"><img class="modal-portrait" src="${escapeHTML(doctor.photo)}" alt="Ілюстративний портрет лікаря"></div><div class="col-sm-8"><p class="doctor-specialty">${escapeHTML(doctor.specialty)}</p><dl><dt>Досвід</dt><dd>${doctor.experience} років (навчальні дані)</dd><dt>Освіта</dt><dd>${escapeHTML(doctor.education)}</dd><dt>Мови спілкування</dt><dd>${doctor.languages.map(escapeHTML).join(', ')}</dd></dl></div></div><h3 class="mt-4">Тижневий розклад</h3><ul class="weekly-schedule">${weekdays.map((day, index) => doctor.schedule[day]?.length ? `<li><strong>${dayLabels[index]}:</strong> ${doctor.schedule[day].map(escapeHTML).join(', ')}</li>` : '').join('') || '<li>Годин прийому поки немає.</li>'}</ul>`;
  $('#modal-book').dataset.doctor = doctor.id;
  doctorModal.show();
}

// localStorage містить лише ID лікаря, дату та час, без ПІБ/телефону/e-mail.
function readBookings() {
  if (!state.storageAvailable) return state.bookings;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(saved)) throw new Error('Invalid storage');
    state.bookings = saved.filter(item => item && Number.isInteger(item.doctorId) && parseDay(item.date) && /^\d{2}:\d{2}$/.test(item.time));
    $('#storage-status').textContent = '';
  } catch {
    state.storageAvailable = false;
    $('#storage-status').textContent = 'Сховище недоступне або пошкоджене: тестові записи зберігаються лише до перезавантаження.';
  }
  return state.bookings;
}
function availableTimes(doctorId, day) {
  const doctor = doctorById(doctorId);
  const date = parseDay(day);
  if (!doctor || !date || day < localDay()) return [];
  const bookings = readBookings();
  return [...new Set((doctor.schedule[weekdays[date.getDay()]] || []).map(normalizeTime))]
    .filter(time => new Date(`${day}T${time}:00`).getTime() > Date.now())
    .filter(time => !bookings.some(booking => booking.doctorId === doctor.id && booking.date === day && booking.time === time))
    .sort();
}
function updateServices(preferred = '') {
  const id = Number(doctorSelect.value);
  const services = state.services.filter(service => service.doctorIds.includes(id));
  serviceSelect.replaceChildren(new Option(id ? 'Оберіть послугу' : 'Спочатку оберіть лікаря', ''));
  services.forEach(service => serviceSelect.add(new Option(`${service.name} — ${money(service.price)}`, service.id)));
  if (services.some(service => String(service.id) === String(preferred))) serviceSelect.value = String(preferred);
}
function updateTimes() {
  dateInput.min = localDay();
  const previous = timeSelect.value;
  const times = availableTimes(doctorSelect.value, dateInput.value);
  timeSelect.replaceChildren(new Option(times.length ? 'Оберіть час' : 'Немає доступного часу', ''));
  times.forEach(time => timeSelect.add(new Option(time, time)));
  if (times.includes(previous)) timeSelect.value = previous;
  $('#schedule-status').textContent = !doctorSelect.value || !dateInput.value
    ? 'Оберіть лікаря та дату, щоб побачити вільні години.'
    : times.length ? `Вільних годин: ${times.length}. Час указано за локальним часом браузера.`
      : 'Цього дня вільних годин немає. Оберіть іншу дату: прийом міг закінчитися, бути зайнятим або не передбачений розкладом.';
}
function chooseDoctor(id, preferredService = '') {
  if (!doctorById(id)) return;
  doctorSelect.value = String(id);
  updateServices(preferredService);
  // Пропонуємо найближчий вільний день, але користувач може змінити дату вручну.
  const date = new Date();
  dateInput.value = '';
  for (let offset = 0; offset < 60; offset++) {
    const day = localDay(date);
    if (availableTimes(id, day).length) { dateInput.value = day; break; }
    date.setDate(date.getDate() + 1);
  }
  updateTimes();
  clearErrors();
  $('#booking-result').hidden = true;
  $('#appointment').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

function setError(id, message) {
  const field = $('#' + id);
  field.classList.toggle('is-invalid', Boolean(message));
  field.setAttribute('aria-invalid', String(Boolean(message)));
  field.setAttribute('aria-describedby', `${id}-error`);
  $('#' + id + '-error').textContent = message;
}
function clearErrors() {
  form.querySelectorAll('input, select').forEach(field => setError(field.id, ''));
}
function validateBooking() {
  clearErrors();
  const doctor = doctorById(doctorSelect.value);
  const service = serviceById(serviceSelect.value);
  const name = $('#patient-name').value.trim().replace(/\s+/g, ' ');
  const phone = $('#patient-phone').value.trim();
  const nameParts = name.split(' ');
  const validName = nameParts.length >= 3 && nameParts.every(part => /^[\p{L}][\p{L}'’ʼ-]*[\p{L}]$/u.test(part));
  if (!doctor) setError('doctor', 'Оберіть лікаря.');
  if (!service || !service.doctorIds.includes(doctor?.id)) setError('service', 'Оберіть послугу цього лікаря.');
  if (!parseDay(dateInput.value) || dateInput.value < localDay()) setError('visit-date', 'Оберіть сьогоднішню або майбутню дату.');
  if (!availableTimes(doctorSelect.value, dateInput.value).includes(timeSelect.value)) setError('visit-time', 'Оберіть вільний час із розкладу.');
  if (!validName) setError('patient-name', 'Введіть прізвище, ім’я та по батькові: щонайменше 3 слова з літер, апострофів або дефісів.');
  if (!/^\+380\d{9}$/.test(phone)) setError('patient-phone', 'Формат телефону: +380 та 9 цифр без пробілів, наприклад +380671234567.');
  if (!$('#patient-email').validity.valid) setError('patient-email', 'Перевірте формат e-mail.');
  if (!$('#demo-consent').checked) setError('demo-consent', 'Підтвердьте, що розумієте навчальний характер запису.');
  const firstInvalid = form.querySelector('.is-invalid');
  if (firstInvalid) { firstInvalid.focus(); return null; }
  return { doctorId: doctor.id, serviceId: service.id, date: dateInput.value, time: timeSelect.value, name, phone };
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const booking = validateBooking();
  if (!booking) return;
  state.pending = booking;
  const doctor = doctorById(booking.doctorId);
  const service = serviceById(booking.serviceId);
  const summary = $('#confirmation-summary');
  summary.replaceChildren();
  for (const line of [booking.name, booking.phone, doctor.name, service.name, `${formatDay(booking.date)}, ${booking.time}`, `Вартість: ${money(service.price)}`]) {
    const paragraph = document.createElement('p');
    paragraph.textContent = line;
    summary.appendChild(paragraph);
  }
  $('#confirmation-error').hidden = true;
  $('#confirm-booking').disabled = false;
  confirmationModal.show();
});

$('#confirm-booking').addEventListener('click', () => {
  const booking = state.pending;
  if (!booking) return;
  // Повторно перевіряємо слот: він міг застаріти після відкриття модального вікна.
  if (!availableTimes(booking.doctorId, booking.date).includes(booking.time)) {
    $('#confirmation-error').textContent = 'Цей час уже недоступний. Закрийте вікно й оберіть інший слот.';
    $('#confirmation-error').hidden = false;
    $('#confirm-booking').disabled = true;
    updateTimes();
    return;
  }
  $('#confirm-booking').disabled = true;
  state.bookings.push({ doctorId: booking.doctorId, date: booking.date, time: booking.time });
  try { localStorage.setItem(storageKey, JSON.stringify(state.bookings)); }
  catch { state.storageAvailable = false; $('#storage-status').textContent = 'Запис збережено лише до перезавантаження: сховище браузера недоступне.'; }
  $('#booking-result').textContent = `Навчальний запис підтверджено: ${doctorById(booking.doctorId).name}, ${formatDay(booking.date)}, ${booking.time}. Слот позначено зайнятим у цьому браузері. Реального запису до клініки не створено.`;
  $('#booking-result').hidden = false;
  state.pending = null;
  updateTimes();
  confirmationModal.hide();
});

function renderCalculator() {
  $('#calculator-services').innerHTML = state.services.length ? state.services.map(service => `<label class="calculator-option" for="calc-${service.id}"><input class="form-check-input" type="checkbox" id="calc-${service.id}" value="${service.id}"><span>${escapeHTML(service.name)}</span><strong>${money(service.price)}</strong></label>`).join('') : '<p>Послуг поки немає.</p>';
  updateCalculation();
}
function updateCalculation() {
  const ids = Array.from(document.querySelectorAll('#calculator-services input:checked')).map(input => Number(input.value));
  const services = state.services.filter(service => ids.includes(service.id));
  const total = services.reduce((sum, service) => sum + service.price, 0);
  $('#calculator-total').textContent = money(total);
  $('#calculator-count').textContent = `Обрано послуг: ${services.length}`;
  $('#print-calculation').disabled = !services.length;
  $('#clear-calculation').disabled = !services.length;
  $('#print-items').innerHTML = '<ul>' + services.map(service => `<li>${escapeHTML(service.name)} — ${money(service.price)}</li>`).join('') + '</ul>';
  $('#print-total').textContent = `Разом: ${money(total)}`;
}

$('#chat-form').addEventListener('submit', event => {
  event.preventDefault();
  const topic = $('#chat-topic');
  if (!topic.value) { topic.reportValidity(); return; }
  const service = state.services.find(item => item.category === topic.value);
  const doctor = service && doctorById(service.doctorIds[0]);
  state.chatService = service || null;
  const log = $('#chat-log');
  // Зберігаємо лише останній обмін, щоб панель не зростала без обмежень.
  log.replaceChildren();
  const question = document.createElement('p');
  question.className = 'chat-bubble chat-user';
  question.textContent = topic.selectedOptions[0].textContent;
  const response = document.createElement('p');
  response.className = 'chat-bubble';
  response.textContent = doctor ? `Для цієї теми можна почати з напрямку «${doctor.specialty}». У нашому каталозі: ${doctor.name}. Можете обрати зручний час у формі. Це навігаційна підказка, а не медичний висновок.` : 'Для цієї теми зараз немає фахівця в каталозі.';
  log.append(question, response);
  $('#chat-book').hidden = !doctor;
});
$('#chat-book').addEventListener('click', () => {
  const service = state.chatService;
  if (service) chooseDoctor(service.doctorIds[0], service.id);
});

// Делегування працює і для карток, створених або перемальованих після fetch.
$('#doctors-list').addEventListener('click', event => {
  const details = event.target.closest('[data-details]');
  const book = event.target.closest('[data-book]');
  if (details) showDoctor(details.dataset.details);
  if (book) chooseDoctor(book.dataset.book);
});
$('#modal-book').addEventListener('click', () => {
  const id = $('#modal-book').dataset.doctor;
  $('#doctor-modal').addEventListener('hidden.bs.modal', () => chooseDoctor(id), { once: true });
  doctorModal.hide();
});
$('#confirm-modal').addEventListener('hidden.bs.modal', () => { state.pending = null; });
$('#specialty-filter').addEventListener('change', renderDoctors);
$('#retry-load').addEventListener('click', loadData);
doctorSelect.addEventListener('change', () => { updateServices(); timeSelect.value = ''; updateTimes(); clearErrors(); });
dateInput.addEventListener('change', () => { timeSelect.value = ''; updateTimes(); });
form.addEventListener('input', event => {
  $('#booking-result').hidden = true;
  if (event.target.id && $('#' + event.target.id + '-error')) setError(event.target.id, '');
});
$('#clear-bookings').addEventListener('click', () => {
  state.bookings = [];
  try { localStorage.removeItem(storageKey); } catch { /* Пам’ять вкладки все одно очищена. */ }
  updateTimes();
  $('#booking-result').textContent = 'Тестові записи очищено. Доступний час оновлено.';
  $('#booking-result').hidden = false;
});
window.addEventListener('storage', event => { if (event.key === storageKey) updateTimes(); });
window.addEventListener('focus', () => { if (state.doctors.length) updateTimes(); });
$('#calculator-services').addEventListener('change', updateCalculation);
$('#clear-calculation').addEventListener('click', () => {
  document.querySelectorAll('#calculator-services input').forEach(input => { input.checked = false; });
  updateCalculation();
});
$('#print-calculation').addEventListener('click', () => window.print());
document.querySelectorAll('[data-service]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  const service = state.services.find(item => item.category === link.dataset.service);
  if (service) chooseDoctor(service.doctorIds[0], service.id);
  else $('#doctors').scrollIntoView();
}));
const nav = $('#main-nav');
nav.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', () => {
  if (nav.classList.contains('show')) bootstrap.Collapse.getOrCreateInstance(nav).hide();
}));

loadData();
