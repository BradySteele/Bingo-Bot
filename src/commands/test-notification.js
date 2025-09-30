const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
module.exports = {
    name: 'test-notification',
    description: 'Send a test admin notification with approve button for testing - Usage: !test-notification {username} {team}',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You need administrator permissions to use this command.');
        }
        if (args.length < 2) {
            return message.reply('❌ Usage: `!test-notification {username} {team}`\nExample: `!test-notification Delmus Weenor`');
        }
        const username = args[0];
        const team = args[1].toLowerCase();
        if (team !== 'melon' && team !== 'weenor') {
            return message.reply('❌ Team must be either "melon" or "weenor"');
        }
        const { loadConfig } = require('../utils/config');
        const config = loadConfig();
        const existingPendingUser = config.pending.find(p =>
            p.username.toLowerCase() === username.toLowerCase()
        );
        const pendingUser = {
            username: username,
            team: team,
            discordId: existingPendingUser ? existingPendingUser.discordId : message.author.id
        };
        try {
            const targetUser = await client.users.fetch(pendingUser.discordId);
            const adminChannelId = process.env.ADMIN_CHANNEL_ID;
            const adminChannel = message.guild.channels.cache.get(adminChannelId);
            if (!adminChannel) {
                return message.reply('❌ Admin channel not found. Check your ADMIN_CHANNEL_ID in .env');
            }
            const member = message.guild.members.cache.get(pendingUser.discordId);
            const notificationEmbed = new EmbedBuilder()
                .setColor(team === 'melon' ? 0x90EE90 : 0xFFB6C1)
                .setTitle('🔍 New RSN Verification Request')
                .setDescription(`🧪 **TEST NOTIFICATION** - This is a test of the verification system.`)
                .addFields(
                    { name: 'RSN', value: pendingUser.username, inline: true },
                    { name: 'Team', value: team.charAt(0).toUpperCase() + team.slice(1), inline: true },
                    { name: 'Discord User', value: `${targetUser.tag}\n<@${targetUser.id}>`, inline: true },
                    { name: 'User ID', value: pendingUser.discordId, inline: true },
                    { name: 'Joined Server', value: member ? member.joinedAt.toLocaleString() : 'Unknown', inline: true },
                    { name: 'Manual Command', value: `\`!approve ${pendingUser.discordId}\``, inline: true }
                )
                .setThumbnail(targetUser.displayAvatarURL())
                .setFooter({
                    text: 'Bingo Bot • Click button to approve or use manual command'
                })
                .setTimestamp();
            const approveButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`approve_${pendingUser.discordId}`)
                        .setLabel(`Approve ${pendingUser.username}`)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅')
                );
            await adminChannel.send({
                embeds: [notificationEmbed],
                components: [approveButton]
            });
            await message.reply(`✅ Sent test admin notification for **${username}** (${team.charAt(0).toUpperCase() + team.slice(1)}) using ${targetUser.tag} to ${adminChannel}. Click the approve button to test!`);
            console.log(`🧪 ${message.author.tag} sent test notification for ${username} (${team.charAt(0).toUpperCase() + team.slice(1)})`);
        } catch (error) {
            console.error('Error sending test notification:', error);
            await message.reply('❌ An error occurred while sending the test notification.');
        }
    }
};