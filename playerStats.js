/**
 * playerStats.js
 * Module to retrieve player's stats.
 */

function getPlayerStats(bot) {
    if (!bot || !bot.entity) {
        console.log("[getPlayerStats] Bot or bot.entity is undefined");
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

    console.log("[getPlayerStats] Bot health:", bot.health);
    console.log("[getPlayerStats] Bot food:", bot.food);
    console.log("[getPlayerStats] Bot position:", bot.entity.position);
    console.log("[getPlayerStats] Bot yaw:", bot.entity.yaw);
    console.log("[getPlayerStats] Bot pitch:", bot.entity.pitch);
    console.log("[getPlayerStats] Bot inventory:", bot.inventory);
    console.log("[getPlayerStats] Bot held item:", bot.heldItem);

    const inventory = bot.inventory?.slots
        ?.map((item, index) => {
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
        })
        .filter(item => item !== null) ?? []; // Remove empty slots

    // Get equipped items
    const equipped = {
        hand: bot.heldItem?.name ?? null,
        armor: {
            helmet: bot.inventory?.slots[5]?.name ?? null,
            chestplate: bot.inventory?.slots[6]?.name ?? null,
            leggings: bot.inventory?.slots[7]?.name ?? null,
            boots: bot.inventory?.slots[8]?.name ?? null
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

module.exports = { getPlayerStats };