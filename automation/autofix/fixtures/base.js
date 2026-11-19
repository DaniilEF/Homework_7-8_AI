/* eslint-disable no-undef */
const rxValid = /^[a-zA-Z0-9\s]{0,40}$/;

// Чистая функция фильтрации по контракту: бросает INVALID_FILTER при недопустимом вводе,
// при пустом запросе возвращает исходный список, иначе — подстрочная фильтрация без учёта регистра
function filterItems(query, items) {
  const rxLocal = /^[a-zA-Z0-9\s]{0,40}$/;
  const q = (query || '').toString();
  if (q === '') return items;
  if (!rxLocal.test(q)) {
    const err = new Error('ValidationError.INVALID_FILTER');
    err.code = 'ValidationError.INVALID_FILTER';
    throw err;
  }
  const lower = q.toLowerCase();
  return (items || []).filter(it => String(it.name || '').toLowerCase().includes(lower));
}
let allItems = [];
