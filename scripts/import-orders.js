/**
 * DaShop Orders Importer
 * Imports 99 historical orders from dashop-db-export-2026-09-26.json into Supabase
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://wninmlukmkdlrfgblobz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduaW5tbHVrbWtkbHJmZ2Jsb2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNjgxOTAsImV4cCI6MjEwNTk0NDE5MH0.QahkI2kesSvnoehhwNHMLXRehqI1wCbJMztaW3_E6wg';

async function importOrders() {
    const exportFile = path.resolve(__dirname, '..', 'dashop-db-export-2026-09-26.json');
    if (!fs.existsSync(exportFile)) {
        console.error('Export file not found at:', exportFile);
        process.exit(1);
    }

    console.log('Reading orders from export file...');
    const rawData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
    const sourceOrders = rawData.orders || [];
    console.log(`Found ${sourceOrders.length} orders in export file.`);

    // 1. Fetch existing orders from Supabase to prevent duplicates
    console.log('Fetching existing orders from Supabase...');
    const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=id,items_json,customer_name,total,created_at`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });

    if (!existingRes.ok) {
        console.error('Failed to fetch existing orders:', existingRes.status, await existingRes.text());
        process.exit(1);
    }

    const existingOrders = await existingRes.json();
    console.log(`Currently in Supabase: ${existingOrders.length} orders.`);

    const existingLegacyOrderIds = new Set();
    existingOrders.forEach(o => {
        try {
            const parsed = typeof o.items_json === 'string' ? JSON.parse(o.items_json) : o.items_json;
            if (parsed?.legacy_order_id) existingLegacyOrderIds.add(parsed.legacy_order_id);
        } catch(e) {}
    });

    // Sort source orders by date ascending so IDs increment chronologically
    sourceOrders.sort((a, b) => {
        const timeA = (a.createdAt?.seconds || 0) * 1000;
        const timeB = (b.createdAt?.seconds || 0) * 1000;
        return timeA - timeB;
    });

    const toInsert = [];
    const skipped = [];

    sourceOrders.forEach(o => {
        if (o.id && existingLegacyOrderIds.has(o.id)) {
            skipped.push(o.id);
            return;
        }

        const cust = o.customerDetails || {};
        const name = (cust.name || 'Valued Customer').trim();
        const phone = (cust.phone || '').trim();
        const cleanDigits = phone.replace(/\D/g, '') || '0000000000';
        const email = `${cleanDigits}@dashop.site`;
        const address = phone ? `Phone: ${phone}` : 'Store Pickup';
        const total = parseFloat(o.totalPrice) || 0;

        let status = (o.status || 'pending').toLowerCase();
        if (status === 'delivered') status = 'completed';

        let createdAt = new Date().toISOString();
        if (o.createdAt && o.createdAt.seconds) {
            createdAt = new Date(o.createdAt.seconds * 1000).toISOString();
        }

        const items = (o.items || []).map(i => ({
            id: i.id,
            name: i.name,
            price: parseFloat(i.price) || 0,
            quantity: parseInt(i.quantity) || 1,
            image: i.imageUrl || ''
        }));

        const itemsJson = JSON.stringify({
            items: items,
            phone: phone,
            customer_name: name,
            customer_email: email,
            legacy_order_id: o.id,
            subtotal: total,
            discount: 0
        });

        toInsert.push({
            customer_name: name,
            customer_email: email,
            address: address,
            total: total,
            status: status,
            items_json: itemsJson,
            created_at: createdAt
        });

        if (o.id) existingLegacyOrderIds.add(o.id);
    });

    console.log(`Ready to insert: ${toInsert.length} orders. Skipped existing: ${skipped.length}`);

    if (toInsert.length === 0) {
        console.log('No new orders to insert.');
        return;
    }

    // 2. Insert in batches of 25
    const batchSize = 25;
    let insertedTotal = 0;

    for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        console.log(`Inserting batch ${Math.floor(i / batchSize) + 1} (${batch.length} orders)...`);

        const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(batch)
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error(`Error inserting batch ${i / batchSize + 1}:`, res.status, errText);
            throw new Error(`Batch insert failed: ${errText}`);
        }

        const inserted = await res.json();
        insertedTotal += inserted.length;
        console.log(`Batch ${Math.floor(i / batchSize) + 1} inserted. Total inserted so far: ${insertedTotal}`);
    }

    console.log(`\nImport complete! Successfully inserted ${insertedTotal} orders into Supabase.`);
}

importOrders().catch(err => {
    console.error('Import orders failed:', err);
    process.exit(1);
});
