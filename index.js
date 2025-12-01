const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const http = require('http'); // Import Node.js HTTP module
const fetch = require('node-fetch'); // Import fetch
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');

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
    goiseencode: async (interaction) => {
        const attachment = interaction.options.getAttachment('file');

        // Ensure MIME is text/plain (plaintext file)
        if (attachment.contentType && !attachment.contentType.startsWith('text/plain')) {
            return interaction.reply(`The attached file \`${attachment.name}\` was not a plaintext file, ensure the extension is \`.txt\`.`);
        }

        const fileUrl = attachment.url;

        try {
            // Fetch the file content from Discord's CDN
            const response = await fetch(fileUrl);
            const textContent = await response.text();

            // For now just assume nothing can be done yet
            return interaction.reply(`# Sorry, but this feature is not yet available.\n\nCheck later for better luck!`);
        } catch (error) {
            console.error('Error fetching file: ' + error);
            return interaction.reply({content: 'Failed to fetch file content from URL.', ephemeral: true});
        }
    },
};

const GOISEEncodeCommandData = new SlashCommandBuilder()
    .setName('goiseencode')
    .setDescription('Accepts a replay code for GOISE and returns a video with the playback for that replay code.')
    .addAttachmentOption(option =>
        option.setName('file')
            .setDescription('Replay code here.')
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
            { body: [GOISEEncodeCommandData] },
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
const httpServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Discord bot is alive and running!\n');
});
// --------------------------------------------------------

// Socket server setup
const io = new Server(httpServer);

// Have server listen
httpServer.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
});

// Log in to Discord
client.login(BOT_TOKEN);
