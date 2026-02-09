/**
 * HSAAS Internal Roster Updater
 * This script should be run via cron (e.g., hourly) on the hospital server.
 * It fetches the latest data, trims it for performance, and saves snapshot.json.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// CONFIGURATION (IT Team should update these)
const BACKEND_PROXY_URL = 'https://sheets-proxy-backend.onrender.com'; // Change to internal proxy URL later
const SNAPSHOT_FILE_PATH = path.join(__dirname, 'snapshot.json');

async function fetchData(endpoint) {
    return new Promise((resolve, reject) => {
        https.get(`${BACKEND_PROXY_URL}/${endpoint}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', (err) => reject(err));
    });
}

function trimTimetable(timetableValues) {
    const headers = timetableValues[0];
    const rows = timetableValues.slice(1);

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const cutoff = sevenDaysAgo < startOfMonth ? sevenDaysAgo : startOfMonth;

    const filteredRows = rows.filter(row => {
        const dateStr = row[0]; // DD/MM/YYYY
        if (!dateStr) return false;
        const pts = dateStr.split('/');
        if (pts.length !== 3) return false;
        const rowDate = new Date(parseInt(pts[2]), parseInt(pts[1]) - 1, parseInt(pts[0]));
        return rowDate >= cutoff;
    });

    return [headers, ...filteredRows];
}

async function runUpdate() {
    console.log('🔄 Starting internal roster update...');
    try {
        const timetable = await fetchData('timetable');
        const contacts = await fetchData('contacts');

        const trimmedValues = trimTimetable(timetable.values);

        const timestamp = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

        const snapshot = {
            last_updated: timestamp,
            timetable: { ...timetable, values: trimmedValues },
            contacts: contacts
        };

        fs.writeFileSync(SNAPSHOT_FILE_PATH, JSON.stringify(snapshot, null, 2));
        console.log(`✅ Success! snapshot.json updated with ${trimmedValues.length - 1} rows.`);
    } catch (err) {
        console.error('❌ Update failed:', err.message);
    }
}

runUpdate();
