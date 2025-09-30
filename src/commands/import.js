const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getFormResponses } = require('../utils/googleSheets');
const { addUnprocessedUser, addUserToTeam, loadConfig } = require('../utils/config');
module.exports = {
    name: 'import',
    description: 'Import ALL form submissions from Google Sheets to config (including old entries)',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You need administrator permissions to use this command.');
        }
        const importMessage = await message.reply('🔄 Importing ALL entries from Google Sheets to config...');
        try {
            const allResponses = await getFormResponses();
            if (allResponses.length === 0) {
                return importMessage.edit('✅ No form submissions found in Google Sheets.');
            }
            let processedCount = 0;
            let skippedCount = 0;
            let approvedCount = 0;
            let validEntryCount = 0;
            const processedUsernames = new Set();
            for (let i = 0; i < allResponses.length; i++) {
                const response = allResponses[i];
                try {
                    if (!response.username || typeof response.username !== 'string') {
                        console.log(`Missing or invalid username for entry ${i}: "${response.username}"`);
                        continue;
                    }
                    const cleanUsername = response.username.trim();
                    if (!cleanUsername) {
                        console.log(`Empty username after trimming for entry ${i}`);
                        continue;
                    }
                    const usernameLower = cleanUsername.toLowerCase();
                    if (processedUsernames.has(usernameLower)) {
                        console.log(`Skipping duplicate username: ${cleanUsername}`);
                        continue;
                    }
                    if (!response.team || typeof response.team !== 'string') {
                        console.log(`Missing or invalid team for user ${cleanUsername}: "${response.team}"`);
                        continue;
                    }
                    let team = null;
                    const teamResponse = response.team.toLowerCase();
                    if (teamResponse.includes('melon')) {
                        team = 'melon';
                    } else if (teamResponse.includes('weenor')) {
                        team = 'weenor';
                    } else {
                        console.log(`Skipping non-team entry for ${cleanUsername}: "${response.team}"`);
                        continue; 
                    }
                    const hasPaid = response.paid && response.paid.toLowerCase().includes('paid');
                    if (!hasPaid) {
                        console.log(`User ${cleanUsername} has not paid buy-in, skipping`);
                        continue;
                    }
                    processedUsernames.add(usernameLower);
                    validEntryCount++;
                    const config = loadConfig();
                    const userExists =
                        config[team][cleanUsername.toLowerCase()] || 
                        config.unprocessed.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase()) || 
                        config.pending.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase()); 
                    if (userExists) {
                        console.log(`User ${cleanUsername} already exists in config, skipping`);
                        skippedCount++;
                        continue;
                    }
                    addUnprocessedUser(cleanUsername, team, response.timestamp);
                    console.log(`📥 Added ${cleanUsername} (${team}) to unprocessed list (paid: ${response.paid})`);
                    processedCount++;
                } catch (error) {
                    console.error(`Error processing response for ${response.username || 'unknown user'}:`, error);
                }
            }
            const summaryEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📥 Import Complete')
                .setDescription('All form submissions have been imported to the config system.')
                .addFields(
                    { name: 'Total Valid Entries', value: validEntryCount.toString(), inline: true },
                    { name: 'Added to Unprocessed', value: processedCount.toString(), inline: true },
                    { name: 'Already Processed', value: skippedCount.toString(), inline: true },
                    { name: 'Synced to Approved', value: approvedCount.toString(), inline: true }
                )
                .addFields({ 
                    name: 'Next Steps', 
                    value: '• Users can now join Discord and verify their RSNs\n• Use `!pending` to see users awaiting approval\n• Use `!teams` to see current team status', 
                    inline: false 
                })
                .setTimestamp();
            await importMessage.edit({
                content: `✅ Import complete! Added ${processedCount} entries to unprocessed list, synced ${approvedCount} already approved users.`,
                embeds: [summaryEmbed]
            });
        } catch (error) {
            console.error('Error importing from Google Sheets:', error);
            await importMessage.edit('❌ Error importing from Google Sheets. Check console for details.');
        }
    }
};