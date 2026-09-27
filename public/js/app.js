/**
 * DaShop Main Application Logic
 * Full-Stack Client, PWA, Cart, Animations, Autocomplete, Routing
 */

// Cart state management
let cart = [];
const STORAGE_KEY = 'dashop_cart';
let appliedPromo = null;
let allProducts = [];

// PWA Install Prompt Listener (Capture early)
window.deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredInstallPrompt = e;
    console.log('[PWA] beforeinstallprompt event captured');
    if (typeof window.showPWAInstallPrompt === 'function') {
        window.showPWAInstallPrompt(false);
    }
});

// Service Worker Registration with auto-update
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('SW registered:', reg.scope);
            reg.update();
        }).catch(err => {
            console.log('SW registration failed:', err);
        });
    });
}

// Initialize app when DOM is ready
async function startApp() {
    initCart();
    initPWAInstallPrompt();
    await loadProducts();
    await loadProductDetail();
    initSearchAutocomplete();
    initHeroBannerCarousel();
    initNewArrivals();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

// Load cart from localStorage
function initCart() {
    const savedCart = localStorage.getItem(STORAGE_KEY);
    if (savedCart) {
        try {
            cart = JSON.parse(savedCart);
            updateCartCount();
        } catch (e) {
            console.error('Error loading cart from storage:', e);
            cart = [];
        }
    }
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    document.querySelectorAll('#cart-count').forEach(el => {
        el.textContent = count;
        el.classList.remove('scale-125');
    });
    document.querySelectorAll('#dock-cart-badge').forEach(el => {
        el.textContent = count;
        if (count > 0) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
}

// Progressive "Add to Cart" Animation
function triggerAddToCartAnimation(startElement) {
    const cartIcon = document.querySelector('header button[onclick="openCart()"]') || document.querySelector('#cart-count');
    if (!startElement || !cartIcon) return;

    const startRect = startElement.getBoundingClientRect();
    const endRect = cartIcon.getBoundingClientRect();

    const clone = document.createElement('div');
    clone.style.position = 'fixed';
    clone.style.zIndex = '9999';
    clone.style.left = `${startRect.left + startRect.width / 2 - 20}px`;
    clone.style.top = `${startRect.top + startRect.height / 2 - 20}px`;
    clone.style.width = '40px';
    clone.style.height = '40px';
    clone.style.borderRadius = '50%';
    clone.style.backgroundColor = '#005c55';
    clone.style.color = '#ffffff';
    clone.style.display = 'flex';
    clone.style.alignItems = 'center';
    clone.style.justifyContent = 'center';
    clone.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
    clone.style.transition = 'all 0.65s cubic-bezier(0.2, 0.8, 0.2, 1)';
    clone.style.pointerEvents = 'none';
    clone.innerHTML = '<span class="material-symbols-outlined text-[20px]">shopping_bag</span>';

    document.body.appendChild(clone);

    // Trigger animation
    requestAnimationFrame(() => {
        clone.style.left = `${endRect.left + endRect.width / 2 - 15}px`;
        clone.style.top = `${endRect.top + endRect.height / 2 - 15}px`;
        clone.style.width = '24px';
        clone.style.height = '24px';
        clone.style.opacity = '0.3';
        clone.style.transform = 'scale(0.5)';
    });

    setTimeout(() => {
        clone.remove();
        // Bounce cart badge
        document.querySelectorAll('#cart-count').forEach(el => {
            el.classList.add('transition-transform', 'duration-300', 'scale-150');
            setTimeout(() => el.classList.remove('scale-150'), 300);
        });
    }, 650);
}

// Add product to cart with animation
async function addToCart(product, quantity = 1, triggerBtn = null) {
    if (!product) return false;
    
    // Strict stock check
    const availableStock = typeof product.stock !== 'undefined' ? parseInt(product.stock) : 999;
    if (availableStock <= 0) {
        const outMsg = window.i18n ? window.i18n.t('product_out_of_stock') : 'Sorry, this product is out of stock!';
        showNotification(outMsg);
        return false;
    }

    const existingItem = cart.find(item => item.id === product.id);
    const currentQtyInCart = existingItem ? existingItem.quantity : 0;

    if (currentQtyInCart + quantity > availableStock) {
        const remaining = Math.max(0, availableStock - currentQtyInCart);
        if (remaining <= 0) {
            const limitMsg = window.i18n ? window.i18n.t('stock_limit_reached') : `Stock limit reached (${availableStock} available).`;
            showNotification(limitMsg);
            return false;
        }
        quantity = remaining;
    }
    
    if (existingItem) {
        existingItem.quantity += quantity;
        existingItem.stock = availableStock;
    } else {
        const primaryImage = getProductPrimaryImage(product);
        cart.push({
            id: product.id,
            name: product.name,
            price: parseFloat(product.price) || 0,
            image: primaryImage,
            quantity: quantity,
            stock: availableStock
        });
    }
    
    saveCart();
    if (triggerBtn) {
        triggerAddToCartAnimation(triggerBtn);
    }
    const msg = window.i18n ? window.i18n.t('product_added') : 'Added to cart!';
    showNotification(`${product.name}: ${msg}`);
    return true;
}

window.addToCartById = function(id, btnElement = null) {
    const product = allProducts.find(p => String(p.id) === String(id));
    if (product) {
        const stock = typeof product.stock !== 'undefined' ? parseInt(product.stock) : 999;
        if (stock <= 0) {
            const outMsg = window.i18n ? window.i18n.t('product_out_of_stock') : 'Sorry, this product is out of stock!';
            showNotification(outMsg);
            return;
        }
        addToCart(product, 1, btnElement);
    } else {
        console.error('Product not found for ID:', id);
    }
};

// Remove item from cart
function removeFromCart(productId) {
    cart = cart.filter(item => String(item.id) !== String(productId));
    saveCart();
    renderCart();
}

// Update cart quantity
function updateQuantity(productId, delta) {
    const item = cart.find(item => String(item.id) === String(productId));
    if (item) {
        if (delta > 0 && typeof item.stock !== 'undefined' && item.quantity + delta > item.stock) {
            const limitMsg = window.i18n ? window.i18n.t('stock_limit_reached') : `Only ${item.stock} available in stock`;
            showNotification(limitMsg);
            return;
        }
        item.quantity += delta;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            renderCart();
        }
    }
}

// Cart Modal open/close
function openCart() {
    const modal = document.getElementById('cart-modal');
    if (modal) {
        modal.classList.remove('hidden');
        renderCart();
    }
}

function closeCart() {
    const modal = document.getElementById('cart-modal');
    if (modal) modal.classList.add('hidden');
}

// Render cart contents
function renderCart() {
    const container = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    if (!container) return;

    if (cart.length === 0) {
        const emptyTitle = window.i18n ? window.i18n.t('empty_cart_title') : 'Your cart is empty 🛒';
        const emptySub = window.i18n ? window.i18n.t('empty_cart_subtitle') : 'Start adding some products!';
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center p-8 text-center text-on-surface-variant">
                <span class="material-symbols-outlined text-[48px] text-outline mb-2">shopping_basket</span>
                <p class="font-title-md font-bold text-on-surface">${emptyTitle}</p>
                <p class="font-body-sm text-outline mt-1">${emptySub}</p>
            </div>
        `;
        if (totalEl) totalEl.textContent = '0.00';
        return;
    }

    let subtotal = 0;
    let html = '';

    cart.forEach(item => {
        const itemTotal = item.price * (item.quantity || 1);
        subtotal += itemTotal;
        const isEmoji = !item.image || item.image.length <= 4 || !item.image.startsWith('http');
        const imgHtml = isEmoji 
            ? `<div class="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-2xl">${item.image || '📦'}</div>`
            : `<img src="${item.image}" alt="${item.name}" class="w-12 h-12 rounded-lg object-contain bg-surface-container p-1">`;

        html += `
            <div class="flex items-center justify-between p-3 rounded-xl bg-surface-container-low shadow-sm">
                <div class="flex items-center gap-3 min-w-0">
                    ${imgHtml}
                    <div class="min-w-0">
                        <h4 class="font-title-md text-on-surface font-semibold truncate">${item.name}</h4>
                        <p class="font-label-md text-on-surface-variant">$${item.price.toFixed(2)}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex items-center rounded-lg bg-surface-container-lowest px-2 py-1 shadow-sm">
                        <button onclick="updateQuantity('${item.id}', -1)" class="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-primary font-bold">-</button>
                        <span class="w-6 text-center font-bold text-on-surface text-sm">${item.quantity}</span>
                        <button onclick="updateQuantity('${item.id}', 1)" class="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:text-primary font-bold">+</button>
                    </div>
                    <button onclick="removeFromCart('${item.id}')" class="text-error hover:bg-error-container/30 p-1.5 rounded-full transition-colors">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    if (totalEl) {
        totalEl.textContent = subtotal.toFixed(2);
    }
}

// Checkout Modal
function proceedToCheckout() {
    closeCart();
    const modal = document.getElementById('checkout-modal');
    if (modal) {
        modal.classList.remove('hidden');
        updateCheckoutSummary();
    }
}

function closeCheckout() {
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.add('hidden');
}

function updateCheckoutSummary() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discount = 0;
    
    if (appliedPromo) {
        if (appliedPromo.discount_type === 'percentage') {
            discount = (subtotal * appliedPromo.discount_value) / 100;
        } else {
            discount = appliedPromo.discount_value;
        }
    }
    
    const finalTotal = Math.max(0, subtotal - discount);
    
    const summaryContainer = document.getElementById('checkout-summary');
    if (summaryContainer) {
        summaryContainer.innerHTML = `
            <div class="flex justify-between font-body-sm text-on-surface-variant">
                <span>Subtotal (${cart.length} items):</span>
                <span>$${subtotal.toFixed(2)}</span>
            </div>
            ${appliedPromo ? `
            <div class="flex justify-between font-body-sm text-secondary font-semibold">
                <span>Promo (${appliedPromo.promo_code}):</span>
                <span>-$${discount.toFixed(2)}</span>
            </div>` : ''}
            <div class="flex justify-between font-title-md font-bold text-on-surface pt-2 border-t border-surface-container">
                <span>Total Due:</span>
                <span class="text-primary text-xl">$${finalTotal.toFixed(2)}</span>
            </div>
        `;
    }
}

// Apply Promo Code
async function applyPromoCode() {
    const input = document.getElementById('promo-code-input');
    const msgEl = document.getElementById('promo-code-msg');
    if (!input) return;

    const code = input.value.trim();
    if (!code) return;

    if (window.promoManager) {
        const promo = await window.promoManager.validateCode(code);
        if (promo) {
            appliedPromo = promo;
            if (msgEl) {
                msgEl.textContent = `✓ ${promo.title} applied! (${promo.discount_value}% OFF)`;
                msgEl.className = "text-secondary font-label-sm font-semibold mt-1";
            }
            updateCheckoutSummary();
            showNotification(`Promo code ${promo.promo_code} applied!`);
        } else {
            appliedPromo = null;
            if (msgEl) {
                msgEl.textContent = window.i18n ? window.i18n.t('invalid_code') : 'Invalid or expired promo code';
                msgEl.className = "text-error font-label-sm font-semibold mt-1";
            }
            updateCheckoutSummary();
        }
    }
}

// Handle Order Placement
async function handleCheckout(event) {
    event.preventDefault();
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }

    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnContent = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
        submitBtn.innerHTML = `
            <div class="flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                <span>Placing Order...</span>
            </div>
        `;
    }

    const formData = new FormData(form);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discount = 0;
    if (appliedPromo) {
        discount = appliedPromo.discount_type === 'percentage' 
            ? (subtotal * appliedPromo.discount_value) / 100 
            : appliedPromo.discount_value;
    }
    const finalTotal = Math.max(0, subtotal - discount);

    const name = (formData.get('name') || '').trim() || 'Guest Customer';
    const phone = (formData.get('phone') || '').trim();

    if (!phone) {
        alert('Please enter your phone number so we can process and track your order.');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            submitBtn.innerHTML = originalBtnContent;
        }
        return;
    }

    const cleanDigits = phone.replace(/\D/g, '') || '0000000000';
    const email = `${cleanDigits}@dashop.site`;
    const address = `Phone: ${phone}`;

    // Schema-aligned payload for Supabase 'orders' table
    const orderPayload = {
        customer_name: name,
        customer_email: email,
        address: address,
        total: finalTotal,
        status: 'pending',
        items_json: JSON.stringify({
            items: cart,
            subtotal: subtotal,
            discount: discount,
            promo_code: appliedPromo ? appliedPromo.promo_code : null,
            phone: phone,
            customer_name: name,
            customer_email: email
        })
    };

    try {
        let createdOrder = null;

        if (window.supabaseClient) {
            const { data, error } = await window.supabaseClient.from('orders').insert([orderPayload]).select();
            if (error) {
                console.error('Order save error from Supabase:', error);
                throw new Error(error.message || 'Database error occurred while saving your order.');
            }
            if (data && data[0]) {
                createdOrder = data[0];
                console.log('Order created successfully in Supabase:', createdOrder);
            }
        }

        if (!createdOrder) {
            // Local fallback if Supabase client is offline/unconfigured
            createdOrder = {
                id: Math.floor(100000 + Math.random() * 900000),
                customer_name: name,
                customer_email: email,
                address: address,
                total: finalTotal,
                status: 'pending',
                created_at: new Date().toISOString(),
                items_json: orderPayload.items_json
            };
        }

        // Save order snapshot to customer's device history
        const custOrders = JSON.parse(localStorage.getItem('dashop_customer_orders') || '[]');
        custOrders.unshift({
            id: createdOrder.id,
            total: createdOrder.total,
            status: createdOrder.status || 'pending',
            items_count: cart.reduce((s, i) => s + (i.quantity || 1), 0),
            items: [...cart],
            phone: phone,
            customer_name: name,
            address: address,
            date: createdOrder.created_at || new Date().toISOString()
        });
        localStorage.setItem('dashop_customer_orders', JSON.stringify(custOrders));

        // Preserve cart items and promo snapshot for the confirmation modal
        const snapshotItems = [...cart];
        const snapshotTotal = finalTotal;
        const snapshotPromo = appliedPromo ? { ...appliedPromo } : null;

        // Reset cart and checkout form
        cart = [];
        appliedPromo = null;
        saveCart();
        closeCheckout();
        form.reset();

        // Display the dedicated Order Success Modal
        showOrderSuccessModal(createdOrder, snapshotItems, snapshotTotal, snapshotPromo);

    } catch (e) {
        console.error('Checkout error:', e);
        alert('Could not place order: ' + e.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            submitBtn.innerHTML = originalBtnContent;
        }
    }
}

// Display dedicated Order Confirmation Modal
function showOrderSuccessModal(order, items, total, promo) {
    const existing = document.getElementById('order-success-modal');
    if (existing) existing.remove();

    const orderId = '#' + String(order.id).padStart(6, '0');
    const customerName = order.customer_name || 'Valued Customer';
    let phone = '';
    try {
        const parsed = typeof order.items_json === 'string' ? JSON.parse(order.items_json) : order.items_json;
        if (parsed?.phone) phone = parsed.phone;
    } catch (e) {}
    if (!phone && order.address && order.address.startsWith('Phone: ')) {
        phone = order.address.replace('Phone: ', '').trim();
    }

    const itemsListHtml = items.map(item => `
        <div class="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0 text-xs sm:text-sm">
            <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-base shrink-0 overflow-hidden">
                    ${item.image && item.image.startsWith('http') ? `<img src="${item.image}" class="w-full h-full object-cover"/>` : (item.image || '📦')}
                </div>
                <div class="min-w-0">
                    <p class="font-bold text-slate-800 truncate">${item.name}</p>
                    <p class="text-xs text-slate-400 font-mono">Qty: ${item.quantity} × $${parseFloat(item.price).toFixed(2)}</p>
                </div>
            </div>
            <span class="font-extrabold text-slate-900 shrink-0 ml-2">$${(item.price * item.quantity).toFixed(2)}</span>
        </div>
    `).join('');

    const modal = document.createElement('div');
    modal.id = 'order-success-modal';
    modal.className = 'fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-300';
    modal.innerHTML = `
        <div class="w-full max-w-lg bg-white text-slate-800 rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
            <!-- Header with Success Animation/Icon -->
            <div class="p-6 pb-4 flex flex-col items-center text-center bg-gradient-to-b from-emerald-50 to-transparent border-b border-slate-100">
                <div class="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3 ring-8 ring-emerald-500/10 shadow-sm">
                    <span class="material-symbols-outlined text-[38px] text-emerald-600">check_circle</span>
                </div>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span data-i18n="order_confirmed">Order Confirmed</span>
                </span>
                <h2 class="text-2xl font-black text-slate-900 tracking-tight" data-i18n="order_received_title">Thank You for Your Order!</h2>
                <p class="text-xs sm:text-sm text-slate-600 mt-1 max-w-sm">
                    We've received your order, <strong class="text-slate-900">${customerName}</strong>. Our team is now preparing it for delivery.
                </p>
            </div>

            <!-- Scrollable Content -->
            <div class="p-5 sm:p-6 overflow-y-auto flex flex-col gap-4">
                <!-- Order Key Info Grid -->
                <div class="grid grid-cols-2 gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                    <div>
                        <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block" data-i18n="order_reference">Order Reference</span>
                        <span class="text-sm font-mono font-extrabold text-emerald-700">${orderId}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Status</span>
                        <span class="text-xs font-bold text-emerald-600 flex items-center justify-end gap-1">
                            <span class="material-symbols-outlined text-[14px]">schedule</span> Pending Confirmation
                        </span>
                    </div>
                    <div class="col-span-2 pt-2 border-t border-slate-200/80 flex flex-col gap-1.5">
                        <div class="flex items-center justify-between text-xs">
                            <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer</span>
                            <span class="font-semibold text-slate-800">${customerName}</span>
                        </div>
                        ${phone ? `
                        <div class="flex items-center justify-between text-xs">
                            <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tracking Phone</span>
                            <span class="font-mono font-bold text-emerald-700 flex items-center gap-1">
                                <span class="material-symbols-outlined text-[15px]">phone_iphone</span> ${phone}
                            </span>
                        </div>` : ''}
                    </div>
                </div>

                <!-- Purchased Items -->
                <div class="rounded-2xl border border-slate-200 p-3 sm:p-4 bg-white">
                    <div class="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                        <span class="text-xs font-bold text-slate-800 uppercase tracking-wider">Ordered Items (${items.length})</span>
                        ${promo ? `<span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200"><span class="material-symbols-outlined text-[12px]">local_offer</span> ${promo.promo_code}</span>` : ''}
                    </div>
                    <div class="max-h-40 overflow-y-auto pr-1">
                        ${itemsListHtml}
                    </div>
                    <div class="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 font-bold">
                        <span class="text-sm text-slate-800" data-i18n="order_total_paid">Total Paid</span>
                        <span class="text-xl font-black text-emerald-700">$${parseFloat(total).toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <!-- Footer Actions -->
            <div class="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-2.5">
                <button onclick="closeOrderSuccessModal(); openCustomerOrdersModal();" class="flex-1 py-3 px-4 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95">
                    <span class="material-symbols-outlined text-[18px]">receipt_long</span>
                    <span data-i18n="view_in_my_orders">View in My Orders</span>
                </button>
                <button onclick="closeOrderSuccessModal()" class="flex-1 py-3 px-4 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95">
                    <span class="material-symbols-outlined text-[18px]">shopping_bag</span>
                    <span data-i18n="continue_shopping">Continue Shopping</span>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function closeOrderSuccessModal() {
    const modal = document.getElementById('order-success-modal');
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.remove(), 250);
    }
}
window.closeOrderSuccessModal = closeOrderSuccessModal;
window.showOrderSuccessModal = showOrderSuccessModal;

// Helper: Extract Product Images & Details
function getProductPrimaryImage(product) {
    if (product.image && product.image.startsWith('http')) return product.image;
    
    // Check if description contains JSON with images
    if (product.description && product.description.startsWith('{')) {
        try {
            const meta = JSON.parse(product.description);
            if (meta.images && meta.images.length > 0) return meta.images[0];
        } catch (e) {}
    }
    
    return product.image || '📦';
}

function getProductAllImages(product) {
    const list = [];
    if (product.image && product.image.startsWith('http')) {
        list.push(product.image);
    }
    if (product.description && product.description.startsWith('{')) {
        try {
            const meta = JSON.parse(product.description);
            if (Array.isArray(meta.images)) {
                meta.images.forEach(img => {
                    if (img && !list.includes(img)) list.push(img);
                });
            }
        } catch (e) {}
    }
    if (list.length === 0 && product.image) {
        list.push(product.image);
    }
    return list;
}

function getProductCleanDescription(product) {
    if (!product.description) return '';
    if (product.description.startsWith('{')) {
        try {
            const meta = JSON.parse(product.description);
            return meta.desc || meta.description || '';
        } catch (e) {}
    }
    return product.description;
}

function getProductSlug(product) {
    if (product.description && product.description.startsWith('{')) {
        try {
            const meta = JSON.parse(product.description);
            if (meta.slug) return meta.slug;
        } catch (e) {}
    }
    return (product.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getProductBarcode(product) {
    if (!product) return '';
    if (product.barcode) return String(product.barcode).trim();
    if (product.description && product.description.startsWith('{')) {
        try {
            const meta = JSON.parse(product.description);
            if (meta.barcode) return String(meta.barcode).trim();
        } catch(e) {}
    }
    return '';
}

let currentActiveCategory = 'All';

window.filterByCategory = function(category, btnElement) {
    currentActiveCategory = category || 'All';
    
    // Update chip styling
    document.querySelectorAll('.category-chip').forEach(chip => {
        chip.classList.remove('bg-primary', 'text-on-primary', 'shadow-sm');
        chip.classList.add('bg-surface-container-low', 'text-on-surface');
    });

    const activeBtn = btnElement || document.querySelector(`.category-chip[data-category="${category}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-surface-container-low', 'text-on-surface');
        activeBtn.classList.add('bg-primary', 'text-on-primary', 'shadow-sm');
    }

    const grid = document.getElementById('product-grid') || document.getElementById('catalog-grid');
    if (!grid) return;

    const searchInput = document.getElementById('catalog-search') || document.getElementById('search-input');
    const query = (searchInput?.value || '').toLowerCase().trim();

    // Only show in-stock products on catalog
    let filtered = allProducts.filter(p => (parseInt(p.stock) || 0) > 0);
    if (query) {
        filtered = filtered.filter(p => {
            const b = getProductBarcode(p).toLowerCase();
            return p.name.toLowerCase().includes(query) || 
                   (p.category && p.category.toLowerCase().includes(query)) ||
                   (b && b.includes(query));
        });
    }

    if (category && category !== 'All') {
        if (category === 'Flash Deals') {
            filtered = filtered.filter(p => (parseFloat(p.price) <= 12) || (p.description && p.description.includes('Deal')));
        } else {
            filtered = filtered.filter(p => 
                p.category && (
                    p.category.toLowerCase().includes(category.toLowerCase()) ||
                    category.toLowerCase().includes(p.category.toLowerCase())
                )
            );
        }
    }

    renderProductGrid(filtered, grid);
};

// Load Products from Supabase
async function loadProducts() {
    const grid = document.getElementById('product-grid') || document.getElementById('catalog-grid');
    
    try {
        if (window.supabaseClient) {
            const { data, error } = await window.supabaseClient
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (!error && data) {
                allProducts = data.filter(p => p.category !== '__dashop_config__');
            }
        }
    } catch (e) {
        console.error('Error fetching products:', e);
    }

    if (!grid) return;

    // Attach search input listener for live search
    const searchInput = document.getElementById('catalog-search') || document.getElementById('search-input');
    if (searchInput && !searchInput.dataset.hasListener) {
        searchInput.dataset.hasListener = 'true';
        searchInput.addEventListener('input', () => {
            window.filterByCategory(currentActiveCategory);
        });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const q = urlParams.get('q');
    const cat = urlParams.get('category');
    const isFlash = urlParams.get('flash');

    if (searchInput && q) searchInput.value = q;

    if (isFlash) {
        window.filterByCategory('Flash Deals');
    } else if (cat) {
        window.filterByCategory(cat);
    } else {
        window.filterByCategory('All');
    }
}

// Customer Orders Modal Logic
window.openCustomerOrdersModal = function() {
    const modal = document.getElementById('customer-orders-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    // Check if admin session is present to show merchant link
    const adminSession = localStorage.getItem('dashop_admin_session');
    const adminLinkWrapper = document.getElementById('admin-orders-link-wrapper');
    if (adminLinkWrapper) {
        if (adminSession) adminLinkWrapper.classList.remove('hidden');
        else adminLinkWrapper.classList.add('hidden');
    }

    // Attach Enter key listener to track input
    const trackInput = document.getElementById('order-track-input');
    if (trackInput && !trackInput.dataset.hasListener) {
        trackInput.dataset.hasListener = 'true';
        trackInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.searchCustomerOrder();
            }
        });
    }

    renderCustomerOrdersList();
};

window.closeCustomerOrdersModal = function() {
    const modal = document.getElementById('customer-orders-modal');
    if (modal) modal.classList.add('hidden');
};

function renderCustomerOrdersList() {
    const container = document.getElementById('customer-orders-list');
    if (!container) return;

    const orders = JSON.parse(localStorage.getItem('dashop_customer_orders') || '[]');
    if (orders.length === 0) {
        container.innerHTML = `
            <div class="p-4 rounded-xl bg-surface-container-low text-center text-xs text-on-surface-variant font-medium">
                No orders placed on this device yet.
            </div>
        `;
        return;
    }

    let html = '';
    orders.forEach(o => {
        const dateStr = o.date ? new Date(o.date).toLocaleDateString() : 'Recent';
        const isCompleted = o.status === 'completed';
        const statusBadge = isCompleted 
            ? `<span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold">Completed</span>`
            : `<span class="px-2 py-0.5 rounded-full bg-surface-dim text-on-surface text-[11px] font-bold">Pending</span>`;

        html += `
            <div class="p-3 rounded-xl bg-surface-container-low flex flex-col gap-1 border border-surface-container/60 shadow-sm">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-xs text-on-surface font-mono">Order #${o.id}</span>
                    ${statusBadge}
                </div>
                <div class="flex items-center justify-between text-xs text-on-surface-variant mt-0.5">
                    <span>${o.items_count || 1} items • ${dateStr}</span>
                    <span class="font-bold text-on-surface text-sm">$${parseFloat(o.total || 0).toFixed(2)}</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

window.searchCustomerOrder = async function() {
    const input = document.getElementById('order-track-input');
    const resultBox = document.getElementById('order-search-result');
    if (!input || !resultBox) return;

    const term = (input.value || '').trim();
    if (!term) {
        const msg = window.i18n ? window.i18n.t('enter_phone_to_track') : 'Please enter your phone number to track your order.';
        resultBox.innerHTML = `<span class="text-error font-medium">${msg}</span>`;
        return;
    }

    const loadingMsg = window.i18n ? window.i18n.t('looking_up_order') : 'Looking up order...';
    resultBox.innerHTML = `
        <div class="flex items-center gap-1.5 py-1 text-on-surface-variant font-medium">
            <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
            <span>${loadingMsg}</span>
        </div>
    `;

    try {
        let matchingOrders = [];
        const cleanDigits = term.replace(/\D/g, '');

        if (window.supabaseClient) {
            let orClauses = [];

            // 1. Order ID (if short pure digits, typically 1 to 6 digits)
            if (/^\d{1,6}$/.test(term)) {
                orClauses.push(`id.eq.${parseInt(term)}`);
            }

            // 2. Phone number matching (raw digits and formatted)
            if (cleanDigits.length >= 4) {
                orClauses.push(`customer_email.ilike.%${cleanDigits}%`);
                orClauses.push(`address.ilike.%${cleanDigits}%`);
                if (cleanDigits !== term) {
                    orClauses.push(`address.ilike.%${term}%`);
                }
            }

            // 3. Fallback for names or email query
            if (term.length >= 3 && cleanDigits.length < term.length) {
                orClauses.push(`customer_name.ilike.%${term}%`);
                orClauses.push(`customer_email.ilike.%${term}%`);
                orClauses.push(`address.ilike.%${term}%`);
            }

            if (orClauses.length > 0) {
                const { data, error } = await window.supabaseClient
                    .from('orders')
                    .select('*')
                    .or(orClauses.join(','))
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (!error && Array.isArray(data)) {
                    matchingOrders = data;
                }
            }

            // Secondary fallback: if direct query returns empty, check recent orders' items_json
            if (matchingOrders.length === 0 && cleanDigits.length >= 4) {
                try {
                    const { data: recentOrders } = await window.supabaseClient
                        .from('orders')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(30);

                    if (Array.isArray(recentOrders)) {
                        matchingOrders = recentOrders.filter(o => {
                            let phoneVal = '';
                            try {
                                const parsed = typeof o.items_json === 'string' ? JSON.parse(o.items_json) : o.items_json;
                                if (parsed?.phone) phoneVal = String(parsed.phone);
                            } catch(e) {}
                            const orderDigits = (phoneVal + (o.address || '') + (o.customer_email || '')).replace(/\D/g, '');
                            return orderDigits.includes(cleanDigits);
                        });
                    }
                } catch(e) {}
            }
        }

        // Local storage device orders fallback / merge
        const localOrders = JSON.parse(localStorage.getItem('dashop_customer_orders') || '[]');
        if (matchingOrders.length === 0 && localOrders.length > 0) {
            matchingOrders = localOrders.filter(o => {
                const oClean = (o.phone || '').replace(/\D/g, '');
                const oAddrClean = (o.address || '').replace(/\D/g, '');
                return (cleanDigits && (oClean.includes(cleanDigits) || oAddrClean.includes(cleanDigits))) ||
                       (term && String(o.id) === term) ||
                       (o.customer_name && o.customer_name.toLowerCase().includes(term.toLowerCase()));
            });
        }

        if (matchingOrders.length === 0) {
            const notFoundMsg = window.i18n ? window.i18n.t('no_order_phone_found') : 'No order found matching this phone number.';
            resultBox.innerHTML = `<span class="text-error font-medium">${notFoundMsg}</span>`;
            return;
        }

        let html = '<div class="flex flex-col gap-2 mt-2">';
        matchingOrders.forEach(o => {
            const dateStr = o.created_at || o.date ? new Date(o.created_at || o.date).toLocaleDateString() : 'Recent';
            const isCompleted = o.status === 'completed';
            const statusBadge = isCompleted 
                ? `<span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider">Completed</span>`
                : `<span class="px-2 py-0.5 rounded-full bg-surface-dim text-on-surface text-[10px] font-bold uppercase tracking-wider">Pending</span>`;

            let phoneDisplay = o.phone || '';
            try {
                const parsed = typeof o.items_json === 'string' ? JSON.parse(o.items_json) : o.items_json;
                if (parsed?.phone) phoneDisplay = parsed.phone;
            } catch (e) {}
            if (!phoneDisplay && o.address && o.address.startsWith('Phone: ')) {
                phoneDisplay = o.address.replace('Phone: ', '').trim();
            }

            html += `
                <div class="p-3 rounded-2xl bg-surface-container-lowest border border-surface-container flex flex-col gap-1 shadow-sm">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-xs font-mono text-on-surface">Order #${o.id} • ${o.customer_name || 'Customer'}</span>
                        ${statusBadge}
                    </div>
                    <div class="flex justify-between items-center text-on-surface-variant text-xs mt-0.5">
                        <span class="flex items-center gap-1 font-mono">
                            <span class="material-symbols-outlined text-[14px] text-primary">phone_iphone</span>
                            ${phoneDisplay || dateStr}
                        </span>
                        <span class="font-black text-on-surface text-sm">$${parseFloat(o.total || 0).toFixed(2)}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        resultBox.innerHTML = html;
    } catch (err) {
        console.error('Error tracking order:', err);
        resultBox.innerHTML = `<span class="text-error font-medium">Lookup error: ${err.message}</span>`;
    }
};

function renderProductGrid(products, grid) {
    if (!grid) return;
    
    // Only display in-stock products on user product list / catalog
    const inStockProducts = (products || []).filter(p => (parseInt(p.stock) || 0) > 0);

    if (inStockProducts.length === 0) {
        const emptyMsg = window.i18n ? window.i18n.t('no_products') : 'No products found.';
        grid.innerHTML = `<div class="col-span-full p-8 text-center text-on-surface-variant font-medium">${emptyMsg}</div>`;
        return;
    }

    let html = '';
    inStockProducts.forEach(p => {
        const primaryImg = getProductPrimaryImage(p);
        const isEmoji = !primaryImg || primaryImg.length <= 4 || !primaryImg.startsWith('http');
        const imgHtml = isEmoji 
            ? `<div class="text-6xl flex items-center justify-center w-full h-full">${primaryImg || '📦'}</div>`
            : `<img class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" src="${primaryImg}" alt="${p.name}">`;

        const slug = getProductSlug(p);
        const category = p.category || 'General';

        html += `
        <div class="group flex flex-col rounded-2xl bg-surface-container-lowest p-space-sm shadow-sm hover:shadow-md transition-all cursor-pointer" onclick="viewProduct('${slug}', ${p.id})">
            <div class="relative w-full aspect-square rounded-xl bg-surface-container-low flex items-center justify-center overflow-hidden mb-space-xs">
                ${imgHtml}
            </div>
            <div class="flex flex-col flex-1 justify-between">
                <div>
                    <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">${category}</span>
                    <h4 class="font-title-md text-title-md text-on-surface font-semibold line-clamp-2 leading-snug">
                        ${p.name}
                    </h4>
                </div>
                <div class="flex items-center justify-between pt-space-sm mt-space-2xs">
                    <span class="font-price-hero text-price-hero text-on-surface font-extrabold">$${parseFloat(p.price).toFixed(2)}</span>
                    <button class="cart-btn w-9 h-9 rounded-full bg-primary hover:bg-primary-container text-on-primary flex items-center justify-center shadow-md active:scale-90 transition-all" onclick="event.stopPropagation(); window.addToCartById(${p.id}, this)" type="button">
                        <span class="material-symbols-outlined text-[18px]">add</span>
                    </button>
                </div>
            </div>
        </div>`;
    });

    grid.innerHTML = html;
}

// Dynamic New Arrivals on index.html
function initNewArrivals() {
    const container = document.getElementById('new-arrivals-container');
    if (!container || allProducts.length === 0) return;

    let html = '';
    const inStockItems = allProducts.filter(p => (parseInt(p.stock) || 0) > 0);
    const newItems = inStockItems.slice(0, 8);
    if (newItems.length === 0) return;

    newItems.forEach(p => {
        const primaryImg = getProductPrimaryImage(p);
        const isEmoji = !primaryImg || primaryImg.length <= 4 || !primaryImg.startsWith('http');
        const imgHtml = isEmoji 
            ? `<div class="text-5xl flex items-center justify-center w-full h-full">${primaryImg || '📦'}</div>`
            : `<img class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" src="${primaryImg}" alt="${p.name}">`;

        const slug = getProductSlug(p);

        html += `
        <div class="w-48 shrink-0 flex flex-col rounded-2xl bg-surface-container-lowest p-space-sm shadow-md transition-transform duration-200 hover:-translate-y-1 cursor-pointer" onclick="viewProduct('${slug}', ${p.id})">
            <div class="relative w-full aspect-square rounded-xl bg-surface-container-low flex items-center justify-center overflow-hidden mb-space-xs">
                ${imgHtml}
            </div>
            <div class="flex flex-col flex-1 justify-between">
                <div>
                    <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">${p.category || 'General'}</span>
                    <h4 class="font-title-md text-title-md text-on-surface font-semibold line-clamp-2 mt-0.5 leading-snug">${p.name}</h4>
                </div>
                <div class="flex items-center justify-between pt-space-sm mt-space-2xs">
                    <span class="font-price-hero text-price-hero text-on-surface font-extrabold">$${parseFloat(p.price).toFixed(2)}</span>
                    <button class="cart-btn w-9 h-9 rounded-full bg-primary hover:bg-primary-container text-on-primary flex items-center justify-center shadow-md active:scale-90 transition-all" onclick="event.stopPropagation(); window.addToCartById(${p.id}, this)" type="button">
                        <span class="material-symbols-outlined text-[20px]">add</span>
                    </button>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

// Dynamic Hero Promo Banner Carousel on index.html
let heroBanners = [];
let currentHeroSlide = 0;
let heroCarouselInterval = null;

async function initHeroBannerCarousel() {
    const track = document.getElementById('hero-banner-track');
    if (!track) return;

    if (!window.bannerManager) {
        console.warn('BannerManager not initialized');
        return;
    }

    try {
        heroBanners = await window.bannerManager.getActiveBanners();
    } catch (e) {
        console.error('Error fetching active banners:', e);
    }

    if (!heroBanners || heroBanners.length === 0) {
        // Fallback default banner
        heroBanners = [
            {
                id: 'default',
                title: "Save Big on Your Essentials",
                subtitle: "Use code SAVE10 for instant discounts on all everyday items!",
                tag: "Limited Time",
                tag_icon: "local_fire_department",
                promo_code: "SAVE10",
                link_url: "/catalog",
                button_text: "Shop now",
                theme: "primary"
            }
        ];
    }

    renderHeroCarouselSlides();
    setupHeroCarouselControls();
}
window.initPromoBanner = initHeroBannerCarousel;

function renderHeroCarouselSlides() {
    const track = document.getElementById('hero-banner-track');
    const dotsContainer = document.getElementById('hero-carousel-dots');
    const prevBtn = document.getElementById('hero-carousel-prev');
    const nextBtn = document.getElementById('hero-carousel-next');
    if (!track) return;

    track.innerHTML = '';
    if (dotsContainer) dotsContainer.innerHTML = '';

    heroBanners.forEach((b, index) => {
        const themeStyle = window.getBannerThemeClasses ? window.getBannerThemeClasses(b.theme) : {
            bg: 'bg-gradient-to-br from-primary via-primary-container to-secondary text-on-primary',
            tagBg: 'bg-tertiary-fixed text-on-tertiary-fixed',
            btnBg: 'bg-tertiary-fixed hover:bg-tertiary-fixed-dim text-on-tertiary-fixed',
            badgeBg: 'bg-tertiary-fixed text-on-tertiary-fixed',
            blurColor: 'bg-tertiary-fixed'
        };

        const slide = document.createElement('div');
        const hasImage = b.image_url && b.image_url.trim() !== '';

        slide.className = `min-w-full relative overflow-hidden rounded-2xl ${hasImage ? 'bg-surface-container-high' : themeStyle.bg} min-h-[230px] sm:min-h-[270px] md:min-h-[320px] p-4 pt-12 pb-14 sm:p-7 sm:pt-16 sm:pb-16 md:p-8 md:pt-18 md:pb-18 shadow-md flex items-center transition-all group`;

        slide.innerHTML = `
            ${hasImage ? `
            <!-- Full Fill Banner Image Background (Mobile & PC) -->
            <div class="absolute inset-0 w-full h-full z-0 overflow-hidden pointer-events-none">
                <img src="${b.image_url}" alt="${b.title || 'Banner'}" class="w-full h-full object-cover object-center transform transition-transform duration-700 ease-out group-hover:scale-105" loading="eager"/>
                <!-- Scrim gradient overlay to ensure text readability -->
                <div class="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/35 sm:from-black/80 sm:via-black/50 sm:to-black/25"></div>
            </div>
            ` : `
            <div class="absolute -right-8 -bottom-10 w-52 h-52 rounded-full ${themeStyle.blurColor} opacity-20 blur-3xl pointer-events-none"></div>
            `}

            <!-- Tag Badge: Top Left & Smaller -->
            <div class="absolute top-3 left-4 sm:top-4 sm:left-7 md:top-5 md:left-8 z-20">
                <div class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full ${hasImage ? 'bg-white/20 text-white border border-white/30 backdrop-blur-md' : themeStyle.tagBg} text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider shadow-sm">
                    <span class="material-symbols-outlined text-[13px] sm:text-[14px]">${b.tag_icon || 'local_fire_department'}</span>
                    <span>${b.tag || 'Special Offer'}</span>
                </div>
            </div>

            <!-- Content: Bigger Title & Details -->
            <div class="relative z-10 flex flex-col items-start max-w-[70%] sm:max-w-[65%] md:max-w-[60%] text-white my-auto">
                <h2 class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-tight mb-1.5 sm:mb-2 text-white drop-shadow-md">
                    ${b.title}
                </h2>
                <p class="text-xs sm:text-sm md:text-base text-white/90 font-medium leading-relaxed line-clamp-2 drop-shadow-sm max-w-xl mb-2 sm:mb-3">
                    ${b.subtitle || ''}
                </p>
                ${b.promo_code ? `
                <div onclick="copyBannerPromoCode('${b.promo_code}', event)" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${hasImage ? 'bg-white/25 text-white border border-white/30 backdrop-blur-md' : themeStyle.badgeBg} cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-sm font-bold text-[11px] sm:text-xs uppercase" title="Click to copy code">
                    <span class="opacity-80">Code:</span>
                    <span class="font-mono tracking-wider">${b.promo_code}</span>
                    <span class="material-symbols-outlined text-[13px]">content_copy</span>
                </div>` : ''}
            </div>

            <!-- Action Button: Bottom Right -->
            <div class="absolute right-4 bottom-3.5 sm:right-7 sm:bottom-5 md:right-8 md:bottom-6 z-20">
                <a href="${b.link_url || '/catalog'}" class="h-9 sm:h-11 px-4 sm:px-6 rounded-full ${hasImage ? 'bg-white hover:bg-white/90 text-neutral-900' : themeStyle.btnBg} text-xs sm:text-sm md:text-base font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center gap-1.5">
                    <span>${b.button_text || 'Shop now'}</span>
                    <span class="material-symbols-outlined text-[16px] sm:text-[18px]">arrow_forward</span>
                </a>
            </div>
        `;
        track.appendChild(slide);

        // Indicator dot
        if (dotsContainer && heroBanners.length > 1) {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = `h-2 rounded-full transition-all duration-300 ${index === 0 ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`;
            dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
            dot.onclick = () => goToHeroSlide(index);
            dotsContainer.appendChild(dot);
        }
    });

    if (heroBanners.length > 1) {
        if (prevBtn) prevBtn.classList.remove('hidden');
        if (nextBtn) nextBtn.classList.remove('hidden');
    } else {
        if (prevBtn) prevBtn.classList.add('hidden');
        if (nextBtn) nextBtn.classList.add('hidden');
    }

    goToHeroSlide(0);
}

function updateHeroCarouselDots() {
    const dotsContainer = document.getElementById('hero-carousel-dots');
    if (!dotsContainer) return;
    const dots = dotsContainer.children;
    for (let i = 0; i < dots.length; i++) {
        if (i === currentHeroSlide) {
            dots[i].className = 'w-6 h-2 rounded-full bg-white transition-all duration-300';
        } else {
            dots[i].className = 'w-2 h-2 rounded-full bg-white/50 hover:bg-white/80 transition-all duration-300';
        }
    }
}

function goToHeroSlide(index) {
    if (!heroBanners || heroBanners.length === 0) return;
    const track = document.getElementById('hero-banner-track');
    if (!track) return;

    currentHeroSlide = (index + heroBanners.length) % heroBanners.length;
    track.style.transform = `translateX(-${currentHeroSlide * 100}%)`;
    updateHeroCarouselDots();
}

window.nextHeroBanner = function() {
    goToHeroSlide(currentHeroSlide + 1);
};

window.prevHeroBanner = function() {
    goToHeroSlide(currentHeroSlide - 1);
};

window.copyBannerPromoCode = function(code, e) {
    if (e) e.stopPropagation();
    if (!code) return;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
            showNotification(`Promo code "${code}" copied to clipboard!`);
        }).catch(() => {
            showNotification(`Promo code: ${code}`);
        });
    } else {
        showNotification(`Promo code: ${code}`);
    }
};

function setupHeroCarouselControls() {
    const frame = document.getElementById('hero-carousel-frame');
    if (!frame) return;

    if (heroCarouselInterval) {
        clearInterval(heroCarouselInterval);
        heroCarouselInterval = null;
    }

    if (heroBanners.length > 1) {
        const startAutoPlay = () => {
            if (!heroCarouselInterval) {
                heroCarouselInterval = setInterval(() => {
                    window.nextHeroBanner();
                }, 5000);
            }
        };

        const stopAutoPlay = () => {
            if (heroCarouselInterval) {
                clearInterval(heroCarouselInterval);
                heroCarouselInterval = null;
            }
        };

        startAutoPlay();

        frame.onmouseenter = stopAutoPlay;
        frame.onmouseleave = startAutoPlay;

        // Mobile touch swipe
        let touchStartX = 0;
        let touchEndX = 0;

        frame.ontouchstart = (e) => {
            stopAutoPlay();
            touchStartX = e.changedTouches[0].screenX;
        };

        frame.ontouchend = (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchEndX - touchStartX;
            if (Math.abs(diff) > 40) {
                if (diff < 0) {
                    window.nextHeroBanner();
                } else {
                    window.prevHeroBanner();
                }
            }
            startAutoPlay();
        };
    }
}

// Search Suggestions / Autocomplete
function initSearchAutocomplete() {
    const inputs = [
        { input: document.getElementById('index-search-input'), dropdown: document.getElementById('index-search-suggestions') },
        { input: document.getElementById('catalog-search'), dropdown: document.getElementById('catalog-search-suggestions') }
    ];

    inputs.forEach(({ input, dropdown }) => {
        if (!input) return;

        // Create dropdown element dynamically if not present
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = "absolute left-0 right-0 top-full mt-1 bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container overflow-hidden z-50 hidden";
            input.parentElement.style.position = 'relative';
            input.parentElement.appendChild(dropdown);
        }

        input.addEventListener('input', (e) => {
            const val = e.target.value.trim().toLowerCase();
            if (!val || allProducts.length === 0) {
                dropdown.classList.add('hidden');
                return;
            }

            const matches = allProducts.filter(p => 
                (parseInt(p.stock) || 0) > 0 &&
                (p.name.toLowerCase().includes(val) || (p.category && p.category.toLowerCase().includes(val)))
            ).slice(0, 5);

            if (matches.length === 0) {
                dropdown.innerHTML = `<div class="p-3 text-sm text-on-surface-variant text-center">No matching products</div>`;
                dropdown.classList.remove('hidden');
                return;
            }

            let html = '';
            matches.forEach(p => {
                const img = getProductPrimaryImage(p);
                const isEmoji = !img || img.length <= 4 || !img.startsWith('http');
                const imgEl = isEmoji 
                    ? `<span class="text-2xl">${img || '📦'}</span>` 
                    : `<img src="${img}" class="w-8 h-8 rounded object-contain">`;
                const slug = getProductSlug(p);

                html += `
                    <div class="flex items-center justify-between p-2.5 hover:bg-surface-container-low cursor-pointer transition-colors border-b border-surface-container/50 last:border-0" onclick="viewProduct('${slug}', ${p.id})">
                        <div class="flex items-center gap-3 min-w-0">
                            ${imgEl}
                            <div class="min-w-0">
                                <span class="font-title-md text-on-surface text-sm font-semibold truncate block">${p.name}</span>
                                <span class="font-label-sm text-on-surface-variant text-xs">${p.category || 'General'}</span>
                            </div>
                        </div>
                        <span class="font-bold text-primary text-sm shrink-0 ml-2">$${parseFloat(p.price).toFixed(2)}</span>
                    </div>
                `;
            });

            dropdown.innerHTML = html;
            dropdown.classList.remove('hidden');
        });

        // Close on blur / click outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    });
}

// Product Details Page Loading
async function loadProductDetail() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const slug = params.get('slug');
    if (!id && !slug) return;

    let product = null;
    if (allProducts.length > 0) {
        if (id) product = allProducts.find(p => String(p.id) === String(id));
        if (!product && slug) product = allProducts.find(p => getProductSlug(p) === slug);
    }

    if (!product && window.supabaseClient) {
        try {
            if (id) {
                const { data } = await window.supabaseClient.from('products').select('*').eq('id', id).single();
                product = data;
            } else if (slug) {
                const { data } = await window.supabaseClient.from('products').select('*');
                if (data) product = data.filter(p => p.category !== '__dashop_config__').find(p => getProductSlug(p) === slug);
            }
        } catch (e) {
            console.error('Error loading product detail:', e);
        }
    }

    if (!product) return;

    const nameEl = document.getElementById('detail-name');
    const priceEl = document.getElementById('detail-price');
    const catEl = document.getElementById('detail-category');
    const descEl = document.getElementById('detail-description');
    const imgEl = document.getElementById('detail-image');
    const thumbsContainer = document.getElementById('detail-thumbnails');
    const addBtn = document.getElementById('addToCartBtn');

    if (nameEl) nameEl.textContent = product.name;
    if (priceEl) priceEl.textContent = '$' + parseFloat(product.price).toFixed(2);
    if (catEl) catEl.textContent = product.category || 'General';
    if (descEl) descEl.textContent = getProductCleanDescription(product) || 'High quality product from DaShop.';

    // Stock Badge & Add Button Logic
    const stockBadge = document.getElementById('detail-stock-badge');
    const stockQty = typeof product.stock !== 'undefined' ? parseInt(product.stock) : 999;
    window.maxStock = stockQty;
    const outOfStockText = window.i18n ? window.i18n.t('out_of_stock') : 'Out of Stock';

    function updateDetailAddButton(isOutOfStock) {
        if (!addBtn) return;
        const addBtnText = addBtn.querySelector('[data-i18n="add_to_cart"]') || addBtn.querySelector('span:not(.material-symbols-outlined)');
        const btnPriceEl = document.getElementById('btnPriceTotal');
        const stepperDisplay = document.getElementById('quantityDisplay');

        if (isOutOfStock) {
            addBtn.disabled = true;
            addBtn.classList.remove('bg-primary', 'hover:bg-primary-container', 'active:scale-[0.98]', 'cursor-pointer');
            addBtn.classList.add('bg-surface-container-highest', 'text-outline', 'cursor-not-allowed', 'opacity-60');
            if (addBtnText) addBtnText.textContent = outOfStockText;
            if (btnPriceEl) btnPriceEl.classList.add('hidden');
            if (stepperDisplay) stepperDisplay.textContent = '0';
            window.currentQty = 0;
        } else {
            addBtn.disabled = false;
            addBtn.classList.add('bg-primary', 'hover:bg-primary-container', 'active:scale-[0.98]', 'cursor-pointer');
            addBtn.classList.remove('bg-surface-container-highest', 'text-outline', 'cursor-not-allowed', 'opacity-60');
            const cartText = window.i18n ? window.i18n.t('add_to_cart') : 'Add to Cart';
            if (addBtnText) addBtnText.textContent = cartText;
            if (btnPriceEl) btnPriceEl.classList.remove('hidden');
            if (stepperDisplay && (window.currentQty === 0 || stepperDisplay.textContent === '0')) {
                window.currentQty = 1;
                stepperDisplay.textContent = '1';
            }
        }
    }

    if (stockBadge) {
        if (stockQty <= 0) {
            stockBadge.className = 'px-2.5 py-0.5 rounded-full bg-error-container text-error font-label-sm font-bold';
            stockBadge.textContent = outOfStockText;
        } else if (stockQty <= 3) {
            stockBadge.className = 'px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-label-sm font-bold';
            stockBadge.textContent = `Only ${stockQty} left`;
        } else {
            stockBadge.className = 'px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-on-secondary-container font-label-sm font-bold';
            stockBadge.textContent = 'In Stock';
        }
    }

    updateDetailAddButton(stockQty <= 0);

    const images = getProductAllImages(product);
    const mainImg = images[0] || '📦';
    const isEmoji = !mainImg || mainImg.length <= 4 || !mainImg.startsWith('http');

    if (imgEl) {
        if (isEmoji) {
            imgEl.outerHTML = `<div id="detail-image" class="w-full h-full flex items-center justify-center text-8xl">${mainImg}</div>`;
        } else {
            imgEl.src = mainImg;
            imgEl.alt = product.name;
        }
    }

    // Render batch image thumbnails if multiple images exist
    if (thumbsContainer && images.length > 1) {
        let thumbsHtml = '';
        images.forEach((imgUrl, idx) => {
            thumbsHtml += `
                <button type="button" class="w-16 h-16 rounded-xl border-2 ${idx === 0 ? 'border-primary' : 'border-surface-container'} p-1 bg-surface-container-low shrink-0 overflow-hidden" onclick="switchProductDetailImage('${imgUrl}', this)">
                    <img src="${imgUrl}" class="w-full h-full object-contain">
                </button>
            `;
        });
        thumbsContainer.innerHTML = thumbsHtml;
        thumbsContainer.classList.remove('hidden');
    }

    // Options & Variations Handling
    let selectedVariation = null;
    let meta = null;
    if (product.description && product.description.startsWith('{')) {
        try { meta = JSON.parse(product.description); } catch(e) {}
    }

    const varsContainer = document.getElementById('detail-variations-container');
    const varsList = document.getElementById('detail-variations-list');
    if (varsContainer && varsList && meta?.variations && meta.variations.length > 0) {
        varsContainer.classList.remove('hidden');
        let varHtml = '';
        meta.variations.forEach((v, idx) => {
            const vPrice = parseFloat(v.price) || parseFloat(product.price);
            const vStock = typeof v.stock !== 'undefined' ? parseInt(v.stock) : stockQty;
            const isVOutOfStock = vStock <= 0;
            varHtml += `
                <button type="button" class="variation-pill px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all ${idx === 0 ? 'border-primary bg-primary text-on-primary shadow-sm' : 'border-surface-container bg-surface-container-low text-on-surface hover:bg-surface-container'} ${isVOutOfStock ? 'opacity-60' : ''}" data-var-idx="${idx}">
                    <span>${v.name}</span>
                    <span class="font-bold ml-1">$${vPrice.toFixed(2)}</span>
                    ${isVOutOfStock ? `<span class="ml-1 text-[10px] text-error font-bold">(${outOfStockText})</span>` : ''}
                </button>
            `;
        });
        varsList.innerHTML = varHtml;

        selectedVariation = meta.variations[0];
        if (selectedVariation) {
            const vStock = typeof selectedVariation.stock !== 'undefined' ? parseInt(selectedVariation.stock) : stockQty;
            window.maxStock = vStock;
            updateDetailAddButton(vStock <= 0);
            if (selectedVariation.price && priceEl) {
                priceEl.textContent = '$' + parseFloat(selectedVariation.price).toFixed(2);
            }
        }

        varsList.querySelectorAll('.variation-pill').forEach((pill, idx) => {
            pill.onclick = () => {
                varsList.querySelectorAll('.variation-pill').forEach(p => {
                    p.classList.remove('border-primary', 'bg-primary', 'text-on-primary', 'shadow-sm');
                    p.classList.add('border-surface-container', 'bg-surface-container-low', 'text-on-surface');
                });
                pill.classList.remove('border-surface-container', 'bg-surface-container-low', 'text-on-surface');
                pill.classList.add('border-primary', 'bg-primary', 'text-on-primary', 'shadow-sm');

                selectedVariation = meta.variations[idx];
                if (selectedVariation) {
                    const currentVarStock = typeof selectedVariation.stock !== 'undefined' ? parseInt(selectedVariation.stock) : stockQty;
                    window.maxStock = currentVarStock;
                    updateDetailAddButton(currentVarStock <= 0);

                    if (selectedVariation.price && priceEl) {
                        priceEl.textContent = '$' + parseFloat(selectedVariation.price).toFixed(2);
                    }
                    if (selectedVariation.imageUrl) {
                        window.switchProductDetailImage(selectedVariation.imageUrl);
                    }
                }
            };
        });
    } else if (varsContainer) {
        varsContainer.classList.add('hidden');
    }

    if (addBtn) {
        addBtn.onclick = () => {
            const currentStock = typeof window.maxStock !== 'undefined' ? window.maxStock : stockQty;
            if (currentStock <= 0) {
                showNotification(window.i18n ? window.i18n.t('product_out_of_stock') : 'Sorry, this product is out of stock!');
                return;
            }
            const qty = window.currentQty || 1;
            if (selectedVariation) {
                const varProduct = {
                    ...product,
                    id: `${product.id}-${(selectedVariation.id || selectedVariation.name).replace(/\s+/g, '-')}`,
                    name: `${product.name} (${selectedVariation.name})`,
                    price: parseFloat(selectedVariation.price) || parseFloat(product.price),
                    image: selectedVariation.imageUrl || getProductPrimaryImage(product),
                    stock: currentStock
                };
                addToCart(varProduct, qty, addBtn);
            } else {
                addToCart(product, qty, addBtn);
            }
        };
    }

    // Render Discover More / Recommended products
    await renderDiscoverMore(product);
}

// Render "Discover More" Suggestions on product.html
async function renderDiscoverMore(currentProduct) {
    const grid = document.getElementById('discover-more-grid');
    if (!grid || !currentProduct) return;

    if (allProducts.length === 0 && window.supabaseClient) {
        try {
            const { data } = await window.supabaseClient.from('products').select('*');
            if (data) allProducts = data.filter(p => p.category !== '__dashop_config__');
        } catch(e) {}
    }

    if (!allProducts || allProducts.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-4 text-center text-on-surface-variant text-sm">No other products available yet.</div>';
        return;
    }

    // Exclude current product and config rows
    const available = allProducts.filter(p => 
        String(p.id) !== String(currentProduct.id) && 
        p.category !== '__dashop_config__' &&
        (parseInt(p.stock) || 0) > 0
    );

    if (available.length === 0) {
        document.getElementById('discover-more-section')?.classList.add('hidden');
        return;
    }

    // Prioritize products in the same category
    const sameCategory = available.filter(p => p.category && p.category.toLowerCase() === (currentProduct.category || '').toLowerCase());
    const otherCategories = available.filter(p => !p.category || p.category.toLowerCase() !== (currentProduct.category || '').toLowerCase());

    // Suggestions: up to 8 items
    const suggestions = [...sameCategory, ...otherCategories].slice(0, 8);

    let html = '';
    suggestions.forEach(p => {
        const primaryImg = getProductPrimaryImage(p);
        const isEmoji = !primaryImg || primaryImg.length <= 4 || !primaryImg.startsWith('http');
        const imgHtml = isEmoji 
            ? `<div class="text-6xl flex items-center justify-center w-full h-full">${primaryImg || '📦'}</div>`
            : `<img class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" src="${primaryImg}" alt="${p.name}">`;

        const slug = getProductSlug(p);
        const category = p.category || 'General';
        const stockQty = typeof p.stock !== 'undefined' ? parseInt(p.stock) : 999;
        const isOutOfStock = stockQty <= 0;
        const outOfStockLabel = window.i18n ? window.i18n.t('out_of_stock') : 'Out of Stock';

        html += `
        <div class="group flex flex-col rounded-2xl bg-surface-container-lowest p-space-sm shadow-sm hover:shadow-md transition-all cursor-pointer ${isOutOfStock ? 'opacity-75' : ''}" onclick="viewProduct('${slug}', ${p.id})">
            <div class="relative w-full aspect-square rounded-xl bg-surface-container-low flex items-center justify-center overflow-hidden mb-space-xs">
                ${imgHtml}
                ${isOutOfStock ? `
                <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-2">
                    <span class="px-2 py-0.5 rounded-full bg-error text-white font-extrabold text-[10px] uppercase tracking-wider shadow-md text-center">
                        ${outOfStockLabel}
                    </span>
                </div>` : ''}
            </div>
            <div class="flex flex-col flex-1 justify-between">
                <div>
                    <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">${category}</span>
                    <h4 class="font-title-md text-title-md text-on-surface font-semibold line-clamp-2 leading-snug">
                        ${p.name}
                    </h4>
                </div>
                <div class="flex items-center justify-between pt-space-sm mt-space-2xs">
                    <span class="font-price-hero text-price-hero text-on-surface font-extrabold">$${parseFloat(p.price).toFixed(2)}</span>
                    ${isOutOfStock ? `
                    <button class="cart-btn w-9 h-9 rounded-full bg-surface-container-highest text-outline flex items-center justify-center shadow-none cursor-not-allowed opacity-60" onclick="event.stopPropagation(); window.showNotification('${outOfStockLabel}')" type="button" title="${outOfStockLabel}">
                        <span class="material-symbols-outlined text-[18px]">remove_shopping_cart</span>
                    </button>` : `
                    <button class="cart-btn w-9 h-9 rounded-full bg-primary hover:bg-primary-container text-on-primary flex items-center justify-center shadow-md active:scale-90 transition-all" onclick="event.stopPropagation(); window.addToCartById(${p.id}, this)" type="button">
                        <span class="material-symbols-outlined text-[18px]">add</span>
                    </button>`}
                </div>
            </div>
        </div>`;
    });

    grid.innerHTML = html;
}

// Switch main photo when thumbnail is clicked
window.switchProductDetailImage = function(url, thumbBtn) {
    const mainImg = document.getElementById('detail-image');
    if (mainImg) {
        if (mainImg.tagName === 'IMG') {
            mainImg.src = url;
        } else {
            mainImg.outerHTML = `<img id="detail-image" class="w-full h-full object-contain drop-shadow-md" src="${url}">`;
        }
    }
    if (thumbBtn && thumbBtn.parentElement) {
        thumbBtn.parentElement.querySelectorAll('button').forEach(b => {
            b.classList.remove('border-primary');
            b.classList.add('border-surface-container');
        });
        thumbBtn.classList.remove('border-surface-container');
        thumbBtn.classList.add('border-primary');
    }
};

// Route to product page by slug or id
function viewProduct(slug, id) {
    if (slug) {
        window.location.href = `/product?slug=${encodeURIComponent(slug)}`;
    } else {
        window.location.href = `/product?id=${id}`;
    }
}

// Notification Toast
function showNotification(message, duration = 3000) {
    const existing = document.querySelector('.dashop-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = 'dashop-notification fixed bottom-20 left-1/2 -translate-x-1/2 bg-surface-container-highest text-on-surface px-5 py-3 rounded-full shadow-2xl z-[9999] font-medium text-sm border border-primary/20 flex items-center gap-2 transition-all duration-300';
    notification.innerHTML = `<span class="material-symbols-outlined text-primary text-[18px]">check_circle</span><span>${message}</span>`;
    
    document.body.appendChild(notification);
    
    if (duration > 0) {
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translate(-50%, 20px)';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

// Open camera barcode scanner to search products
window.openBarcodeSearchScanner = function() {
    if (!window.openBarcodeScanner) {
        alert('Scanner module is loading, please try again in a moment.');
        return;
    }

    window.openBarcodeScanner((code) => {
        if (!code) return;
        console.log('Scanned barcode:', code);

        // Find exact match in allProducts
        const match = allProducts.find(p => {
            const b = getProductBarcode(p);
            return b && b.toLowerCase() === code.toLowerCase();
        });

        if (match) {
            showNotification(`Found product: ${match.name}!`);
            const slug = getProductSlug(match);
            setTimeout(() => {
                viewProduct(slug, match.id);
            }, 300);
        } else {
            // Fill search input and filter catalog
            showNotification(`Barcode scanned: ${code}`);
            const searchInput = document.getElementById('catalog-search') || document.getElementById('index-search-input');
            if (searchInput) {
                searchInput.value = code;
            }
            if (window.location.pathname.includes('catalog')) {
                window.filterByCategory('All');
            } else {
                window.location.href = `/catalog?q=${encodeURIComponent(code)}`;
            }
        }
    }, "Scan Product Barcode to Search");
};

// PWA Install Prompt Management
function initPWAInstallPrompt() {
    // Skip if on admin pages
    if (window.location.pathname.startsWith('/admin')) return;

    // Detect if already running as standalone PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone === true || 
                         document.referrer.includes('android-app://');
    if (isStandalone) {
        console.log('[PWA] App is already running in standalone mode');
        return;
    }

    // Check dismissal cooldown (24 hours)
    const DISMISSED_KEY = 'dashop_pwa_dismissed_at';
    const lastDismissed = localStorage.getItem(DISMISSED_KEY);
    if (lastDismissed) {
        const hoursPassed = (Date.now() - parseInt(lastDismissed, 10)) / (1000 * 60 * 60);
        if (hoursPassed < 24) {
            console.log('[PWA] Install prompt was recently dismissed. Waiting cooldown.');
            return;
        }
    }

    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase()) && !window.MSStream;

    window.addEventListener('appinstalled', () => {
        dismissPWAInstallModal();
        window.deferredInstallPrompt = null;
        localStorage.setItem(DISMISSED_KEY, (Date.now() + 30 * 24 * 60 * 60 * 1000).toString());
    });

    window.showPWAInstallPrompt = function(forceIOS = false) {
        if (isStandalone) return;
        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (dismissed && ((Date.now() - parseInt(dismissed, 10)) / (1000 * 60 * 60)) < 24) return;
        
        setTimeout(() => {
            renderPWAInstallModal(forceIOS || isIOS);
        }, 1200);
    };

    if (window.deferredInstallPrompt) {
        window.showPWAInstallPrompt(false);
    } else if (isIOS) {
        window.showPWAInstallPrompt(true);
    } else {
        // Fallback timer for browsers that don't immediately fire beforeinstallprompt
        setTimeout(() => {
            if (!document.getElementById('pwa-install-modal')) {
                window.showPWAInstallPrompt(false);
            }
        }, 3000);
    }
}

function renderPWAInstallModal(isIOS = false) {
    if (document.getElementById('pwa-install-modal')) return;

    const t = (key) => window.i18n ? window.i18n.t(key) : key;

    const container = document.createElement('div');
    container.id = 'pwa-install-modal';
    container.className = 'fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-[9990] max-w-sm sm:max-w-md w-auto bg-surface-container-lowest text-on-surface rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.25)] border border-surface-container-high transition-all duration-300 transform translate-y-8 opacity-0';

    container.innerHTML = `
        <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3.5">
                <img src="/icons/icon-192x192.png" alt="DASHOP" class="w-13 h-13 rounded-2xl shadow-md border border-surface-container-high object-cover flex-shrink-0" onerror="this.src='/icons/icon-512x512.png'">
                <div>
                    <span class="inline-block text-[10px] font-bold tracking-wider uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-1">DASHOP Web App</span>
                    <h3 class="font-extrabold text-on-surface text-base leading-tight" data-i18n="install_app_title">${t('install_app_title')}</h3>
                </div>
            </div>
            <button onclick="dismissPWAInstallModal()" class="w-8 h-8 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant flex items-center justify-center transition-colors -mr-1 -mt-1 flex-shrink-0" title="Close" aria-label="Close">
                <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
        </div>

        <p class="text-xs text-on-surface-variant font-medium mt-3 leading-relaxed" data-i18n="install_app_desc">
            ${t('install_app_desc')}
        </p>

        ${isIOS ? `
            <div class="mt-3.5 p-3 rounded-2xl bg-surface-container-low border border-surface-container space-y-2 text-xs text-on-surface">
                <div class="font-bold text-primary flex items-center gap-1.5" data-i18n="ios_install_guide">
                    <span class="material-symbols-outlined text-[18px]">apple</span>
                    <span>${t('ios_install_guide')}</span>
                </div>
                <div class="flex items-center gap-2 text-on-surface-variant">
                    <span class="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[11px] flex items-center justify-center flex-shrink-0">1</span>
                    <span data-i18n="ios_install_step1">${t('ios_install_step1')}</span>
                    <span class="material-symbols-outlined text-primary text-[18px] flex-shrink-0">ios_share</span>
                </div>
                <div class="flex items-center gap-2 text-on-surface-variant">
                    <span class="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[11px] flex items-center justify-center flex-shrink-0">2</span>
                    <span data-i18n="ios_install_step2">${t('ios_install_step2')}</span>
                    <span class="material-symbols-outlined text-primary text-[18px] flex-shrink-0">add_box</span>
                </div>
            </div>
            <button onclick="dismissPWAInstallModal()" class="w-full mt-3.5 py-2.5 px-4 bg-primary text-white font-bold text-xs rounded-xl shadow hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">check</span>
                <span data-i18n="not_now">${t('not_now')}</span>
            </button>
        ` : `
            <div class="mt-4 flex flex-col gap-2">
                <button id="pwa-install-action-btn" onclick="triggerPWAInstall()" class="w-full py-2.5 px-4 bg-primary text-white font-bold text-sm rounded-xl shadow-md hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">download</span>
                    <span data-i18n="install_btn">${t('install_btn')}</span>
                </button>
                <button onclick="dismissPWAInstallModal()" class="w-full py-1 text-xs font-semibold text-outline hover:text-on-surface transition-colors" data-i18n="not_now">
                    ${t('not_now')}
                </button>
            </div>
        `}
    `;

    document.body.appendChild(container);

    // Smooth entrance animation
    requestAnimationFrame(() => {
        container.classList.remove('translate-y-8', 'opacity-0');
        container.classList.add('translate-y-0', 'opacity-100');
    });

    if (window.i18n) {
        window.i18n.applyTranslations();
    }
}

function dismissPWAInstallModal() {
    const modal = document.getElementById('pwa-install-modal');
    if (modal) {
        modal.classList.add('translate-y-8', 'opacity-0');
        modal.classList.remove('translate-y-0', 'opacity-100');
        setTimeout(() => {
            if (modal && modal.parentElement) modal.remove();
        }, 350);
    }
    // Record dismissal timestamp to avoid annoying users
    localStorage.setItem('dashop_pwa_dismissed_at', Date.now().toString());
}

async function triggerPWAInstall() {
    if (window.deferredInstallPrompt) {
        try {
            window.deferredInstallPrompt.prompt();
            const choice = await window.deferredInstallPrompt.userChoice;
            if (choice && choice.outcome === 'accepted') {
                console.log('User accepted PWA installation');
                dismissPWAInstallModal();
            }
        } catch (err) {
            console.error('Error triggering PWA install prompt:', err);
        }
        window.deferredInstallPrompt = null;
    } else {
        // Fallback for browsers without direct programmatic prompt
        alert('To install DASHOP on this device, open your browser menu and choose "Add to Home screen" or "Install App".');
        dismissPWAInstallModal();
    }
}

// Export for global window access
window.viewProduct = viewProduct;
window.openCart = openCart;
window.closeCart = closeCart;
window.proceedToCheckout = proceedToCheckout;
window.closeCheckout = closeCheckout;
window.handleCheckout = handleCheckout;
window.applyPromoCode = applyPromoCode;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.showNotification = showNotification;
window.openCustomerOrdersModal = openCustomerOrdersModal;
window.closeCustomerOrdersModal = closeCustomerOrdersModal;
window.filterByCategory = filterByCategory;
window.searchCustomerOrder = searchCustomerOrder;
window.initPWAInstallPrompt = initPWAInstallPrompt;
window.renderPWAInstallModal = renderPWAInstallModal;
window.dismissPWAInstallModal = dismissPWAInstallModal;
window.triggerPWAInstall = triggerPWAInstall;
