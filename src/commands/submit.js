const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { findUserByDiscordId } = require('../utils/config');
const { findTileForItem, canSubmitItem, addSubmission, generateSubmissionId, calculateTileProgress } = require('../utils/bingo');
module.exports = {
    name: 'submit',
    description: 'Submit a bingo item with screenshot',
    async execute(message, args) {
        try {
            const user = findUserByDiscordId(message.author.id);
            if (!user || !user.approved) {
                return message.reply('❌ You must be an approved team member to submit bingo items.');
            }
            const team = user.team;
            const rsn = user.username;
            if (!args || args.length === 0) {
                return message.reply('❌ Please provide an item name. Usage: `!submit <item name>`\nExample: `!submit elder maul`');
            }
            const itemName = args.join(' ').toLowerCase().trim();
            if (!message.attachments || message.attachments.size === 0) {
                return message.reply('❌ Please attach a screenshot of the item. The screenshot should clearly show the item you\'re submitting.');
            }
            const attachment = message.attachments.first();
            const validImageTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'];
            if (!validImageTypes.includes(attachment.contentType)) {
                return message.reply('❌ Please attach a valid image file (PNG, JPG, JPEG, GIF, or WebP).');
            }
            console.log(`🎯 Bingo submission attempt: "${itemName}" by ${message.author.tag} (${rsn}) for team ${team}`);
            const tileInfo = findTileForItem(team, itemName);
            if (!tileInfo) {
                return message.reply(`❌ "${itemName}" is not a required item for any bingo tile for team ${team.charAt(0).toUpperCase() + team.slice(1)}.\n\nPlease check the bingo board and make sure you're using the exact item name.`);
            }
            const { coordinate, tile, exactItemName, similarity, matchType, similarMatches } = tileInfo;
            const validationResult = canSubmitItem(tile, exactItemName, message.author.id);
            if (!validationResult.valid) {
                return message.reply(`❌ Cannot submit "${exactItemName}" for tile ${coordinate.toUpperCase()}: ${validationResult.reason}`);
            }
            const submissionId = generateSubmissionId();
            const submission = addSubmission(
                team,
                coordinate,
                exactItemName,
                message.author.id,
                rsn,
                attachment.url,
                submissionId,
                itemName, 
                similarity || 1
            );
            console.log(`✅ Added submission ${submissionId} for ${rsn}: ${exactItemName} (${coordinate})`);
            const progress = calculateTileProgress(tile);
            const adminChannelId = process.env.ADMIN_CHANNEL_ID;
            const adminChannel = message.guild?.channels.cache.get(adminChannelId);
            if (adminChannel) {
                try {
                    let embedColor = team === 'melon' ? 0x90EE90 : 0xFFB6C1;
                    let title = '🎯 New Bingo Submission';
                    if (similarity < 1) {
                        embedColor = 0xFFA500; 
                        title = '🎯 New Bingo Submission';
                    }
                    const adminEmbed = new EmbedBuilder()
                        .setColor(embedColor)
                        .setTitle(title)
                        .setDescription(`**${rsn}** submitted an item for tile **${coordinate.toUpperCase()}**`)
                        .addFields(
                            { name: 'Team', value: team.charAt(0).toUpperCase() + team.slice(1), inline: true },
                            { name: 'Tile', value: `${coordinate.toUpperCase()} (${tile.points} points)`, inline: true },
                            { name: 'Discord User', value: `${message.author.tag}\n<@${message.author.id}>`, inline: true }
                        );
                    if (similarity < 1) {
                        adminEmbed.addFields(
                            { name: '📝 User Typed', value: `"${itemName}"`, inline: true },
                            { name: '🎯 Mapped To', value: `"${exactItemName}"`, inline: true },
                            { name: '📊 Match %', value: `${Math.round(similarity * 100)}%`, inline: true }
                        );
                    } else {
                        adminEmbed.addFields(
                            { name: '🎯 Item', value: exactItemName, inline: false }
                        );
                    }
                    adminEmbed.addFields(
                        { name: 'Progress', value: progress.description, inline: false },
                        { name: 'Submission ID', value: submissionId, inline: true },
                        { name: 'Manual Command', value: `\`!bingo-approve ${submissionId}\``, inline: true }
                    )
                    .setImage(attachment.url)
                    .setFooter({
                        text: similarity < 1 ? 'Bingo Bot • Review screenshot and mapping before approving' : 'Bingo Bot • Click button to approve or use manual command'
                    })
                    .setTimestamp();
                    const approveButton = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`bingo_approve_${submissionId}`)
                                .setLabel(`Approve ${exactItemName}`)
                                .setStyle(ButtonStyle.Success)
                                .setEmoji('✅')
                        );
                    await adminChannel.send({
                        embeds: [adminEmbed],
                        components: [approveButton]
                    });
                    console.log(`✅ Sent bingo admin notification for submission ${submissionId}`);
                } catch (error) {
                    console.error(`❌ Failed to send admin notification for bingo submission:`, error);
                }
            }
            const confirmEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🎯 Bingo Submission Received!')
                .setDescription(`Your submission has been received and is pending admin approval.`)
                .addFields(
                    { name: 'Item', value: exactItemName, inline: true },
                    { name: 'Tile', value: `${coordinate.toUpperCase()} (${tile.points} points)`, inline: true },
                    { name: 'Team', value: team.charAt(0).toUpperCase() + team.slice(1), inline: true },
                    { name: 'Current Progress', value: progress.description, inline: false },
                    { name: 'Submission ID', value: submissionId, inline: true }
                )
                .setThumbnail(attachment.url)
                .setFooter({
                    text: `Bingo Bot • Team ${team.charAt(0).toUpperCase() + team.slice(1)}`
                })
                .setTimestamp();
            await message.reply({ embeds: [confirmEmbed] });
        } catch (error) {
            console.error('Error in bingo submit command:', error);
            await message.reply('❌ An error occurred while processing your bingo submission. Please try again or contact an admin.');
        }
    },
};