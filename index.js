const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

// --- Configuration ---
// !!! REPLACE THESE PLACEHOLDERS WITH YOUR ACTUAL DETAILS !!!
const BOT_TOKEN = 'YOUR_BOT_TOKEN';
const CLIENT_ID = 'YOUR_CLIENT_ID';
// Optional: Use a specific Guild ID for faster updates during testing
const GUILD_ID = 'YOUR_GUILD_ID';
// ---------------------

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

// --- COMMAND DEFINITION AND HANDLER OBJECT ---

// 1. Define the Slash Command structure
const EchoCommandData = new SlashCommandBuilder()
.setName('echo')
.setDescription('Echoes back the input word.')
.addStringOption(option =>
option.setName('input')
.setDescription('The word to echo back.')
.setRequired(true)
)
.toJSON();

// 2. Define the Commands object containing the handler logic
const Commands = {
// The key 'echo' matches the command name
echo: (interaction) => {
const input = interaction.options.getString('input');
// This function simply returns the reply promise
return interaction.reply(`You said: ${input}`);
}
};

// 3. Register the command with Discord API
async function registerCommands() {
const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
try {
console.log('Started refreshing application (/) commands.');
await rest.put(
Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
{ body: [EchoCommandData] }, // Use the defined command data
);
console.log('Successfully reloaded application (/) commands.');
} catch (error) {
console.error(error);
}
}


// Event: Bot is ready
client.on('ready', () => {
console.log(`Logged in as ${client.user.tag}!`);
registerCommands();
});

// Event: Interaction (Slash Command) received
client.on('interactionCreate', async interaction => {
if (!interaction.isChatInputCommand()) return;

// --- LOGIC DISPATCH ---
// Look up the command name in our Commands object and execute the associated function
const commandHandler = Commands[interaction.commandName];

if (commandHandler) {
try {
await commandHandler(interaction);
} catch (error) {
console.error(error);
await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
}
}
// ----------------------
});

// Log in to Discord
client.login(BOT_TOKEN);
