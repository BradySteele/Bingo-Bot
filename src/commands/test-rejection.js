const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
module.exports = {
    name: 'test-rejection',
    description: 'Show the RSN not found error message for testing - Usage: !test-rejection {username}',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You need administrator permissions to use this command.');
        }
        if (args.length < 1) {
            return message.reply('❌ Usage: `!test-rejection {username}`\nExample: `!test-rejection Delmus`');
        }
        const username = args[0];
        try {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ RSN Not Found')
                .setDescription(`🧪 **TEST** - The RSN "${username}" was not found in our approved list.`)
                .addFields(
                    {
                        name: '🤔 What to check:',
                        value: '• Make sure the RSN matches exactly (case-sensitive)\n• Ensure you signed up using the Google Form\n• Make sure your bingo buy-in has been paid\n• Check that an admin has imported your signup\n• Contact an admin if you believe this is an error',
                        inline: false
                    }
                )
                .setFooter({
                    text: 'Bingo Bot • Try again with the exact RSN'
                });
            await message.reply({ embeds: [errorEmbed] });
            console.log(`🧪 ${message.author.tag} sent test RSN not found error for ${username}`);
        } catch (error) {
            console.error('Error sending test rejection:', error);
            await message.reply('❌ An error occurred while sending the test rejection.');
        }
    }
};