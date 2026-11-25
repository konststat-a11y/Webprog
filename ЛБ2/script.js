'use strict';

const doctors = {
  olena: { name: 'Олена Коваль', services: ['family', 'ultrasound'] },
  andrii: { name: 'Андрій Мельник', services: ['cardiology'] },
  mariia: { name: 'Марія Бондар', services: ['pediatrics'] }
};
const form = document.querySelector('#appointment-form');
const serviceSelect = document.querySelector('#service');
const doctorSelect = document.querySelector('#doctor');
const dateInput = document.querySelector('#visit-date');
const nameInput = document.querySelector('#patient-name');
const phoneInput = document.querySelector('#patient-phone');
const result = document.querySelector('#booking-result');

// Локальна дата: UTC може дати інший календарний день біля опівночі.
function localDateString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
dateInput.min = localDateString();
window.addEventListener('focus', () => { dateInput.min = localDateString(); });

function updateDoctors(preferredDoctor = '') {
  doctorSelect.replaceChildren(new Option(serviceSelect.value ? 'Оберіть лікаря' : 'Спочатку оберіть напрямок', ''));
  Object.entries(doctors).forEach(([id, doctor]) => {
    if (doctor.services.includes(serviceSelect.value)) doctorSelect.add(new Option(doctor.name, id));
  });
  if (Array.from(doctorSelect.options).some(option => option.value === preferredDoctor)) doctorSelect.value = preferredDoctor;
  result.hidden = true;
}
serviceSelect.addEventListener('change', () => updateDoctors());
document.querySelectorAll('[data-service]').forEach(link => {
  link.addEventListener('click', () => {
    serviceSelect.value = link.dataset.service;
    updateDoctors();
  });
});
document.querySelectorAll('[data-doctor]').forEach(button => {
  button.addEventListener('click', () => {
    const id = button.dataset.doctor;
    serviceSelect.value = doctors[id].services[0];
    updateDoctors(id);
    document.querySelector('#appointment').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    doctorSelect.focus({ preventScroll: true });
  });
});

// Перевіряємо зміст додатково до вбудованих HTML required/pattern/min.
function validateName() {
  nameInput.setCustomValidity(nameInput.value.trim() ? '' : 'Введіть ваше ім’я.');
}
function validatePhone() {
  const digits = phoneInput.value.replace(/\D/g, '');
  phoneInput.setCustomValidity(digits.length >= 10 && digits.length <= 15 ? '' : 'Телефон має містити від 10 до 15 цифр.');
}
nameInput.addEventListener('input', validateName);
phoneInput.addEventListener('input', validatePhone);
form.addEventListener('input', () => { result.hidden = true; });
form.addEventListener('submit', event => {
  event.preventDefault();
  dateInput.min = localDateString();
  validateName();
  validatePhone();
  if (!form.reportValidity()) return;
  const date = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'long' }).format(new Date(`${dateInput.value}T12:00:00`));
  // textContent не інтерпретує введений користувачем текст як HTML.
  result.textContent = `${nameInput.value.trim()}, форму заповнено правильно. ${doctors[doctorSelect.value].name}, бажана дата: ${date}; це демонстрація: запис не створено, дані нікуди не надіслано.`;
  result.hidden = false;
});

// Згортаємо мобільне меню після переходу до секції.
const nav = document.querySelector('#main-nav');
nav.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', () => {
    if (nav.classList.contains('show') && window.bootstrap) bootstrap.Collapse.getOrCreateInstance(nav).hide();
  });
});

// Без JavaScript форма залишається видимою, але не передає персональні дані через GET.
form.querySelector('[type="submit"]').disabled = false;
