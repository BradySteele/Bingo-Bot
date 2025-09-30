const { EmbedBuilder } = require('discord.js');
module.exports = {
    name: 'help',
    description: 'Show available commands',
    async execute(message, args, client) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🤖 Bingo Bot Commands')
            .setDescription('Here are the available commands for managing the bingo signup system:')
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                {
                    name: 'Admin Commands - Signup System',
                    value: '`!approve <user>` - Approve a pending signup\n`!pending` - View all pending signups\n`!teams` - Show team member counts\n`!breakdown` - Detailed breakdown of all signups by status\n`!sync` - Sync new submissions from Google Sheets\n`!import` - Import ALL entries from Google Sheets (for existing data)\n`!status` - Check system status',
                    inline: false
                },
                {
                    name: 'Admin Commands - Bingo System',
                    value: '`!bingo-approve <submission_id>` - Approve a bingo item submission\n`!bingo-pending [submission_id]` - View pending bingo submissions',
                    inline: false
                },
                {
                    name: 'User Commands - Bingo',
                    value: '`!submit <item name>` - Submit a bingo item with screenshot\n`!bingo-board [tile]` - View your team\'s bingo board progress\n`!bingo-search <item>` - Search for items on your team\'s bingo board',
                    inline: false
                },
                {
                    name: 'Automatic Features',
                    value: '• **New Member Welcome** - Sends welcome message with verification button\n• **RSN Verification Modal** - Users click button to enter RSN in popup\n• **Admin Approval System** - Verification requests sent to admin channel\n• **Role Assignment** - Automatic team role and channel access after approval\n• **Nickname Setting** - Sets Discord nickname to RSN',
                    inline: false
                },
                {
                    name: 'How It Works',
                    value: '1. Users fill out Google Form with RSN and team\n2. Run `!import` (initial) or `!sync` (new signups) to import submissions\n3. Users join Discord server via invite link\n4. Users click "Verify RSN" button and enter RSN in popup\n5. Admin gets notification in admin channel with approve button\n6. Admin clicks "Approve" button or uses `!approve @user`\n7. User automatically gets team role and access',
                    inline: false
                },
                {
                    name: 'Teams',
                    value: '**Melon** and **Weenor**',
                    inline: true
                },
                {
                    name: 'Support',
                    value: 'Contact server administrators for help',
                    inline: true
                }
            )
            .setFooter({ 
                text: `Bingo Bot`,
                iconURL: client.user.displayAvatarURL()
            })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    }
};