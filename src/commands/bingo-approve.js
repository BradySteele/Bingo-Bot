const { EmbedBuilder } = require('discord.js');
const { PermissionFlagsBits } = require('discord.js');
const { approveSubmission, getPendingSubmissions } = require('../utils/bingo');
const { findUserByDiscordId } = require('../utils/config');
module.exports = {
    name: 'bingo-approve',
    description: 'Approve a bingo submission (Admin only)',
    async execute(message, args) {
        try {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply('❌ You need administrator permissions to approve bingo submissions.');
            }
            if (!args || args.length === 0) {
                return message.reply('❌ Please provide a submission ID. Usage: `!bingo-approve <submission_id>`');
            }
            const submissionId = args[0];
            const pendingSubmissions = getPendingSubmissions();
            const submissionData = pendingSubmissions.find(sub => sub.submission.id === submissionId);
            if (!submissionData) {
                return message.reply(`❌ No pending submission found with ID: ${submissionId}`);
            }
            const { team, coordinate, submission, tile } = submissionData;
            console.log(`🎯 Admin ${message.author.tag} approving bingo submission ${submissionId}`);
            const result = approveSubmission(team, coordinate, submissionId);
            const { tileCompleted, newTotalPoints, progress } = result;
            const bingoChannelId = team === 'melon' ?
                (process.env.MELON_BINGO_CHANNEL_ID || '1422616740197695619') :
                (process.env.WEENOR_BINGO_CHANNEL_ID || '1422616765199945820');
            const bingoChannel = message.guild?.channels.cache.get(bingoChannelId);
            console.log(`🎯 Looking for bingo channel for ${team}: ${bingoChannelId}`);
            console.log(`🎯 Found bingo channel: ${bingoChannel ? `#${bingoChannel.name}` : 'null'}`);
            if (bingoChannel) {
                try {
                    let notificationEmbed;
                    if (tileCompleted) {
                        notificationEmbed = new EmbedBuilder()
                            .setColor(team === 'melon' ? 0x90EE90 : 0xFFB6C1)
                            .setTitle('🎉 TILE COMPLETED!')
                            .setDescription(`**${submission.submitterRSN}** has completed tile **${coordinate.toUpperCase()}** with **${submission.itemName}**!`)
                            .addFields(
                                { name: '🏆 Points Added', value: `+${tile.points} points`, inline: true },
                                { name: '📊 Team Total', value: `${newTotalPoints} points`, inline: true },
                                { name: '👤 Completed By', value: submission.submitterRSN, inline: true },
                                { name: '🎯 Tile Details', value: `${coordinate.toUpperCase()} (${tile.points} point tile)`, inline: false }
                            )
                            .setFooter({
                                text: `Bingo Bot • Team ${team.charAt(0).toUpperCase() + team.slice(1)} Submissions`
                            })
                            .setTimestamp();
                    } else {
                        notificationEmbed = new EmbedBuilder()
                            .setColor(team === 'melon' ? 0x90EE90 : 0xFFB6C1)
                            .setTitle('📈 Tile Progress Update!')
                            .setDescription(`**${submission.submitterRSN}** has made progress towards completing tile **${coordinate.toUpperCase()}** with **${submission.itemName}**`)
                            .addFields(
                                { name: '📈 Progress', value: progress.description, inline: true },
                                { name: '📊 Team Total', value: `${newTotalPoints} points`, inline: true },
                                { name: '👤 Submitted By', value: submission.submitterRSN, inline: true },
                                { name: '🎯 Tile Details', value: `${coordinate.toUpperCase()} (${tile.points} point tile when completed)`, inline: false }
                            )
                            .setFooter({
                                text: `Bingo Bot • Team ${team.charAt(0).toUpperCase() + team.slice(1)} Submissions`
                            })
                            .setTimestamp();
                    }
                    await bingoChannel.send({ embeds: [notificationEmbed] });
                    console.log(`✅ Sent bingo progress notification to ${team} submissions channel`);
                } catch (error) {
                    console.error(`❌ Failed to send team notification:`, error);
                }
            }
            try {
                const submitter = await message.client.users.fetch(submission.submittedBy);
                const dmEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Bingo Submission Approved!')
                    .setDescription(`Your submission has been approved!`)
                    .addFields(
                        { name: 'Item', value: submission.itemName, inline: true },
                        { name: 'Tile', value: `${coordinate.toUpperCase()} (${tile.points} points)`, inline: true },
                        { name: 'Status', value: tileCompleted ? '🎉 Tile Completed!' : '📈 Progress Made', inline: true },
                        { name: 'Team Points', value: `${newTotalPoints} total`, inline: false }
                    )
                    .setFooter({
                        text: `Bingo Bot • Team ${team.charAt(0).toUpperCase() + team.slice(1)}`
                    })
                    .setTimestamp();
                await submitter.send({ embeds: [dmEmbed] });
                console.log(`✅ Sent approval DM to ${submission.submitterRSN}`);
            } catch (error) {
                console.error(`❌ Failed to send approval DM:`, error.message);
            }
            const adminEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Bingo Submission Approved!')
                .setDescription(`Successfully approved submission by **${submission.submitterRSN}**`)
                .addFields(
                    { name: 'Tile', value: `${coordinate.toUpperCase()} (${tile.points} points)`, inline: true },
                    { name: 'Team', value: team.charAt(0).toUpperCase() + team.slice(1), inline: true },
                    { name: 'Result', value: tileCompleted ? '🎉 Tile Completed!' : '📈 Progress Made', inline: true }
                );
            if (submission.similarity && submission.similarity < 1) {
                adminEmbed.addFields(
                    { name: '📝 User Typed', value: `"${submission.originalInput}"`, inline: true },
                    { name: '🎯 Approved As', value: `"${submission.itemName}"`, inline: true },
                    { name: '📊 Match %', value: `${Math.round(submission.similarity * 100)}%`, inline: true }
                );
            } else {
                adminEmbed.addFields(
                    { name: '🎯 Item', value: submission.itemName, inline: true }
                );
            }
            adminEmbed.addFields(
                { name: 'Team Points', value: `${newTotalPoints} total`, inline: true },
                { name: 'Approved By', value: message.author.tag, inline: true }
            )
            .setFooter({
                text: 'Bingo Bot • Approval Complete'
            })
            .setTimestamp();
            await message.reply({ embeds: [adminEmbed] });
            console.log(`✅ ${message.author.tag} approved bingo submission ${submissionId} for ${submission.submitterRSN}`);
        } catch (error) {
            console.error('Error in bingo-approve command:', error);
            await message.reply('❌ An error occurred while approving the bingo submission. Please try again or check the submission ID.');
        }
    },
};