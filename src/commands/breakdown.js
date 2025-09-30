const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { loadConfig } = require('../utils/config');
module.exports = {
    name: 'breakdown',
    description: 'Show detailed breakdown of all signups by status',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You need administrator permissions to use this command.');
        }
        try {
            const config = loadConfig();
            const melonApproved = Object.keys(config.melon);
            const weenorlApproved = Object.keys(config.weenor);
            const melonUnprocessed = config.unprocessed ? config.unprocessed.filter(u => u.team.toLowerCase() === 'melon') : [];
            const weenorlUnprocessed = config.unprocessed ? config.unprocessed.filter(u => u.team.toLowerCase() === 'weenor') : [];
            const melonPending = config.pending.filter(p => p.team.toLowerCase() === 'melon');
            const weenorlPending = config.pending.filter(p => p.team.toLowerCase() === 'weenor');
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📊 Detailed Signup Breakdown')
                .setDescription('Complete status of all signups organized by team and verification stage')
                .setTimestamp();
            let melonValue = '';
            if (melonApproved.length > 0) {
                melonValue += `**✅ Approved (${melonApproved.length}):**\n${melonApproved.join(', ')}\n\n`;
            }
            if (melonPending.length > 0) {
                melonValue += `**⏳ Pending Approval (${melonPending.length}):**\n${melonPending.map(p => p.username).join(', ')}\n\n`;
            }
            if (melonUnprocessed.length > 0) {
                melonValue += `**📝 Not Yet Joined (${melonUnprocessed.length}):**\n${melonUnprocessed.map(u => u.username).join(', ')}`;
            }
            if (!melonValue) melonValue = 'No signups yet';
            let weenorlValue = '';
            if (weenorlApproved.length > 0) {
                weenorlValue += `**✅ Approved (${weenorlApproved.length}):**\n${weenorlApproved.join(', ')}\n\n`;
            }
            if (weenorlPending.length > 0) {
                weenorlValue += `**⏳ Pending Approval (${weenorlPending.length}):**\n${weenorlPending.map(p => p.username).join(', ')}\n\n`;
            }
            if (weenorlUnprocessed.length > 0) {
                weenorlValue += `**📝 Not Yet Joined (${weenorlUnprocessed.length}):**\n${weenorlUnprocessed.map(u => u.username).join(', ')}`;
            }
            if (!weenorlValue) weenorlValue = 'No signups yet';
            if (melonValue.length > 1024) {
                const truncated = melonValue.substring(0, 1000) + '... (truncated)';
                melonValue = truncated;
            }
            if (weenorlValue.length > 1024) {
                const truncated = weenorlValue.substring(0, 1000) + '... (truncated)';
                weenorlValue = truncated;
            }
            embed.addFields(
                { name: '🍉 Team Melon', value: melonValue, inline: true },
                { name: '🍆 Team Weenor', value: weenorlValue, inline: true }
            );
            const totalApproved = melonApproved.length + weenorlApproved.length;
            const totalPending = melonPending.length + weenorlPending.length;
            const totalUnprocessed = melonUnprocessed.length + weenorlUnprocessed.length;
            const grandTotal = totalApproved + totalPending + totalUnprocessed;
            embed.addFields({
                name: '📈 Summary',
                value: `**${grandTotal}** total signups\n✅ ${totalApproved} approved\n⏳ ${totalPending} pending\n📝 ${totalUnprocessed} not yet joined`,
                inline: false
            });
            embed.setFooter({
                text: 'Bingo Bot • Detailed Breakdown'
            });
            await message.reply({ embeds: [embed] });
            console.log(`📊 ${message.author.tag} requested detailed breakdown`);
        } catch (error) {
            console.error('Error in breakdown command:', error);
            await message.reply('❌ An error occurred while generating the breakdown.');
        }
    }
};