(() => {
  'use strict';

  const root = document.querySelector('.lavka-site');
  if (!root) return;

  const productCards = [...root.querySelectorAll('.lavka-products > article')];
  const categoryButtons = [...root.querySelectorAll('[data-category]')];
  const search = root.querySelector('.lavka-search input');
  const productCount = root.querySelector('[data-product-count]');
  const cartButton = root.querySelector('.lavka-cart');
  const cart = root.querySelector('.lavka-cart-panel');
  const overlay = root.querySelector('.lavka-overlay');
  const cartItems = root.querySelector('[data-cart-items]');
  const cartEmpty = root.querySelector('[data-cart-empty]');
  const cartCount = [...root.querySelectorAll('[data-cart-count]')];
  const cartTotal = root.querySelector('[data-cart-total]');
  const recipeSearch = root.querySelector('.lavka-recipe-search input');
  const recipeCards = [...root.querySelectorAll('.lavka-recipe-grid > article')];
  const recipeNotFound = root.querySelector('.lavka-not-found');
  const storageKey = 'lavka:cart';
  let activeCategory = 'Все';
  let cartIds = [];

  const formatRubles = value => `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
  const normalize = value => value.toLowerCase().replace(/ё/g, 'е').trim();

  const products = productCards.map((card, index) => {
    const id = index + 1;
    const price = Number(card.querySelector(':scope > strong').textContent.match(/\d+/)[0]);
    const product = {
      id,
      name: card.querySelector('h2').textContent.trim(),
      category: card.querySelector(':scope > p').textContent.trim(),
      price,
      unit: card.querySelector('small').textContent.trim(),
      image: card.querySelector('img').getAttribute('src')
    };
    card.dataset.productId = String(id);
    if (!card.querySelector('[data-add]')) {
      card.insertAdjacentHTML('beforeend', `<button type="button" data-add="${id}" aria-label="Добавить ${product.name}"><span>Купить </span>+</button>`);
    }
    return product;
  });

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) cartIds = saved.filter(id => products.some(product => product.id === id));
  } catch { /* The demo still works when storage is unavailable. */ }

  function saveCart() {
    try { localStorage.setItem(storageKey, JSON.stringify(cartIds)); } catch { /* Optional persistence. */ }
  }

  function renderProducts() {
    const query = normalize(search.value);
    let shown = 0;
    productCards.forEach((card, index) => {
      const product = products[index];
      const matches = (activeCategory === 'Все' || product.category === activeCategory)
        && normalize(product.name).includes(query);
      card.hidden = !matches;
      if (matches) shown += 1;
    });
    productCount.textContent = `${shown} ${shown === 1 ? 'товар' : shown < 5 ? 'товара' : 'товаров'}`;
  }

  function renderCart() {
    const quantities = new Map();
    cartIds.forEach(id => quantities.set(id, (quantities.get(id) || 0) + 1));
    const entries = [...quantities].map(([id, quantity]) => ({ product: products.find(item => item.id === id), quantity }));
    cartItems.replaceChildren();
    entries.forEach(({ product, quantity }) => {
      const item = document.createElement('article');
      item.className = 'lavka-cart-item';
      item.innerHTML = `<img src="${product.image}" alt=""><div><h4>${product.name}</h4><span>${formatRubles(product.price * quantity)} × ${quantity}</span></div><button type="button" data-remove="${product.id}">Удалить</button>`;
      cartItems.append(item);
    });
    const total = cartIds.reduce((sum, id) => sum + products.find(product => product.id === id).price, 0);
    cartCount.forEach(node => { node.textContent = String(cartIds.length); });
    cartTotal.textContent = formatRubles(total);
    cartEmpty.hidden = entries.length > 0;
    saveCart();
  }

  function openCart() {
    overlay.hidden = false;
    cart.classList.add('is-open');
    cart.setAttribute('aria-hidden', 'false');
  }

  function closeCart() {
    overlay.hidden = true;
    cart.classList.remove('is-open');
    cart.setAttribute('aria-hidden', 'true');
  }

  function addProducts(ids) {
    cartIds.push(...ids.filter(id => products.some(product => product.id === id)));
    renderCart();
  }

  function renderRecipes() {
    const query = normalize(recipeSearch.value);
    let shown = 0;
    recipeCards.forEach(card => {
      const matches = !query || normalize(card.dataset.keywords).split(' ').some(word => query.includes(word) || word.includes(query));
      card.hidden = !matches;
      if (matches) shown += 1;
    });
    recipeNotFound.hidden = shown > 0;
  }

  categoryButtons.forEach(button => button.addEventListener('click', () => {
    activeCategory = button.dataset.category;
    categoryButtons.forEach(item => item.classList.toggle('is-active', item === button));
    renderProducts();
  }));

  search.addEventListener('input', renderProducts);
  recipeSearch.addEventListener('input', renderRecipes);
  cartButton.addEventListener('click', openCart);
  root.querySelector('[data-close-cart]').addEventListener('click', closeCart);
  overlay.addEventListener('click', closeCart);
  root.querySelector('[data-checkout]').addEventListener('click', () => {
    if (cartIds.length) window.alert('Оформление в демо-версии не подключено.');
  });
  root.addEventListener('click', event => {
    const add = event.target.closest('[data-add]');
    if (add) addProducts([Number(add.dataset.add)]);
    const recipe = event.target.closest('[data-recipe]');
    if (recipe) addProducts(recipe.dataset.recipe.split(',').map(Number));
    const remove = event.target.closest('[data-remove]');
    if (remove) {
      const index = cartIds.indexOf(Number(remove.dataset.remove));
      if (index >= 0) cartIds.splice(index, 1);
      renderCart();
    }
  });

  renderProducts();
  renderRecipes();
  renderCart();
})();
