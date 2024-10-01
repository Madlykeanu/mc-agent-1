const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');
const httpRequestHandler = require('./httpRequestHandler');
const readline = require('readline');
const esprima = require('esprima'); // Ensure esprima is installed
const { buildPayload, addNewCommand, buildScriptPayload, anthropic } = require('./payloadBuilder');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const minecraftData = require('minecraft-data');
const { Vec3 } = require('vec3'); // Import Vec3

// Make Vec3 and goals globally available
global.Vec3 = Vec3;
global.goals = goals;

// Load configuration
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')); 

// Define scriptsPath
const scriptsPath = path.join(__dirname, 'scripts');

// Add this near the top of the file with other path definitions
const tempScriptTestPath = path.join(__dirname, 'tempscripttest');

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

// Temporary scripts storage for AI-generated scripts
const tempScripts = {};

// Add this near the top of the file, after other variable declarations
let debugMode = true;

// Initialize Anthropic client
// const anthropicClient = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY,
// });

// Add this near the top of the file, after other imports
console.log('Environment variables loaded:');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set');
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'Set' : 'Not set');

// Listen for the spawn event
bot.on('spawn', () => {
    setTimeout(() => {
        canRespondToMessages = true;
    }, 2000);
    ignoreNextPpmomentMessage = true; // Reset the flag on spawn
    bot.mcData = minecraftData(bot.version);
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

// Function to process batched messages every 5 seconds
async function processBatchedMessages() {
    if (newMessages.length === 0) return;

    const batch = newMessages.join('\n');
    newMessages = [];

    console.log('Starting to process batched messages...');

    // Build the payload for AI request
    console.log('Building payload...');
    const payload = buildPayload(batch, messageHistory.join('\n'), bot);
    console.log('Payload built successfully.');

    try {
        console.log('Sending request to AI model...');
        const startTime = Date.now();
        const response = await httpRequestHandler.sendPostRequest(config.languageModel.url, payload, 60000); // 60 second timeout
        const endTime = Date.now();
        console.log(`Received response from AI model after ${endTime - startTime}ms`);
        
        // Log the input token count
        if (response.usage && response.usage.total_tokens) {
            console.log(`Total tokens: ${response.usage.total_tokens}`);
        } else {
            console.log('Total token count not available in the response');
        }

        if (response.choices && response.choices[0].message) {
            console.log('Processing AI response...');
            const jsonResponse = parseJSONResponse(response.choices[0].message.content);

            if (!jsonResponse) {
                console.error('Invalid JSON response from AI.');
                messageHistory.push(`System: Error parsing AI response.`);
                return;
            }

            console.log('JSON response parsed successfully.');
            console.log('AI response:', JSON.stringify(jsonResponse, null, 2));

            // Handle shouldRespond and message immediately
            if (jsonResponse.shouldRespond && jsonResponse.message) {
                console.log(`Sending message immediately: ${jsonResponse.message}`);
                bot.chat(jsonResponse.message);
                trackSentMessage(jsonResponse.message);
                
            }

            // Handle command execution
            if (jsonResponse.command) {
                console.log(`Executing command: ${jsonResponse.command}`);
                try {
                    const result = await handleCommandUsage(jsonResponse.command, jsonResponse.args);
                    console.log(`Command execution result: ${result}`);
                    messageHistory.push(`System: Executed command ${jsonResponse.command}`);
                } catch (error) {
                    console.error(`Error executing command: ${error.message}`);
                    messageHistory.push(`System: Error executing command - ${error.message}`);
                }
            }

            // Handle createScript
            if (jsonResponse.createScript && jsonResponse.createScript.create) {
                const { description } = jsonResponse.createScript;

                if (description) {
                    const scriptPayload = buildScriptPayload(description, bot);

                    try {
                        const msg = await anthropic.messages.create(scriptPayload);

                        if (msg.content && msg.content.length > 0) {
                            const scriptContent = stripMarkdownCodeBlocks(msg.content[0].text);

                            // Execute the newly generated temporary script
                            const scriptResult = await createAndLoadScript(scriptContent, description);
                            messageHistory.push(`System: ${scriptResult}`);

                            // Inform the AI about the new temporary script
                            messageHistory.push(`System: Temporary script has been executed.`);
                        } else {
                            console.error('Invalid script generation response:', msg);
                            messageHistory.push(`System: Error generating script.`);
                        }
                    } catch (error) {
                        console.error('Error generating script:', error);
                        messageHistory.push(`System: Error generating script - ${error.message}`);
                    }
                } else {
                    console.error('createScript.create is true but missing description.');
                    messageHistory.push(`System: Error creating script - Missing description.`);
                }
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
        } else {
            console.error('Invalid AI response structure:', response);
            messageHistory.push(`System: Error processing AI response.`);
        }
    } catch (error) {
        console.error('Error processing batched messages:', error);
        if (error.code === 'ECONNABORTED') {
            console.error('Request timed out. The AI model is taking too long to respond.');
        }
        messageHistory.push(`System: Error processing messages - ${error.message}`);
    }

    console.log('Finished processing batched messages.');
}

// Set up interval to process batched messages every 5 seconds
setInterval(processBatchedMessages, 5000);

// Function to create and execute a temporary script
async function createAndLoadScript(scriptCode, description) {
    console.log("Received script code:");
    console.log(scriptCode);
    console.log("End of received script code");

    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
        try {
            // Validate JavaScript syntax
            esprima.parseScript(scriptCode);

            // Create a sandbox with allowed modules and global objects
            const sandbox = {
                require: (moduleName) => {
                    switch (moduleName) {
                        case 'vec3':
                            return require('vec3');
                        case 'mineflayer-pathfinder':
                            return require('mineflayer-pathfinder');
                        default:
                            // Allow Node.js built-in modules
                            return require(moduleName);
                    }
                },
                bot,
                Vec3,
                goals,
                console,
                setTimeout,
                setInterval,
                clearTimeout,
                clearInterval,
                Promise,
                // Add other global objects as needed
                ...global
            };

            // Execute the script in the sandbox
            const vm = require('vm');
            const script = new vm.Script(scriptCode);
            const context = vm.createContext(sandbox);
            await script.runInContext(context);
            
            console.log(`Temporary script executed successfully.`);
            return `Temporary script executed successfully.`;
        } catch (error) {
            console.error(`Failed to execute temporary script (Attempt ${attempts + 1}/${maxAttempts}):`, error);
            console.error(`Error details:`, error.stack);

            if (attempts < maxAttempts - 1) {
                // If not the last attempt, try to fix the script
                const fixedScript = await fixScript(scriptCode, error.message, description);
                if (fixedScript) {
                    scriptCode = fixedScript;
                    attempts++;
                } else {
                    return `Error: Failed to fix and execute temporary script after ${attempts + 1} attempts.`;
                }
            } else {
                return `Error: Failed to execute temporary script after ${maxAttempts} attempts. ${error.message}`;
            }
        }
    }
}

// Add this new function to fix the script
async function fixScript(scriptCode, errorMessage, description) {
    try {
        const scriptPayload = buildScriptPayload(description, bot, scriptCode, errorMessage);
        const msg = await anthropic.messages.create(scriptPayload);

        if (msg.content && msg.content.length > 0) {
            const fixedScriptContent = stripMarkdownCodeBlocks(msg.content[0].text);
            console.log("Fixed script received:");
            console.log(fixedScriptContent);
            return fixedScriptContent;
        } else {
            console.error('Invalid script fix response:', msg);
            return null;
        }
    } catch (error) {
        console.error('Error fixing script:', error);
        return null;
    }
}

// Function to strip Markdown code blocks and parse JSON safely.
function stripMarkdownCodeBlocks(text) {
    // Check if the text starts and ends with code block markers
    if (text.startsWith('```') && text.endsWith('```')) {
        // Remove the starting and ending code block markers
        text = text.slice(3, -3);
        
        // Remove the language specifier if present (e.g., 'json' or 'javascript')
        const firstLineBreak = text.indexOf('\n');
        if (firstLineBreak !== -1) {
            const firstLine = text.slice(0, firstLineBreak).trim().toLowerCase();
            if (firstLine === 'json' || firstLine.startsWith('javascript')) {
                text = text.slice(firstLineBreak + 1);
            }
        }
    }
    return text.trim();
}

// Function to parse JSON response safely.
function parseJSONResponse(text) {
    try {
        const stripped = stripMarkdownCodeBlocks(text);
        return JSON.parse(stripped);
    } catch (error) {
        console.error('Failed to parse JSON response:', error);
        return null;
    }
}

// Function to track sent messages to avoid replying to own messages
function trackSentMessage(message) {
    lastSentMessages.push(message);
    if (lastSentMessages.length > 10) {
        lastSentMessages.shift();
    }
}

/**
 * Checks if the incoming message ends with any of the last sent messages.
 * @param {string} message - The incoming message.
 * @returns {boolean} True if there is a match; otherwise, false.
 */
function messageEndsMatchLastSent(message) {
    for (let sentMessage of lastSentMessages) {
        if (message.endsWith(sentMessage)) {
            return true;
        }
    }
    return false;
}

/**
 * Handles the usage of a command.
 * @param {string} command - The command to execute.
 * @param {string} args - The arguments for the command.
 * @returns {Promise<string|null>} The result of command execution or an error message.
 */
async function handleCommandUsage(command, args) {
    console.log(`Handling command usage: ${command} with args: ${args}`);
    // Remove leading '/' if present
    const normalizedCommand = command.startsWith('/') ? command.slice(1) : command;

    // Check if the command exists in the loaded scripts
    if (bot.scriptCommands && typeof bot.scriptCommands[normalizedCommand] === 'object' && typeof bot.scriptCommands[normalizedCommand].execute === 'function') {
        try {
            console.log(`Executing script command: ${normalizedCommand}`);
            const result = await bot.scriptCommands[normalizedCommand].execute(bot, args);
            console.log(`Script command result: ${result}`);
            return result;
        } catch (error) {
            console.error(`Error executing script command: ${error.message}`);
            return `Error: ${error.message}`;
        }
    }

    // Check if the command exists in commands.json
    const jsonCommands = JSON.parse(fs.readFileSync(path.join(__dirname, 'commands.json'), 'utf8'));
    const foundCommand = jsonCommands.find(cmd => cmd.name === normalizedCommand);

    if (foundCommand) {
        // If the command is found in commands.json, execute it
        const fullCommand = args ? `/${normalizedCommand} ${args}` : `/${normalizedCommand}`;
        console.log(`Executing JSON command: ${fullCommand}`);
        bot.chat(fullCommand);
        return `Executed command: ${fullCommand}`;
    }

    console.log(`Unknown command: ${command}`);
    return `Error: Unknown command ${command}`;
}

// Set up readline interface to accept terminal input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (line) => {
  bot.chat(line);
  trackSentMessage(line);
});

console.log('Mineflayer bot setup complete. Type in the terminal to send messages in-game.');

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

// Update this function to handle temporary script execution from tempscripttest folder
async function executeTempScript(scriptName) {
    // add a description for the test script here, this important for the AI to understand what the script is supposed to do so if there is an error it can fix it
    const scriptDescription = ('This is a test script. It should execute a specific task and nothing else. It will be deleted immediately after execution.');
  try {
    const scriptPath = path.join(tempScriptTestPath, `${scriptName}.js`);
    if (fs.existsSync(scriptPath)) {
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      return await createAndLoadScript(scriptContent, scriptDescription);
    } else {
      return 'Error: Script not found in tempscripttest folder.';
    }
  } catch (error) {
    console.error('Error executing temp script:', error);
    return `Error: ${error.message}`;
  }
}

// Update the chat event listener
bot.on('chat', async (username, message) => {
  if (username === bot.username) return;

  if (debugMode && message.toLowerCase() === 'test') {
    const scriptResult = await executeTempScript('test2');
    bot.chat(scriptResult);
  }

  // ... rest of your existing chat handling code ...
});

// Add this command to toggle debug mode
bot.on('chat', (username, message) => {
  if (message.toLowerCase() === 'toggle debug') {
    debugMode = !debugMode;
    bot.chat(`Debug mode ${debugMode ? 'enabled' : 'disabled'}.`);
  }
});

// You might want to add this to ensure the tempscripttest folder exists
if (!fs.existsSync(tempScriptTestPath)) {
  fs.mkdirSync(tempScriptTestPath);
  console.log('Created tempscripttest folder');
}