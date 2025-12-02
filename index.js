// Using import prevents using require, hence the change to all of them
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import http from 'http'; // Import Node.js HTTP module
import fetch from 'node-fetch'; // Import fetch
import path from 'path'; // More imports
import puppeteer from 'puppeteer';

// --- Configuration ---
const BOT_TOKEN = process.env.BOT_TOKEN || ''; 
const CLIENT_ID = process.env.CLIENT_ID || ''; 
const GUILD_ID = process.env.GUILD_ID || ''; 
const PORT = process.env.PORT || 3000; // Use Render's port or default to 3000

// File path setup
const FILENAME = fileURLToPath(import.meta.url);
const DIRNAME = path.dirname(FILENAME);
const goiseRunnerPath = path.join(DIRNAME, 'gamefiles/goise.html');
// const appelRunnerPath = path.join(DIRNAME, 'gamefiles/appel.html');

// --- Headless browser async logic ---
async function runCanvasTaskHeadless() {
    let browser;
    try {
        console.log('Launching headless browser...');
        browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });

        const page = await browser.newPage();
        // Step 1: pass input data before evaluation
        await page.evaluateOnNewDocument(data => {
            window.taskInputData = data;
        }, inputData);

        // Step 2: load local html file
        await page.goto(`https://this-username-is-no-longer-allowed.github.io/replaybot-backend/${goiseRunnerPath}`, { // <-- APPEND QUERY PARAM `code` LATER
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Step 3: tell html script to initiate computation
        await page.evaluate(() => {
            window.startComputation();
        });

        // Step 4: target location to receive output when ready
        const outputElement = '#output' // <-- ADD SPAN ELEMENT WITH ID output TO HTML GAME FILE AND USE JAVASCRIPT TO POPULATE ITS TEXTCONTENT WITH LIST OFNPMG DATA URI'S

        // Step 5: wait for the output to be ready and populated, then collect its content for further processing
        await page.waitForFunction(selector => {
            const element = document.querySelector(selector);
            return element.textContent.length > 0; // True when element populates its text content
        }, {timeout: 300000}, outputElement); // Wait up to five minutes

        // Step 6: read the final result from the output element
        const resultText = await page.$eval(outputElement, el => el.textContent);

        return resultText; // For now, simply return the result text
    } catch (error) {
        return `[ERROR] Failed to run task: ${error.message}`;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

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

        const fileUrl = attachment.url; // Gets a url to the uploaded file from Discord's CDN

        try {
            // Fetch the file content from Discord's CDN
            const response = await fetch(fileUrl);
            const textContent = await response.text(); // Gets the actual content of the file as a string

            // For now just assume nothing can be done yet
            return interaction.reply(`# Sorry, but this feature is not yet available.\n\nCheck later for better luck!`);
        } catch (error) {
            console.error('Error fetching file: ' + error);
            return interaction.reply({content: 'Failed to fetch file content from URL.', ephemeral: true});
        }
    },
    echo: (interaction) => {
        const input = interaction.options.getString('input');
        return interaction.reply(`You said: ${input}`);
    },
    guessage: (interaction) => {
        return interaction.reply(`Guess: **${Math.round(100 * Math.random())}**.`);
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

const GOISEEncodeCommandData = new SlashCommandBuilder()
    .setName('goiseencode')
    .setDescription('Accepts a replay code for GOISE and returns a video with the playback for that replay code.')
    .addAttachmentOption(option =>
        option.setName('file')
            .setDescription('Replay code here.')
            .setRequired(true)
    )
    .toJSON();
const GuessageCommandData = new SlashCommandBuilder()
    .setName('guessage')
    .setDescription('Guesses the age of Auto-Scout!')
    .toJSON();

// Function to register the commands with Discord
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: [GOISEEncodeCommandData, EchoCommandData, GuessageCommandData] },
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

    const commandHandler = Commands[interaction.commandName]; // This is the actual logic that generates the response

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
