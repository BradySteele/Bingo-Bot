const { initializeProcessedColumn } = require('../utils/googleSheets');
module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`✅ Discord bot is ready! Logged in as ${client.user.tag}`);
        console.log(`🏠 Connected to ${client.guilds.cache.size} server(s)`);
        try {
            await initializeProcessedColumn();
            console.log('✅ Google Sheets integration initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Google Sheets:', error.message);
        }
        client.user.setActivity('for new signups', { type: 'WATCHING' });
    },
};