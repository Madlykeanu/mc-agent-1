/**
 * playerStats.js
 * Module to retrieve player's stats.
 */

function getPlayerStats(bot) {
    const health = bot.health;
    const food = bot.food;
    const position = {
        x: bot.entity.position.x,
        y: bot.entity.position.y,
        z: bot.entity.position.z
    };
    const yaw = bot.entity.yaw;
    const pitch = bot.entity.pitch;

    // Get detailed inventory information
    const inventory = bot.inventory.slots.map((item, index) => {
        if (item) {
            return {
                slot: index,
                name: item.name,
                displayName: item.displayName,
                count: item.count,
                metadata: item.metadata
            };
        } else {
            return null;
        }
    }).filter(item => item !== null); // Remove empty slots

    // Get equipped items
    const equipped = {
        hand: bot.heldItem ? bot.heldItem.name : null,
        armor: {
            helmet: bot.inventory.slots[5] ? bot.inventory.slots[5].name : null,
            chestplate: bot.inventory.slots[6] ? bot.inventory.slots[6].name : null,
            leggings: bot.inventory.slots[7] ? bot.inventory.slots[7].name : null,
            boots: bot.inventory.slots[8] ? bot.inventory.slots[8].name : null
        }
    };

    return {
        health,
        food,
        position,
        yaw,
        pitch,
        inventory,
        equipped
    };
}

module.exports = { getPlayerStats };