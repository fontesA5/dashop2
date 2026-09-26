async function loadOrders() {
    const container = document.getElementById('orders-container-dynamic');
    if (!container) return;
    
    try {
        const supabase = window.supabaseClient;
        if (!supabase) return;
        
        const { data: orders, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        
        let html = '';
        orders.forEach((o, index) => {
            const shortId = '#' + String(o.id).padStart(6, '0');
            const initials = (o.customer_name || '??').substring(0, 2).toUpperCase();
            const date = new Date(o.created_at).toLocaleString();
            const statusColor = o.status === 'completed' ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-error';
            const statusIcon = o.status === 'completed' ? 'check_circle' : 'schedule';
            const itemsText = o.items_json ? JSON.parse(o.items_json).length + ' items' : 'Items';

            html += `
            <article class="order-card bg-surface-container-lowest rounded-xl shadow-sm transition-all duration-200 overflow-hidden" data-order-id="${shortId}">
                <div class="p-space-base flex flex-col gap-space-xs cursor-pointer select-none" onclick="toggleOrderDetails('order-${index}')">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-space-sm">
                            <div class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-title-md text-title-md text-primary font-bold">
                                ${initials}
                            </div>
                            <div>
                                <div class="flex items-center gap-space-xs">
                                    <h2 class="font-title-md text-title-md text-on-surface font-semibold tracking-tight">${o.customer_name}</h2>
                                </div>
                                <div class="flex items-center gap-1.5 mt-0.5">
                                    <span class="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container font-mono text-on-surface-variant">${shortId}</span>
                                    <span class="text-outline text-[10px]">•</span>
                                    <span class="font-body-sm text-body-sm text-outline">${date}</span>
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
                            <span class="font-label-md text-label-md text-outline">${itemsText}</span>
                        </div>
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${statusColor} font-label-md text-label-md font-semibold">
                            <span class="material-symbols-outlined text-[14px]">${statusIcon}</span>
                            ${o.status || 'Pending'}
                        </span>
                    </div>
                </div>
                <div class="hidden bg-surface-container-low px-space-base pb-space-base pt-space-xs flex flex-col gap-space-sm" id="details-order-${index}">
                    <div class="bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
                        <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Email</span>
                        <p class="font-body-sm text-body-sm text-on-surface">${o.customer_email}</p>
                    </div>
                    <div class="bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
                        <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Address</span>
                        <p class="font-body-sm text-body-sm text-on-surface">${o.address}</p>
                    </div>
                </div>
            </article>`;
        });
        
        container.innerHTML = html || '<p>No orders found.</p>';
    } catch (e) {
        console.error("Error loading orders", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
});
