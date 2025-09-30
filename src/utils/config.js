const fs = require('fs');
const path = require('path');
const CONFIG_PATH = path.join(__dirname, '../../config/users.json');
const defaultConfig = {
    melon: {},
    weenor: {},
    unprocessed: [],
    pending: []
};
function loadConfig() {
    try {
        const configDir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        if (!fs.existsSync(CONFIG_PATH)) {
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
        const config = JSON.parse(configData);
        if (!config.unprocessed) {
            config.unprocessed = [];
            saveConfig(config);
        }
        return config;
    } catch (error) {
        console.error('Error loading config:', error);
        return defaultConfig;
    }
}
function saveConfig(config) {
    try {
        const configDir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        console.log('Config saved successfully');
    } catch (error) {
        console.error('Error saving config:', error);
    }
}
function addUserToTeam(username, team, discordId) {
    const config = loadConfig();
    if (!config[team]) {
        throw new Error(`Invalid team: ${team}`);
    }
    config[team][username.toLowerCase()] = {
        username: username,
        discordId: discordId,
        approved: true,
        approvedAt: new Date().toISOString()
    };
    saveConfig(config);
    return config;
}
function removePendingUser(discordId) {
    const config = loadConfig();
    config.pending = config.pending.filter(user => user.discordId !== discordId);
    saveConfig(config);
    return config;
}
function addPendingUser(username, team, discordId) {
    const config = loadConfig();
    const existingPending = config.pending.find(user => user.discordId === discordId);
    if (existingPending) {
        return config;
    }
    config.pending.push({
        username: username,
        team: team,
        discordId: discordId,
        submittedAt: new Date().toISOString()
    });
    saveConfig(config);
    return config;
}
function findUserByUsername(username) {
    const config = loadConfig();
    const lowerUsername = username.toLowerCase();
    for (const team of ['melon', 'weenor']) {
        if (config[team][lowerUsername]) {
            return {
                ...config[team][lowerUsername],
                team: team
            };
        }
    }
    return null;
}
function findUserByDiscordId(discordId) {
    const config = loadConfig();
    for (const team of ['melon', 'weenor']) {
        for (const [username, userData] of Object.entries(config[team])) {
            if (userData.discordId === discordId) {
                return {
                    ...userData,
                    team: team
                };
            }
        }
    }
    return null;
}
function findPendingUser(discordId) {
    const config = loadConfig();
    return config.pending.find(user => user.discordId === discordId) || null;
}
function removeUser(username) {
    const config = loadConfig();
    const lowerUsername = username.toLowerCase();
    for (const team of ['melon', 'weenor']) {
        if (config[team][lowerUsername]) {
            delete config[team][lowerUsername];
            console.log(`🗑️ Removed ${username} from ${team} team`);
        }
    }
    saveConfig(config);
    return config;
}
function addUnprocessedUser(username, team, timestamp) {
    const config = loadConfig();
    const existingUnprocessed = config.unprocessed.find(user =>
        user.username.toLowerCase() === username.toLowerCase()
    );
    if (existingUnprocessed) {
        return config;
    }
    config.unprocessed.push({
        username: username,
        team: team,
        timestamp: timestamp,
        importedAt: new Date().toISOString()
    });
    saveConfig(config);
    return config;
}
function findUserInUnprocessed(username) {
    const config = loadConfig();
    return config.unprocessed.find(user =>
        user.username.toLowerCase() === username.toLowerCase()
    ) || null;
}
function moveUnprocessedToPending(username, discordId) {
    const config = loadConfig();
    const unprocessedIndex = config.unprocessed.findIndex(user =>
        user.username.toLowerCase() === username.toLowerCase()
    );
    if (unprocessedIndex === -1) {
        return null; 
    }
    const unprocessedUser = config.unprocessed[unprocessedIndex];
    config.unprocessed.splice(unprocessedIndex, 1);
    const existingPending = config.pending.find(user => user.discordId === discordId);
    if (!existingPending) {
        config.pending.push({
            username: unprocessedUser.username,
            team: unprocessedUser.team,
            discordId: discordId,
            submittedAt: unprocessedUser.timestamp,
            movedToPendingAt: new Date().toISOString()
        });
    }
    saveConfig(config);
    return config;
}
function removeUnprocessedUser(username) {
    const config = loadConfig();
    config.unprocessed = config.unprocessed.filter(user =>
        user.username.toLowerCase() !== username.toLowerCase()
    );
    saveConfig(config);
    return config;
}
module.exports = {
    loadConfig,
    saveConfig,
    addUserToTeam,
    removePendingUser,
    addPendingUser,
    findUserByUsername,
    findUserByDiscordId,
    findPendingUser,
    removeUser,
    addUnprocessedUser,
    findUserInUnprocessed,
    moveUnprocessedToPending,
    removeUnprocessedUser
};