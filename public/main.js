var swiper = new Swiper(".mySwiper", {
    loop: true,
    navigation: {
        nextEl: "#next",
        prevEl: "#prev",
    },
});

const cartIcon = document.querySelector('.cart-icon');
const cartTab = document.querySelector('.cart-tab');
const closeBtn = document.querySelector('.close-btn');
const cardList = document.querySelector('.card-list');
const cartList = document.querySelector('.cart-list');
const cartTotal = document.querySelector('.cart-total');
const cartValue = document.querySelector('.cart-value');
const hamburger = document.querySelector('.hamburger');
const mobileMenu = document.querySelector('.mobile-menu');
const bars = document.querySelector('.fa-bars');

cartIcon.addEventListener('click', () => cartTab.classList.add('cart-tab-active'));
closeBtn.addEventListener('click', () => cartTab.classList.remove('cart-tab-active'));
hamburger.addEventListener('click', () => mobileMenu.classList.toggle('mobile-menu-active'));
hamburger.addEventListener('click', () => bars.classList.toggle('fa-xmark'));

let productlist = [];
let cartProduct = [];
let currentUser = null;

// ---------- small API helper ----------
async function api(path, method, body) {
    const res = await fetch('/api' + path, {
        method: method || 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Kuch galat ho gaya.');
    return data;
}

// ---------- account button ----------
const accountBtns = document.querySelectorAll('.account-btn');
const signoutBtn = document.querySelector('.signout-btn');

function paintAccount() {
    accountBtns.forEach(btn => {
        const label = btn.querySelector('.account-label');
        label.textContent = currentUser ? currentUser.name.split(' ')[0] : 'Sign in';
    });
    if (signoutBtn) signoutBtn.hidden = !currentUser;
}

accountBtns.forEach(btn => btn.addEventListener('click', e => {
    e.preventDefault();
    currentUser ? openOrders() : openAuth('login');
}));

if (signoutBtn) signoutBtn.addEventListener('click', async e => {
    e.preventDefault();
    await api('/logout', 'POST');
    currentUser = null;
    paintAccount();
});

// ---------- generic modal helpers ----------
function showModal(el) { el.classList.add('modal-active'); }
function hideModal(el) { el.classList.remove('modal-active'); }
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.querySelector('.modal-close').addEventListener('click', e => {
        e.preventDefault();
        hideModal(overlay);
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) hideModal(overlay); });
});

// ---------- auth modal ----------
const authModal = document.querySelector('.auth-modal');
const authTitle = authModal.querySelector('.auth-title');
const authForm = authModal.querySelector('.auth-form');
const authMsg = authModal.querySelector('.modal-msg');
const nameField = authModal.querySelector('.name-field');
const authSwap = authModal.querySelector('.auth-swap');
const authSwapText = authModal.querySelector('.auth-swap-text');
const authSubmit = authModal.querySelector('.auth-submit');
let authMode = 'login';
let pendingCheckout = false;

function openAuth(mode, message) {
    authMode = mode;
    authTitle.textContent = mode === 'register' ? 'Account banaiye' : 'Sign in';
    authSubmit.textContent = mode === 'register' ? 'Account banaiye' : 'Sign in';
    nameField.hidden = mode !== 'register';
    authSwapText.textContent = mode === 'register' ? 'Pehle se account hai?' : 'Naye hain?';
    authSwap.textContent = mode === 'register' ? 'Sign in karein' : 'Register karein';
    if (message) { authMsg.hidden = false; authMsg.textContent = message; }
    else { authMsg.hidden = true; }
    authForm.reset();
    showModal(authModal);
}

authSwap.addEventListener('click', e => {
    e.preventDefault();
    openAuth(authMode === 'register' ? 'login' : 'register');
});

authForm.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
        email: authModal.querySelector('.auth-email').value,
        password: authModal.querySelector('.auth-password').value
    };
    if (authMode === 'register') payload.name = authModal.querySelector('.auth-name').value;
    try {
        const { user } = await api(authMode === 'register' ? '/register' : '/login', 'POST', payload);
        currentUser = user;
        paintAccount();
        hideModal(authModal);
        if (pendingCheckout) { pendingCheckout = false; openCheckout(); }
    } catch (err) {
        authMsg.hidden = false;
        authMsg.textContent = err.message;
    }
});

// ---------- checkout modal ----------
const checkoutModal = document.querySelector('.checkout-modal');
const checkoutForm = checkoutModal.querySelector('.checkout-form');
const checkoutMsg = checkoutModal.querySelector('.modal-msg');
const checkoutBtn = document.querySelector('.checkout-btn');

function openCheckout() {
    if (!currentUser) { pendingCheckout = true; return openAuth('login', 'Order place karne ke liye sign in karein.'); }
    if (!cartProduct.length) { checkoutMsg.hidden = false; checkoutMsg.textContent = 'Cart khali hai.'; return showModal(checkoutModal); }
    checkoutMsg.hidden = true;
    checkoutForm.reset();
    showModal(checkoutModal);
}

checkoutBtn.addEventListener('click', e => { e.preventDefault(); openCheckout(); });

checkoutForm.addEventListener('submit', async e => {
    e.preventDefault();
    const items = [];
    cartList.querySelectorAll('.item').forEach(el => {
        const id = Number(el.dataset.id);
        const qty = Number(el.querySelector('.quantity-value').textContent);
        items.push({ id, qty });
    });
    try {
        const { orderId } = await api('/checkout', 'POST', {
            items,
            address: checkoutModal.querySelector('.co-address').value,
            city: checkoutModal.querySelector('.co-city').value,
            phone: checkoutModal.querySelector('.co-phone').value
        });
        cartList.innerHTML = '';
        cartProduct = [];
        updateTotals();
        hideModal(checkoutModal);
        cartTab.classList.remove('cart-tab-active');
        alert(`Order #${orderId} place ho gaya! Cash on delivery.`);
    } catch (err) {
        checkoutMsg.hidden = false;
        checkoutMsg.textContent = err.message;
    }
});

// ---------- orders modal ----------
const ordersModal = document.querySelector('.orders-modal');
const ordersList = ordersModal.querySelector('.orders-list');

async function openOrders() {
    showModal(ordersModal);
    ordersList.innerHTML = '<p class="orders-empty">Load ho raha hai…</p>';
    try {
        const { orders } = await api('/orders');
        ordersList.innerHTML = orders.length
            ? orders.map(o => `
                <div class="order-entry">
                    <div class="order-line"><strong>Order #${o.id}</strong><span>${o.total}</span></div>
                    <div class="order-line"><span>${new Date(o.created_at + 'Z').toLocaleString()}</span><span>${o.status}</span></div>
                    ${o.items.map(i => `<div class="order-line"><span>${i.name} × ${i.qty}</span><span>${i.price}</span></div>`).join('')}
                </div>`).join('')
            : '<p class="orders-empty">Abhi koi order nahi hai.</p>';
    } catch (err) {
        ordersList.innerHTML = `<p class="orders-empty">${err.message}</p>`;
    }
}

// ---------- cart rendering (original template logic, with data-id added) ----------
const updateTotals = () => {
    let totalPrice = 0;
    let totalQuantity = 0;

    document.querySelectorAll('.item').forEach(item => {
        const quantity = parseInt(item.querySelector('.quantity-value').textContent);
        const price = parseFloat(item.querySelector('.item-total').textContent.replace('$', ''));
        totalPrice += price;
        totalQuantity += quantity;
    });

    cartTotal.textContent = `$${totalPrice.toFixed(2)}`;
    cartValue.textContent = totalQuantity;
};

const showCards = () => {
    productlist.forEach(product => {
        const orderCard = document.createElement('div');
        orderCard.classList.add('order-card');

        orderCard.innerHTML = `
        <div class="card-image">
            <img src="${product.image}">
        </div>
        <h4>${product.name}</h4>
        <h4 class="price">${product.price}</h4>
        <a href="#" class="btn card-btn">Add to Cart</a>
        `;

        cardList.appendChild(orderCard);

        const cardBtn = orderCard.querySelector('.card-btn');
        cardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addToCart(product);
        });
    });
};

const addToCart = (product) => {
    const existingProduct = cartProduct.find(item => item.id === product.id);
    if (existingProduct) {
        alert('Item already in your cart!');
        return;
    }

    cartProduct.push(product);

    let quantity = 1;
    let price = parseFloat(product.price.replace('$', ''));

    const cartItem = document.createElement('div');
    cartItem.classList.add('item');
    cartItem.dataset.id = product.id;

    cartItem.innerHTML = `
        <div class="item-image">
          <img src="${product.image}">
        </div>
        <div class="detail">
            <h4>${product.name}</h4>
            <h4 class="item-total">${product.price}</h4>
        </div>
        <div class="flex">
            <a href="#" class="quantity-btn minus">
                <i class="fa-solid fa-minus"></i>
            </a>
            <h4 class="quantity-value">${quantity}</h4>
            <a href="#" class="quantity-btn plus">
                <i class="fa-solid fa-plus"></i>
            </a>
        </div>
    `;
    cartList.appendChild(cartItem);
    updateTotals();

    const plusBtn = cartItem.querySelector('.plus');
    const quantityValue = cartItem.querySelector('.quantity-value');
    const itemTotal = cartItem.querySelector('.item-total');
    const minusBtn = cartItem.querySelector('.minus');

    plusBtn.addEventListener('click', (e) => {
        e.preventDefault();
        quantity++;
        quantityValue.textContent = quantity;
        itemTotal.textContent = `$${(price * quantity).toFixed(2)}`;
        updateTotals();
    });

    minusBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (quantity > 1) {
            quantity--;
            quantityValue.textContent = quantity;
            itemTotal.textContent = `$${(price * quantity).toFixed(2)}`;
            updateTotals();
        } else {
            cartItem.classList.add('slide-out');
            setTimeout(() => {
                cartItem.remove();
                cartProduct = cartProduct.filter(item => item.id !== product.id);
                updateTotals();
            }, 300);
        }
    });
};

// ---------- boot ----------
const initApp = async () => {
    try {
        const [{ products }, { user }] = await Promise.all([api('/products'), api('/me')]);
        productlist = products;
        currentUser = user;
    } catch (err) {
        console.error(err);
    }
    showCards();
    paintAccount();
};

initApp();
