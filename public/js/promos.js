/**
 * DaShop Promo & Discount Code Manager + Hero Banner Carousel Manager
 */

// Helper to get styling for banner theme presets
window.getBannerThemeClasses = function(theme) {
    switch (theme) {
        case 'sunset':
            return {
                bg: 'bg-gradient-to-br from-amber-600 via-orange-600 to-rose-600 text-white',
                tagBg: 'bg-white/20 text-white border border-white/30 backdrop-blur-sm',
                btnBg: 'bg-white hover:bg-white/90 text-amber-900',
                badgeBg: 'bg-white/25 text-white',
                blurColor: 'bg-yellow-300'
            };
        case 'emerald':
            return {
                bg: 'bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-700 text-white',
                tagBg: 'bg-white/20 text-white border border-white/30 backdrop-blur-sm',
                btnBg: 'bg-white hover:bg-white/90 text-emerald-950',
                badgeBg: 'bg-white/25 text-white',
                blurColor: 'bg-emerald-300'
            };
        case 'berry':
            return {
                bg: 'bg-gradient-to-br from-purple-800 via-fuchsia-700 to-pink-600 text-white',
                tagBg: 'bg-white/20 text-white border border-white/30 backdrop-blur-sm',
                btnBg: 'bg-white hover:bg-white/90 text-purple-950',
                badgeBg: 'bg-white/25 text-white',
                blurColor: 'bg-pink-300'
            };
        case 'midnight':
            return {
                bg: 'bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-900 text-white',
                tagBg: 'bg-white/20 text-white border border-white/30 backdrop-blur-sm',
                btnBg: 'bg-white hover:bg-white/90 text-slate-950',
                badgeBg: 'bg-white/25 text-white',
                blurColor: 'bg-indigo-400'
            };
        case 'ruby':
            return {
                bg: 'bg-gradient-to-br from-rose-800 via-red-600 to-amber-700 text-white',
                tagBg: 'bg-white/20 text-white border border-white/30 backdrop-blur-sm',
                btnBg: 'bg-white hover:bg-white/90 text-rose-950',
                badgeBg: 'bg-white/25 text-white',
                blurColor: 'bg-rose-300'
            };
        case 'primary':
        default:
            return {
                bg: 'bg-gradient-to-br from-primary via-primary-container to-secondary text-on-primary',
                tagBg: 'bg-tertiary-fixed text-on-tertiary-fixed',
                btnBg: 'bg-tertiary-fixed hover:bg-tertiary-fixed-dim text-on-tertiary-fixed',
                badgeBg: 'bg-tertiary-fixed text-on-tertiary-fixed',
                blurColor: 'bg-tertiary-fixed'
            };
    }
};

class BannerManager {
    constructor() {
        this.storageKey = 'dashop_banners';
        this.configRowName = '__dashop_banners__';
        this.defaultBanners = [
            {
                id: 'banner_1',
                title: "Save Big on Your Essentials",
                subtitle: "Use code SAVE10 for instant discounts on all everyday items!",
                tag: "Limited Time",
                tag_icon: "local_fire_department",
                promo_code: "SAVE10",
                link_url: "/catalog",
                button_text: "Shop now",
                theme: "primary",
                image_url: "",
                active: true,
                created_at: new Date().toISOString()
            },
            {
                id: 'banner_2',
                title: "Weekend Flash Deals",
                subtitle: "Exclusive savings on household & cleaning essentials!",
                tag: "Flash Deals",
                tag_icon: "bolt",
                promo_code: "FLASH20",
                link_url: "/catalog?category=Household+Essentials",
                button_text: "Explore Deals",
                theme: "sunset",
                image_url: "",
                active: true,
                created_at: new Date().toISOString()
            },
            {
                id: 'banner_3',
                title: "Personal Care & Beauty",
                subtitle: "Discover premium skincare and personal wellness products.",
                tag: "Seasonal Special",
                tag_icon: "spa",
                promo_code: "",
                link_url: "/catalog?category=Personal+Care",
                button_text: "Discover More",
                theme: "emerald",
                image_url: "",
                active: true,
                created_at: new Date().toISOString()
            }
        ];
    }

    async getBanners() {
        try {
            if (window.supabaseClient) {
                // Try table 'banners' first
                try {
                    const { data, error } = await window.supabaseClient.from('banners').select('*').order('created_at', { ascending: false });
                    if (!error && data && data.length > 0) {
                        this.saveLocalBanners(data);
                        return data;
                    }
                } catch(e) {}

                // Try config row in products table
                const { data: configData, error: configErr } = await window.supabaseClient
                    .from('products')
                    .select('*')
                    .eq('category', '__dashop_config__')
                    .eq('name', this.configRowName)
                    .maybeSingle();

                if (!configErr && configData && configData.description) {
                    try {
                        const parsed = JSON.parse(configData.description);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            this.saveLocalBanners(parsed);
                            return parsed;
                        }
                    } catch(e) {}
                }
            }
        } catch (e) {
            console.log('Using local banners fallback:', e);
        }

        // Fallback to localStorage
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch (e) {}
        }

        // Default seeds
        this.saveLocalBanners(this.defaultBanners);
        this.syncToSupabase(this.defaultBanners).catch(() => {});
        return this.defaultBanners;
    }

    async getActiveBanners() {
        const banners = await this.getBanners();
        return banners.filter(b => b.active === true);
    }

    saveLocalBanners(banners) {
        localStorage.setItem(this.storageKey, JSON.stringify(banners));
    }

    async syncToSupabase(banners) {
        if (!window.supabaseClient) return;
        try {
            const { data: existing } = await window.supabaseClient
                .from('products')
                .select('id')
                .eq('category', '__dashop_config__')
                .eq('name', this.configRowName)
                .maybeSingle();

            const payload = {
                name: this.configRowName,
                description: JSON.stringify(banners),
                price: 0,
                stock: 0,
                category: '__dashop_config__'
            };

            if (existing && existing.id) {
                await window.supabaseClient
                    .from('products')
                    .update(payload)
                    .eq('id', existing.id);
            } else {
                await window.supabaseClient
                    .from('products')
                    .insert([payload]);
            }
        } catch(e) {
            console.warn('Could not sync banners to Supabase:', e);
        }
    }

    async createBanner(bannerData) {
        const banners = await this.getBanners();
        const newBanner = {
            id: 'banner_' + Date.now(),
            title: bannerData.title ? bannerData.title.trim() : 'Special Promotion',
            subtitle: bannerData.subtitle ? bannerData.subtitle.trim() : '',
            tag: bannerData.tag ? bannerData.tag.trim() : 'Special Event',
            tag_icon: bannerData.tag_icon ? bannerData.tag_icon.trim() : 'campaign',
            promo_code: bannerData.promo_code ? bannerData.promo_code.trim().toUpperCase() : '',
            link_url: bannerData.link_url ? bannerData.link_url.trim() : '/catalog',
            button_text: bannerData.button_text ? bannerData.button_text.trim() : 'Shop now',
            theme: bannerData.theme || 'primary',
            image_url: bannerData.image_url ? bannerData.image_url.trim() : '',
            active: bannerData.active !== undefined ? !!bannerData.active : true,
            created_at: new Date().toISOString()
        };

        banners.unshift(newBanner);
        this.saveLocalBanners(banners);
        await this.syncToSupabase(banners);
        return newBanner;
    }

    async toggleBannerActive(id) {
        const banners = await this.getBanners();
        const banner = banners.find(b => String(b.id) === String(id));
        if (banner) {
            banner.active = !banner.active;
            this.saveLocalBanners(banners);
            await this.syncToSupabase(banners);
        }
        return banner;
    }

    async deleteBanner(id) {
        let banners = await this.getBanners();
        banners = banners.filter(b => String(b.id) !== String(id));
        this.saveLocalBanners(banners);
        await this.syncToSupabase(banners);
        return true;
    }
}

class PromoManager {
    constructor() {
        this.storageKey = 'dashop_promos';
        this.configRowName = '__dashop_promos__';
        this.defaultPromos = [
            {
                id: 1,
                title: "Launch Celebration",
                description: "Get 15% off your entire order with code LAUNCH15",
                promo_code: "LAUNCH15",
                discount_type: "percentage",
                discount_value: 15,
                active: true,
                start_date: new Date().toISOString(),
                end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 2,
                title: "Special Welcome",
                description: "Save 10% on your essentials with code SAVE10",
                promo_code: "SAVE10",
                discount_type: "percentage",
                discount_value: 10,
                active: true,
                start_date: new Date().toISOString(),
                end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    async getPromos() {
        try {
            if (window.supabaseClient) {
                try {
                    const { data, error } = await window.supabaseClient.from('promos').select('*');
                    if (!error && data && data.length > 0) {
                        this.saveLocalPromos(data);
                        return data;
                    }
                } catch (e) {}

                // Try config row
                const { data: configData, error: configErr } = await window.supabaseClient
                    .from('products')
                    .select('*')
                    .eq('category', '__dashop_config__')
                    .eq('name', this.configRowName)
                    .maybeSingle();

                if (!configErr && configData && configData.description) {
                    try {
                        const parsed = JSON.parse(configData.description);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            this.saveLocalPromos(parsed);
                            return parsed;
                        }
                    } catch(e) {}
                }
            }
        } catch (e) {
            console.log('Using local promos fallback');
        }

        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try { return JSON.parse(stored); } catch (e) {}
        }

        this.saveLocalPromos(this.defaultPromos);
        this.syncToSupabase(this.defaultPromos).catch(() => {});
        return this.defaultPromos;
    }

    saveLocalPromos(promos) {
        localStorage.setItem(this.storageKey, JSON.stringify(promos));
    }

    async syncToSupabase(promos) {
        if (!window.supabaseClient) return;
        try {
            const { data: existing } = await window.supabaseClient
                .from('products')
                .select('id')
                .eq('category', '__dashop_config__')
                .eq('name', this.configRowName)
                .maybeSingle();

            const payload = {
                name: this.configRowName,
                description: JSON.stringify(promos),
                price: 0,
                stock: 0,
                category: '__dashop_config__'
            };

            if (existing && existing.id) {
                await window.supabaseClient
                    .from('products')
                    .update(payload)
                    .eq('id', existing.id);
            } else {
                await window.supabaseClient
                    .from('products')
                    .insert([payload]);
            }
        } catch(e) {
            console.warn('Could not sync promos to Supabase:', e);
        }
    }

    async getActivePromo() {
        const promos = await this.getPromos();
        const now = new Date();
        const active = promos.find(p => p.active && (!p.end_date || new Date(p.end_date) >= now));
        return active || promos[0] || null;
    }

    async validateCode(code) {
        if (!code) return null;
        const normalized = code.trim().toUpperCase();
        const promos = await this.getPromos();
        const found = promos.find(p => p.active && p.promo_code.toUpperCase() === normalized);
        return found || null;
    }

    async createPromo(promoData) {
        const newPromo = {
            id: Date.now(),
            title: promoData.title,
            description: promoData.description,
            promo_code: promoData.promo_code.toUpperCase(),
            discount_type: promoData.discount_type || 'percentage',
            discount_value: parseFloat(promoData.discount_value) || 10,
            active: true,
            created_at: new Date().toISOString()
        };

        const promos = await this.getPromos();
        promos.unshift(newPromo);
        this.saveLocalPromos(promos);
        await this.syncToSupabase(promos);
        return newPromo;
    }

    async togglePromoStatus(id) {
        const promos = await this.getPromos();
        const promo = promos.find(p => String(p.id) === String(id));
        if (promo) {
            promo.active = !promo.active;
            this.saveLocalPromos(promos);
            await this.syncToSupabase(promos);
        }
        return promo;
    }

    async deletePromo(id) {
        let promos = await this.getPromos();
        promos = promos.filter(p => String(p.id) !== String(id));
        this.saveLocalPromos(promos);
        await this.syncToSupabase(promos);
        return true;
    }
}

window.promoManager = new PromoManager();
window.bannerManager = new BannerManager();
