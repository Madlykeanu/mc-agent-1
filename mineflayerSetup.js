const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');
const httpRequestHandler = require('./httpRequestHandler');
const readline = require('readline');
const { buildPayload, addNewCommand, buildScriptPayload } = require('./payloadBuilder');
const { pathfinder } = require('mineflayer-pathfinder');

// Load configuration
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')); 

let bot = mineflayer.createBot(config.bot);

// Initialize pathfinder
bot.loadPlugin(pathfinder);

// Flags and tracking variables
let canRespondToMessages = false;
let ignoreNextPpmomentMessage = true;
let lastMentionedPlayers = {}; // Track mentions
let lastSentMessages = []; // Track the last 10 messages sent by the bot
let respondToMentionsOnly = true; 
let respondToAllMessages = true; // Enables response to all messages
let lastMessageTime = 0; // Timestamp of the last message sent

// Initialize the message history array
let messageHistory = [];

// Listen for the spawn event
bot.on('spawn', () => {
    setTimeout(() => {
        canRespondToMessages = true;
    }, 10000);
    ignoreNextPpmomentMessage = true; // Reset the flag on spawn
});

// New variables for message batching
let newMessages = [];
let lastProcessedTime = 0;

bot.on('message', async (jsonMsg) => {
    if (!canRespondToMessages) return;

    const message = jsonMsg.toString();
    const timestamp = new Date().toISOString();
    const timedMessage = `[${timestamp}] - ${message}`;

    // Always add the message to chat history
    console.log(`Added message to history: ${timedMessage}`);
    messageHistory.push(timedMessage);
    if (messageHistory.length > 50) {
        messageHistory.shift();
    }

    // Check if the message contains 'ppmoment' or 'ppmoment:' and skip adding to newMessages if it does
    if (message.toLowerCase().includes('<ppmoment>') || message.includes('ppmoment:')) {
        console.log('Skipping message to prevent responding to messages containing "<ppmoment>" or "ppmoment:".');
        return;
    }

    // Check if the incoming message's end matches the end of any of the last sent messages
    if (messageEndsMatchLastSent(message)) {
        console.log('Skipping message to prevent responding to own message.');
        return;
    }

    // Add new message to the batch for AI processing
    newMessages.push(message);
});

// Function to create a new script from description
async function createAndLoadScript(scriptCode, commandName) {
    const scriptsDir = path.join(__dirname, 'scripts');
    const scriptName = `${commandName}.js`;
    const scriptPath = path.join(scriptsDir, scriptName);

    try {
        // Remove code block markers and language identifier
        let cleanedScriptCode = scriptCode.replace(/^```javascript\s*/, '').replace(/```\s*$/, '');
        
        // Further clean up any remaining markdown artifacts
        cleanedScriptCode = cleanedScriptCode.replace(/^```\s*/, '').trim();

        fs.writeFileSync(scriptPath, cleanedScriptCode);
        console.log(`New script '${scriptName}' created successfully.`);

        // Dynamically load the new script
        delete require.cache[require.resolve(scriptPath)]; // Clear the module cache
        const newScript = require(scriptPath);
        if (typeof newScript.init === 'function') {
            newScript.init(bot);
            console.log(`Initialized script: ${scriptName}`);
        }

        if (newScript.commands) {
            Object.assign(bot.scriptCommands, newScript.commands);
            console.log(`Registered commands from script: ${scriptName}`);
        }

        return `Script '${scriptName}' created and loaded successfully.`;
    } catch (error) {
        console.error(`Failed to create script '${scriptName}':`, error);
        return `Error: Failed to create script '${scriptName}'. ${error.message}`;
    }
}

// Update the processBatchedMessages function to handle createScript
async function processBatchedMessages() {
    if (newMessages.length === 0) return;

    const currentTime = Date.now();
    if (currentTime - lastProcessedTime < 5000) return;

    console.log(`Processing ${newMessages.length} new messages`);

    const batchedMessage = newMessages.join('\n');
    newMessages = []; // Clear the batch

    try {
        // Pass the bot object to buildPayload
        const payload = buildPayload(batchedMessage, messageHistory.join('\n'), bot);
        const response = await httpRequestHandler.sendPostRequest(config.languageModel.url, payload);

        if (response.choices && response.choices[0].message) {
            let messageContent = response.choices[0].message.content.trim();

            // Strip Markdown code block markers if present
            const strippedContent = stripMarkdownCodeBlocks(messageContent);
            //console.log(`Original AI response: ${messageContent}`);
            console.log(`Stripped AI response: ${strippedContent}`);

            try {
                const jsonResponse = JSON.parse(strippedContent);
                

                // Handle createScript
                if (jsonResponse.createScript && jsonResponse.createScript.create) {
                    const { description, commandName, args } = jsonResponse.createScript;

                    if (description && commandName) {
                        // Collect existing scripts as examples
                        const existingScripts = ['scripts/dropItem.js', 'scripts/followPlayer.js'];

                        // Build script payload
                        const scriptPayload = buildScriptPayload(description, commandName, existingScripts);

                        // Send script generation request to AI
                        const scriptResponse = await httpRequestHandler.sendPostRequest(config.languageModel.url, scriptPayload);

                        if (scriptResponse.choices && scriptResponse.choices[0].message) {
                            const scriptContent = scriptResponse.choices[0].message.content.trim();

                            // Execute the newly generated script
                            const scriptResult = await createAndLoadScript(scriptContent, commandName);
                            messageHistory.push(`System: ${scriptResult}`);
                            
                            // Inform the AI about the new script
                            messageHistory.push(`System: New script '${commandName}' has been created and loaded.`);
                        } else {
                            console.error('Invalid script generation response:', scriptResponse);
                            messageHistory.push(`System: Error generating script.`);
                        }
                    } else {
                        console.error('createScript.create is true but missing description or commandName.');
                        messageHistory.push(`System: Error creating script - Missing description or command name.`);
                    }

                    // **NEW CODE ADDED HERE**
                    // Execute the newly created command with the provided arguments
                    if (args && Array.isArray(args) && args.length > 0) {
                        // Convert args array to a space-separated string
                        const argsString = args.join(' ');
                        console.log(`Executing newly created command '${commandName}' with arguments: ${argsString}`);

                        // Execute the command
                        const commandResult = await handleCommandUsage(commandName, argsString);

                        if (commandResult && commandResult.startsWith("Error:")) {
                            console.error(`Error executing command '${commandName}': ${commandResult}`);
                            messageHistory.push(`System: ${commandResult}`);
                        } else {
                            console.log(`Command '${commandName}' executed successfully with arguments: ${argsString}`);
                            messageHistory.push(`System: Command '${commandName}' executed successfully.`);
                        }
                    }
                    // **END OF NEW CODE**
                }

                // Handle newCommand
                if (jsonResponse.newCommand) {
                    try {
                        console.log(`Attempting to add/update command: ${JSON.stringify(jsonResponse.newCommand)}`);
                        const addCommandResult = addNewCommand(jsonResponse.newCommand);
                        console.log(`Result of adding/updating command: ${addCommandResult}`);
                        // Provide feedback to the AI about the command update
                        messageHistory.push(`System: ${addCommandResult}`);
                    } catch (error) {
                        console.error('Error adding/updating command:', error);
                        messageHistory.push(`System: Error adding/updating command: ${error.message}`);
                    }
                }

                if (jsonResponse.shouldRespond) {
                    if (jsonResponse.command) {
                        const commandResult = handleCommandUsage(jsonResponse.command, jsonResponse.args);
                        if (commandResult && commandResult.startsWith("Error:")) {
                            console.error(commandResult);
                        }
                    }

                    if (jsonResponse.message) {
                        setTimeout(() => {
                            bot.chat(jsonResponse.message);
                            console.log(`Bot response: ${jsonResponse.message}`);
                            trackSentMessage(jsonResponse.message);
                        }, 3000);
                    }
                } else {
                    console.log('AI decided not to respond to these messages.');
                }
            } catch (error) {
                console.error('Error processing AI response:', error);
                console.log('Stripped content that failed to parse:', strippedContent);
            }
        } else {
            console.error('Invalid response structure:', response);
        }
    } catch (error) {
        console.error('Error handling batched messages:', error);
    }

    lastProcessedTime = currentTime;
}

// Set up interval to process batched messages every 5 seconds
setInterval(processBatchedMessages, 5000);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (line) => {
  bot.chat(line);
  trackSentMessage(line);
});

console.log('Mineflayer bot setup complete. Type in the terminal to send messages in-game.');

function extractPlayerName(message) {
    let match = message.match(/^<([^>]+)>/);
    if (match) {
        return match[1];
    }

    match = message.match(/\[.*\]\s*([^»]+)\s*»/);
    if (match) {
        return match[1].trim();
    }

    return null;
}

function trackSentMessage(message) {
    lastSentMessages.unshift(message);
    if (lastSentMessages.length > 10) {
        lastSentMessages.pop();
    }
}

function messageEndsMatchLastSent(message) {
    // Extract the last 4 characters of the incoming message
    const incomingMessageEnd = message.slice(-4);

    // Check against the last 10 messages sent by the bot
    for (let i = 0; i < lastSentMessages.length; i++) {
        // Extract the last 4 characters of the current message being checked
        const lastMessageEnd = lastSentMessages[i].slice(-4);

        // Compare the two
        if (incomingMessageEnd === lastMessageEnd) {
            return true; // If any match is found, return true
        }
    }

    // If no match is found after checking all messages, return false
    return false;
}

// Add this function to handle tool usage
function handleToolUsage(tool, args) {
    if (tool.startsWith('/')) {
        const command = args ? `${tool} ${args}` : tool;
        bot.chat(command);
        return null;
    }
    return `Error: Unknown tool command ${tool}`;
}

// Modify this function to handle both script commands and commands from commands.json
function handleCommandUsage(command, args) {
    // Remove leading '/' if present
    const normalizedCommand = command.startsWith('/') ? command.slice(1) : command;

    // Check if the command exists in the loaded scripts
    if (bot.scriptCommands && typeof bot.scriptCommands[normalizedCommand] === 'object' && typeof bot.scriptCommands[normalizedCommand].execute === 'function') {
        return bot.scriptCommands[normalizedCommand].execute(bot, args);  // Pass 'bot' as the first argument
    }

    // Check if the command exists in commands.json
    const jsonCommands = JSON.parse(fs.readFileSync(path.join(__dirname, 'commands.json'), 'utf8'));
    const foundCommand = jsonCommands.find(cmd => cmd.name === normalizedCommand);

    if (foundCommand) {
        // If the command is found in commands.json, execute it
        const fullCommand = args ? `/${normalizedCommand} ${args}` : `/${normalizedCommand}`;
        bot.chat(fullCommand);
        return null;
    }

    return `Error: Unknown command ${command}`;
}

// Script Management System
const scriptsPath = path.join(__dirname, 'scripts');

// Ensure the scripts directory exists
if (!fs.existsSync(scriptsPath)) {
    fs.mkdirSync(scriptsPath);
}

/**
 * Loads all scripts from the scripts directory.
 */
function loadScripts() {
    return new Promise((resolve, reject) => {
        bot.scriptCommands = {}; // Object to store script commands

        fs.readdir(scriptsPath, (err, files) => {
            if (err) {
                console.error('Error reading scripts directory:', err);
                reject(err);
                return;
            }

            files.forEach(file => {
                if (path.extname(file) === '.js') {
                    const script = require(path.join(scriptsPath, file));
                    if (typeof script.init === 'function') {
                        script.init(bot);
                        console.log(`Loaded script: ${file}`);

                        // Register script commands
                        if (script.commands) {
                            Object.assign(bot.scriptCommands, script.commands);
                        }
                    }
                }
            });

            console.log('All scripts loaded');
            resolve();
        });
    });
}

// Load scripts on startup
loadScripts();

/**
 * Strips Markdown code block markers if present.
 * @param {string} text - The text to process.
 * @returns {string} The text with code block markers removed if they were present.
 */
function stripMarkdownCodeBlocks(text) {
    // Check if the text starts and ends with code block markers
    if (text.startsWith('```') && text.endsWith('```')) {
        // Remove the starting and ending code block markers
        text = text.slice(3, -3);
        
        // Remove the language specifier if present (e.g., 'json')
        const firstLineBreak = text.indexOf('\n');
        if (firstLineBreak !== -1) {
            const firstLine = text.slice(0, firstLineBreak).trim();
            if (firstLine === 'json') {
                text = text.slice(firstLineBreak + 1);
            }
        }
    }
    return text.trim();
}