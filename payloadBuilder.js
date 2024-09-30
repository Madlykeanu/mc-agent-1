/**
 * payloadBuilder.js
 * This module is responsible for building the payload for the chat model requests.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config.json');

/**
 * Loads commands from commands.json.
 * @returns {Array} Array of command objects.
 */
function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands.json');
  try {
    const data = fs.readFileSync(commandsPath, 'utf8');
    console.log(`[loadCommands] Successfully loaded commands from ${commandsPath}`);
    return JSON.parse(data);
  } catch (error) {
    console.error(`[loadCommands] Error loading commands: ${error.message}`);
    return [];
  }
}

/**
 * Loads script commands from the scripts directory.
 * @returns {Array} Array of script command objects.
 */
function loadScriptCommands() {
  const scriptsPath = path.join(__dirname, 'scripts');
  const scriptCommands = [];

  try {
    const files = fs.readdirSync(scriptsPath);
    files.forEach(file => {
      if (path.extname(file) === '.js') {
        const scriptPath = path.join(scriptsPath, file);
        const script = require(scriptPath);
        if (script.commands) {
          Object.entries(script.commands).forEach(([name, func]) => {
            scriptCommands.push({
              name,
              description: func.description || `Script command from ${file}`,
              usage: func.usage || `${name} [args]`
            });
          });
        }
      }
    });
    console.log(`[loadScriptCommands] Successfully loaded ${scriptCommands.length} script commands`);
    return scriptCommands;
  } catch (error) {
    console.error(`[loadScriptCommands] Error loading script commands: ${error.message}`);
    return [];
  }
}

/**
 * Normalizes command names by removing the leading slash.
 * @param {string} name - The command name to normalize.
 * @returns {string} The normalized command name.
 */
function normalizeCommandName(name) {
  return name.startsWith('/') ? name.slice(1) : name;
}

/**
 * Builds the payload for the chat model request.
 * @param {string} message - The message from the game chat to be sent to the model.
 * @param {string} messageHistory - The history of messages for context.
 * @returns {Object} The payload object for the chat model request.
 */
function buildPayload(message, messageHistory) {
  const commands = loadCommands();
  const scriptCommands = loadScriptCommands();
  const allCommands = [...commands, ...scriptCommands];

  const commandsDescription = allCommands.map(command => 
    `${command.name}: ${command.description}. Usage: ${command.usage}`
  ).join('\n');

  const systemMessage = `You're a helpful player called ppmoment. You're playing on a Minecraft server you love called earthvision. Keep responses as short and concise as possible. Do NOT use *, quotes, or emojis in your responses.

Always respond with a JSON object in the following format:
{
  "thought": "Your chain of thought or reasoning (be detailed but concise)",
  "shouldRespond": true or false, you can decide whether to respond to a message. Ignore server messages, irrelevant chatter, or messages not directed at you.
  "newCommand": { "name": "command_name", "description": "command_description", "usage": "command_usage", "args": ["arg1", "arg2"] } or null if no new command is being added or updated,
  "command": "command_name or null if not using a command",
  "args": "arguments for the command or null if not applicable",
  "message": "Your final message to be sent in the game chat or null if not responding"
}

Always include all fields in your JSON response, using null for newCommand, command, args, and message when not applicable.

Provide detailed thoughts that show your decision-making process, including why you chose to respond or not respond.

Important: You can use the "newCommand" field to add new commands or update existing ones if you learn new information about how they work. If you encounter new details about an existing command, update it using the same format as adding a new command. This helps keep your knowledge of commands up-to-date.

The bot can execute various commands, including those loaded from scripts. Refer to the available commands list for details on what the bot can do.`;

  return {
    model: config.languageModel.model,
    messages: [
      {
        role: "system",
        content: `Ingame chat history for context: ${messageHistory}`
      },
      {
        role: "system",
        content: systemMessage
      },
      {
        role: "system",
        content: `Available commands:\n${commandsDescription}`
      },
      
      {
        role: "user",
        content: message
      }
    ],
    temperature: config.languageModel.temperature,
    max_tokens: config.languageModel.max_tokens
  };
}

/**
 * Adds a new command or updates an existing one in the commands.json file.
 * @param {Object} newCommand - The new command object to add or update.
 * @returns {string} Success or error message.
 */
function addNewCommand(newCommand) {
  console.log(`[addNewCommand] Received newCommand: ${JSON.stringify(newCommand)}`);

  if (!newCommand || !newCommand.name || !newCommand.description || !newCommand.usage) {
    const errorMsg = "Error: Invalid command format";
    console.error(`[addNewCommand] ${errorMsg}`);
    return errorMsg;
  }

  // Load the current commands
  const commands = loadCommands();
  console.log(`[addNewCommand] Current commands: ${JSON.stringify(commands, null, 2)}`);

  // Check if the command already exists
  const existingCommandIndex = commands.findIndex(command => 
    command.name === newCommand.name
  );
  let actionTaken;

  if (existingCommandIndex !== -1) {
    // Update the existing command
    commands[existingCommandIndex] = newCommand;
    actionTaken = "updated";
    console.log(`[addNewCommand] Updated existing command at index ${existingCommandIndex}`);
  } else {
    // Add the new command
    commands.push(newCommand);
    actionTaken = "added";
    console.log(`[addNewCommand] Added new command`);
  }

  // Save the updated commands to the JSON file
  const commandsPath = path.join(__dirname, 'commands.json');
  try {
    fs.writeFileSync(commandsPath, JSON.stringify(commands, null, 2));
    const successMsg = `Command ${newCommand.name} ${actionTaken} successfully`;
    console.log(`[addNewCommand] ${successMsg}`);
    return successMsg;
  } catch (error) {
    const errorMsg = `Error: Failed to save ${actionTaken} command ${newCommand.name} to file`;
    console.error(`[addNewCommand] ${errorMsg} - ${error.message}`);
    return errorMsg;
  }
}

module.exports = { buildPayload, addNewCommand };