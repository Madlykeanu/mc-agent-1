/**
 * playerStats.js
 * Module to retrieve player's stats with detailed inventory information.
 */

function getPlayerStats(bot) {
    if (!bot || !bot.entity) {
        return {
            health: null,
            food: null,
            position: { x: null, y: null, z: null },
            yaw: null,
            pitch: null,
            inventory: [],
            equipped: {
                hand: null,
                armor: { helmet: null, chestplate: null, leggings: null, boots: null }
            }
        };
    }

    const inventory = bot.inventory?.slots
        ?.map((item, index) => {
            if (item) {
                return {
                    slot: index,
                    name: item.name,
                    displayName: item.displayName,
                    count: item.count,
                    type: item.type,
                    metadata: item.metadata,
                    enchants: item.enchants,
                    durability: item.durability,
                    stackSize: item.stackSize,
                    // Add information about the item's location in the inventory
                    location: getInventoryLocation(index)
                };
            } else {
                return null;
            }
        })
        .filter(item => item !== null) ?? []; // Remove empty slots

    // Get equipped items with more details
    const equipped = {
        hand: bot.heldItem ? {
            name: bot.heldItem.name,
            displayName: bot.heldItem.displayName,
            count: bot.heldItem.count,
            type: bot.heldItem.type,
            metadata: bot.heldItem.metadata,
            enchants: bot.heldItem.enchants,
            durability: bot.heldItem.durability
        } : null,
        armor: {
            helmet: getEquippedItemDetails(bot.inventory?.slots[5]),
            chestplate: getEquippedItemDetails(bot.inventory?.slots[6]),
            leggings: getEquippedItemDetails(bot.inventory?.slots[7]),
            boots: getEquippedItemDetails(bot.inventory?.slots[8])
        }
    };

    const food = bot.food;

    return {
        health: bot.health,
        food,
        position: bot.entity.position,
        yaw: bot.entity.yaw,
        pitch: bot.entity.pitch,
        inventory,
        equipped
    };
}

function getEquippedItemDetails(item) {
    if (!item) return null;
    return {
        name: item.name,
        displayName: item.displayName,
        count: item.count,
        type: item.type,
        metadata: item.metadata,
        enchants: item.enchants,
        durability: item.durability
    };
}

// Add this new function to determine the inventory location
function getInventoryLocation(slotIndex) {
    if (slotIndex >= 36 && slotIndex <= 44) {
        return `Hotbar ${slotIndex - 35}`;
    } else if (slotIndex >= 9 && slotIndex <= 35) {
        return `Main Inventory ${slotIndex - 8}`;
    } else if (slotIndex >= 5 && slotIndex <= 8) {
        const armorPieces = ['Boots', 'Leggings', 'Chestplate', 'Helmet'];
        return `Armor: ${armorPieces[slotIndex - 5]}`;
    } else if (slotIndex === 45) {
        return 'Offhand';
    } else {
        return `Slot ${slotIndex}`;
    }
}

module.exports = { getPlayerStats };