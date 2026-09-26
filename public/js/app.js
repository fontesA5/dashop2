/**
 * DaShop Main Application Logic
 * Full-Stack Client, PWA, Cart, Animations, Autocomplete, Routing
 */

// Cart state management
let cart = [];
const STORAGE_KEY = 'dashop_cart';
let appliedPromo = null;
let allProducts = [];

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('SW registered:', reg.scope);
        }).catch(err => {
            console.log('SW registration failed:', err);
        });
    });
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    initCart();
    await loadProducts();
    await loadProductDetail();
    initSearchAutocomplete();
    initPromoBanner();
    initNewArrivals();
});

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
        address: formData.get('address') || '',
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
            else console.log('Order created successfully:', data);
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
                allProducts = data;
            }
        }
    } catch (e) {
        console.error('Error fetching products:', e);
    }

    if (!grid) return;

    const urlParams = new URLSearchParams(window.location.search);
    const q = urlParams.get('q');
    const cat = urlParams.get('category');
    let productsToRender = allProducts;

    if (q) {
        const query = q.toLowerCase();
        productsToRender = productsToRender.filter(p => 
            p.name.toLowerCase().includes(query) || 
            (p.category && p.category.toLowerCase().includes(query))
        );
    }
    if (cat && cat !== 'All') {
        productsToRender = productsToRender.filter(p => 
            p.category && p.category.toLowerCase() === cat.toLowerCase()
        );
    }

    renderProductGrid(productsToRender, grid);
}

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
            : `<img class="h-32 w-auto object-contain transition-transform group-hover:scale-105" src="${primaryImg}" alt="${p.name}">`;

        const slug = getProductSlug(p);
        const category = p.category || 'General';

        html += `
        <div class="group flex flex-col rounded-2xl bg-surface-container-lowest p-space-sm shadow-sm hover:shadow-md transition-all cursor-pointer" onclick="viewProduct('${slug}', ${p.id})">
            <div class="relative w-full aspect-square rounded-xl bg-surface-container-low flex items-center justify-center p-space-xs overflow-hidden mb-space-xs">
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
            : `<img class="h-32 w-auto object-contain transition-transform group-hover:scale-105" src="${primaryImg}" alt="${p.name}">`;

        const slug = getProductSlug(p);

        html += `
        <div class="w-48 shrink-0 flex flex-col rounded-2xl bg-surface-container-lowest p-space-sm shadow-md transition-transform duration-200 hover:-translate-y-1 cursor-pointer" onclick="viewProduct('${slug}', ${p.id})">
            <div class="relative w-full aspect-square rounded-xl bg-surface-container-low flex items-center justify-center p-space-sm overflow-hidden mb-space-xs">
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

// Dynamic Hero Promo Banner on index.html
async function initPromoBanner() {
    const bannerTitle = document.getElementById('hero-promo-title');
    const bannerSub = document.getElementById('hero-promo-sub');
    const promoCodeBadge = document.getElementById('hero-promo-code');
    if (!bannerTitle || !window.promoManager) return;

    const promo = await window.promoManager.getActivePromo();
    if (promo) {
        bannerTitle.textContent = promo.title;
        if (bannerSub) bannerSub.textContent = promo.description;
        if (promoCodeBadge) {
            promoCodeBadge.textContent = promo.promo_code;
            promoCodeBadge.parentElement.classList.remove('hidden');
        }
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
                if (data) product = data.find(p => getProductSlug(p) === slug);
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
        window.location.href = `/product.html?slug=${encodeURIComponent(slug)}`;
    } else {
        window.location.href = `/product.html?id=${id}`;
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
