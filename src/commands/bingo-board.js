const { EmbedBuilder } = require('discord.js');
const { findUserByDiscordId } = require('../utils/config');
const { loadBingoBoard, calculateTileProgress } = require('../utils/bingo');
module.exports = {
    name: 'bingo-board',
    description: 'View your team\'s bingo board progress',
    async execute(message, args) {
        try {
            const user = findUserByDiscordId(message.author.id);
            if (!user || !user.approved) {
                return message.reply('❌ You must be an approved team member to view the bingo board.');
            }
            const team = user.team;
            const board = loadBingoBoard(team);
            let completedTiles = 0;
            let totalPoints = board.totalPoints;
            let inProgressTiles = 0;
            const recentCompletions = [];
            Object.entries(board.tiles).forEach(([coordinate, tile]) => {
                if (tile.completed) {
                    completedTiles++;
                    if (tile.obtainedItems.length > 0) {
                        const latest = tile.obtainedItems.reduce((latest, item) =>
                            new Date(item.timestamp) > new Date(latest.timestamp) ? item : latest
                        );
                        recentCompletions.push({
                            coordinate: coordinate.toUpperCase(),
                            item: latest.itemName,
                            submitter: latest.submitterRSN,
                            points: tile.points,
                            timestamp: new Date(latest.timestamp)
                        });
                    }
                } else {
                    const progress = calculateTileProgress(tile);
                    if (progress.current > 0) {
                        inProgressTiles++;
                    }
                }
            });
            recentCompletions.sort((a, b) => b.timestamp - a.timestamp);
            const boardEmbed = new EmbedBuilder()
                .setColor(team === 'melon' ? 0x90EE90 : 0xFFB6C1)
                .setTitle(`🎯 Team ${team.charAt(0).toUpperCase() + team.slice(1)}`)
                .addFields(
                    { name: '🏆 Points', value: `${totalPoints}`, inline: true },
                    { name: '✅ Complete', value: `${completedTiles}/56`, inline: true },
                    { name: '🔄 In Progress', value: `${inProgressTiles}`, inline: true }
                );
            if (recentCompletions.length > 0) {
                const recentText = recentCompletions.slice(0, 3).map(completion =>
                    `**${completion.coordinate}** • ${completion.item} • ${completion.submitter}`
                ).join('\n');
                boardEmbed.addFields({
                    name: '🆕 Recent Completions',
                    value: recentText,
                    inline: false
                });
            }
            if (args && args.length > 0) {
                const requestedTile = args[0].toLowerCase();
                const tile = board.tiles[requestedTile];
                if (!tile) {
                    return message.reply(`❌ Tile "${args[0].toUpperCase()}" not found. Use format like "a1" or "c8".`);
                }
                const progress = calculateTileProgress(tile);
                let status;
                if (tile.completed) {
                    status = 'Complete';
                } else if (progress.current > 0) {
                    status = 'In Progress';
                } else {
                    status = 'Not Started';
                }
                const detailEmbed = new EmbedBuilder()
                    .setColor(tile.completed ? 0x00FF00 : (progress.current > 0 ? 0xFFA500 : 0x808080))
                    .setTitle(`🎯 Tile ${requestedTile.toUpperCase()}`)
                    .setDescription(`📋 Progress: ${progress.description}`)
                    .addFields(
                        { name: '🏆 Points', value: `${tile.points}`, inline: true },
                        { name: '📊 Status', value: status, inline: true },
                        { name: '\u200B', value: '\u200B', inline: true } 
                    );
                if (tile.requiredItems.length <= 5) {
                    detailEmbed.addFields({
                        name: '📋 Required',
                        value: tile.requiredItems.map(item => `• ${item}`).join('\n'),
                        inline: false
                    });
                } else {
                    detailEmbed.addFields({
                        name: '📋 Required',
                        value: `${tile.requiredItems.slice(0, 4).map(item => `• ${item}`).join('\n')}\n• *...and ${tile.requiredItems.length - 4} more*`,
                        inline: false
                    });
                }
                if (tile.obtainedItems.length > 0) {
                    const obtainedText = tile.obtainedItems.map(item =>
                        `• ${item.itemName} *by ${item.submitterRSN}*`
                    ).join('\n');
                    detailEmbed.addFields({
                        name: '✅ Obtained',
                        value: obtainedText,
                        inline: false
                    });
                }
                return message.reply({ embeds: [boardEmbed, detailEmbed] });
            }
            boardEmbed.setFooter({
                text: `Use "!bingo-board <tile>" for detailed view (e.g., "!bingo-board c8")`
            });
            await message.reply({ embeds: [boardEmbed] });
        } catch (error) {
            console.error('Error in bingo-board command:', error);
            await message.reply('❌ An error occurred while loading the bingo board. Please try again.');
        }
    },
};