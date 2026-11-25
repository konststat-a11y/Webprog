/* На GitHub Pages немає обробника форми: показуємо результат локально. */
const form = document.querySelector('#user-form');
const result = document.querySelector('#form-result');

form.addEventListener('submit', function (event) {
  event.preventDefault();
  const data = new FormData(form);
  const name = String(data.get('user_name')).trim();
  if (!name) {
    const input = form.elements.namedItem('user_name');
    input.setCustomValidity('Введіть прізвище, ім’я та по батькові.');
    input.reportValidity();
    return;
  }
  result.textContent = 'Форму заповнено правильно. ' +
    'ПІБ: ' + name + '; ' +
    'E-mail: ' + (data.get('user_email') || 'не вказано') + '; ' +
    'Дата народження: ' + data.get('user_birthdate') + '; ' +
    'Стать: ' + data.get('user_sex') + '. Дані не надіслано на сервер.';
  result.hidden = false;
});
form.elements.namedItem('user_name').addEventListener('input', function () {
  this.setCustomValidity('');
});
form.addEventListener('reset', function () {
  form.elements.namedItem('user_name').setCustomValidity('');
  result.hidden = true;
  result.textContent = '';
});
