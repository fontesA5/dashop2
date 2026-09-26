/**
 * DaShop Main Application Logic
 * Full-Stack Client, PWA, Cart, Animations, Autocomplete, Routing
 */

// Cart state management
let cart = [];
const STORAGE_KEY = 'dashop_cart';
let appliedPromo = null;
let allProducts = [];

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
    if (!product) return;
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        const primaryImage = getProductPrimaryImage(product);
        cart.push({
            id: product.id,
            name: product.name,
            price: parseFloat(product.price) || 0,
            image: primaryImage,
            quantity: quantity
        });
    }
    
    saveCart();
    if (triggerBtn) {
        triggerAddToCartAnimation(triggerBtn);
    }
    const msg = window.i18n ? window.i18n.t('product_added') : 'Added to cart!';
    showNotification(`${product.name}: ${msg}`);
}

window.addToCartById = function(id, btnElement = null) {
    const product = allProducts.find(p => String(p.id) === String(id));
    if (product) {
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
    const formData = new FormData(form);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discount = 0;
    if (appliedPromo) {
        discount = appliedPromo.discount_type === 'percentage' 
            ? (subtotal * appliedPromo.discount_value) / 100 
            : appliedPromo.discount_value;
    }
    const finalTotal = Math.max(0, subtotal - discount);

    const orderPayload = {
        customer_name: formData.get('name') || 'Guest Customer',
        customer_email: formData.get('email') || '',
        customer_phone: formData.get('phone') || '',
        total: finalTotal,
        discount_code: appliedPromo ? appliedPromo.promo_code : null,
        items_json: JSON.stringify({
            items: cart,
            subtotal: subtotal,
            discount: discount,
            promo_code: appliedPromo ? appliedPromo.promo_code : null,
            phone: formData.get('phone') || ''
        }),
        status: 'pending'
    };

    try {
        if (window.supabaseClient) {
            const { data, error } = await window.supabaseClient.from('orders').insert([orderPayload]).select();
            if (error) console.error('Order save error:', error);
            else {
                console.log('Order created successfully:', data);
                if (data && data[0]) {
                    const custOrders = JSON.parse(localStorage.getItem('dashop_customer_orders') || '[]');
                    custOrders.unshift({
                        id: data[0].id,
                        total: data[0].total,
                        status: data[0].status || 'pending',
                        items_count: cart.reduce((s, i) => s + (i.quantity || 1), 0),
                        date: new Date().toISOString()
                    });
                    localStorage.setItem('dashop_customer_orders', JSON.stringify(custOrders));
                }
            }
        }

        // Reset cart and checkout state
        cart = [];
        appliedPromo = null;
        saveCart();
        closeCheckout();
        form.reset();

        const successMsg = window.i18n ? window.i18n.t('order_success') : 'Order placed successfully!';
        showNotification(successMsg, 5000);
    } catch (e) {
        console.error('Checkout error:', e);
        alert('Failed to place order: ' + e.message);
    }
}

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

    let filtered = allProducts;
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
        resultBox.innerHTML = `<span class="text-error">Please enter an Order ID or Email.</span>`;
        return;
    }

    resultBox.innerHTML = `<span class="text-on-surface-variant">Looking up order...</span>`;

    try {
        let query = window.supabaseClient.from('orders').select('*');
        if (/^\d+$/.test(term)) {
            query = query.eq('id', parseInt(term));
        } else {
            query = query.ilike('customer_email', term);
        }

        const { data, error } = await query.order('created_at', { ascending: false }).limit(3);
        if (error || !data || data.length === 0) {
            resultBox.innerHTML = `<span class="text-error">No order found matching "${term}".</span>`;
            return;
        }

        let html = '<div class="flex flex-col gap-2 mt-2">';
        data.forEach(o => {
            const dateStr = new Date(o.created_at).toLocaleDateString();
            const isCompleted = o.status === 'completed';
            const statusClass = isCompleted ? 'text-secondary font-bold' : 'text-primary font-bold';
            html += `
                <div class="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container flex flex-col gap-0.5">
                    <div class="flex justify-between items-center font-bold">
                        <span>#${o.id} - ${o.customer_name}</span>
                        <span class="${statusClass} uppercase text-[10px]">${o.status || 'Pending'}</span>
                    </div>
                    <div class="flex justify-between items-center text-on-surface-variant text-[11px]">
                        <span>${dateStr} · ${o.customer_phone || 'Order'}</span>
                        <span class="font-extrabold text-on-surface">$${parseFloat(o.total || 0).toFixed(2)}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        resultBox.innerHTML = html;
    } catch (err) {
        console.error('Error tracking order:', err);
        resultBox.innerHTML = `<span class="text-error">Lookup failed: ${err.message}</span>`;
    }
};

function renderProductGrid(products, grid) {
    if (!grid) return;
    if (products.length === 0) {
        const emptyMsg = window.i18n ? window.i18n.t('no_products') : 'No products found.';
        grid.innerHTML = `<div class="col-span-full p-8 text-center text-on-surface-variant font-medium">${emptyMsg}</div>`;
        return;
    }

    let html = '';
    products.forEach(p => {
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
                    <span class="font-label-sm text-label-sm text-on-surface-variant">${category}</span>
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
    const newItems = allProducts.slice(0, 8);
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
                p.name.toLowerCase().includes(val) || 
                (p.category && p.category.toLowerCase().includes(val))
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

    if (addBtn) {
        addBtn.onclick = () => {
            const qty = window.currentQty || 1;
            addToCart(product, qty, addBtn);
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
        p.category !== '__dashop_config__'
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
