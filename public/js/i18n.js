/**
 * DaShop Internationalization (i18n) Module
 * Supports: English (en), Spanish (es), Portuguese (pt)
 */

const translations = {
    en: {
        store: "Store",
        catalog: "Catalog",
        orders: "Orders",
        admin_hub: "Admin Hub",
        cart: "Your Cart",
        checkout: "Checkout",
        search_placeholder: "Search groceries, essentials...",
        search_catalog_placeholder: "Search products by name or category...",
        official_store: "Official Online Store",
        direct_to_you: "Direct to You • Orders 24/7",
        fast_dispatch: "Fast Dispatch",
        explore_categories: "Explore Categories",
        view_all: "View All",
        see_all: "See All",
        new_arrivals: "New Arrivals",
        all_products: "All Products",
        limited_time: "Limited Time",
        shop_now: "Shop Now",
        add_to_cart: "Add to Cart",
        order_online: "Order Online",
        total: "Total",
        proceed_to_checkout: "Proceed to Checkout",
        empty_cart_title: "Your cart is empty 🛒",
        empty_cart_subtitle: "Start adding some products!",
        remove: "Remove",
        full_name: "Full Name",
        email: "Email",
        phone: "Phone Number",
        address: "Delivery Address",
        place_order: "Place Order",
        order_success: "✅ Order placed successfully! Thank you for shopping with DaShop.",
        discount_code: "Promo / Discount Code",
        apply: "Apply",
        discount_applied: "Discount applied",
        invalid_code: "Invalid or expired promo code",
        no_products: "No products found in this category.",
        loading: "Loading...",
        order_details: "Order Details",
        status_pending: "Pending",
        status_completed: "Completed",
        delete_confirm_order: "Are you sure you want to delete this order?",
        delete_confirm_product: "Are you sure you want to delete this product?",
        product_added: "Added to cart!",
        dark_mode: "Dark Mode",
        light_mode: "Light Mode",
        promo_banner_title: "Special Offer Available!",
        promo_banner_sub: "Use code at checkout to save big.",
        manage_products: "Manage Products",
        add_new_product: "Add New Product",
        edit_product: "Edit Product",
        delete: "Delete",
        save: "Save Product",
        cancel: "Cancel",
        product_name: "Product Name",
        slug: "Slug (URL path)",
        category: "Category",
        price: "Price ($)",
        stock: "Stock Quantity",
        description: "Description",
        image_url: "Image URL",
        drag_drop_images: "Drag & drop images here, or click to upload",
        batch_images: "Additional Image URLs (one per line)",
        manage_promos: "Manage Promos",
        create_promo: "Create Promo Code",
        promo_code_label: "Code (e.g. SAVE10)",
        discount_percent: "Discount Percentage (%)",
        active: "Active",
        inactive: "Inactive",
        status: "Status",
        revenue: "Total Revenue",
        inventory: "Inventory",
        in_stock: "in stock",
        recent_activity: "Recent Activity",
        quick_actions: "Quick Actions"
    },
    es: {
        store: "Tienda",
        catalog: "Catálogo",
        orders: "Pedidos",
        admin_hub: "Panel Admin",
        cart: "Tu Carrito",
        checkout: "Finalizar Compra",
        search_placeholder: "Buscar comestibles, artículos esenciales...",
        search_catalog_placeholder: "Buscar productos por nombre o categoría...",
        official_store: "Tienda Oficial Online",
        direct_to_you: "Directo a ti • Pedidos 24/7",
        fast_dispatch: "Envío Rápido",
        explore_categories: "Explorar Categorías",
        view_all: "Ver Todos",
        see_all: "Ver Todos",
        new_arrivals: "Novedades",
        all_products: "Todos los Productos",
        limited_time: "Tiempo Limitado",
        shop_now: "Comprar Ahora",
        add_to_cart: "Agregar al Carrito",
        order_online: "Pedir Online",
        total: "Total",
        proceed_to_checkout: "Continuar al Pago",
        empty_cart_title: "Tu carrito está vacío 🛒",
        empty_cart_subtitle: "¡Comienza agregando productos!",
        remove: "Eliminar",
        full_name: "Nombre Completo",
        email: "Correo Electrónico",
        phone: "Teléfono",
        address: "Dirección de Entrega",
        place_order: "Confirmar Pedido",
        order_success: "✅ ¡Pedido realizado con éxito! Gracias por comprar en DaShop.",
        discount_code: "Código Promocional / Descuento",
        apply: "Aplicar",
        discount_applied: "Descuento aplicado",
        invalid_code: "Código inválido o vencido",
        no_products: "No se encontraron productos en esta categoría.",
        loading: "Cargando...",
        order_details: "Detalles del Pedido",
        status_pending: "Pendiente",
        status_completed: "Completado",
        delete_confirm_order: "¿Estás seguro de que deseas eliminar este pedido?",
        delete_confirm_product: "¿Estás seguro de que deseas eliminar este producto?",
        product_added: "¡Agregado al carrito!",
        dark_mode: "Modo Oscuro",
        light_mode: "Modo Claro",
        promo_banner_title: "¡Oferta Especial Disponible!",
        promo_banner_sub: "Usa el código en el checkout y ahorra.",
        manage_products: "Gestionar Productos",
        add_new_product: "Agregar Producto",
        edit_product: "Editar Producto",
        delete: "Eliminar",
        save: "Guardar Producto",
        cancel: "Cancelar",
        product_name: "Nombre del Producto",
        slug: "Slug (enlace URL)",
        category: "Categoría",
        price: "Precio ($)",
        stock: "Cantidad en Stock",
        description: "Descripción",
        image_url: "URL de la Imagen",
        drag_drop_images: "Arrastra imágenes aquí o haz clic para subir",
        batch_images: "URLs adicionales de imágenes (una por línea)",
        manage_promos: "Gestionar Promos",
        create_promo: "Crear Código Promocional",
        promo_code_label: "Código (ej. SAVE10)",
        discount_percent: "Porcentaje de Descuento (%)",
        active: "Activo",
        inactive: "Inactivo",
        status: "Estado",
        revenue: "Ingresos Totales",
        inventory: "Inventario",
        in_stock: "en inventario",
        recent_activity: "Actividad Reciente",
        quick_actions: "Acciones Rápidas"
    },
    pt: {
        store: "Loja",
        catalog: "Catálogo",
        orders: "Pedidos",
        admin_hub: "Painel Admin",
        cart: "Seu Carrinho",
        checkout: "Finalizar Compra",
        search_placeholder: "Pesquisar produtos, essenciais...",
        search_catalog_placeholder: "Buscar produtos por nome ou categoria...",
        official_store: "Loja Oficial Online",
        direct_to_you: "Direto para você • Pedidos 24/7",
        fast_dispatch: "Envio Rápido",
        explore_categories: "Explorar Categorias",
        view_all: "Ver Todos",
        see_all: "Ver Todos",
        new_arrivals: "Novidades",
        all_products: "Todos os Produtos",
        limited_time: "Tempo Limitado",
        shop_now: "Comprar Agora",
        add_to_cart: "Adicionar ao Carrinho",
        order_online: "Pedir Online",
        total: "Total",
        proceed_to_checkout: "Ir para o Pagamento",
        empty_cart_title: "Seu carrinho está vazio 🛒",
        empty_cart_subtitle: "Comece adicionando produtos!",
        remove: "Remover",
        full_name: "Nome Completo",
        email: "E-mail",
        phone: "Telefone",
        address: "Endereço de Entrega",
        place_order: "Confirmar Pedido",
        order_success: "✅ Pedido realizado com sucesso! Obrigado por comprar na DaShop.",
        discount_code: "Cupom de Desconto",
        apply: "Aplicar",
        discount_applied: "Desconto aplicado",
        invalid_code: "Cupom inválido ou expirado",
        no_products: "Nenhum produto encontrado nesta categoria.",
        loading: "Carregando...",
        order_details: "Detalhes do Pedido",
        status_pending: "Pendente",
        status_completed: "Concluído",
        delete_confirm_order: "Tem certeza de que deseja excluir este pedido?",
        delete_confirm_product: "Tem certeza de que deseja excluir este produto?",
        product_added: "Adicionado ao carrinho!",
        dark_mode: "Modo Escuro",
        light_mode: "Modo Claro",
        promo_banner_title: "Oferta Especial Disponível!",
        promo_banner_sub: "Use o cupom no checkout e economize.",
        manage_products: "Gerenciar Produtos",
        add_new_product: "Adicionar Produto",
        edit_product: "Editar Produto",
        delete: "Excluir",
        save: "Salvar Produto",
        cancel: "Cancelar",
        product_name: "Nome do Produto",
        slug: "Slug (link URL)",
        category: "Categoria",
        price: "Preço ($)",
        stock: "Quantidade em Estoque",
        description: "Descrição",
        image_url: "URL da Imagem",
        drag_drop_images: "Arraste imagens aqui ou clique para enviar",
        batch_images: "URLs adicionais de imagens (uma por linha)",
        manage_promos: "Gerenciar Cupons",
        create_promo: "Criar Cupom de Desconto",
        promo_code_label: "Código (ex: SAVE10)",
        discount_percent: "Porcentagem de Desconto (%)",
        active: "Ativo",
        inactive: "Inativo",
        status: "Status",
        revenue: "Receita Total",
        inventory: "Estoque",
        in_stock: "em estoque",
        recent_activity: "Atividade Recente",
        quick_actions: "Ações Rápidas"
    }
};

class I18nManager {
    constructor() {
        this.supported = ['en', 'es', 'pt'];
        this.lang = localStorage.getItem('dashop_lang') || this.detectLanguage();
    }

    detectLanguage() {
        const browserLang = (navigator.language || 'en').substring(0, 2).toLowerCase();
        return this.supported.includes(browserLang) ? browserLang : 'en';
    }

    setLanguage(lang) {
        if (!this.supported.includes(lang)) return;
        this.lang = lang;
        localStorage.setItem('dashop_lang', lang);
        document.documentElement.lang = lang;
        this.applyTranslations();
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    }

    t(key) {
        return (translations[this.lang] && translations[this.lang][key]) || 
               (translations['en'] && translations['en'][key]) || 
               key;
    }

    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    if (el.hasAttribute('placeholder')) el.placeholder = translation;
                } else {
                    el.textContent = translation;
                }
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            if (translation) el.placeholder = translation;
        });

        // Update active flags/dropdown state if present
        const currentLangEl = document.getElementById('current-lang-text');
        if (currentLangEl) {
            currentLangEl.textContent = this.lang.toUpperCase();
        }
    }
}

window.i18n = new I18nManager();

// Global language dropdown handlers
window.toggleLangMenu = function(e) {
    if (e) e.stopPropagation();
    const dd = document.getElementById('lang-dropdown');
    if (dd) dd.classList.toggle('hidden');
};

window.selectLanguage = function(lang) {
    if (window.i18n) window.i18n.setLanguage(lang);
    const dd = document.getElementById('lang-dropdown');
    if (dd) dd.classList.add('hidden');
};

document.addEventListener('click', () => {
    const dd = document.getElementById('lang-dropdown');
    if (dd) dd.classList.add('hidden');
});

document.addEventListener('DOMContentLoaded', () => {
    window.i18n.applyTranslations();
});

