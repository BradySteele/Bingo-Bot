const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
async function setupGoogleSheets() {
    try {
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, serviceAccountAuth);
        await doc.loadInfo();
        console.log(`Connected to Google Sheets: ${doc.title}`);
        return doc;
    } catch (error) {
        console.error('Error setting up Google Sheets:', error);
        throw error;
    }
}
async function getFormResponses() {
    try {
        const doc = await setupGoogleSheets();
        const sheet = doc.sheetsByIndex[0]; 
        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();
        return rows.map(row => ({
            timestamp: row.get('Timestamp') || row.get('timestamp') || row.get('Column 1'),
            team: row.get('Which clan are you in? *Note: you MUST be an ACTUAL member in either Weenor or Melon (not a guest) to play in this bingo') || row.get('Column 2'),
            username: row.get('What is the Runescape Username of the account that will be playing in the bingo? SPELL CORRECTLY PLEASE') || row.get('Column 3'),
            paid: row.get('PAID (and how much)') || row.get('Column 4'),
            email: row.get('Email') || row.get('email'),
            processed: row.get('Processed') || row.get('processed') || 'false'
        }));
    } catch (error) {
        console.error('Error getting form responses:', error);
        return [];
    }
}
async function markAsProcessed(rowIndex) {
    try {
        const doc = await setupGoogleSheets();
        const sheet = doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();
        if (rows[rowIndex]) {
            rows[rowIndex].set('Processed', 'true');
            await rows[rowIndex].save();
        }
    } catch (error) {
        console.error('Error marking row as processed:', error);
    }
}
async function getUnprocessedResponses() {
    try {
        const responses = await getFormResponses();
        return responses
            .map((response, index) => ({ ...response, rowIndex: index }))
            .filter(response => {
                const processed = String(response.processed || '').toLowerCase().trim();
                return processed !== 'true' && processed !== '1' && processed !== 'yes';
            });
    } catch (error) {
        console.error('Error getting unprocessed responses:', error);
        return [];
    }
}
async function initializeProcessedColumn() {
    try {
        const doc = await setupGoogleSheets();
        const sheet = doc.sheetsByIndex[0];
        await sheet.loadHeaderRow();
        const headers = sheet.headerValues;
        if (!headers.includes('Processed') && !headers.includes('processed')) {
            await sheet.setHeaderRow([...headers, 'Processed']);
            console.log('Added Processed column to spreadsheet');
        }
    } catch (error) {
        console.error('Error initializing processed column:', error);
    }
}
module.exports = {
    setupGoogleSheets,
    getFormResponses,
    markAsProcessed,
    getUnprocessedResponses,
    initializeProcessedColumn
};