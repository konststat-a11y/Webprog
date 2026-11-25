'use strict';

// Дані та порядок елементів точно відповідають зображенню завдання.
const hierarchy = [
  {
    name: 'fruits',
    children: ['apple', 'pineapple;', 'apricot;', 'pear;', 'lemon;']
  },
  {
    name: 'vegetables',
    children: ['potatoes;', 'beetroot;', 'carrots;', 'pear;']
  }
];

// Змінюємо лише підсписок натиснутого розділу.
function toggleBranch(event, link, list) {
  event.preventDefault();
  list.hidden = !list.hidden;
  link.setAttribute('aria-expanded', String(!list.hidden));
}

function createTree(data) {
  const tree = document.createElement('ul');
  tree.className = 'hierarchy';
  tree.setAttribute('aria-label', 'Категорії продуктів');

  data.forEach(function (category, index) {
    const branch = document.createElement('li');
    const link = document.createElement('a');
    const list = document.createElement('ul');

    list.id = 'branch-' + index;
    link.href = '#' + list.id;
    link.textContent = category.name;
    link.setAttribute('aria-controls', list.id);
    link.setAttribute('aria-expanded', 'true');

    category.children.forEach(function (name) {
      const item = document.createElement('li');
      item.textContent = name;
      list.appendChild(item);
    });

    // Enter активує посилання стандартним способом, як і клік мишею.
    link.addEventListener('click', function (event) {
      toggleBranch(event, link, list);
    });

    branch.appendChild(link);
    branch.appendChild(list);
    tree.appendChild(branch);
  });

  return tree;
}

document.querySelector('#hierarchy').appendChild(createTree(hierarchy));
