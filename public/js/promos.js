/**
 * DaShop Promo & Discount Code Manager
 */

class PromoManager {
    constructor() {
        this.storageKey = 'dashop_promos';
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
                const { data, error } = await window.supabaseClient.from('promos').select('*');
                if (!error && data && data.length > 0) {
                    return data;
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
        return this.defaultPromos;
    }

    saveLocalPromos(promos) {
        localStorage.setItem(this.storageKey, JSON.stringify(promos));
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

        try {
            if (window.supabaseClient) {
                const { data, error } = await window.supabaseClient.from('promos').insert([newPromo]).select();
                if (!error && data && data.length > 0) return data[0];
            }
        } catch (e) {
            console.warn('Supabase promo insert error, saving locally:', e);
        }

        const promos = await this.getPromos();
        promos.unshift(newPromo);
        this.saveLocalPromos(promos);
        return newPromo;
    }

    async togglePromoStatus(id) {
        const promos = await this.getPromos();
        const promo = promos.find(p => String(p.id) === String(id));
        if (promo) {
            promo.active = !promo.active;
            try {
                if (window.supabaseClient) {
                    await window.supabaseClient.from('promos').update({ active: promo.active }).eq('id', id);
                }
            } catch (e) {}
            this.saveLocalPromos(promos);
        }
        return promo;
    }

    async deletePromo(id) {
        let promos = await this.getPromos();
        promos = promos.filter(p => String(p.id) !== String(id));
        try {
            if (window.supabaseClient) {
                await window.supabaseClient.from('promos').delete().eq('id', id);
            }
        } catch (e) {}
        this.saveLocalPromos(promos);
        return true;
    }
}

window.promoManager = new PromoManager();
