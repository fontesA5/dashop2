/**
 * DaShop Admin Management Module
 * Full-Stack Dashboard KPIs, Real Order Management, Product CRUD with Batch Images, and Promos
 */

let adminProducts = [];
let adminOrders = [];
let editingProductId = null;
let uploadedImageFiles = [];

// Admin Session Verification — always requires login
function checkAdminAuth() {
    const raw = localStorage.getItem('dashop_admin_session');

    if (!raw) {
        if (!window.location.pathname.includes('login.html')) {
            window.location.replace('/admin/login.html');
            return false;
        }
        return false;
    }

    // Validate session JSON
    let session = null;
    try {
        session = JSON.parse(raw);
    } catch(e) {
        localStorage.removeItem('dashop_admin_session');
        if (!window.location.pathname.includes('login.html')) {
            window.location.replace('/admin/login.html');
        }
        return false;
    }

    if (!session || !session.email) {
        localStorage.removeItem('dashop_admin_session');
        if (!window.location.pathname.includes('login.html')) {
            window.location.replace('/admin/login.html');
        }
        return false;
    }

    // Update email badge in admin UI if present
    const emailEl = document.getElementById('admin-user-email');
    if (emailEl) emailEl.textContent = session.email;

    return true;
}

window.handleAdminSignOut = function() {
    localStorage.removeItem('dashop_admin_session');
    if (window.supabaseClient && window.supabaseClient.auth) {
        window.supabaseClient.auth.signOut().catch(() => {});
    }
    window.location.replace('/admin/login.html');
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAdminAuth()) return;
    await loadAdminData();
    initAdminModals();
});

// Load all data from Supabase for Admin
async function loadAdminData() {
    try {
        if (window.supabaseClient) {
            // Load Products
            const { data: pData, error: pErr } = await window.supabaseClient
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });
            if (!pErr && pData) adminProducts = pData;

            // Load Orders
            const { data: oData, error: oErr } = await window.supabaseClient
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });
            if (!oErr && oData) adminOrders = oData;
        }
    } catch (e) {
        console.error('Error fetching admin data:', e);
    }

    renderDashboardKPIs();
    renderRecentOrdersFeed();
    renderOrdersPage();
    renderProductsList();
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

    // Low stock items (< 5 in stock)
    const lowStock = adminProducts.filter(p => (parseInt(p.stock) || 0) < 5);
    if (lowStockCountEl) lowStockCountEl.textContent = `${lowStock.length} low`;
    if (lowStockAlertEl) {
        if (lowStock.length > 0) {
            lowStockAlertEl.classList.remove('hidden');
            const alertText = lowStockAlertEl.querySelector('#low-stock-text');
            if (alertText) {
                alertText.textContent = `${lowStock.length} items require restock: ${lowStock.map(p => p.name).slice(0, 3).join(', ')}`;
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
        try {
            const parsed = JSON.parse(o.items_json);
            if (Array.isArray(parsed)) items = parsed;
            else if (parsed.items) {
                items = parsed.items;
                if (parsed.promo_code) discountCode = parsed.promo_code;
            }
        } catch (e) {}

        const itemsSummary = items.map(i => `${i.name} (x${i.quantity || 1})`).join(', ') || 'Custom Items';

        html += `
        <article class="order-card bg-surface-container-lowest rounded-xl shadow-sm transition-all duration-200 overflow-hidden" data-order-id="${shortId}">
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
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div class="bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
                        <span class="font-label-sm text-on-surface-variant uppercase tracking-wider block">Customer Contact</span>
                        <p class="font-body-md text-on-surface font-medium">${o.customer_email || 'No email'}</p>
                        ${o.customer_phone ? `<p class="font-body-sm text-outline mt-0.5">📞 ${o.customer_phone}</p>` : ''}
                    </div>
                    <div class="bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
                        <span class="font-label-sm text-on-surface-variant uppercase tracking-wider block">Delivery Address</span>
                        <p class="font-body-md text-on-surface font-medium">${o.address || 'Pickup'}</p>
                    </div>
                </div>
                <div class="bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
                    <span class="font-label-sm text-on-surface-variant uppercase tracking-wider block mb-1">Items Purchased</span>
                    <p class="font-body-sm text-on-surface">${itemsSummary}</p>
                    ${discountCode ? `<div class="mt-2 text-xs font-semibold text-secondary flex items-center gap-1"><span class="material-symbols-outlined text-xs">local_offer</span> Promo Applied: ${discountCode}</div>` : ''}
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
}

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

// Delete Order from Supabase
window.deleteOrder = async function(orderId) {
    const confirmMsg = window.i18n ? window.i18n.t('delete_confirm_order') : 'Are you sure you want to delete this order?';
    if (!confirm(confirmMsg)) return;

    try {
        if (window.supabaseClient) {
            const { error } = await window.supabaseClient
                .from('orders')
                .delete()
                .eq('id', orderId);
            if (error) throw error;
        }

        adminOrders = adminOrders.filter(o => o.id !== orderId);
        renderOrdersPage();
        renderRecentOrdersFeed();
        renderDashboardKPIs();
        showNotification('Order deleted successfully');
    } catch (e) {
        console.error('Error deleting order:', e);
        alert('Failed to delete order: ' + e.message);
    }
};

// 4. Product Management (CRUD with Batch Images)
function renderProductsList() {
    const container = document.getElementById('admin-products-table-body');
    if (!container) return;

    if (adminProducts.length === 0) {
        container.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-on-surface-variant">No products found. Click "Add Product" above to create one.</td></tr>`;
        return;
    }

    let html = '';
    adminProducts.forEach(p => {
        let primaryImg = p.image || '📦';
        let imgCount = 1;
        if (p.description && p.description.startsWith('{')) {
            try {
                const meta = JSON.parse(p.description);
                if (meta.images && meta.images.length > 0) {
                    primaryImg = meta.images[0];
                    imgCount = meta.images.length;
                }
            } catch (e) {}
        }
        const isEmoji = !primaryImg || primaryImg.length <= 4 || !primaryImg.startsWith('http');
        const imgEl = isEmoji 
            ? `<div class="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-xl">${primaryImg}</div>`
            : `<img src="${primaryImg}" class="w-10 h-10 rounded-lg object-contain bg-surface-container p-0.5">`;

        html += `
        <tr class="border-b border-surface-container/60 hover:bg-surface-container-low/50 transition-colors">
            <td class="p-3">${imgEl}</td>
            <td class="p-3 font-semibold text-on-surface">
                ${p.name}
                ${imgCount > 1 ? `<span class="ml-1 text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-mono font-bold">${imgCount} photos</span>` : ''}
            </td>
            <td class="p-3 text-on-surface-variant text-sm">${p.category || 'General'}</td>
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

// Open Add Product Modal
window.openAddProductModal = function() {
    editingProductId = null;
    uploadedImageFiles = [];
    const form = document.getElementById('product-form');
    if (form) form.reset();
    
    const title = document.getElementById('product-modal-title');
    if (title) title.textContent = window.i18n ? window.i18n.t('add_new_product') : 'Add New Product';
    
    const previewContainer = document.getElementById('product-images-preview');
    if (previewContainer) previewContainer.innerHTML = '';

    const modal = document.getElementById('product-modal');
    if (modal) modal.classList.remove('hidden');
};

// Open Edit Product Modal
window.editProduct = function(id) {
    const product = adminProducts.find(p => p.id === id);
    if (!product) return;

    editingProductId = id;
    uploadedImageFiles = [];

    const title = document.getElementById('product-modal-title');
    if (title) title.textContent = window.i18n ? window.i18n.t('edit_product') : 'Edit Product';

    // Populate inputs
    document.getElementById('prod-name').value = product.name || '';
    document.getElementById('prod-price').value = product.price || '';
    document.getElementById('prod-stock').value = product.stock || '0';
    document.getElementById('prod-category').value = product.category || 'Household';
    document.getElementById('prod-image').value = (product.image && product.image.startsWith('http')) ? product.image : '';

    let cleanDesc = product.description || '';
    let slug = '';
    let existingImages = [];

    if (product.description && product.description.startsWith('{')) {
        try {
            const meta = JSON.parse(product.description);
            cleanDesc = meta.desc || '';
            slug = meta.slug || '';
            existingImages = meta.images || [];
        } catch (e) {}
    }

    document.getElementById('prod-desc').value = cleanDesc;
    document.getElementById('prod-slug').value = slug || (product.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    document.getElementById('prod-batch-images').value = existingImages.join('\n');

    renderImagePreviews(existingImages);

    const modal = document.getElementById('product-modal');
    if (modal) modal.classList.remove('hidden');
};

window.closeProductModal = function() {
    const modal = document.getElementById('product-modal');
    if (modal) modal.classList.add('hidden');
    editingProductId = null;
    uploadedImageFiles = [];
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

    // Store metadata in description JSON to support unlimited batch images & slugs
    const metadataDesc = JSON.stringify({
        desc: descText,
        slug: slug,
        images: allImages
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
    renderProductsList();
    const modal = document.getElementById('manage-products-modal');
    if (modal) modal.classList.remove('hidden');
};

window.closeManageProductsModal = function() {
    const modal = document.getElementById('manage-products-modal');
    if (modal) modal.classList.add('hidden');
};

// Manage Promos Modal Open / Close
window.openManagePromosModal = async function() {
    await renderPromosList();
    const modal = document.getElementById('manage-promos-modal');
    if (modal) modal.classList.remove('hidden');
};

window.closeManagePromosModal = function() {
    const modal = document.getElementById('manage-promos-modal');
    if (modal) modal.classList.add('hidden');
};

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
        <div class="flex items-center justify-between p-3 rounded-xl bg-surface-container-low shadow-sm">
            <div>
                <div class="flex items-center gap-2">
                    <span class="font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10 text-sm">${p.promo_code}</span>
                    <span class="text-xs px-2 py-0.5 rounded-full font-bold ${p.active ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-dim text-outline'}">${p.active ? 'Active' : 'Inactive'}</span>
                </div>
                <h4 class="font-title-md text-on-surface font-semibold text-sm mt-1">${p.title}</h4>
                <p class="font-body-sm text-outline text-xs">${p.discount_value}% OFF • ${p.description}</p>
            </div>
            <div class="flex items-center gap-1">
                <button onclick="togglePromoActive(${p.id})" class="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant text-xs font-bold">
                    ${p.active ? 'Deactivate' : 'Activate'}
                </button>
                <button onclick="deletePromoCode(${p.id})" class="p-2 rounded-lg hover:bg-error-container/40 text-error">
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
            showNotification('Promo deleted');
        }
    }
};

// Initialize Drag and Drop image upload listeners
function initAdminModals() {
    const dropZone = document.getElementById('image-drop-zone');
    const fileInput = document.getElementById('file-upload-input');

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-primary', 'bg-primary/5');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('border-primary', 'bg-primary/5');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-primary', 'bg-primary/5');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleImageFiles(e.dataTransfer.files);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleImageFiles(e.target.files);
            }
        });
    }

    // Auto-generate slug when name is typed
    const nameInput = document.getElementById('prod-name');
    const slugInput = document.getElementById('prod-slug');
    if (nameInput && slugInput) {
        nameInput.addEventListener('input', () => {
            if (!editingProductId) {
                slugInput.value = nameInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            }
        });
    }
}

// Convert files to base64 for batch gallery storage
function handleImageFiles(files) {
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const b64 = e.target.result;
            uploadedImageFiles.push(b64);
            const previewContainer = document.getElementById('product-images-preview');
            if (previewContainer) {
                const div = document.createElement('div');
                div.className = "relative w-16 h-16 rounded-xl border border-surface-container bg-surface-container-low overflow-hidden";
                div.innerHTML = `<img src="${b64}" class="w-full h-full object-contain">`;
                previewContainer.appendChild(div);
            }
        };
        reader.readAsDataURL(file);
    });
}