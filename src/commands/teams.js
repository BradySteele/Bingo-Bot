const { EmbedBuilder } = require('discord.js');
const { loadConfig } = require('../utils/config');
module.exports = {
    name: 'teams',
    description: 'Show current team member counts',
    async execute(message, args, client) {
        try {
            const config = loadConfig();
            const melonCount = Object.keys(config.melon).length;
            const weenorlCount = Object.keys(config.weenor).length;
            const pendingCount = config.pending.length;
            const unprocessedCount = config.unprocessed ? config.unprocessed.length : 0;
            const totalApproved = melonCount + weenorlCount;
            const pendingMelon = config.pending.filter(p => p.team.toLowerCase() === 'melon').length;
            const pendingWeenor = config.pending.filter(p => p.team.toLowerCase() === 'weenor').length;
            const unprocessedMelon = config.unprocessed ? config.unprocessed.filter(u => u.team.toLowerCase() === 'melon').length : 0;
            const unprocessedWeenor = config.unprocessed ? config.unprocessed.filter(u => u.team.toLowerCase() === 'weenor').length : 0;
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🏆 Team Member Counts')
                .setDescription('Current approved, pending, and unprocessed members for each team')
                .addFields(
                    {
                        name: '🍉 Team Melon',
                        value: `**${melonCount}** approved${pendingMelon > 0 ? `\n*${pendingMelon} pending*` : ''}${unprocessedMelon > 0 ? `\n*${unprocessedMelon} unprocessed*` : ''}`,
                        inline: true
                    },
                    {
                        name: '🍆 Team Weenor',
                        value: `**${weenorlCount}** approved${pendingWeenor > 0 ? `\n*${pendingWeenor} pending*` : ''}${unprocessedWeenor > 0 ? `\n*${unprocessedWeenor} unprocessed*` : ''}`,
                        inline: true
                    },
                    {
                        name: '📊 Totals',
                        value: `**${totalApproved}** approved\n${pendingCount > 0 ? `*${pendingCount} pending*` : ''}\n${unprocessedCount > 0 ? `*${unprocessedCount} unprocessed*` : ''}`.replace(/\n+/g, '\n').trim(),
                        inline: true
                    }
                )
                .setFooter({
                    text: 'Bingo Bot • Team Statistics'
                })
                .setTimestamp();
            await message.reply({ embeds: [embed] });
            console.log(`📊 ${message.author.tag} requested team statistics`);
        } catch (error) {
            console.error('Error in teams command:', error);
            await message.reply('❌ An error occurred while fetching team statistics.');
        }
    }
};