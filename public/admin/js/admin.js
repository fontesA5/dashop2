/**
 * DaShop Admin Management Module
 * Full-Stack Dashboard KPIs, Real Order Management, Product CRUD with Batch Images, and Promos
 */

let adminProducts = [];
let adminOrders = [];
let editingProductId = null;
let uploadedImageFiles = [];
let wasManageProductsOpen = false;
let knownAdminOrderIds = new Set();
let isInitialAdminOrderLoad = true;
let titleFlashInterval = null;
let originalDocumentTitle = document.title || 'DASHOP Admin';

// Notification Toast for Admin
function showNotification(message, duration = 3000) {
    const existing = document.querySelector('.dashop-admin-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'dashop-admin-notification fixed bottom-10 left-1/2 -translate-x-1/2 bg-surface-container-highest text-on-surface px-5 py-3 rounded-full shadow-2xl z-[99999] font-medium text-sm border border-primary/20 flex items-center gap-2 transition-all duration-300';
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
window.showNotification = showNotification;

// Admin Session Verification — always requires login
function checkAdminAuth() {
    let raw = null;
    try { raw = localStorage.getItem('dashop_admin_session'); } catch(e) {}

    // Cookie fallback in case localStorage was not shared across contexts
    if (!raw) {
        const match = document.cookie.match(/(?:^|;\s*)dashop_admin_session=([^;]*)/);
        if (match) {
            try {
                raw = decodeURIComponent(match[1]);
                localStorage.setItem('dashop_admin_session', raw);
            } catch(e) {}
        }
    }

    const isLoginPage = window.location.pathname.includes('login');

    if (!raw) {
        if (!isLoginPage) {
            window.location.replace('/admin/login');
            return false;
        }
        return false;
    }

    // Validate session JSON
    let session = null;
    try {
        session = JSON.parse(raw);
    } catch(e) {
        try { localStorage.removeItem('dashop_admin_session'); } catch(err) {}
        document.cookie = 'dashop_admin_session=; path=/; max-age=0';
        if (!isLoginPage) {
            window.location.replace('/admin/login');
        }
        return false;
    }

    if (!session || !session.email) {
        try { localStorage.removeItem('dashop_admin_session'); } catch(err) {}
        document.cookie = 'dashop_admin_session=; path=/; max-age=0';
        if (!isLoginPage) {
            window.location.replace('/admin/login');
        }
        return false;
    }

    // Sync cookie for domain
    document.cookie = `dashop_admin_session=${encodeURIComponent(raw)}; path=/; max-age=86400; SameSite=Lax`;

    // Update email badge in admin UI if present
    const emailEl = document.getElementById('admin-user-email');
    if (emailEl) emailEl.textContent = session.email;

    return true;
}

window.handleAdminSignOut = function() {
    try { localStorage.removeItem('dashop_admin_session'); } catch(e) {}
    document.cookie = 'dashop_admin_session=; path=/; max-age=0';
    if (window.supabaseClient && window.supabaseClient.auth) {
        window.supabaseClient.auth.signOut().catch(() => {});
    }
    window.location.replace('/admin/login');
};

async function initAdmin() {
    if (!checkAdminAuth()) return;
    await loadAdminData();
    initAdminModals();
    initAdminOrderAlerts();
    setupAdminRealtimeOrderListener();
    startAdminOrdersPolling();
    checkHighlightedOrder();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
} else {
    initAdmin();
}

// Load all data from Supabase for Admin
async function loadAdminData() {
    try {
        if (window.supabaseClient) {
            // Load Products
            const { data: pData, error: pErr } = await window.supabaseClient
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });
            if (!pErr && pData) adminProducts = pData.filter(p => p.category !== '__dashop_config__');

            // Load Orders
            const { data: oData, error: oErr } = await window.supabaseClient
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });
            if (!oErr && oData) {
                adminOrders = oData;
                if (isInitialAdminOrderLoad) {
                    knownAdminOrderIds.clear();
                    oData.forEach(o => knownAdminOrderIds.add(String(o.id)));
                    isInitialAdminOrderLoad = false;
                }
            }
        }
    } catch (e) {
        console.error('Error fetching admin data:', e);
    }

    renderDashboardKPIs();
    renderRecentOrdersFeed();
    renderOrdersPage();
    renderProductsList();
}

// Helper: Robust image extraction across direct URL and JSON metadata
function getAdminProductPrimaryImage(p) {
    if (!p) return '📦';
    // 1. Direct http/data URL
    if (p.image && (p.image.startsWith('http') || p.image.startsWith('data:image') || p.image.startsWith('/'))) {
        return p.image;
    }
    // 2. Metadata inside description JSON
    if (p.description && p.description.startsWith('{')) {
        try {
            const meta = JSON.parse(p.description);
            if (Array.isArray(meta.images) && meta.images.length > 0) {
                const u = typeof meta.images[0] === 'string' ? meta.images[0] : (meta.images[0] && meta.images[0].url);
                if (u && (u.startsWith('http') || u.startsWith('data:image') || u.startsWith('/'))) {
                    return u;
                }
            }
            if (meta.imageUrl && (meta.imageUrl.startsWith('http') || meta.imageUrl.startsWith('data:image') || meta.imageUrl.startsWith('/'))) {
                return meta.imageUrl;
            }
            if (meta.image && (meta.image.startsWith('http') || meta.image.startsWith('data:image') || meta.image.startsWith('/'))) {
                return meta.image;
            }
        } catch (e) {}
    }
    return p.image || '📦';
}

// 1. Calculate & Render Real KPIs on Dashboard
function renderDashboardKPIs() {
    const revEl = document.getElementById('kpi-revenue');
    const invEl = document.getElementById('kpi-inventory');
    const invItemsEl = document.getElementById('kpi-inventory-items');
    const ordersEl = document.getElementById('kpi-orders');
    const prodsEl = document.getElementById('kpi-products');
    const lowStockCountEl = document.getElementById('kpi-low-stock-count');
    const lowStockAlertEl = document.getElementById('low-stock-alert-box');

    // Revenue
    const totalRev = adminOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    if (revEl) revEl.textContent = '$' + totalRev.toFixed(2);

    // Inventory Value & count
    const totalStock = adminProducts.reduce((sum, p) => sum + (parseInt(p.stock) || 0), 0);
    const totalInvVal = adminProducts.reduce((sum, p) => sum + ((parseFloat(p.price) || 0) * (parseInt(p.stock) || 0)), 0);
    if (invEl) invEl.textContent = '$' + totalInvVal.toFixed(2);
    if (invItemsEl) invItemsEl.textContent = `${totalStock} items`;

    // Orders Count
    if (ordersEl) ordersEl.textContent = adminOrders.length;

    // Products Count
    if (prodsEl) prodsEl.textContent = adminProducts.length;

    // Out of stock items (stock <= 0)
    const outOfStock = adminProducts.filter(p => (parseInt(p.stock) || 0) <= 0);
    const outOfStockListEl = document.getElementById('out-of-stock-products-list');
    const outOfStockBadgeEl = document.getElementById('out-of-stock-badge');

    if (lowStockCountEl) lowStockCountEl.textContent = `${outOfStock.length} out of stock`;
    if (outOfStockBadgeEl) outOfStockBadgeEl.textContent = `${outOfStock.length} item${outOfStock.length === 1 ? '' : 's'}`;

    if (lowStockAlertEl) {
        if (outOfStock.length > 0) {
            lowStockAlertEl.classList.remove('hidden');
            const alertText = lowStockAlertEl.querySelector('#low-stock-text');
            if (alertText) {
                alertText.textContent = `${outOfStock.length} product${outOfStock.length === 1 ? '' : 's'} with 0 stock (hidden from customer catalog until restocked).`;
            }

            if (outOfStockListEl) {
                outOfStockListEl.innerHTML = outOfStock.map(p => {
                    const primaryImg = getAdminProductPrimaryImage(p);
                    const isEmoji = !primaryImg || primaryImg.length <= 4 || (!primaryImg.startsWith('http') && !primaryImg.startsWith('data:image') && !primaryImg.startsWith('/'));
                    const priceFormatted = '$' + parseFloat(p.price || 0).toFixed(2);
                    const safeAlt = (p.name || 'Product').replace(/"/g, '&quot;');

                    const imgEl = isEmoji 
                        ? `<div class="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-surface-container flex items-center justify-center text-3xl shrink-0 shadow-xs">${primaryImg}</div>`
                        : `<img src="${primaryImg}" loading="lazy" onerror="this.onerror=null; this.src='/icons/icon-192x192.png'" class="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-contain bg-surface-container-low p-1 border border-surface-container/80 shrink-0 shadow-xs" alt="${safeAlt}">`;

                    return `
                    <div onclick="openProductDetailById(${p.id})" class="group flex items-center justify-between p-3 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs hover:border-primary/50 hover:shadow-md transition-all cursor-pointer" title="Click to view product details">
                        <div class="flex items-center gap-3 min-w-0">
                            ${imgEl}
                            <div class="min-w-0">
                                <h4 class="font-bold text-xs sm:text-sm text-on-surface truncate leading-tight group-hover:text-primary transition-colors">${p.name || 'Unnamed Product'}</h4>
                                <div class="flex items-center gap-1.5 mt-1 text-[11px] text-on-surface-variant font-medium">
                                    <span class="px-2 py-0.5 rounded-full bg-error-container text-error font-extrabold text-[10px]">0 in stock</span>
                                    <span>•</span>
                                    <span class="font-bold text-on-surface">${priceFormatted}</span>
                                    <span>•</span>
                                    <span class="truncate text-outline">${p.category || 'General'}</span>
                                </div>
                            </div>
                        </div>
                        <button onclick="event.stopPropagation(); editProduct(${p.id})" class="px-3 py-2 rounded-xl bg-surface-container hover:bg-primary hover:text-white text-primary text-xs font-bold transition-all shrink-0 ml-2 active:scale-95 flex items-center gap-1 border border-surface-container" title="Restock product">
                            <span class="material-symbols-outlined text-[16px]">edit_note</span>
                            <span>Restock</span>
                        </button>
                    </div>
                    `;
                }).join('');
            }
        } else {
            lowStockAlertEl.classList.add('hidden');
        }
    }
}

// 2. Render Recent Orders Feed on Dashboard
function renderRecentOrdersFeed() {
    const container = document.getElementById('recent-orders-feed');
    if (!container) return;

    if (adminOrders.length === 0) {
        container.innerHTML = `
            <div class="p-space-base rounded-2xl bg-surface-container-lowest text-center text-on-surface-variant">
                <span class="material-symbols-outlined text-[32px] text-outline mb-1">receipt_long</span>
                <p class="font-title-md font-semibold">No orders yet</p>
                <p class="font-body-sm text-outline">New customer orders will appear here automatically.</p>
            </div>
        `;
        return;
    }

    let html = '';
    const recent = adminOrders.slice(0, 5);

    recent.forEach((o, idx) => {
        const shortId = '#' + String(o.id).padStart(6, '0');
        const initials = (o.customer_name || '??').substring(0, 2).toUpperCase();
        const date = new Date(o.created_at).toLocaleDateString() + ' ' + new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isCompleted = o.status === 'completed';
        const statusColor = isCompleted ? 'bg-secondary-container/40 text-on-secondary-container' : 'bg-surface-dim text-on-surface';

        let itemCount = 0;
        try {
            const parsed = JSON.parse(o.items_json);
            itemCount = Array.isArray(parsed) ? parsed.length : (parsed.items ? parsed.items.length : 1);
        } catch (e) {
            itemCount = 1;
        }

        html += `
        <div class="p-space-base rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-xs">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 min-w-0">
                    <div class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary font-bold font-label-md">
                        ${initials}
                    </div>
                    <div class="min-w-0">
                        <span class="font-title-md text-title-md text-on-surface font-semibold block truncate">${o.customer_name}</span>
                        <span class="font-body-sm text-body-sm text-on-surface-variant font-mono">${shortId} • ${date}</span>
                    </div>
                </div>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full ${statusColor} font-label-sm font-bold capitalize">
                    ${o.status || 'Pending'}
                </span>
            </div>
            <div class="flex items-center justify-between pt-space-xs">
                <span class="font-body-sm text-on-surface-variant">${itemCount} items • ${o.address || 'Standard Delivery'}</span>
                <span class="font-title-md font-extrabold text-on-surface">$${parseFloat(o.total || 0).toFixed(2)}</span>
            </div>
        </div>
        `;
    });

    container.innerHTML = html;
}

// 3. Render Orders on orders.html with Status Change & Delete
function renderOrdersPage() {
    const container = document.getElementById('orders-container-dynamic');
    if (!container) return;

    if (adminOrders.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center text-on-surface-variant bg-surface-container-lowest rounded-2xl">
                <span class="material-symbols-outlined text-[48px] text-outline mb-2">shopping_cart_checkout</span>
                <h3 class="font-headline-md font-bold text-on-surface">No Orders Received</h3>
                <p class="font-body-sm text-outline mt-1">Orders placed on the storefront will appear here instantly.</p>
            </div>
        `;
        return;
    }

    let html = '';
    adminOrders.forEach((o, index) => {
        const shortId = '#' + String(o.id).padStart(6, '0');
        const initials = (o.customer_name || '??').substring(0, 2).toUpperCase();
        const date = new Date(o.created_at).toLocaleString();
        const isCompleted = o.status === 'completed';
        const statusColor = isCompleted ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-dim text-on-surface';
        const statusIcon = isCompleted ? 'check_circle' : 'schedule';

        let items = [];
        let discountCode = o.discount_code || '';
        let customerPhone = o.customer_phone || '';
        let orderAddress = o.address || '';
        try {
            const parsed = typeof o.items_json === 'string' ? JSON.parse(o.items_json) : o.items_json;
            if (Array.isArray(parsed)) items = parsed;
            else if (parsed.items) {
                items = parsed.items;
                if (parsed.promo_code) discountCode = parsed.promo_code;
                if (parsed.phone) customerPhone = parsed.phone;
                if (parsed.address && !orderAddress) orderAddress = parsed.address;
            }
        } catch (e) {}
        if (!customerPhone && o.address && o.address.startsWith('Phone: ')) {
            customerPhone = o.address.replace('Phone: ', '').trim();
        }

        const itemsSummary = items.map(i => `${i.name} (x${i.quantity || 1})`).join(', ') || 'Custom Items';

        html += `
        <article id="order-card-${o.id}" class="order-card bg-surface-container-lowest rounded-xl shadow-sm transition-all duration-200 overflow-hidden" data-order-id="${shortId}" data-status="${(o.status || 'pending').toLowerCase()}">
            <div class="p-space-base flex flex-col gap-space-xs cursor-pointer select-none" onclick="toggleOrderDetails('order-${index}')">
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-space-sm min-w-0">
                        <div class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-title-md text-primary font-bold shrink-0">
                            ${initials}
                        </div>
                        <div class="min-w-0">
                            <h2 class="font-title-md text-title-md text-on-surface font-semibold tracking-tight truncate">${o.customer_name}</h2>
                            <div class="flex items-center gap-1.5 mt-0.5 text-xs text-on-surface-variant font-mono">
                                <span class="px-1.5 py-0.5 rounded bg-surface-container">${shortId}</span>
                                <span>•</span>
                                <span>${date}</span>
                                ${customerPhone ? `<span>•</span><span class="text-primary font-bold">📞 ${customerPhone}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <button aria-label="Toggle details" class="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container transition-transform duration-200" id="icon-order-${index}">
                        <span class="material-symbols-outlined text-[20px]">expand_more</span>
                    </button>
                </div>
                <div class="flex items-center justify-between pt-space-xs">
                    <div class="flex items-baseline gap-space-xs">
                        <span class="font-price-hero text-price-hero text-on-surface font-extrabold">$${parseFloat(o.total || 0).toFixed(2)}</span>
                        <span class="font-label-md text-outline">(${items.length} items)</span>
                    </div>
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${statusColor} font-label-md font-semibold capitalize">
                        <span class="material-symbols-outlined text-[14px]">${statusIcon}</span>
                        ${o.status || 'Pending'}
                    </span>
                </div>
            </div>
            <div class="hidden bg-surface-container-low px-space-base pb-space-base pt-space-xs flex flex-col gap-space-sm border-t border-surface-container" id="details-order-${index}">
                <!-- Customer Contact Card -->
                <div class="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm border border-surface-container/60">
                    <span class="font-label-sm text-on-surface-variant uppercase tracking-wider block font-bold">Customer Contact</span>
                    <div class="flex items-center gap-x-4 gap-y-1 mt-1">
                        ${customerPhone ? `<p class="font-title-md text-primary font-bold flex items-center gap-1.5"><span class="material-symbols-outlined text-[18px]">call</span> ${customerPhone}</p>` : '<p class="font-body-sm text-on-surface-variant">No phone number</p>'}
                    </div>
                </div>

                <!-- Items Purchased with Photos (Organized in Cards) -->
                <div class="bg-surface-container-lowest p-space-sm rounded-2xl shadow-sm border border-surface-container/60">
                    <div class="flex items-center justify-between mb-3 px-0.5">
                        <div class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[18px] text-primary">shopping_bag</span>
                            <span class="font-label-sm text-on-surface font-bold uppercase tracking-wider">Items Purchased (${items.length})</span>
                        </div>
                        <span class="text-[11px] text-on-surface-variant font-medium hidden sm:inline">Tap card to inspect</span>
                    </div>

                    <!-- Responsive Product Cards Grid -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        ${items.map((item, itemIdx) => {
                            let img = item.image;
                            let matchedProd = null;
                            if (adminProducts.length > 0) {
                                matchedProd = adminProducts.find(p => String(p.id) === String(item.id) || p.name === item.name);
                                if ((!img || !img.startsWith('http')) && matchedProd) {
                                    img = getAdminProductPrimaryImage(matchedProd);
                                }
                            }
                            const isEmoji = !img || img.length <= 4 || (!img.startsWith('http') && !img.startsWith('data:image') && !img.startsWith('/'));
                            const unitPrice = parseFloat(item.price || (matchedProd ? matchedProd.price : 0) || 0).toFixed(2);
                            const qty = parseInt(item.quantity || 1, 10);
                            const subtotal = (parseFloat(unitPrice) * qty).toFixed(2);
                            const stock = matchedProd ? matchedProd.stock : null;
                            const safeAlt = (item.name || 'Product').replace(/"/g, '&quot;');

                            const imgEl = isEmoji 
                                ? `<div class="w-full h-44 sm:h-48 rounded-xl bg-surface-container flex items-center justify-center text-5xl shrink-0 shadow-inner">${img || '📦'}</div>`
                                : `<img src="${img}" loading="lazy" alt="${safeAlt}" onerror="this.onerror=null; this.src='/icons/icon-192x192.png'" class="w-full h-44 sm:h-48 rounded-xl object-contain bg-surface-container p-2 shrink-0 shadow-inner border border-surface-container/60 transition-transform duration-200 group-hover:scale-[1.03]">`;

                            return `
                                <div onclick="openOrderItemModal(${o.id}, ${itemIdx})" class="group bg-surface-container-low/70 hover:bg-surface-container-low border border-surface-container/60 hover:border-primary/50 rounded-2xl p-3 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between relative active:scale-[0.99]" title="Click to view product details">
                                    <!-- Photo Section with Quantity Badge -->
                                    <div class="relative w-full overflow-hidden rounded-xl bg-surface-container flex items-center justify-center">
                                        ${imgEl}
                                        <span class="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-primary text-white text-xs font-black shadow-md flex items-center gap-1 z-10">
                                            <span>Qty:</span>
                                            <span>${qty}</span>
                                        </span>
                                        ${stock !== null ? (stock <= 0 ? `<span class="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-error-container text-error text-[10px] font-bold shadow-sm z-10">Out of Stock</span>` : '') : ''}
                                    </div>

                                    <!-- Product Info Section (Full Name, No Truncation) -->
                                    <div class="mt-2.5 flex-1 flex flex-col justify-between">
                                        <div>
                                            <h3 class="font-title-md text-sm sm:text-base font-bold text-on-surface leading-snug break-words">
                                                ${item.name}
                                            </h3>
                                            <p class="font-body-sm text-xs text-on-surface-variant mt-1">
                                                Unit Price: <span class="font-semibold text-on-surface font-mono">$${unitPrice}</span>
                                            </p>
                                        </div>

                                        <!-- Bottom Price & Action Row -->
                                        <div class="mt-3 pt-2.5 border-t border-surface-container/60 flex items-center justify-between">
                                            <div class="flex flex-col">
                                                <span class="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Subtotal</span>
                                                <span class="font-extrabold text-base text-primary font-mono">$${subtotal}</span>
                                            </div>
                                            <div class="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-xl transition-colors">
                                                <span class="material-symbols-outlined text-[16px]">visibility</span>
                                                <span>Details</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    ${discountCode ? `<div class="mt-3 pt-2 border-t border-surface-container/60 text-xs font-semibold text-secondary flex items-center gap-1"><span class="material-symbols-outlined text-xs">local_offer</span> Promo Applied: ${discountCode}</div>` : ''}
                </div>
                <div class="flex items-center justify-between pt-2">
                    <div class="flex items-center gap-2">
                        <button onclick="toggleOrderStatus(${o.id}, '${o.status}')" class="px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1 ${isCompleted ? 'bg-surface-container text-on-surface hover:bg-surface-container-high' : 'bg-secondary text-on-secondary hover:bg-secondary-container'}">
                            <span class="material-symbols-outlined text-[16px]">${isCompleted ? 'history' : 'check'}</span>
                            <span>Mark as ${isCompleted ? 'Pending' : 'Completed'}</span>
                        </button>
                    </div>
                    <button onclick="deleteOrder(${o.id})" class="px-3 py-2 rounded-xl bg-error-container/40 text-error hover:bg-error-container font-label-sm font-bold flex items-center gap-1 transition-colors">
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                        <span>Delete</span>
                    </button>
                </div>
            </div>
        </article>`;
    });

    container.innerHTML = html;
    if (typeof window.filterOrdersLocally === 'function') {
        window.filterOrdersLocally();
    }
}

// Product Detail Modal Handlers for Orders Page & Out of Stock List
window.openProductDetailModal = function(itemOrData) {
    let item;
    if (typeof itemOrData === 'string') {
        try {
            item = JSON.parse(decodeURIComponent(itemOrData));
        } catch (e) {
            console.error('Error parsing product modal data:', e);
            return;
        }
    } else if (typeof itemOrData === 'object' && itemOrData !== null) {
        item = itemOrData;
    } else {
        return;
    }

    const modal = document.getElementById('product-detail-modal');
    const body = document.getElementById('product-detail-modal-body');
    const storeLink = document.getElementById('product-modal-store-link');
    const restockBtn = document.getElementById('product-modal-restock-btn');
    if (!modal || !body) return;

    let matchedProd = null;
    if (adminProducts && adminProducts.length > 0) {
        matchedProd = adminProducts.find(p => String(p.id) === String(item.id) || p.name === item.name);
    }

    let img = item.image;
    if ((!img || !img.startsWith('http')) && matchedProd) {
        img = getAdminProductPrimaryImage(matchedProd);
    }
    const isEmoji = !img || img.length <= 4 || (!img.startsWith('http') && !img.startsWith('data:image') && !img.startsWith('/'));

    const unitPrice = parseFloat(item.price || (matchedProd ? matchedProd.price : 0) || 0).toFixed(2);
    const qty = parseInt(item.quantity || 1, 10);
    const subtotal = (parseFloat(unitPrice) * qty).toFixed(2);
    const stock = matchedProd ? (matchedProd.stock ?? null) : (item.stock !== undefined ? item.stock : null);
    const category = (matchedProd && matchedProd.category) ? matchedProd.category : (item.category || 'General');
    const prodId = matchedProd ? matchedProd.id : item.id;
    const isOutOfStockContext = Boolean(item.fromOutOfStockList || (stock !== null && parseInt(stock) <= 0 && (!item.quantity || item.quantity <= 1)));

    // Clean description text
    let descriptionText = '';
    const rawDesc = (matchedProd && matchedProd.description) ? matchedProd.description : (item.description || '');
    if (rawDesc) {
        if (rawDesc.startsWith('{')) {
            try {
                const meta = JSON.parse(rawDesc);
                descriptionText = meta.description || meta.text || '';
            } catch(e) {
                descriptionText = rawDesc;
            }
        } else {
            descriptionText = rawDesc;
        }
    }

    const badgeText = isOutOfStockContext ? 'Out of Stock (0)' : `Qty: ${qty}`;
    const badgeClass = isOutOfStockContext ? 'bg-error-container text-error' : 'bg-primary text-white';

    const imgDisplay = isEmoji
        ? `<div class="w-full h-56 sm:h-64 rounded-2xl bg-surface-container flex items-center justify-center text-6xl shadow-inner">${img || '📦'}</div>`
        : `<img src="${img}" loading="lazy" alt="${item.name}" onerror="this.onerror=null; this.src='/icons/icon-192x192.png'" class="w-full h-56 sm:h-64 rounded-2xl object-contain bg-surface-container p-3 shadow-inner border border-surface-container/60">`;

    const metricsGrid = isOutOfStockContext ? `
        <div class="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container/80 grid grid-cols-3 gap-2 text-center">
            <div class="flex flex-col">
                <span class="text-[11px] text-outline font-semibold uppercase tracking-wider">Price</span>
                <span class="font-bold text-sm text-on-surface mt-0.5 font-mono">$${unitPrice}</span>
            </div>
            <div class="flex flex-col border-x border-surface-container">
                <span class="text-[11px] text-outline font-semibold uppercase tracking-wider">Status</span>
                <span class="font-bold text-sm text-error mt-0.5 font-mono">0 in stock</span>
            </div>
            <div class="flex flex-col">
                <span class="text-[11px] text-outline font-semibold uppercase tracking-wider">Category</span>
                <span class="font-bold text-sm text-on-surface mt-0.5 truncate">${category}</span>
            </div>
        </div>
    ` : `
        <div class="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container/80 grid grid-cols-3 gap-2 text-center">
            <div class="flex flex-col">
                <span class="text-[11px] text-outline font-semibold uppercase tracking-wider">Unit Price</span>
                <span class="font-bold text-sm text-on-surface mt-0.5 font-mono">$${unitPrice}</span>
            </div>
            <div class="flex flex-col border-x border-surface-container">
                <span class="text-[11px] text-outline font-semibold uppercase tracking-wider">Quantity</span>
                <span class="font-bold text-sm text-primary mt-0.5 font-mono">×${qty}</span>
            </div>
            <div class="flex flex-col">
                <span class="text-[11px] text-outline font-semibold uppercase tracking-wider">Subtotal</span>
                <span class="font-extrabold text-sm text-on-surface mt-0.5 font-mono">$${subtotal}</span>
            </div>
        </div>
    `;

    let variationsList = [];
    let mainBarcode = (matchedProd && matchedProd.barcode) ? matchedProd.barcode : (item.barcode || '');
    if (rawDesc && rawDesc.startsWith('{')) {
        try {
            const meta = JSON.parse(rawDesc);
            if (meta.barcode && !mainBarcode) mainBarcode = meta.barcode;
            if (Array.isArray(meta.variations)) variationsList = meta.variations;
        } catch(e) {}
    }

    body.innerHTML = `
        <div class="flex flex-col gap-3.5">
            <!-- Big Image with Quantity or Out of Stock Badge -->
            <div class="relative w-full overflow-hidden rounded-2xl bg-surface-container">
                ${imgDisplay}
                <div class="absolute top-3 right-3 px-3 py-1 rounded-full ${badgeClass} font-black text-xs shadow-md">
                    ${badgeText}
                </div>
            </div>

            <!-- Title & Category & Stock -->
            <div>
                <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span class="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm font-semibold text-xs">${category}</span>
                    ${stock !== null ? (parseInt(stock) > 0 ? `<span class="px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-on-secondary-container font-label-sm font-bold text-xs">In Stock: ${stock}</span>` : `<span class="px-2.5 py-0.5 rounded-full bg-error-container text-error font-label-sm font-bold text-xs">Out of Stock</span>`) : ''}
                </div>
                <h2 class="font-headline-md text-lg sm:text-xl font-bold text-on-surface leading-snug break-words">${item.name}</h2>
            </div>

            <!-- Metrics Grid -->
            ${metricsGrid}

            <!-- Barcode / SKU -->
            ${mainBarcode ? `
                <div class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low text-xs font-mono text-on-surface border border-surface-container">
                    <span class="material-symbols-outlined text-[16px] text-primary">barcode</span>
                    <span class="text-on-surface-variant font-sans">Barcode / SKU:</span>
                    <strong class="text-on-surface">${escapeAdminHtml(mainBarcode)}</strong>
                </div>
            ` : ''}

            <!-- Product Variations & Their Barcodes -->
            ${variationsList.length > 0 ? `
                <div class="p-3.5 rounded-2xl bg-surface-container-lowest border border-surface-container flex flex-col gap-2">
                    <div class="flex items-center justify-between">
                        <span class="text-[11px] text-outline font-bold uppercase tracking-wider flex items-center gap-1">
                            <span class="material-symbols-outlined text-[15px] text-primary">style</span>
                            <span>Variations & Barcodes (${variationsList.length})</span>
                        </span>
                    </div>
                    <div class="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                        ${variationsList.map(v => `
                            <div class="p-2 rounded-xl bg-surface-container-low/70 border border-surface-container flex items-center justify-between gap-2 text-xs">
                                <div class="flex items-center gap-2 min-w-0">
                                    ${v.imageUrl ? `<img src="${v.imageUrl}" class="w-8 h-8 rounded-lg object-contain bg-surface-container border border-surface-container shrink-0" onerror="this.remove()">` : `<div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-xs shrink-0 font-bold text-primary">${escapeAdminHtml((v.name || 'V').slice(0, 2).toUpperCase())}</div>`}
                                    <div class="min-w-0">
                                        <div class="font-bold text-on-surface truncate">${escapeAdminHtml(v.name)}</div>
                                        ${v.barcode ? `<div class="flex items-center gap-1 font-mono text-[11px] text-primary mt-0.5"><span class="material-symbols-outlined text-[13px]">barcode</span><span>${escapeAdminHtml(v.barcode)}</span></div>` : `<div class="text-[10px] text-outline italic">No barcode</div>`}
                                    </div>
                                </div>
                                <div class="text-right shrink-0">
                                    <div class="font-bold text-on-surface">$${parseFloat(v.price || 0).toFixed(2)}</div>
                                    <div class="text-[10px] ${parseInt(v.stock || 0) <= 0 ? 'text-error font-bold' : 'text-on-surface-variant'}">${v.stock !== undefined ? `${v.stock} in stock` : ''}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- Description (if available) -->
            ${descriptionText ? `
                <div class="p-3.5 rounded-2xl bg-surface-container-lowest border border-surface-container/60">
                    <span class="text-[11px] text-outline font-bold uppercase tracking-wider block mb-1">Description</span>
                    <p class="text-xs text-on-surface-variant leading-relaxed whitespace-pre-line">${descriptionText}</p>
                </div>
            ` : ''}
        </div>
    `;

    if (storeLink) {
        if (prodId) {
            storeLink.href = `/product.html?id=${encodeURIComponent(prodId)}`;
            storeLink.style.display = 'inline-flex';
        } else {
            storeLink.style.display = 'none';
        }
    }

    if (restockBtn) {
        if (prodId) {
            restockBtn.classList.remove('hidden');
            restockBtn.classList.add('inline-flex');
            restockBtn.onclick = function() {
                closeProductDetailModal();
                if (typeof window.editProduct === 'function') {
                    window.editProduct(prodId);
                }
            };
        } else {
            restockBtn.classList.add('hidden');
            restockBtn.classList.remove('inline-flex');
        }
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
};

window.closeProductDetailModal = function() {
    const modal = document.getElementById('product-detail-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    document.body.style.overflow = '';
};

// Helper to open modal directly by product ID (e.g. from Out of Stock list)
window.openProductDetailById = function(productId) {
    const prod = (adminProducts || []).find(p => String(p.id) === String(productId));
    if (!prod) return;
    window.openProductDetailModal({
        id: prod.id,
        name: prod.name,
        price: prod.price,
        stock: prod.stock,
        image: getAdminProductPrimaryImage(prod),
        category: prod.category || '',
        description: prod.description || '',
        fromOutOfStockList: true
    });
};

// Helper to open modal directly by order item (from Orders page)
window.openOrderItemModal = function(orderId, itemIndex) {
    const order = (adminOrders || []).find(o => String(o.id) === String(orderId));
    if (!order) return;
    let items = [];
    try {
        const parsed = typeof order.items_json === 'string' ? JSON.parse(order.items_json) : order.items_json;
        items = Array.isArray(parsed) ? parsed : (parsed.items || []);
    } catch(e) {}
    const item = items[itemIndex];
    if (!item) return;

    let matchedProd = null;
    if (adminProducts && adminProducts.length > 0) {
        matchedProd = adminProducts.find(p => String(p.id) === String(item.id) || p.name === item.name);
    }

    let img = item.image;
    if ((!img || !img.startsWith('http')) && matchedProd) {
        img = getAdminProductPrimaryImage(matchedProd);
    }

    window.openProductDetailModal({
        id: matchedProd ? matchedProd.id : item.id,
        name: item.name,
        price: item.price || (matchedProd ? matchedProd.price : 0),
        quantity: item.quantity || 1,
        image: img,
        category: (matchedProd && matchedProd.category) ? matchedProd.category : (item.category || ''),
        description: (matchedProd && matchedProd.description) ? matchedProd.description : '',
        stock: matchedProd ? matchedProd.stock : null,
        fromOutOfStockList: false
    });
};

// Dismiss modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        window.closeProductDetailModal();
    }
});

// Toggle Order details collapse
window.toggleOrderDetails = function(id) {
    const details = document.getElementById(`details-${id}`);
    const icon = document.getElementById(`icon-${id}`);
    if (!details || !icon) return;
    
    if (details.classList.contains('hidden')) {
        details.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
    } else {
        details.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }
};

// Toggle Order status between 'pending' and 'completed'
window.toggleOrderStatus = async function(orderId, currentStatus) {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
        if (window.supabaseClient) {
            const { error } = await window.supabaseClient
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);
            if (error) throw error;
        }
        
        const order = adminOrders.find(o => o.id === orderId);
        if (order) order.status = newStatus;
        
        renderOrdersPage();
        renderRecentOrdersFeed();
        renderDashboardKPIs();
        showNotification(`Order #${orderId} marked as ${newStatus}`);
    } catch (e) {
        console.error('Error updating order:', e);
        alert('Could not update status: ' + e.message);
    }
};

// Restore stock in Supabase for items from a deleted order
async function restoreStockForItems(items) {
    if (!items || items.length === 0 || !window.supabaseClient) return { success: true };

    const productIds = Array.from(new Set(items.map(item => {
        if (item.productId) return parseInt(item.productId);
        const s = String(item.id);
        return s.includes('-') ? parseInt(s.split('-')[0]) : parseInt(s);
    }).filter(id => !isNaN(id))));

    if (productIds.length === 0) return { success: true };

    const { data: dbProducts, error: fetchErr } = await window.supabaseClient
        .from('products')
        .select('*')
        .in('id', productIds);

    if (fetchErr || !dbProducts) {
        console.error('Could not fetch products to restore stock:', fetchErr);
        return { success: false, error: fetchErr };
    }

    const productMap = new Map();
    dbProducts.forEach(p => {
        let meta = null;
        if (p.description && p.description.startsWith('{')) {
            try { meta = JSON.parse(p.description); } catch(e) {}
        }
        productMap.set(p.id, {
            id: p.id,
            name: p.name,
            stock: parseInt(p.stock) || 0,
            meta: meta
        });
    });

    for (const item of items) {
        const pId = item.productId ? parseInt(item.productId) : (String(item.id).includes('-') ? parseInt(String(item.id).split('-')[0]) : parseInt(item.id));
        const prod = productMap.get(pId);
        if (!prod) continue;

        let targetVar = null;
        if (prod.meta && Array.isArray(prod.meta.variations)) {
            const s = String(item.id);
            const varPart = s.includes('-') ? s.split('-').slice(1).join('-') : null;
            targetVar = prod.meta.variations.find(v => 
                (item.variationId && v.id === item.variationId) ||
                (varPart && (v.id === varPart || (v.id || v.name).replace(/\s+/g, '-') === varPart)) ||
                (item.name && item.name.includes(`(${v.name})`)) ||
                (item.barcode && v.barcode && String(v.barcode).trim() === String(item.barcode).trim())
            );
        }

        const qty = parseInt(item.quantity) || 1;
        if (targetVar) {
            targetVar.stock = (parseInt(targetVar.stock) || 0) + qty;
            prod.stock = prod.stock + qty;
        } else {
            prod.stock = prod.stock + qty;
        }
    }

    for (const [pId, prod] of productMap.entries()) {
        const payload = {
            stock: prod.stock
        };
        if (prod.meta) {
            payload.description = JSON.stringify(prod.meta);
        }
        await window.supabaseClient
            .from('products')
            .update(payload)
            .eq('id', pId);

        // Also update in-memory adminProducts if present
        if (Array.isArray(adminProducts)) {
            const memProd = adminProducts.find(p => p.id === pId);
            if (memProd) {
                memProd.stock = prod.stock;
                if (prod.meta) memProd.description = payload.description;
            }
        }
    }

    return { success: true };
}
window.restoreStockForItems = restoreStockForItems;

// Delete Order from Supabase and restore inventory stock
window.deleteOrder = async function(orderId) {
    const confirmMsg = window.i18n ? window.i18n.t('delete_confirm_order') : 'Are you sure you want to delete this order? Items will be returned to stock.';
    if (!confirm(confirmMsg)) return;

    try {
        const order = adminOrders.find(o => o.id === orderId);
        if (order && order.items_json) {
            let items = [];
            try {
                const parsed = typeof order.items_json === 'string' ? JSON.parse(order.items_json) : order.items_json;
                items = Array.isArray(parsed) ? parsed : (parsed.items || []);
            } catch (e) {
                console.warn('Could not parse items_json for order stock return:', e);
            }
            if (items && items.length > 0) {
                await restoreStockForItems(items);
            }
        }

        if (window.supabaseClient) {
            const { error } = await window.supabaseClient
                .from('orders')
                .delete()
                .eq('id', orderId);
            if (error) throw error;
        }

        adminOrders = adminOrders.filter(o => o.id !== orderId);
        if (typeof loadAdminData === 'function') {
            await loadAdminData();
        } else {
            renderOrdersPage();
            renderRecentOrdersFeed();
            renderDashboardKPIs();
        }
        showNotification('Order deleted and product stock returned successfully');
    } catch (e) {
        console.error('Error deleting order:', e);
        alert('Failed to delete order: ' + e.message);
    }
};

// HTML escaping helper for admin UI
function escapeAdminHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 4. Product Management (CRUD with Batch Images)
window.currentAdminProductsSort = 'relevance';

function sortAdminProductsList(list, sortKey = 'relevance') {
    const sorted = [...list];
    switch (sortKey) {
        case 'stock_asc':
            sorted.sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0));
            break;
        case 'stock_desc':
            sorted.sort((a, b) => (Number(b.stock) || 0) - (Number(a.stock) || 0));
            break;
        case 'price_asc':
            sorted.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
            break;
        case 'price_desc':
            sorted.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
            break;
        case 'name_asc':
            sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            break;
        case 'name_desc':
            sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
            break;
        case 'relevance':
        default:
            sorted.sort((a, b) => {
                const stockA = Number(a.stock) || 0;
                const stockB = Number(b.stock) || 0;
                if (stockB !== stockA) return stockB - stockA;
                return (a.name || '').localeCompare(b.name || '');
            });
            break;
    }
    return sorted;
}

window.adminSetProductsSort = function(sortKey) {
    window.currentAdminProductsSort = sortKey;
    const sortSelect = document.getElementById('manage-products-sort-select');
    if (sortSelect && sortSelect.value !== sortKey) {
        sortSelect.value = sortKey;
    }
    renderProductsList();
};

window.adminToggleSortColumn = function(col) {
    let nextSort = 'relevance';
    if (col === 'name') {
        nextSort = (window.currentAdminProductsSort === 'name_asc') ? 'name_desc' : 'name_asc';
    } else if (col === 'price') {
        nextSort = (window.currentAdminProductsSort === 'price_asc') ? 'price_desc' : 'price_asc';
    } else if (col === 'stock') {
        nextSort = (window.currentAdminProductsSort === 'stock_desc') ? 'stock_asc' : 'stock_desc';
    }
    window.adminSetProductsSort(nextSort);
};

function renderProductsList(filterQuery = '') {
    const container = document.getElementById('admin-products-table-body');
    if (!container) return;

    const searchInput = document.getElementById('manage-products-search-input');
    const q = (filterQuery !== undefined && filterQuery !== null && filterQuery !== '' 
        ? filterQuery 
        : (searchInput ? searchInput.value : '')).trim().toLowerCase();

    let list = adminProducts || [];
    if (q) {
        list = list.filter(p => {
            const nameMatch = (p.name || '').toLowerCase().includes(q);
            const catMatch = (p.category || '').toLowerCase().includes(q);
            const barcodeMatch = (p.barcode || '').toLowerCase().includes(q);
            let metaMatch = false;
            if (p.description && p.description.startsWith('{')) {
                try {
                    const meta = JSON.parse(p.description);
                    if (meta.barcode && String(meta.barcode).toLowerCase().includes(q)) metaMatch = true;
                    if (Array.isArray(meta.variations)) {
                        metaMatch = metaMatch || meta.variations.some(v => 
                            (v.name && v.name.toLowerCase().includes(q)) || 
                            (v.barcode && String(v.barcode).toLowerCase().includes(q))
                        );
                    }
                } catch (e) {}
            }
            return nameMatch || catMatch || barcodeMatch || metaMatch;
        });
    }

    const countEl = document.getElementById('manage-products-count');
    if (countEl) {
        countEl.textContent = q 
            ? `${list.length} of ${adminProducts.length} items` 
            : `${adminProducts.length} items`;
    }

    // Apply sorting to products list
    const sortSelect = document.getElementById('manage-products-sort-select');
    const sortKey = (sortSelect && sortSelect.value) ? sortSelect.value : (window.currentAdminProductsSort || 'relevance');
    list = sortAdminProductsList(list, sortKey);

    if (list.length === 0) {
        container.innerHTML = q 
            ? `<tr><td colspan="6" class="p-6 text-center text-on-surface-variant">No products found matching "<strong>${escapeAdminHtml(q)}</strong>".</td></tr>`
            : `<tr><td colspan="6" class="p-6 text-center text-on-surface-variant">No products found. Click "Add Product" above to create one.</td></tr>`;
        return;
    }

    let html = '';
    list.forEach(p => {
        let primaryImg = getAdminProductPrimaryImage(p);
        let imgCount = 1;
        let barcode = p.barcode || '';
        let variationBarcodes = [];
        if (p.description && p.description.startsWith('{')) {
            try {
                const meta = JSON.parse(p.description);
                if (meta.images && meta.images.length > 0) {
                    imgCount = meta.images.length;
                }
                if (meta.barcode) barcode = meta.barcode;
                if (Array.isArray(meta.variations)) {
                    variationBarcodes = meta.variations.filter(v => v.barcode && String(v.barcode).trim()).map(v => ({
                        name: v.name,
                        barcode: String(v.barcode).trim()
                    }));
                }
            } catch (e) {}
        }
        const isEmoji = !primaryImg || primaryImg.length <= 4 || (!primaryImg.startsWith('http') && !primaryImg.startsWith('data:image') && !primaryImg.startsWith('/'));
        const imgEl = isEmoji 
            ? `<div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-surface-container flex items-center justify-center text-3xl shadow-sm">${primaryImg}</div>`
            : `<img src="${primaryImg}" onerror="this.onerror=null; this.src='/icons/icon-192x192.png'" class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-contain bg-surface-container p-1 shadow-sm border border-surface-container/70">`;

        html += `
        <tr class="border-b border-surface-container/60 hover:bg-surface-container-low/50 transition-colors">
            <td class="p-3 w-24 sm:w-28">${imgEl}</td>
            <td class="p-3 font-semibold text-on-surface">
                <div>${escapeAdminHtml(p.name)} ${imgCount > 1 ? `<span class="ml-1 text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-mono font-bold">${imgCount} photos</span>` : ''}</div>
                ${barcode ? `<div class="flex items-center gap-1 font-mono text-[11px] text-outline mt-0.5"><span class="material-symbols-outlined text-[13px]">barcode</span><span>${escapeAdminHtml(barcode)}</span></div>` : ''}
                ${variationBarcodes.length > 0 ? `
                    <div class="mt-1 flex flex-wrap gap-1">
                        ${variationBarcodes.map(vb => `
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-surface-container-low border border-surface-container text-[10px] font-mono text-on-surface-variant" title="Variation: ${escapeAdminHtml(vb.name)}">
                                <span class="material-symbols-outlined text-[11px] text-primary">barcode</span>
                                <span class="font-sans font-semibold text-on-surface">${escapeAdminHtml(vb.name)}:</span>
                                <span>${escapeAdminHtml(vb.barcode)}</span>
                            </span>
                        `).join('')}
                    </div>
                ` : ''}
            </td>
            <td class="p-3 text-on-surface-variant text-sm">${escapeAdminHtml(p.category || 'General')}</td>
            <td class="p-3 font-bold text-on-surface">$${parseFloat(p.price).toFixed(2)}</td>
            <td class="p-3 text-sm">
                <span class="px-2 py-0.5 rounded-full text-xs font-bold ${p.stock < 5 ? 'bg-error-container text-error' : 'bg-secondary-container/40 text-on-secondary-container'}">
                    ${p.stock}
                </span>
            </td>
            <td class="p-3 text-right">
                <div class="inline-flex items-center gap-1">
                    <button onclick="editProduct(${p.id})" class="p-1.5 rounded-lg hover:bg-surface-container text-primary transition-colors" title="Edit">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onclick="deleteProduct(${p.id})" class="p-1.5 rounded-lg hover:bg-error-container/30 text-error transition-colors" title="Delete">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            </td>
        </tr>
        `;
    });

    container.innerHTML = html;
}

// Search filter for Manage Products Modal
window.adminFilterManageProducts = function(query) {
    const clearBtn = document.getElementById('manage-products-search-clear');
    if (clearBtn) {
        if (query && query.trim()) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
    }
    renderProductsList(query);
};

window.adminClearManageProductsSearch = function() {
    const input = document.getElementById('manage-products-search-input');
    if (input) input.value = '';
    const clearBtn = document.getElementById('manage-products-search-clear');
    if (clearBtn) clearBtn.classList.add('hidden');
    renderProductsList('');
};

// Search existing products in Add Product Modal
window.adminFilterAddProductSearch = function(query) {
    const clearBtn = document.getElementById('add-product-search-clear');
    const resultsContainer = document.getElementById('add-product-search-results');
    if (!resultsContainer) return;

    const q = (query || '').trim().toLowerCase();
    if (clearBtn) {
        if (q) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
    }

    if (!q) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
        return;
    }

    const matches = (adminProducts || []).filter(p => {
        const nameMatch = (p.name || '').toLowerCase().includes(q);
        const catMatch = (p.category || '').toLowerCase().includes(q);
        const barcodeMatch = (p.barcode || '').toLowerCase().includes(q);
        let metaMatch = false;
        if (p.description && p.description.startsWith('{')) {
            try {
                const meta = JSON.parse(p.description);
                if (meta.barcode && String(meta.barcode).toLowerCase().includes(q)) metaMatch = true;
                if (Array.isArray(meta.variations)) {
                    metaMatch = metaMatch || meta.variations.some(v => 
                        (v.name && v.name.toLowerCase().includes(q)) || 
                        (v.barcode && String(v.barcode).toLowerCase().includes(q))
                    );
                }
            } catch (e) {}
        }
        return nameMatch || catMatch || barcodeMatch || metaMatch;
    });

    resultsContainer.classList.remove('hidden');

    if (matches.length === 0) {
        resultsContainer.innerHTML = `
            <div class="p-3 text-center rounded-xl bg-surface-container-lowest border border-surface-container text-xs text-on-surface-variant">
                <span>No existing products match "<strong>${escapeAdminHtml(q)}</strong>". Fill in details below to create a new one.</span>
            </div>
        `;
        return;
    }

    let html = matches.slice(0, 5).map(p => {
        const primaryImg = getAdminProductPrimaryImage(p);
        const isEmoji = !primaryImg || primaryImg.length <= 4 || (!primaryImg.startsWith('http') && !primaryImg.startsWith('data:image') && !primaryImg.startsWith('/'));
        const imgEl = isEmoji 
            ? `<div class="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-xl shrink-0">${primaryImg}</div>`
            : `<img src="${primaryImg}" onerror="this.onerror=null; this.src='/icons/icon-192x192.png'" class="w-10 h-10 rounded-lg object-contain bg-surface-container p-0.5 border border-surface-container shrink-0">`;
        const barcode = p.barcode || '';

        let matchedVarSnippet = '';
        if (p.description && p.description.startsWith('{')) {
            try {
                const meta = JSON.parse(p.description);
                if (Array.isArray(meta.variations)) {
                    const matchedVar = meta.variations.find(v => 
                        (v.barcode && String(v.barcode).toLowerCase().includes(q)) || 
                        (v.name && v.name.toLowerCase().includes(q))
                    );
                    if (matchedVar) {
                        matchedVarSnippet = `
                            <div class="flex items-center gap-1 text-[10px] text-primary font-medium mt-0.5">
                                <span class="material-symbols-outlined text-[12px]">style</span>
                                <span>Variation: <strong>${escapeAdminHtml(matchedVar.name)}</strong>${matchedVar.barcode ? ` (${escapeAdminHtml(matchedVar.barcode)})` : ''}</span>
                            </div>
                        `;
                    }
                }
            } catch(e) {}
        }

        return `
            <div class="p-2 rounded-xl bg-surface-container-lowest border border-surface-container flex items-center justify-between gap-2 shadow-xs hover:border-primary/50 transition-all">
                <div class="flex items-center gap-2.5 min-w-0">
                    ${imgEl}
                    <div class="min-w-0">
                        <div class="font-bold text-xs text-on-surface truncate">${escapeAdminHtml(p.name)}</div>
                        <div class="flex items-center gap-1.5 text-[10px] text-on-surface-variant mt-0.5">
                            <span class="font-bold text-on-surface">$${parseFloat(p.price || 0).toFixed(2)}</span>
                            <span>•</span>
                            <span class="${p.stock < 5 ? 'text-error font-bold' : ''}">${p.stock} in stock</span>
                            ${p.category ? `<span>•</span><span class="truncate">${escapeAdminHtml(p.category)}</span>` : ''}
                            ${barcode ? `<span>•</span><span class="font-mono text-[9px] text-outline">${escapeAdminHtml(barcode)}</span>` : ''}
                        </div>
                        ${matchedVarSnippet}
                    </div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <button type="button" onclick="adminSelectProductToEdit(${p.id})" class="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-bold hover:bg-primary-container transition active:scale-95 shadow-xs" title="Edit this product">
                        Edit / Restock
                    </button>
                    <button type="button" onclick="adminAutofillAsTemplate(${p.id})" class="px-2 py-1 rounded-lg bg-surface-container text-on-surface-variant text-[11px] font-semibold hover:bg-surface-variant hover:text-on-surface transition active:scale-95" title="Copy info into a new product">
                        Duplicate
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (matches.length > 5) {
        html += `<div class="text-[11px] text-center text-on-surface-variant py-1">Showing 5 of ${matches.length} matches. Type more to narrow down.</div>`;
    }

    resultsContainer.innerHTML = html;
};

window.adminClearAddProductSearch = function() {
    const input = document.getElementById('add-product-search-input');
    if (input) input.value = '';
    const clearBtn = document.getElementById('add-product-search-clear');
    if (clearBtn) clearBtn.classList.add('hidden');
    const resultsContainer = document.getElementById('add-product-search-results');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
    }
};

window.adminSelectProductToEdit = function(id) {
    adminClearAddProductSearch();
    window.editProduct(id);
    if (typeof showNotification === 'function') {
        showNotification('Loaded product for editing');
    }
};

window.adminAutofillAsTemplate = function(id) {
    const product = (adminProducts || []).find(p => p.id === id);
    if (!product) return;
    
    // Clear editing ID so saving creates a NEW product
    editingProductId = null;
    
    const title = document.getElementById('product-modal-title');
    if (title) title.textContent = window.i18n ? window.i18n.t('add_new_product') : 'Add New Product';
    
    const subtitle = document.getElementById('product-modal-subtitle');
    if (subtitle) {
        subtitle.innerHTML = `Duplicating template from <strong>${escapeAdminHtml(product.name)}</strong>`;
        subtitle.classList.remove('hidden');
    }
    
    document.getElementById('prod-name').value = (product.name || '') + ' (Copy)';
    document.getElementById('prod-price').value = product.price || '';
    document.getElementById('prod-stock').value = product.stock || '10';
    document.getElementById('prod-category').value = product.category || 'Household';
    document.getElementById('prod-image').value = (product.image && product.image.startsWith('http')) ? product.image : '';
    
    let cleanDesc = product.description || '';
    let slug = ((product.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-copy').replace(/^-+|-+$/g, '');
    let existingImages = [];
    let variations = [];

    if (product.description && product.description.startsWith('{')) {
        try {
            const meta = JSON.parse(product.description);
            cleanDesc = meta.desc || '';
            if (meta.slug) slug = meta.slug + '-copy';
            existingImages = meta.images || [];
            if (Array.isArray(meta.variations)) variations = meta.variations;
        } catch (e) {}
    }

    document.getElementById('prod-desc').value = cleanDesc;
    document.getElementById('prod-slug').value = slug;
    document.getElementById('prod-batch-images').value = existingImages.join('\n');
    
    const barcodeInput = document.getElementById('prod-barcode');
    if (barcodeInput) barcodeInput.value = '';


    renderImagePreviews(existingImages);
    adminClearAddProductSearch();
    if (typeof showNotification === 'function') {
        showNotification('Template loaded. Edit details and save as a new product.');
    }
};

// Open Add Product Modal
window.openAddProductModal = function() {
    editingProductId = null;
    uploadedImageFiles = [];
    const form = document.getElementById('product-form');
    if (form) form.reset();
    const barcodeInput = document.getElementById('prod-barcode');
    if (barcodeInput) barcodeInput.value = '';

    const varsContainer = document.getElementById('admin-variations-container');
    if (varsContainer) varsContainer.innerHTML = '';

    const manageModal = document.getElementById('manage-products-modal');
    if (manageModal && !manageModal.classList.contains('hidden')) {
        wasManageProductsOpen = true;
        manageModal.classList.add('hidden');
    }
    
    const title = document.getElementById('product-modal-title');
    if (title) title.textContent = window.i18n ? window.i18n.t('add_new_product') : 'Add New Product';

    const subtitle = document.getElementById('product-modal-subtitle');
    if (subtitle) {
        subtitle.textContent = '';
        subtitle.classList.add('hidden');
    }

    if (typeof window.adminClearAddProductSearch === 'function') {
        window.adminClearAddProductSearch();
    }
    
    const previewContainer = document.getElementById('product-images-preview');
    if (previewContainer) previewContainer.innerHTML = '';

    const modal = document.getElementById('product-modal');
    if (modal) modal.classList.remove('hidden');
};

window.adminAddVariationRow = function() {};
window.startAdminVariationBarcodeScan = function() {};

// Open Edit Product Modal
window.editProduct = function(id) {
    const product = adminProducts.find(p => p.id === id);
    if (!product) return;

    editingProductId = id;
    uploadedImageFiles = [];

    const manageModal = document.getElementById('manage-products-modal');
    if (manageModal && !manageModal.classList.contains('hidden')) {
        wasManageProductsOpen = true;
        manageModal.classList.add('hidden');
    }

    const title = document.getElementById('product-modal-title');
    if (title) title.textContent = window.i18n ? window.i18n.t('edit_product') : 'Edit Product';

    const subtitle = document.getElementById('product-modal-subtitle');
    if (subtitle) {
        subtitle.innerHTML = `Editing <strong>${escapeAdminHtml(product.name)}</strong> • <a href="javascript:void(0)" onclick="openAddProductModal()" class="text-primary hover:underline font-bold">Switch to Add New</a>`;
        subtitle.classList.remove('hidden');
    }

    if (typeof window.adminClearAddProductSearch === 'function') {
        window.adminClearAddProductSearch();
    }

    // Populate inputs
    document.getElementById('prod-name').value = product.name || '';
    document.getElementById('prod-price').value = product.price || '';
    document.getElementById('prod-stock').value = product.stock || '0';
    document.getElementById('prod-category').value = product.category || 'Household';
    document.getElementById('prod-image').value = (product.image && product.image.startsWith('http')) ? product.image : '';

    let cleanDesc = product.description || '';
    let slug = '';
    let existingImages = [];
    let barcode = product.barcode || '';
    let variations = [];

    if (product.description && product.description.startsWith('{')) {
        try {
            const meta = JSON.parse(product.description);
            cleanDesc = meta.desc || '';
            slug = meta.slug || '';
            existingImages = meta.images || [];
            if (meta.barcode) barcode = meta.barcode;
            if (Array.isArray(meta.variations)) variations = meta.variations;
        } catch (e) {}
    }

    document.getElementById('prod-desc').value = cleanDesc;
    document.getElementById('prod-slug').value = slug || (product.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    document.getElementById('prod-batch-images').value = existingImages.join('\n');
    const barcodeInput = document.getElementById('prod-barcode');
    if (barcodeInput) barcodeInput.value = barcode;

    renderImagePreviews(existingImages);

    const modal = document.getElementById('product-modal');
    if (modal) modal.classList.remove('hidden');
};

window.closeProductModal = function() {
    const modal = document.getElementById('product-modal');
    if (modal) modal.classList.add('hidden');
    editingProductId = null;
    uploadedImageFiles = [];

    const subtitle = document.getElementById('product-modal-subtitle');
    if (subtitle) {
        subtitle.textContent = '';
        subtitle.classList.add('hidden');
    }

    if (typeof window.adminClearAddProductSearch === 'function') {
        window.adminClearAddProductSearch();
    }

    if (wasManageProductsOpen) {
        const manageModal = document.getElementById('manage-products-modal');
        if (manageModal) {
            renderProductsList();
            manageModal.classList.remove('hidden');
        }
        wasManageProductsOpen = false;
    }
};

// Render previews of uploaded / linked images
function renderImagePreviews(urls = []) {
    const container = document.getElementById('product-images-preview');
    if (!container) return;

    let html = '';
    urls.forEach((url, i) => {
        html += `
            <div class="relative w-16 h-16 rounded-xl border border-surface-container bg-surface-container-low overflow-hidden group">
                <img src="${url}" class="w-full h-full object-contain">
                <button type="button" onclick="removeImagePreview(${i})" class="absolute top-1 right-1 w-5 h-5 rounded-full bg-error text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span class="material-symbols-outlined text-[12px]">close</span>
                </button>
            </div>
        `;
    });
    container.innerHTML = html;
}

// Handle Form Submission for Adding / Updating Product
window.handleProductSubmit = async function(event) {
    event.preventDefault();
    const form = event.target;
    const name = document.getElementById('prod-name').value.trim();
    const price = parseFloat(document.getElementById('prod-price').value) || 0;
    const stock = parseInt(document.getElementById('prod-stock').value) || 0;
    const category = document.getElementById('prod-category').value.trim();
    const primaryImgUrl = document.getElementById('prod-image').value.trim();
    const rawBatchUrls = document.getElementById('prod-batch-images').value.trim();
    const descText = document.getElementById('prod-desc').value.trim();
    const slug = document.getElementById('prod-slug').value.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Aggregate all images (file uploads + single URL + batch URLs)
    const allImages = [];
    if (primaryImgUrl) allImages.push(primaryImgUrl);
    if (rawBatchUrls) {
        rawBatchUrls.split('\n').map(u => u.trim()).filter(Boolean).forEach(u => {
            if (!allImages.includes(u)) allImages.push(u);
        });
    }
    uploadedImageFiles.forEach(b64 => {
        if (!allImages.includes(b64)) allImages.push(b64);
    });

    const primaryImage = allImages[0] ? (allImages[0].length < 50 ? allImages[0] : '📦') : '📦';
    const barcode = (document.getElementById('prod-barcode')?.value || '').trim();

    // Store metadata in description JSON to support unlimited batch images, slugs & barcodes
    const metadataDesc = JSON.stringify({
        desc: descText,
        slug: slug,
        images: allImages,
        barcode: barcode
    });

    const payload = {
        name,
        price,
        stock,
        category,
        image: primaryImage,
        description: metadataDesc,
        updated_at: new Date().toISOString()
    };

    try {
        if (window.supabaseClient) {
            if (editingProductId) {
                // Update
                const { error } = await window.supabaseClient
                    .from('products')
                    .update(payload)
                    .eq('id', editingProductId);
                if (error) throw error;
                showNotification('Product updated successfully!');
            } else {
                // Insert
                const { error } = await window.supabaseClient
                    .from('products')
                    .insert([payload]);
                if (error) throw error;
                showNotification('Product created successfully!');
            }
        }

        closeProductModal();
        await loadAdminData();
    } catch (e) {
        console.error('Error saving product:', e);
        alert('Failed to save product: ' + e.message);
    }
};

// Delete Product
window.deleteProduct = async function(id) {
    const confirmMsg = window.i18n ? window.i18n.t('delete_confirm_product') : 'Are you sure you want to delete this product?';
    if (!confirm(confirmMsg)) return;

    try {
        if (window.supabaseClient) {
            const { error } = await window.supabaseClient
                .from('products')
                .delete()
                .eq('id', id);
            if (error) throw error;
        }

        adminProducts = adminProducts.filter(p => p.id !== id);
        renderProductsList();
        renderDashboardKPIs();
        showNotification('Product deleted successfully');
    } catch (e) {
        console.error('Error deleting product:', e);
        alert('Failed to delete product: ' + e.message);
    }
};

// Manage Products Modal Open / Close
window.openManageProductsModal = function() {
    const input = document.getElementById('manage-products-search-input');
    if (input) input.value = '';
    const clearBtn = document.getElementById('manage-products-search-clear');
    if (clearBtn) clearBtn.classList.add('hidden');
    const sortSelect = document.getElementById('manage-products-sort-select');
    if (sortSelect) sortSelect.value = window.currentAdminProductsSort || 'relevance';
    renderProductsList('');
    const modal = document.getElementById('manage-products-modal');
    if (modal) modal.classList.remove('hidden');
};

window.closeManageProductsModal = function() {
    const modal = document.getElementById('manage-products-modal');
    if (modal) modal.classList.add('hidden');
};

// Scan Barcode from Admin to populate Product Form
window.startAdminBarcodeScan = function() {
    if (!window.openBarcodeScanner) {
        alert('Scanner module is loading, please try again in a moment.');
        return;
    }
    window.openBarcodeScanner((code) => {
        const input = document.getElementById('prod-barcode');
        if (input) {
            input.value = code;
            showNotification(`Barcode scanned: ${code}`);
        }
    }, "Scan Product Barcode / SKU");
};

// Quick lookup from Admin to find / edit product by scanning
window.adminQuickBarcodeLookup = function() {
    if (!window.openBarcodeScanner) {
        alert('Scanner module is loading, please try again in a moment.');
        return;
    }
    window.openBarcodeScanner((code) => {
        if (!code) return;
        const cleanCode = String(code).trim().toLowerCase();
        let matchedVariation = null;

        const product = (adminProducts || []).find(p => {
            if (p.barcode && String(p.barcode).trim().toLowerCase() === cleanCode) return true;
            if (p.description && p.description.startsWith('{')) {
                try {
                    const meta = JSON.parse(p.description);
                    if (meta.barcode && String(meta.barcode).trim().toLowerCase() === cleanCode) return true;
                } catch(e) {}
            }
            return false;
        });

        if (product) {
            showNotification(`Found: ${product.name}`);
            editProduct(product.id);
        } else {
            alert(`No product found with barcode "${code}". You can create a new product with this barcode.`);
            openAddProductModal();
            const input = document.getElementById('prod-barcode');
            if (input) input.value = code;
        }
    }, "Scan Barcode to Lookup Product");
};

// Manage Promos & Carousel Banners Modal Open / Close
window.openManagePromosModal = async function() {
    await renderBannersList();
    await renderPromosList();
    if (window.populateBundleItemSelects) window.populateBundleItemSelects();
    if (window.renderAdminBundlesList) await window.renderAdminBundlesList();
    const modal = document.getElementById('manage-promos-modal');
    if (modal) modal.classList.remove('hidden');
};

window.closeManagePromosModal = function() {
    const modal = document.getElementById('manage-promos-modal');
    if (modal) modal.classList.add('hidden');
};

// Switch Tabs between Carousel Banners and Discount Codes
window.switchPromoTab = function(tab) {
    const bannersPanel = document.getElementById('promo-panel-banners');
    const codesPanel = document.getElementById('promo-panel-codes');
    const bundlesPanel = document.getElementById('promo-panel-bundles');
    const bannersBtn = document.getElementById('promo-tab-btn-banners');
    const codesBtn = document.getElementById('promo-tab-btn-codes');
    const bundlesBtn = document.getElementById('promo-tab-btn-bundles');

    // Hide all panels & reset tab styles
    bannersPanel?.classList.add('hidden');
    codesPanel?.classList.add('hidden');
    bundlesPanel?.classList.add('hidden');

    bannersBtn?.classList.remove('border-primary', 'text-primary');
    bannersBtn?.classList.add('border-transparent', 'text-on-surface-variant');
    codesBtn?.classList.remove('border-primary', 'text-primary');
    codesBtn?.classList.add('border-transparent', 'text-on-surface-variant');
    bundlesBtn?.classList.remove('border-primary', 'text-primary');
    bundlesBtn?.classList.add('border-transparent', 'text-on-surface-variant');

    if (tab === 'banners') {
        bannersPanel?.classList.remove('hidden');
        bannersBtn?.classList.add('border-primary', 'text-primary');
        bannersBtn?.classList.remove('border-transparent', 'text-on-surface-variant');
    } else if (tab === 'bundles') {
        bundlesPanel?.classList.remove('hidden');
        bundlesBtn?.classList.add('border-primary', 'text-primary');
        bundlesBtn?.classList.remove('border-transparent', 'text-on-surface-variant');
        if (window.populateBundleItemSelects) window.populateBundleItemSelects();
        if (window.renderAdminBundlesList) window.renderAdminBundlesList();
    } else {
        codesPanel?.classList.remove('hidden');
        codesBtn?.classList.add('border-primary', 'text-primary');
        codesBtn?.classList.remove('border-transparent', 'text-on-surface-variant');
    }
};

// Render Banners List in Admin Modal
async function renderBannersList() {
    const container = document.getElementById('banners-list-container');
    const badge = document.getElementById('active-banners-count-badge');
    if (!container || !window.bannerManager) return;

    const banners = await window.bannerManager.getBanners();
    const activeCount = banners.filter(b => b.active).length;
    if (badge) badge.textContent = activeCount;

    if (banners.length === 0) {
        container.innerHTML = `<div class="text-center py-6 text-on-surface-variant bg-surface-container-low rounded-xl">No banners yet. Use the form above to create your first promo banner.</div>`;
        return;
    }

    let html = '';
    banners.forEach(b => {
        const themeStyle = window.getBannerThemeClasses ? window.getBannerThemeClasses(b.theme) : {
            bg: 'bg-gradient-to-br from-primary via-primary-container to-secondary text-on-primary',
            tagBg: 'bg-tertiary-fixed text-on-tertiary-fixed',
            btnBg: 'bg-tertiary-fixed text-on-tertiary-fixed',
            badgeBg: 'bg-tertiary-fixed text-on-tertiary-fixed'
        };

        html += `
        <div class="rounded-xl border border-surface-container overflow-hidden shadow-sm bg-surface-container-low flex flex-col sm:flex-row items-stretch">
            <!-- Mini visual banner preview card -->
            <div class="sm:w-64 min-h-[120px] p-3 ${b.image_url ? 'bg-surface-container-high' : themeStyle.bg} flex flex-col justify-between shrink-0 relative overflow-hidden">
                ${b.image_url ? `
                <div class="absolute inset-0 z-0">
                    <img src="${b.image_url}" class="w-full h-full object-cover object-center"/>
                    <div class="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30"></div>
                </div>
                ` : ''}
                <div class="relative z-10">
                    <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${b.image_url ? 'bg-white/20 text-white border border-white/30 backdrop-blur-sm' : themeStyle.tagBg} text-[10px] font-bold uppercase tracking-wider mb-1 shadow-xs">
                        <span class="material-symbols-outlined text-[12px]">${b.tag_icon || 'local_fire_department'}</span>
                        <span>${b.tag || 'Promo'}</span>
                    </div>
                    <h4 class="font-bold text-sm leading-tight text-white line-clamp-1 drop-shadow-xs">${b.title}</h4>
                    <p class="text-[11px] opacity-85 line-clamp-2 mt-0.5 text-white/90">${b.subtitle || ''}</p>
                </div>
                <div class="relative z-10 flex items-center justify-between mt-2 pt-2 border-t border-white/20">
                    <span class="text-[10px] font-semibold text-white/90 underline">${b.button_text || 'Shop now'}</span>
                    ${b.promo_code ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${b.image_url ? 'bg-white/25 text-white border border-white/30' : themeStyle.badgeBg}">${b.promo_code}</span>` : ''}
                </div>
            </div>

            <!-- Details & Controls -->
            <div class="p-3 flex-1 flex flex-col justify-between gap-2">
                <div>
                    <div class="flex items-center justify-between gap-2">
                        <span class="font-bold text-sm text-on-surface line-clamp-1">${b.title}</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${b.active ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-dim text-outline'}">
                            ${b.active ? '● LIVE IN STORE' : '○ DISABLED'}
                        </span>
                    </div>
                    <div class="text-xs text-on-surface-variant mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>Link: <code class="bg-surface-container px-1 py-0.5 rounded text-[11px] font-mono">${b.link_url || '/catalog'}</code></span>
                        <span>Theme: <b class="capitalize">${b.theme || 'primary'}</b></span>
                        ${b.promo_code ? `<span>Code: <b class="font-mono text-primary font-bold">${b.promo_code}</b></span>` : ''}
                    </div>
                </div>

                <!-- Action Buttons: Toggle Active and Delete -->
                <div class="flex items-center justify-between pt-2 border-t border-surface-container">
                    <button type="button" onclick="handleToggleBannerActive('${b.id}')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 ${b.active ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}">
                        <span class="material-symbols-outlined text-[16px]">${b.active ? 'toggle_on' : 'toggle_off'}</span>
                        <span>${b.active ? 'Active (Turn OFF)' : 'Disabled (Turn ON)'}</span>
                    </button>

                    <div class="flex items-center gap-1.5">
                        <button type="button" onclick="editBanner('${b.id}')" class="px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg active:scale-95 transition flex items-center gap-1" title="Edit Banner">
                            <span class="material-symbols-outlined text-[15px]">edit</span>
                            <span>Edit</span>
                        </button>
                        <button type="button" onclick="handleDeleteBanner('${b.id}')" class="p-1.5 rounded-lg hover:bg-error-container/40 text-error transition active:scale-90" title="Delete Banner">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
    });

    container.innerHTML = html;
}

window.editBanner = async function(id) {
    if (!window.bannerManager) return;
    const banners = await window.bannerManager.getBanners();
    const b = banners.find(item => String(item.id) === String(id));
    if (!b) return;

    document.getElementById('banner-edit-id').value = b.id;
    document.getElementById('banner-title').value = b.title || '';
    document.getElementById('banner-subtitle').value = b.subtitle || '';
    document.getElementById('banner-tag').value = b.tag || 'Limited Time';
    document.getElementById('banner-icon').value = b.tag_icon || 'local_fire_department';
    document.getElementById('banner-promo-code').value = b.promo_code || '';
    document.getElementById('banner-link').value = b.link_url || '/catalog';
    document.getElementById('banner-btn-text').value = b.button_text || 'Shop now';
    document.getElementById('banner-image').value = b.image_url || '';
    document.getElementById('banner-active').checked = !!b.active;

    const themeRadio = document.querySelector(`input[name="banner-theme"][value="${b.theme || 'primary'}"]`);
    if (themeRadio) themeRadio.checked = true;

    window.updateBannerImagePreview();

    const submitBtnText = document.getElementById('banner-submit-btn-text');
    if (submitBtnText) submitBtnText.textContent = 'Update Banner';

    const cancelBtn = document.getElementById('banner-cancel-edit-btn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');

    const form = document.querySelector('#promo-panel-banners form');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.cancelEditBanner = function() {
    const editIdInput = document.getElementById('banner-edit-id');
    if (editIdInput) editIdInput.value = '';

    const form = document.querySelector('#promo-panel-banners form');
    if (form) form.reset();

    document.getElementById('banner-tag').value = 'Limited Time';
    document.getElementById('banner-link').value = '/catalog';
    document.getElementById('banner-btn-text').value = 'Shop now';
    document.getElementById('banner-active').checked = true;
    window.clearBannerImage();

    const submitBtnText = document.getElementById('banner-submit-btn-text');
    if (submitBtnText) submitBtnText.textContent = 'Add Banner to Carousel';

    const cancelBtn = document.getElementById('banner-cancel-edit-btn');
    if (cancelBtn) cancelBtn.classList.add('hidden');
};

window.handleCreateBanner = async function(event) {
    event.preventDefault();
    const editId = (document.getElementById('banner-edit-id')?.value || '').trim();
    const title = document.getElementById('banner-title').value.trim();
    const subtitle = document.getElementById('banner-subtitle').value.trim();
    const tag = document.getElementById('banner-tag').value.trim() || 'Limited Time';
    const tag_icon = document.getElementById('banner-icon').value || 'local_fire_department';
    const promo_code = document.getElementById('banner-promo-code').value.trim();
    const link_url = document.getElementById('banner-link').value.trim() || '/catalog';
    const button_text = document.getElementById('banner-btn-text').value.trim() || 'Shop now';
    const image_url = document.getElementById('banner-image').value.trim();
    const active = document.getElementById('banner-active').checked;

    const themeRadio = document.querySelector('input[name="banner-theme"]:checked');
    const theme = themeRadio ? themeRadio.value : 'primary';

    if (!title) return;

    if (window.bannerManager) {
        if (editId) {
            await window.bannerManager.updateBanner(editId, {
                title, subtitle, tag, tag_icon, promo_code, link_url, button_text, theme, image_url, active
            });
            showNotification(`Banner "${title}" updated successfully!`);
        } else {
            await window.bannerManager.createBanner({
                title, subtitle, tag, tag_icon, promo_code, link_url, button_text, theme, image_url, active
            });
            showNotification(`Banner "${title}" created and saved!`);
        }

        cancelEditBanner();
        await renderBannersList();
    }
};

// Banner Image Helpers (Upload, Preview, Clear)
window.updateBannerImagePreview = function() {
    const input = document.getElementById('banner-image');
    const box = document.getElementById('banner-image-preview-box');
    const img = document.getElementById('banner-image-preview-img');
    if (!input || !box || !img) return;

    const val = input.value.trim();
    if (val) {
        img.src = val;
        box.classList.remove('hidden');
    } else {
        box.classList.add('hidden');
    }
};

window.clearBannerImage = function() {
    const input = document.getElementById('banner-image');
    const fileInput = document.getElementById('banner-file-input');
    if (input) input.value = '';
    if (fileInput) fileInput.value = '';
    const box = document.getElementById('banner-image-preview-box');
    if (box) box.classList.add('hidden');
};

window.handleBannerFileUpload = function(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file (JPEG, PNG, WebP).');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Compress and resize to max width 1600px for sharp high-res banners with low file size
            const maxWidth = 1600;
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            const bannerImgInput = document.getElementById('banner-image');
            if (bannerImgInput) {
                bannerImgInput.value = compressedDataUrl;
                window.updateBannerImagePreview();
            }
            showNotification('Image loaded and optimized for banner!');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.handleToggleBannerActive = async function(id) {
    if (window.bannerManager) {
        const b = await window.bannerManager.toggleBannerActive(id);
        await renderBannersList();
        showNotification(`Banner ${b && b.active ? 'turned ON' : 'turned OFF'}`);
    }
};

window.handleDeleteBanner = async function(id) {
    if (!confirm('Are you sure you want to delete this promotional banner?')) return;
    if (window.bannerManager) {
        await window.bannerManager.deleteBanner(id);
        await renderBannersList();
        showNotification('Banner deleted.');
    }
};

// Promos List & Code Management
async function renderPromosList() {
    const container = document.getElementById('promos-list-container');
    if (!container || !window.promoManager) return;

    const promos = await window.promoManager.getPromos();
    if (promos.length === 0) {
        container.innerHTML = `<p class="text-center text-on-surface-variant p-4">No promo codes yet.</p>`;
        return;
    }

    let html = '';
    promos.forEach(p => {
        html += `
        <div class="flex items-center justify-between p-3 rounded-xl bg-surface-container-low shadow-sm border border-surface-container">
            <div>
                <div class="flex items-center gap-2">
                    <span class="font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10 text-sm">${p.promo_code}</span>
                    <span class="text-xs px-2 py-0.5 rounded-full font-bold ${p.active ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-dim text-outline'}">${p.active ? 'Active' : 'Inactive'}</span>
                </div>
                <h4 class="font-title-md text-on-surface font-semibold text-sm mt-1">${p.title}</h4>
                <p class="font-body-sm text-outline text-xs">${p.discount_value}% OFF • ${p.description}</p>
            </div>
            <div class="flex items-center gap-1">
                <button type="button" onclick="togglePromoActive(${p.id})" class="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant text-xs font-bold">
                    ${p.active ? 'Deactivate' : 'Activate'}
                </button>
                <button type="button" onclick="deletePromoCode(${p.id})" class="p-2 rounded-lg hover:bg-error-container/40 text-error">
                    <span class="material-symbols-outlined text-[18px]">delete</span>
                </button>
            </div>
        </div>
        `;
    });

    container.innerHTML = html;
}

window.handleCreatePromo = async function(event) {
    event.preventDefault();
    const form = event.target;
    const title = document.getElementById('promo-title').value.trim();
    const code = document.getElementById('promo-code').value.trim();
    const value = parseFloat(document.getElementById('promo-value').value) || 10;
    const desc = document.getElementById('promo-desc').value.trim();

    if (!code) return;

    if (window.promoManager) {
        await window.promoManager.createPromo({
            title: title || `${value}% Off Promo`,
            promo_code: code,
            discount_value: value,
            description: desc || `Save ${value}% at checkout with code ${code}`
        });

        form.reset();
        await renderPromosList();
        showNotification(`Promo code ${code} created!`);
    }
};

window.togglePromoActive = async function(id) {
    if (window.promoManager) {
        await window.promoManager.togglePromoStatus(id);
        await renderPromosList();
    }
};

window.deletePromoCode = async function(id) {
    if (confirm('Delete this promo code?')) {
        if (window.promoManager) {
            await window.promoManager.deletePromo(id);
            await renderPromosList();
            showNotification('Promo code deleted');
        }
    }
};

// Flash Deal Bundles Admin Management (Supports 2 to 6 Products & Editing)
window.bundleProductRows = ['', ''];

window.renderBundleProductRows = function() {
    const container = document.getElementById('bundle-items-container');
    const addBtn = document.getElementById('bundle-add-item-btn');
    if (!container) return;

    if (!Array.isArray(window.bundleProductRows) || window.bundleProductRows.length < 2) {
        window.bundleProductRows = ['', ''];
    }

    const sorted = [...(adminProducts || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    let html = '';
    window.bundleProductRows.forEach((val, idx) => {
        let optionsHtml = '<option value="">Select Product...</option>';
        sorted.forEach(p => {
            optionsHtml += `<option value="${p.id}" ${String(p.id) === String(val) ? 'selected' : ''}>[#${p.id}] ${escapeAdminHtml(p.name)}</option>`;
        });

        html += `
        <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-on-surface-variant w-14 shrink-0">Item ${idx + 1}:</span>
            <select onchange="window.bundleProductRows[${idx}] = this.value;" required class="bundle-item-select flex-1 px-3 py-2 rounded-lg bg-surface-container-lowest text-on-surface text-xs outline-none border border-surface-container focus:border-primary">
                ${optionsHtml}
            </select>
            ${window.bundleProductRows.length > 2 ? `
            <button type="button" onclick="removeBundleProductRow(${idx})" class="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error/10 transition" title="Remove Item">
                <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
            ` : '<div class="w-7"></div>'}
        </div>`;
    });

    container.innerHTML = html;

    if (addBtn) {
        if (window.bundleProductRows.length >= 6) {
            addBtn.classList.add('hidden');
        } else {
            addBtn.classList.remove('hidden');
        }
    }
};

window.addBundleProductRow = function(selectedId = '') {
    if (!Array.isArray(window.bundleProductRows)) window.bundleProductRows = ['', ''];
    if (window.bundleProductRows.length < 6) {
        window.bundleProductRows.push(selectedId ? String(selectedId) : '');
        window.renderBundleProductRows();
    }
};

window.removeBundleProductRow = function(index) {
    if (window.bundleProductRows.length > 2) {
        window.bundleProductRows.splice(index, 1);
        window.renderBundleProductRows();
    }
};

window.populateBundleItemSelects = function() {
    window.renderBundleProductRows();
};

window.renderAdminBundlesList = async function() {
    const container = document.getElementById('bundles-list-container');
    const badge = document.getElementById('active-bundles-count-badge');
    if (!container || !window.bundleManager) return;

    const bundles = await window.bundleManager.getBundles();
    const activeCount = bundles.filter(b => b.active).length;
    if (badge) badge.textContent = activeCount;

    if (bundles.length === 0) {
        container.innerHTML = `<p class="text-center text-on-surface-variant p-4 bg-surface-container-low rounded-xl">No combos created yet. Use the form above to pair products.</p>`;
        return;
    }

    let html = '';
    bundles.forEach(b => {
        let items = Array.isArray(b.items) && b.items.length > 0 ? b.items : [b.item1_id, b.item2_id].filter(Boolean);
        const bundlePrice = parseFloat(b.bundle_price) || 0;

        let itemsHtml = '';
        items.forEach((id, idx) => {
            const p = (adminProducts || []).find(prod => String(prod.id) === String(id));
            const pName = p ? p.name : `Product #${id}`;
            itemsHtml += `
            <div class="flex items-center justify-between text-xs py-0.5">
                <span class="text-on-surface-variant"><strong>${idx + 1}.</strong> ${escapeAdminHtml(pName)}</span>
            </div>`;
        });

        html += `
        <div class="p-4 rounded-xl border ${b.active ? 'border-surface-container bg-surface-container-low' : 'border-surface-container/40 bg-surface-container-low/40 opacity-70'} flex flex-col gap-2">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="material-symbols-outlined text-error text-[20px]">bolt</span>
                    <span class="font-bold text-on-surface text-sm">${escapeAdminHtml(b.title)}</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${b.active ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-highest text-outline'}">
                        ${b.active ? 'Active' : 'Paused'}
                    </span>
                    <span class="text-[10px] text-on-surface-variant font-semibold">(${items.length} products)</span>
                </div>
                <div class="flex items-center gap-1.5 self-end sm:self-auto">
                    <button type="button" onclick="editBundle('${b.id}')" class="px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg active:scale-95 transition flex items-center gap-1" title="Edit Combo">
                        <span class="material-symbols-outlined text-[15px]">edit</span>
                        <span>Edit</span>
                    </button>
                    <button type="button" onclick="adminToggleBundleStatus('${b.id}')" class="px-2.5 py-1 text-xs font-bold rounded-lg border border-surface-container hover:bg-surface-container active:scale-95 transition">
                        ${b.active ? 'Pause' : 'Activate'}
                    </button>
                    <button type="button" onclick="adminDeleteBundle('${b.id}')" class="p-1.5 text-error hover:bg-error/10 rounded-lg active:scale-95 transition" title="Delete Combo">
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                </div>
            </div>

            <!-- Items summary (Clean bundle price info only, no regular price or save price) -->
            <div class="text-xs text-on-surface-variant flex flex-col gap-1 bg-surface-container-lowest p-2.5 rounded-lg border border-surface-container/60">
                ${itemsHtml}
                <div class="pt-1.5 mt-0.5 border-t border-surface-container flex items-center justify-between font-bold">
                    <span class="text-on-surface">Bundle Price: <strong class="text-error text-sm">$${bundlePrice.toFixed(2)}</strong></span>
                    <span class="text-[11px] text-on-surface-variant font-medium">(Limit 1 per order)</span>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
};

window.editBundle = async function(id) {
    if (!window.bundleManager) return;
    const bundles = await window.bundleManager.getBundles();
    const b = bundles.find(item => String(item.id) === String(id));
    if (!b) return;

    document.getElementById('bundle-edit-id').value = b.id;
    document.getElementById('bundle-title').value = b.title || '';
    document.getElementById('bundle-price-input').value = b.bundle_price || '';

    // Populate items (2 to 6)
    let items = [];
    if (Array.isArray(b.items) && b.items.length > 0) {
        items = b.items;
    } else if (b.item1_id && b.item2_id) {
        items = [b.item1_id, b.item2_id];
    }
    window.bundleProductRows = items.map(String);
    if (window.bundleProductRows.length < 2) window.bundleProductRows.push('');
    window.renderBundleProductRows();

    const titleText = document.getElementById('bundle-form-title-text');
    if (titleText) titleText.textContent = 'Edit Flash Deal Combo';

    const submitBtnText = document.getElementById('bundle-submit-btn-text');
    if (submitBtnText) submitBtnText.textContent = 'Update Combo Promotion';

    const cancelBtn = document.getElementById('bundle-cancel-edit-btn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');

    const form = document.querySelector('#promo-panel-bundles form');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.cancelEditBundle = function() {
    const editIdInput = document.getElementById('bundle-edit-id');
    if (editIdInput) editIdInput.value = '';

    const form = document.querySelector('#promo-panel-bundles form');
    if (form) form.reset();

    const titleText = document.getElementById('bundle-form-title-text');
    if (titleText) titleText.textContent = 'Create Flash Deal Combo';

    const submitBtnText = document.getElementById('bundle-submit-btn-text');
    if (submitBtnText) submitBtnText.textContent = 'Create Combo Promotion';

    const cancelBtn = document.getElementById('bundle-cancel-edit-btn');
    if (cancelBtn) cancelBtn.classList.add('hidden');

    window.bundleProductRows = ['', ''];
    window.renderBundleProductRows();
};

window.handleCreateBundle = async function(event) {
    event.preventDefault();
    const editId = (document.getElementById('bundle-edit-id')?.value || '').trim();
    const title = (document.getElementById('bundle-title')?.value || '').trim();
    const bundle_price = parseFloat(document.getElementById('bundle-price-input')?.value) || 0;

    // Collect product IDs from current rows
    const selects = document.querySelectorAll('.bundle-item-select');
    const items = [];
    selects.forEach(sel => {
        if (sel.value) items.push(String(sel.value).trim());
    });

    if (items.length < 2) {
        alert('Please select at least 2 products for the combo.');
        return;
    }
    if (items.length > 6) {
        alert('A combo can have a maximum of 6 products.');
        return;
    }
    const unique = new Set(items);
    if (unique.size !== items.length) {
        alert('All products in a combo must be distinct. Please do not select the same product twice.');
        return;
    }
    if (bundle_price <= 0) {
        alert('Please enter a valid bundle price greater than $0.');
        return;
    }

    if (window.bundleManager) {
        if (editId) {
            await window.bundleManager.updateBundle(editId, {
                title: title || 'Flash Deal Combo',
                items: items,
                bundle_price: bundle_price
            });
            showNotification('Flash Deal Combo updated successfully!');
        } else {
            await window.bundleManager.createBundle({
                title: title || 'Flash Deal Combo',
                items: items,
                bundle_price: bundle_price,
                active: true
            });
            showNotification('Flash Deal Combo created successfully!');
        }

        cancelEditBundle();
        await renderAdminBundlesList();
    }
};

window.adminToggleBundleStatus = async function(id) {
    if (window.bundleManager) {
        await window.bundleManager.toggleBundleStatus(id);
        await renderAdminBundlesList();
    }
};

window.adminDeleteBundle = async function(id) {
    if (confirm('Delete this combo promotion?')) {
        if (window.bundleManager) {
            await window.bundleManager.deleteBundle(id);
            await renderAdminBundlesList();
            showNotification('Combo deleted');
        }
    }
};
