const BOOT_ID = Math.floor(Math.random() * 10000);
console.log("[STARTUP] Booting Instance ID: " + BOOT_ID);
// Using import prevents using require, hence the change to all of them
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import http from 'http'; // Import Node.js HTTP module
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegpath from 'ffmpeg-static';
ffmpeg.setFfmpegPath(ffmpegpath);
import fetch from 'node-fetch'; // Import fetch
import path from 'path'; // More imports
import { fileURLToPath } from 'url'; // THIS IMPORT IS CRITICAL
import puppeteer from 'puppeteer';
import express from 'express';

// Error handling
process.on('uncaughtException', e => {
    console.error("[FATAL] UncaughtException: " + e);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error(`[FATAL] UnhandledRejection at: ${promise} reason: ${reason}`);
});

// --- Configuration ---
const BOT_TOKEN = process.env.BOT_TOKEN || ''; 
const CLIENT_ID = process.env.CLIENT_ID || ''; 
const CANVAS_TASK_URL = process.env.CANVAS_TASK_URL || '';
const APP_URL = process.env.RENDER_EXTERNAL_URL || '';
const GUILD_ID = process.env.GUILD_ID || ''; 
const PORT = process.env.PORT // Use Render's port or default to 3000
const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH;

if (!PORT) {
    console.error("[FATAL] Environment variable PORT is missing. Cannot start server.");
    process.exit(1);
}

// File path setup
const FILENAME = fileURLToPath(import.meta.url);
const DIRNAME = path.dirname(FILENAME);
const goiseRunnerPath = path.join(DIRNAME, 'public');
// const appelRunnerPath = path.join(DIRNAME, 'gamefiles/appel.html');

if (!fs.existsSync(goiseRunnerPath)) fs.mkdirSync(goiseRunnerPath, { recursive: true });

// Express Server
const app = express();
app.use(express.static(goiseRunnerPath));
console.log(`[SERVER] Instance ${BOOT_ID} is attempting to claim port ${PORT}`);
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[System] File server ready on port ${PORT}`);
});

server.on('error', e => {
    if (e.code === 'EADDRINUSE') {
        console.error(`[FATAL] Port ${PORT} already in use`);
    } else if (e.code === 'EACCES') {
        console.error(`[FATAL] Permission denied on port ${PORT}. Is PORT 80?`);
    } else {
        console.error("[FATAL] Server crashed with error " + e);
    }
    process.exit(1);
});

const QUEUE = [];
let isProcessing = false;

function base64ToBuffer(base64String) {
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
}

let logLines = [];
function logLine(text) {
    logLines.push(text);
    return { content: `\`\`\`bash\n${logLines.join('\n')}\n\`\`\`` };
}

// --- Headless browser async logic ---
async function runCanvasTaskHeadless(replayCode, interaction) {
    let browser;
    try {
        console.log('Launching headless browser...');
        await interaction.editReply(logLine("Launching puppeteer..."));
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ],
            timeout: 300000
        });
        await interaction.editReply(logLine("Puppeteer launched! Creating new window..."));

        const page = await browser.newPage();
        // Step 1: pass input data before evaluation
        await page.evaluateOnNewDocument(data => {
            window.taskInputData = data;
        }, replayCode);
        
        // Step 2: load local html file
        await interaction.editReply(logLine("New window created! Loading GOISE..."));
        console.log(goiseRunnerPath);
        await page.goto(`${goiseRunnerPath}?code=${replayCode}`, {
            waitUntil: 'networkidle0',
            timeout: 300000
        });

        // Step 3: tell html script to initiate computation
        await interaction.editReply(logLine("GOISE loaded! Starting computation..."));
        await page.evaluate(() => {
            window.startComputation();
        });

        // Step 4: target location to receive output when ready
        await interaction.editReply(logLine("Computation started! Awaiting output frames..."));
        const outputElement = '#output' // <-- ADD SPAN ELEMENT WITH ID output TO HTML GAME FILE AND USE JAVASCRIPT TO POPULATE ITS TEXTCONTENT WITH LIST OFNPMG DATA URI'S

        // Step 5: wait for the output to be ready and populated, then collect its content for further processing
        await page.waitForFunction(selector => {
            const element = document.querySelector(selector);
            return element?.textContent.length > 0; // True when element exists and populates its text content, added optional chaining operator to prevent error
        }, {timeout: 300000}, outputElement); // Wait up to five minutes

        // Step 6: read the final result from the output element
        await interaction.editReply(logLine("Output frames received! Closing puppeteer..."));
        
        const resultText = await page.$eval(outputElement, el => el.textContent);
        const resultArray = resultText.split(' ');
        
        if (browser) {
            await browser.close();
        }

        return resultArray; // Simply return the result array
    } catch (error) {
        await interaction.editReply(logLine("Error: " + error.message));
        if (browser) {
            await browser.close();
        }
        return [];
    }
}

async function encodeVideoLocally(array, id) {
    return new Promise((resolve, reject) => {
        (async (resolve, reject) => {
            const fileName = `vid-${id}.mp4`;
            const filePath = path.join(DIRNAME, fileName);

            await interaction.editReply(logLine("Starting ffmpeg encoding..."));
            const command = ffmpeg()
                .input('pipe:')
                .inputOptions(['-f', 'image2pipe', '-r', '30'])
                .videoCodec('libx264')
                .outputOptions(['-pix_fmt', 'yuv420p', '-r', '30', '-movflags', 'faststart'])
                .save(filePath);

            command.on('error', e => {
                (async (e) => {
                    await interaction.editReply(logLine("Error: " + e.message));
                    reject(new Error("Encoding failed: " + e.message));
                })(e);
            });

            command.on('end', () => {
                (async () => {
                    await interaction.editReply(logLine("Ffmpeg encoding complete! Saving to disk.."));
                    const publicUrl = `${APP_URL}/${fileName}`;
                    setTimeout(() => {
                        (async () => {
                            if (fs.existsSync(filePath)) {
                                fs.unlinkSync(filePath); 
                                await interaction.editReply(logLine("Warning: Video expired and removed from servers. Video embed may disappear at any time."));
                            }
                        })();
                    }, 3600000);
                    resolve(publicUrl);
                })();
            });

            // Streaming loop: push data from array into pipe
            const inputPipe = command.pipe();
            await interaction.editReply(logLine("Converting Base 64 PNG images to Buffer..."));
            for (const frameBase64 of array) {
                inputPipe.write(base64ToBuffer(frameBase64));
            }
            await interaction.editReply(logLine("Conversion complete!"));
            inputPipe.end();
        })(resolve, reject);
    });
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
        await interaction.deferReply({ ephemeral: false });
        interaction.editReply(logLine("Request received! Processing..."));
        const seed = interaction.id;
        QUEUE.push(seed);
        await interaction.editReply(logLine("Checking for file..."));
        const attachment = interaction.options.getAttachment('file');
        if (!attachment) {
            await interaction.editReply(logLine("Error: File not found"));
        }
        await interaction.editReply(logLine("File found! Parsing contents..."));

        // Ensure MIME is text/plain (plaintext file)
        await interaction.editReply(logLine("Verifying MIME type..."));
        if (attachment.contentType && !attachment.contentType.startsWith('text/plain')) {
            await interaction.editReply(logLine(`Error: The attached file was not a plaintext file. Ensure the extension is \`.txt\`.`));
            return;
        }
        await interaction.editReply(logLine("Verified! Fetching URL to file..."));
        
        const fileUrl = attachment.url; // Gets a url to the uploaded file from Discord's CDN

        try {
            // Fetch the file content from Discord's CDN
            const response = await fetch(fileUrl);
            const textContent = await response.text(); // Gets the actual content of the file as a string
            await interaction.editReply(logLine("String content received!"));
            
            const frames = runCanvasTaskHeadless(textContent, interaction);
            if (frames.length === 0) {
                await interaction.editReply(logLine("Error: Null replay code file"));
                return;
            }
            const video = await encodeVideoLocally(frames, seed);

            await interaction.editReply(logLine("Preparing to send video..."));
            
            await interaction.editReply({ content: `${logLine("Video send imminent!")}\n[Replay Video](${video})` });
        } catch (error) {
            await interaction.editReply(logLine("Error: Unable to fetch file"));
            return;
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
client.on('error', e => {
    console.error("[FATAL] Discord Client Error: " + e);
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

client.login(BOT_TOKEN).catch(e => {
    console.error("[FATAL] Discord login failed. Check token and intents: " + e);
    process.exit(1);
});
/*
// --- ADDED CODE TO SATISFY RENDER'S PORT REQUIREMENT ---
const httpServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Discord bot is alive and running!\n');
});
// --------------------------------------------------------

// Have server listen
httpServer.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
});*/

// Log in to Discord
client.login(BOT_TOKEN);
