const { findUserByUsername } = require('../utils/config');
module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return;
        if (message.content.startsWith('!')) {
            const args = message.content.slice(1).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const command = message.client.commands.get(commandName);
            if (!command) return;
            try {
                await command.execute(message, args, message.client);
            } catch (error) {
                console.error('Error executing command:', error);
                await message.reply('There was an error executing that command!');
            }
        }
    },
};