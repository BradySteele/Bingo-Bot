const { EmbedBuilder } = require('discord.js');
const { PermissionFlagsBits } = require('discord.js');
const { getPendingSubmissions } = require('../utils/bingo');
module.exports = {
    name: 'bingo-pending',
    description: 'View all pending bingo submissions (Admin only)',
    async execute(message, args) {
        try {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply('❌ You need administrator permissions to view pending bingo submissions.');
            }
            const pendingSubmissions = getPendingSubmissions();
            if (pendingSubmissions.length === 0) {
                const noSubmissionsEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('📋 Pending Bingo Submissions')
                    .setDescription('No pending bingo submissions at this time.')
                    .setFooter({
                        text: 'Bingo Bot • All caught up!'
                    })
                    .setTimestamp();
                return message.reply({ embeds: [noSubmissionsEmbed] });
            }
            pendingSubmissions.sort((a, b) => 
                new Date(b.submission.timestamp) - new Date(a.submission.timestamp)
            );
            const melonSubmissions = pendingSubmissions.filter(sub => sub.team === 'melon');
            const weenorSubmissions = pendingSubmissions.filter(sub => sub.team === 'weenor');
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('📋 Pending Bingo Submissions')
                .setDescription(`${pendingSubmissions.length} submission${pendingSubmissions.length !== 1 ? 's' : ''} awaiting review`)
                .setFooter({
                    text: 'Bingo Bot • Use !bingo-approve <submission_id> to approve'
                })
                .setTimestamp();
            if (melonSubmissions.length > 0) {
                const melonText = melonSubmissions.slice(0, 10).map(sub => {
                    const timeAgo = Math.floor((Date.now() - new Date(sub.submission.timestamp)) / (1000 * 60));
                    return `• **${sub.coordinate.toUpperCase()}**: ${sub.submission.itemName}\n  ${sub.submission.submitterRSN} • ${timeAgo}m ago • \`${sub.submission.id}\``;
                }).join('\n\n');
                embed.addFields({
                    name: `🍈 Melon Team (${melonSubmissions.length})`,
                    value: melonText + (melonSubmissions.length > 10 ? '\n\n... and more' : ''),
                    inline: false
                });
            }
            if (weenorSubmissions.length > 0) {
                const weenorText = weenorSubmissions.slice(0, 10).map(sub => {
                    const timeAgo = Math.floor((Date.now() - new Date(sub.submission.timestamp)) / (1000 * 60));
                    return `• **${sub.coordinate.toUpperCase()}**: ${sub.submission.itemName}\n  ${sub.submission.submitterRSN} • ${timeAgo}m ago • \`${sub.submission.id}\``;
                }).join('\n\n');
                embed.addFields({
                    name: `🌭 Weenor Team (${weenorSubmissions.length})`,
                    value: weenorText + (weenorSubmissions.length > 10 ? '\n\n... and more' : ''),
                    inline: false
                });
            }
            if (args && args.length > 0) {
                const submissionId = args[0];
                const submissionData = pendingSubmissions.find(sub => sub.submission.id === submissionId);
                if (!submissionData) {
                    return message.reply(`❌ No pending submission found with ID: ${submissionId}`);
                }
                const { team, coordinate, submission, tile } = submissionData;
                let embedColor = team === 'melon' ? 0x90EE90 : 0xFFB6C1;
                let title = `🔍 Submission Details: ${submissionId}`;
                if (submission.similarity && submission.similarity < 1) {
                    embedColor = 0xFFA500;
                    title = `🔍 Submission Details: ${submissionId} (Fuzzy Match)`;
                }
                const detailEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle(title)
                    .setDescription(`Submission for tile **${coordinate.toUpperCase()}**`)
                    .addFields(
                        { name: 'Team', value: team.charAt(0).toUpperCase() + team.slice(1), inline: true },
                        { name: 'Tile Points', value: `${tile.points}`, inline: true },
                        { name: 'Submitter', value: submission.submitterRSN, inline: true }
                    );
                if (submission.similarity && submission.similarity < 1) {
                    detailEmbed.addFields(
                        { name: '📝 User Typed', value: `"${submission.originalInput}"`, inline: true },
                        { name: '🎯 Mapped To', value: `"${submission.itemName}"`, inline: true },
                        { name: '📊 Match %', value: `${Math.round(submission.similarity * 100)}%`, inline: true }
                    );
                } else {
                    detailEmbed.addFields(
                        { name: '🎯 Item', value: submission.itemName, inline: false }
                    );
                }
                detailEmbed.addFields(
                    { name: 'Discord User', value: `<@${submission.submittedBy}>`, inline: true },
                    { name: 'Submitted', value: new Date(submission.timestamp).toLocaleString(), inline: true },
                    { name: 'Submission ID', value: submission.id, inline: true }
                )
                .setImage(submission.attachmentUrl)
                .setFooter({
                    text: submission.similarity && submission.similarity < 1 ?
                        `Review screenshot and mapping before approving • !bingo-approve ${submission.id}` :
                        `Use !bingo-approve ${submission.id} to approve this submission`
                })
                .setTimestamp();
                return message.reply({ embeds: [embed, detailEmbed] });
            }
            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error in bingo-pending command:', error);
            await message.reply('❌ An error occurred while loading pending bingo submissions. Please try again.');
        }
    },
};