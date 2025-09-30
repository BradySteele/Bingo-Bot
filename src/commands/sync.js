const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getFormResponses } = require('../utils/googleSheets');
const { addUnprocessedUser, loadConfig, findUserByUsername, findUserInUnprocessed } = require('../utils/config');
module.exports = {
    name: 'sync',
    description: 'Sync NEW form submissions from Google Sheets and notify admins',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You need administrator permissions to use this command.');
        }
        const syncMessage = await message.reply('🔄 Syncing new entries from Google Sheets...');
        try {
            const allResponses = await getFormResponses();
            if (allResponses.length === 0) {
                return syncMessage.edit('✅ No form submissions found.');
            }
            const adminChannelId = process.env.ADMIN_CHANNEL_ID;
            const adminChannel = message.guild.channels.cache.get(adminChannelId);
            let newSignupsCount = 0;
            let skippedCount = 0;
            const newSignups = [];
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
                    newSignupsCount++;
                    newSignups.push({
                        username: cleanUsername,
                        team: team,
                        timestamp: response.timestamp
                    });
                    console.log(`📥 Added new signup: ${cleanUsername} (${team}) (paid: ${response.paid})`);
                } catch (error) {
                    console.error(`Error processing response for ${response.username || 'unknown user'}:`, error);
                }
            }
            if (newSignupsCount > 0 && adminChannel) {
                const melonSignups = newSignups.filter(s => s.team === 'melon');
                const weenorlSignups = newSignups.filter(s => s.team === 'weenor');
                const melonList = melonSignups.length > 0 ? melonSignups.map(s => s.username).join(', ') : 'None';
                const weenorlList = weenorlSignups.length > 0 ? weenorlSignups.map(s => s.username).join(', ') : 'None';
                const summaryEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🔄 Sync Complete - New Signups Imported')
                    .setDescription(`Successfully imported **${newSignupsCount}** new signups into the system`)
                    .addFields(
                        { name: '🍉 Team Melon', value: `**${melonSignups.length}** signups${melonSignups.length > 0 ? `\n${melonList}` : ''}`, inline: true },
                        { name: '🍆 Team Weenor', value: `**${weenorlSignups.length}** signups${weenorlSignups.length > 0 ? `\n${weenorlList}` : ''}`, inline: true },
                        { name: '📊 Summary', value: `${newSignupsCount} imported\n${skippedCount} already in system`, inline: true },
                        { name: '✅ Ready for Verification', value: 'These users can now join Discord and verify their RSNs', inline: false }
                    )
                    .setFooter({
                        text: 'Bingo Bot • Import Complete'
                    })
                    .setTimestamp();
                await adminChannel.send({ embeds: [summaryEmbed] });
            }
            await syncMessage.edit(`✅ Sync complete! Found ${newSignupsCount} new signups${newSignupsCount > 0 ? ', notifications sent to admin channel' : ''}.`);
        } catch (error) {
            console.error('Error syncing from Google Sheets:', error);
            await syncMessage.edit('❌ Error syncing from Google Sheets. Check console for details.');
        }
    }
};