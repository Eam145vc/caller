const { getJson } = require("serpapi");
const db = require('../database/db');

// Helper to add a delay between requests (if needed)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeBusinesses(city, businessType, maxResults = 20) {
    return new Promise(async (resolve, reject) => {
        let leads = [];
        let nextToken = null;
        let resultsCount = 0;
        const searchQuery = `${businessType} in ${city}`;

        console.log(`Starting scrape for: ${searchQuery}`);

        // Extract internal helper to process a single page of results
        const fetchPage = (start = 0) => {
            if (!process.env.SERPAPI_KEY) {
                return reject(new Error("SERPAPI_KEY is missing in .env"));
            }

            getJson({
                engine: "google_maps",
                q: searchQuery,
                type: "search",
                api_key: process.env.SERPAPI_KEY,
                start: start,
                limit: 20 // Max per page
            }, (json) => {
                if (!json.local_results) {
                    // No more results or error
                    if (json.error) console.error("SerpAPI Error:", json.error);
                    return resolve(leads);
                }

                const results = json.local_results;

                // Process results
                const newLeads = results.map(place => {
                    const hasWebsite = !!place.website;

                    // We are looking for businesses WITHOUT a website mainly,
                    // but we store all to avoid re-scraping the same ones later usually.
                    // For this specific use case, let's filter or mark them.

                    return {
                        name: place.title,
                        phone: place.phone,
                        address: place.address,
                        city: city,
                        business_type: businessType,
                        website: place.website || null,
                        has_website: hasWebsite,
                        rating: place.rating,
                        reviews: place.reviews,
                        place_id: place.place_id
                    };
                });

                // Filter: ONLY keep those WITHOUT a website for our cold calling list
                // (or keep all but mark them - let's save all but prioritize no-website in DB)

                // Insert into DB
                const insert = db.prepare(`
                    INSERT INTO leads (name, phone, address, city, business_type, has_website, website_url, status)
                    VALUES (@name, @phone, @address, @city, @business_type, @has_website, @website, 'new')
                `);

                const checkExists = db.prepare('SELECT id FROM leads WHERE name = ? AND city = ?');

                let savedCount = 0;
                for (const lead of newLeads) {
                    // Simple deduplication check
                    const exists = checkExists.get(lead.name, lead.city);
                    if (!exists) {
                        try {
                            // Only save if it has a phone number (can't call without it)
                            if (lead.phone) {
                                insert.run({
                                    name: lead.name,
                                    phone: lead.phone,
                                    address: lead.address,
                                    city: lead.city,
                                    business_type: lead.business_type,
                                    has_website: lead.has_website ? 1 : 0, // SQLite keeps booleans as 1/0
                                    website: lead.website
                                });
                                savedCount++;
                            }
                        } catch (err) {
                            console.error("Error saving lead:", err.message);
                        }
                    }
                }

                leads.push(...newLeads);
                resultsCount += newLeads.length;

                console.log(`Processed ${newLeads.length} results. Saved ${savedCount} new leads.`);

                // Pagination logic
                if (resultsCount < maxResults && json.serpapi_pagination && json.serpapi_pagination.next) {
                    // SerpAPI maps uses 'start' parameter. next_link has it.
                    // Just increment start by 20.
                    const nextStart = start + 20;
                    console.log(`Fetching next page (start: ${nextStart})...`);
                    fetchPage(nextStart);
                } else {
                    resolve(leads);
                }
            });
        };

        // Start first page
        fetchPage(0);
    });
}

module.exports = { scrapeBusinesses };
