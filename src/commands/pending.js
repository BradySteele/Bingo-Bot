const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { loadConfig } = require('../utils/config');
module.exports = {
    name: 'pending',
    description: 'View all pending user signups',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You need administrator permissions to use this command.');
        }
        const config = loadConfig();
        const pendingUsers = config.pending || [];
        if (pendingUsers.length === 0) {
            return message.reply('✅ No pending signups to review.');
        }
        const embed = new EmbedBuilder()
            .setColor(0xFFA500) 
            .setTitle('🕐 Pending Signups')
            .setDescription(`There are **${pendingUsers.length}** pending signup(s) awaiting approval.`)
            .setTimestamp();
        const maxFields = Math.min(pendingUsers.length, 25);
        for (let i = 0; i < maxFields; i++) {
            const user = pendingUsers[i];
            let discordUser = 'Unknown User';
            try {
                const fetchedUser = await client.users.fetch(user.discordId);
                discordUser = fetchedUser.tag;
            } catch (error) {
                discordUser = `<@${user.discordId}>`;
            }
            const submittedDate = new Date(user.submittedAt).toLocaleDateString();
            embed.addFields({
                name: `${user.username} (${user.team.charAt(0).toUpperCase() + user.team.slice(1)})`,
                value: `Discord: ${discordUser}\nSubmitted: ${submittedDate}\nApprove: \`!approve ${user.discordId}\``,
                inline: true
            });
        }
        if (pendingUsers.length > 25) {
            embed.setFooter({ text: `Showing first 25 of ${pendingUsers.length} pending signups` });
        }
        await message.reply({ embeds: [embed] });
    }
};