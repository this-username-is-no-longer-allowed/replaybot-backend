const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const http = require('http'); // Import Node.js HTTP module
const fetch = require('node-fetch'); // Import fetch

// --- Configuration ---
const BOT_TOKEN = process.env.BOT_TOKEN || ''; 
const CLIENT_ID = process.env.CLIENT_ID || ''; 
const GUILD_ID = process.env.GUILD_ID || ''; 
const PORT = process.env.PORT || 3000; // Use Render's port or default to 3000

// ... (Rest of your client and commands definitions remain the same) ...
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});
const Commands = {
    echo: (interaction) => {
        const input = interaction.options.getString('input');
        return interaction.reply(`You said: ${input}`);
    },
    length: (interaction) => {
        const input = interaction.options.getString('input');
        return interaction.reply(`The length of "${input}" is **${input.length}** characters.`);
    },
    average: (interaction) => {
        const input = interaction.options.getString('numbers');
        const array = input.split(' ').map(Number).filter(n => !isNaN(n));
        const sum = array.reduce((a, b) => a + b, 0);
        const average = sum / array.length;
        return interaction.reply(`The average of the numbers **${array.join(', ')}** is **${average.toFixed(2)}**.`);
    },
    parsefile: async (interaction) => {
        const attachment = interaction.options.getAttachment('file');

        // Ensure MIME is text/plain (plaintext file)
        if (attachment.contentType && !attachment.contentType.startsWith('text/plain')) {
            return interaction.reply(`The attached file \`${attachment.name}\` was not a plaintext file, ensure the extension is **.txt**.`);
        }

        const fileUrl = attachment.url;

        try {
            // Fetch the file content from Discarded CDN
            const response = await fetch(fileUrl);
            const textContent = await response.text();

            return interaction.reply(`The attached file \`${attachment.name}\` has the content \n \`\`\`${textContent}\`\`\``);
        } catch (error) {
            console.error('Error fetching file: ' + error);
            return interaction.reply({content: 'Failed to fetch file content from URL.', ephemeral: true});
        }
    },
};

const EchoCommandData = new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Echoes back the input word.')
    .addStringOption(option =>
        option.setName('input')
            .setDescription('The word to echo back.')
            .setRequired(true)
    )
    .toJSON();
const LengthCommandData = new SlashCommandBuilder()
    .setName('length')
    .setDescription('Returns the length of the input word.')
    .addStringOption(option =>
        option.setName('input')
            .setDescription('The word to measure the length of.')
            .setRequired(true)
    )
    .toJSON();
const AverageCommandData = new SlashCommandBuilder()
    .setName('average')
    .setDescription('Calculates the average of numbers provided in a space-delimited list.')
    .addStringOption(option =>
        option.setName('numbers')
            .setDescription('The numbers separated by spaces that are to be averaged.')
            .setRequired(true)
    )
    .toJSON();
const ReadfileCommandData = new SlashCommandBuilder()
    .setName('parsefile')
    .setDescription('Echoes the content of an attached plaintext file.')
    .addAttachmentOption(option =>
        option.setName('file')
            .setDescription('Attach the text file here.')
            .setRequired(true)
    )
    .toJSON();

// Function to register the commands with Discord
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: [EchoCommandData, LengthCommandData, AverageCommandData, ReadfileCommandData] },
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

    const commandHandler = Commands[interaction.commandName];

    if (commandHandler) {
        try {
            await commandHandler(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});


// --- ADDED CODE TO SATISFY RENDER'S PORT REQUIREMENT ---
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Discord bot is alive and running!\n');
}).listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
});
// --------------------------------------------------------

// Log in to Discord
client.login(BOT_TOKEN);
