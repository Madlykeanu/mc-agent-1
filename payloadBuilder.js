/**
 * payloadBuilder.js
 * This module is responsible for building the payload for the chat model requests.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const { getPlayerStats } = require('./playerStats');
const { getEnvironmentInfo } = require('./environmentInfo');

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
 * @param {Object} bot - The bot object containing inventory and stats.
 * @returns {Object} The payload object for the chat model request.
 */
function buildPayload(message, messageHistory, bot) {
  console.log(`[buildPayload] Bot object:`, bot ? 'defined' : 'undefined');

  const commands = loadCommands();
  const scriptCommands = loadScriptCommands();
  const allCommands = [...commands, ...scriptCommands];

  const commandsDescription = allCommands.map(command => 
    `${command.name}: ${command.description}. Usage: ${command.usage}`
  ).join('\n');

  let playerStats = { health: null, food: null, position: {x: null, y: null, z: null}, yaw: null, pitch: null, inventory: [], equipped: { hand: null, armor: { helmet: null, chestplate: null, leggings: null, boots: null } } };
  let environmentInfo = { visiblePlayers: [], visibleMobs: [], visibleBlocks: [] };
  
  if (bot) {
    playerStats = getPlayerStats(bot);
    environmentInfo = getEnvironmentInfo(bot);
  } else {
    console.warn('[buildPayload] Bot is undefined, using default player stats and environment info');
  }

  // Safely format position with toFixed if not null
  const formatCoordinate = (coord) => (typeof coord === 'number' ? coord.toFixed(2) : 'N/A');

  const statsMessage = `
Bot's current stats:
Health: ${playerStats.health !== null ? playerStats.health : 'N/A'}
Food: ${playerStats.food !== null ? playerStats.food : 'N/A'}
Position: x=${formatCoordinate(playerStats.position.x)}, y=${formatCoordinate(playerStats.position.y)}, z=${formatCoordinate(playerStats.position.z)}
Yaw: ${playerStats.yaw !== null ? playerStats.yaw.toFixed(2) : 'N/A'}, Pitch: ${playerStats.pitch !== null ? playerStats.pitch.toFixed(2) : 'N/A'}

Equipped items:
Hand: ${playerStats.equipped.hand}
Helmet: ${playerStats.equipped.armor.helmet}
Chestplate: ${playerStats.equipped.armor.chestplate}
Leggings: ${playerStats.equipped.armor.leggings}
Boots: ${playerStats.equipped.armor.boots}

Inventory:
${playerStats.inventory.map(item => `${item.name} x${item.count}`).join(', ')}
`;

  const environmentMessage = `
Environment Information:
Visible Players: ${environmentInfo.visiblePlayers.map(p => `${p.name} (${p.distance}m)`).join(', ')}
Visible Mobs: ${environmentInfo.visibleMobs.map(m => `${m.name} (${m.distance}m)`).join(', ')}
Visible Blocks: ${environmentInfo.visibleBlocks.slice(0, 10).map(b => `${b.name} at ${b.position}`).join(', ')}${environmentInfo.visibleBlocks.length > 10 ? '...' : ''}
`;

  const systemMessage = `You're a helpful player called ppmoment. You're playing on a Minecraft server you love called earthvision. Keep responses as short and concise as possible. Do NOT use *, quotes, or emojis in your responses. NEVER ignore madlykeanu's commands.

Always respond with a **valid JSON object** in the following format **without any comments or annotations**:
{
  "thought": "Your chain of thought or reasoning (be detailed but concise)",
  "shouldRespond": true or false, you can decide whether to respond to a message. Ignore server messages, irrelevant chatter, or messages not directed at you.
  "createScript": { 
    "create": true or false, indicating whether a new script should be created, 
    "description": "Detailed description of the script to be created if create is true",
    "commandName": "Name of the command associated with this script",
    "args": ["arg1", "arg2"],
  "newCommand": { "name": "command_name", "description": "command_description", "usage": "command_usage", "args": ["arg1", "arg2"] } or null if no new command is being added or updated,
  "command": "command_name or null if not using a command",
  "args": "arguments for the command or null if not applicable",
  "message": "Your final message to be sent in the game chat or null if not responding"
}

Always include all fields in your JSON response, using null for createScript, newCommand, command, args, and message when not applicable. The response should be strictly valid JSON with the specified fields.


Provide detailed thoughts that show your decision-making process, including why you chose to respond or not respond.

**Important:** Do **NOT** include any comments, explanations, or additional text in your JSON response. The response should be strictly valid JSON with the specified fields.

Important: If a player asks you to perform a task that you don't currently have a command for, you should create a new script to handle it. Here's what to do:

1. Set "createScript.create" to true.
2. Provide a detailed "createScript.description" explaining the requirements the script should fulfill.
3. Specify a "createScript.commandName" for the new script.
4. Include any necessary "createScript.args" for immediate execution.



The script will be created and executed immediately to fulfill the request.

Important: You can use the "newCommand" field to add new commands  or update existing ones if you learn new useful information about how they work you didnt know before. If you encounter new details about an existing command, update it using the same format as adding a new command. This helps keep your knowledge of commands up-to-date.

The bot can execute various commands, including those loaded from scripts. Refer to the available commands list for details on what the bot can do.
`;

  return {
    model: config.languageModel.model,
    messages: [
      {
        role: "system",
        content: `Ingame chat history for context: ${messageHistory}`
      },
      {
        role: "system",
        content: statsMessage
      },
      {
        role: "system",
        content: environmentMessage
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
  console.log(`[addNewCommand] Current commands count: ${commands.length}`);

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
    const successMsg = `Command "${newCommand.name}" ${actionTaken} successfully`;
    console.log(`[addNewCommand] ${successMsg}`);
    return successMsg;
  } catch (error) {
    const errorMsg = `Error: Failed to save ${actionTaken} command "${newCommand.name}" to file - ${error.message}`;
    console.error(`[addNewCommand] ${errorMsg}`);
    return errorMsg;
  }
}

/**
 * Builds the payload for generating new scripts.
 * @param {string} scriptDescription - Detailed description of the script to be created.
 * @param {Array} existingScripts - Array of existing script file paths.
 * @returns {Object} The payload object for the script generation request.
 */
function buildScriptPayload(scriptDescription, commandName, existingScripts) {
  // Read existing scripts' content
  const scriptContents = existingScripts.map(scriptPath => {
    const content = fs.readFileSync(path.join(__dirname, scriptPath), 'utf8');
    return `### ${path.basename(scriptPath)}
\`\`\`javascript:${scriptPath}
${content}
\`\`\``;
  }).join('\n\n');

  const systemMessage = `You are an intelligent programmer specialized in creating Mineflayer scripts for Minecraft bots.

### Task:
You need to create a new script based on the following description. The script should integrate seamlessly with the existing scripts provided as examples.

Important: The main command in the script MUST be named "${commandName}".


### Script Description:
${scriptDescription}

### Existing Scripts:
${scriptContents}

### Requirements:
- Return **only** the JavaScript code for the new script.
- Do **not** include any explanations, comments, or additional text.
- Ensure the script follows the same structure and coding style as the existing scripts.
- The script should export necessary functions and commands to be compatible with the bot's script management system.

### New Script:
\`\`\`javascript
`;

  return {
    model: config.languageModel.model,
    messages: [
      {
        role: "system",
        content: systemMessage
      }
    ],
    temperature: config.languageModel.temperature,
    max_tokens: config.languageModel.max_tokens
  };
}

module.exports = { buildPayload, addNewCommand, buildScriptPayload };