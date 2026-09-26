/**
 * DaShop Product Importer
 * Imports products from dashop-db-export-2026-09-26.json into Supabase
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://wninmlukmkdlrfgblobz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduaW5tbHVrbWtkbHJmZ2Jsb2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNjgxOTAsImV4cCI6MjEwNTk0NDE5MH0.QahkI2kesSvnoehhwNHMLXRehqI1wCbJMztaW3_E6wg';

async function importProducts() {
    const exportFile = path.resolve(__dirname, '..', 'dashop-db-export-2026-09-26.json');
    if (!fs.existsSync(exportFile)) {
        console.error('Export file not found at:', exportFile);
        process.exit(1);
    }

    console.log('Reading export file...');
    const rawData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
    const sourceProducts = rawData.products || [];
    console.log(`Found ${sourceProducts.length} products in export file.`);

    // 1. Fetch existing products from Supabase to prevent duplicates
    console.log('Fetching existing products from Supabase...');
    const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,category,description`, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
    });

    if (!existingRes.ok) {
        console.error('Failed to fetch existing products:', existingRes.status, await existingRes.text());
        process.exit(1);
    }

    const existingProducts = await existingRes.json();
    console.log(`Currently in Supabase: ${existingProducts.length} entries.`);

    const existingNames = new Set(existingProducts.map(p => (p.name || '').trim().toLowerCase()));
    const existingLegacyIds = new Set();

    existingProducts.forEach(p => {
        if (p.description && p.description.startsWith('{')) {
            try {
                const meta = JSON.parse(p.description);
                if (meta.legacy_id) existingLegacyIds.add(meta.legacy_id);
            } catch (e) {}
        }
    });

    // 2. Format and prepare records to insert
    const toInsert = [];
    const skipped = [];

    sourceProducts.forEach(item => {
        const trimmedName = (item.name || '').trim();
        const lowerName = trimmedName.toLowerCase();

        if (existingNames.has(lowerName) || (item.id && existingLegacyIds.has(item.id))) {
            skipped.push(trimmedName);
            return;
        }

        // Gather all image URLs and hints
        const images = [];
        const imageHints = [];

        if (Array.isArray(item.images)) {
            item.images.forEach(img => {
                const u = typeof img === 'string' ? img : img.url;
                const h = typeof img === 'object' ? img.hint : '';
                if (u && !images.includes(u)) {
                    images.push(u);
                    if (h) imageHints.push(h);
                }
            });
        }
        if (item.imageUrl && !images.includes(item.imageUrl)) {
            images.push(item.imageUrl);
            if (item.imageHint) imageHints.push(item.imageHint);
        }

        const category = (item.category || 'General').trim();
        let emoji = '📦';
        if (category.toLowerCase().includes('personal')) emoji = '🧴';
        else if (category.toLowerCase().includes('household')) emoji = '🧼';
        else if (category.toLowerCase().includes('beauty')) emoji = '💄';

        const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        const metadata = {
            desc: item.description || '',
            slug: slug,
            images: images,
            image_hints: imageHints,
            barcode: item.barcode || '',
            variations: item.variations || [],
            legacy_id: item.id
        };

        let createdAt = new Date().toISOString();
        if (item.createdAt) {
            if (typeof item.createdAt === 'object' && item.createdAt.seconds) {
                createdAt = new Date(item.createdAt.seconds * 1000).toISOString();
            } else if (typeof item.createdAt === 'string') {
                createdAt = new Date(item.createdAt).toISOString();
            }
        }

        toInsert.push({
            name: trimmedName,
            price: parseFloat(item.price) || 0,
            stock: parseInt(item.stock) || 0,
            category: category,
            image: emoji,
            description: JSON.stringify(metadata),
            created_at: createdAt,
            updated_at: new Date().toISOString()
        });

        // Add to tracking set to avoid duplicate entries within file
        existingNames.add(lowerName);
    });

    console.log(`Ready to insert: ${toInsert.length} products. Skipped existing: ${skipped.length}`);

    if (toInsert.length === 0) {
        console.log('No new products to insert. Everything is up to date.');
        return;
    }

    // 3. Batch insert in chunks of 25
    const batchSize = 25;
    let insertedTotal = 0;

    for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        console.log(`Inserting batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)...`);

        const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
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
        console.log(`Batch ${Math.floor(i / batchSize) + 1} inserted successfully. Total inserted so far: ${insertedTotal}`);
    }

    console.log(`\nImport complete! Successfully inserted ${insertedTotal} products into Supabase.`);
}

importProducts().catch(err => {
    console.error('Import script failed:', err);
    process.exit(1);
});
