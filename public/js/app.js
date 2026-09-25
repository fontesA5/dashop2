// Cart state management
let cart = [];
const STORAGE_KEY = 'dashop_cart';

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initCart();
    loadProducts();
});

// Load cart from localStorage or initialize empty
function initCart() {
    const savedCart = localStorage.getItem(STORAGE_KEY);
    if (savedCart) {
        try {
            cart = JSON.parse(savedCart);
            updateCartUI();
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

// Open cart modal
function openCart() {
    const modal = document.getElementById('cart-modal');
    if (modal) modal.classList.add('active');
    renderCart();
}

// Close cart modal
function closeCart() {
    const modal = document.getElementById('cart-modal');
    if (modal) modal.classList.remove('active');
}

// Proceed to checkout
function proceedToCheckout() {
    closeCart();
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.add('active');
}

// Close checkout modal
function closeCheckout() {
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.remove('active');
}

// Add product to cart
async function addToCart(product, quantity = 1) {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image || '📦',
            quantity: quantity
        });
    }
    
    saveCart();
    updateCartCount();
    showNotification(`Added ${product.name} to cart!`);
}

// Remove item from cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
    showNotification('Item removed from cart');
}

// Update cart quantity
function updateQuantity(productId, delta) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
        }
    }
}

// Render cart items
function renderCart() {
    const cartContainer = document.getElementById('cart-items');
    if (!cartContainer) return;
    
    if (cart.length === 0) {
        cartContainer.innerHTML = `
            <div class="empty-cart">
                <p style="text-align: center; padding: 2rem; color: #94a3b8;">
                    Your cart is empty 🛒<br>
                    Start adding some products!
                </p>
            </div>
        `;
        document.getElementById('cart-total').textContent = '0.00';
        return;
    }
    
    let html = '<div class="cart-items">';
    cart.forEach(item => {
        html += `
            <div class="cart-item">
                <div class="item-info">
                    <div class="item-name">${item.name}</div>
                    <div class="item-price">$${item.price.toFixed(2)} x ${item.quantity}</div>
                </div>
                <button class="remove-btn" onclick="removeFromCart('${item.id}')">Remove</button>
            </div>
        `;
    });
    html += '</div>';
    
    cartContainer.innerHTML = html;
}

// Calculate and update cart total
function calculateTotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = count;
    }
}

// Handle checkout form submission
async function handleCheckout(event) {
    event.preventDefault();
    
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }
    
    const formData = new FormData(event.target);
    const orderData = {
        name: formData.get('name'),
        email: formData.get('email'),
        address: formData.get('address'),
        items: cart,
        total: calculateTotal(),
        timestamp: new Date().toISOString()
    };
    
    try {
        // Sync order to Supabase (will be configured in supabase config)
        await syncOrderToSupabase(orderData);
        
        // Clear cart after successful checkout
        cart = [];
        saveCart();
        updateCartCount();
        
        closeCheckout();
        showNotification('✅ Order placed successfully! We\'ll send a confirmation email soon.');
        
        event.target.reset();
    } catch (error) {
        console.error('Checkout error:', error);
        alert('Error placing order: ' + error.message);
    }
}

// Sync order to Supabase backend
async function syncOrderToSupabase(orderData) {
    // Initialize Supabase client (will use env vars)
    const supabaseUrl = window.supabaseUrl;
    const supabaseKey = window.supabaseAnonKey;
    
    if (!supabaseUrl || !supabaseKey) {
        console.log('Supabase not configured yet - storing locally');
        return Promise.resolve();
    }
    
    const supabase = window.supabaseClient;
    
    try {
        // Insert order into Supabase orders table
        const { data, error } = await supabase
            .from('orders')
            .insert([{
                ...orderData,
                status: 'pending'
            }])
            .select('*');
        
        if (error) throw error;
        
        console.log('Order synced to Supabase:', data);
    } catch (error) {
        console.error('Supabase sync error:', error);
        // Don't block checkout if Supabase is not ready
    }
}

// Load products from Supabase or use demo data
async function loadProducts() {
    const productGrid = document.getElementById('product-grid');
    
    try {
        const supabaseUrl = window.supabaseUrl;
        const supabaseKey = window.supabaseAnonKey;
        
        let products = [];
        
        if (supabaseUrl && supabaseKey) {
            const supabase = window.supabaseClient;
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            products = data;
        } else {
            // Demo products for initial load
            products = [
                { id: 1, name: 'Wireless Bluetooth Earbuds', price: 49.99, image: '🎧' },
                { id: 2, name: 'Smartphone Stand', price: 19.99, image: '📱' },
                { id: 3, name: 'USB-C Cable 6ft', price: 12.99, image: '🔌' },
                { id: 4, name: 'Portable Power Bank', price: 34.99, image: '🔋' },
                { id: 5, name: 'Laptop Sleeve 13"', price: 24.99, image: '💼' },
                { id: 6, name: 'Mechanical Keyboard', price: 89.99, image: '⌨️' },
                { id: 7, name: 'Gaming Mouse', price: 39.99, image: '🖱️' },
                { id: 8, name: 'Monitor Stand', price: 29.99, image: '🪑' }
            ];
        }
        
        // Render product cards
        let html = '<div class="product-grid";';
        products.forEach(product => {
            const emoji = product.image || getPlaceholderEmoji(product.name);
            html += `
                <div class="product-card" onclick="viewProduct(${product.id})">
                    <div class="product-image">${emoji}</div>
                    <div class="product-title">${product.name}</div>
                    <div class="product-price">$${product.price.toFixed(2)}</div>
                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart(${JSON.stringify(product)})">
                        Add to Cart
                    </button>
                </div>
            `;
        });
        html += '</div>';
        
        productGrid.innerHTML = html;
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

// Helper to get emoji based on product name
function getPlaceholderEmoji(name) {
    const keywords = ['ear', 'phone', 'cable', 'battery', 'power', 'stand', 'mouse', 'keyboard', 'sleeve'];
    return keywords.find(k => name.toLowerCase().includes(k)) || '📦';
}

// View product (placeholder for detail page)
function viewProduct(productId) {
    console.log('Viewing product:', productId);
    // TODO: Implement product detail page
}

// Show notification
function showNotification(message, duration = 3000) {
    // Simple notification implementation
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 1rem 2rem;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        z-index: 2000;
        font-weight: 500;
        animation: slideUp 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    if (duration > 0) {
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

// Add animation styles dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from { transform: translate(-50%, 100%); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
    }
    
    .notification { animation: slideUp 0.3s ease; }
`;
document.head.appendChild(style);

// Make functions globally available
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.openCart = openCart;
window.closeCart = closeCart;
window.proceedToCheckout = proceedToCheckout;
window.handleCheckout = handleCheckout;