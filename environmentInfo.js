/**
 * environmentInfo.js
 * Module to retrieve information about the bot's surroundings using ray tracing.
 */

const Vec3 = require('vec3');

function getEnvironmentInfo(bot) {
    if (!bot || !bot.entity) {
        console.log("[getEnvironmentInfo] Bot or bot.entity is undefined");
        return {
            visiblePlayers: [],
            visibleMobs: [],
            visibleBlocks: []
        };
    }

    const viewDistance = 32; // Maximum view distance
    const rayStep = 1; // Step size for ray tracing
    const verticalFov = Math.PI / 2; // Vertical field of view (90 degrees)
    const horizontalFov = Math.PI * 2 / 3; // Horizontal field of view (120 degrees)

    const visiblePlayers = [];
    const visibleMobs = [];
    const visibleBlocks = [];

    // Helper function to check if an entity is visible
    function isVisible(entity) {
        const { position: start } = bot.entity;
        const end = entity.position.offset(0, entity.height * 0.5, 0);
        const block = bot.world.raycast(start, end, viewDistance);
        return !block || block.position.distanceTo(end) < 1;
    }

    // Check visible players
    Object.values(bot.players).forEach(player => {
        if (player.entity && player.entity !== bot.entity && isVisible(player.entity)) {
            visiblePlayers.push({
                name: player.username,
                distance: player.entity.position.distanceTo(bot.entity.position).toFixed(2)
            });
        }
    });

    // Check visible mobs
    Object.values(bot.entities).forEach(entity => {
        if (entity.type === 'mob' && isVisible(entity)) {
            visibleMobs.push({
                name: entity.name,
                distance: entity.position.distanceTo(bot.entity.position).toFixed(2)
            });
        }
    });

    // Ray tracing for visible blocks
    const { yaw, pitch } = bot.entity;
    for (let vAngle = -verticalFov / 2; vAngle <= verticalFov / 2; vAngle += Math.PI / 16) {
        for (let hAngle = -horizontalFov / 2; hAngle <= horizontalFov / 2; hAngle += Math.PI / 16) {
            const x = Math.cos(yaw + hAngle) * Math.cos(pitch + vAngle);
            const y = Math.sin(pitch + vAngle);
            const z = Math.sin(yaw + hAngle) * Math.cos(pitch + vAngle);
            const direction = new Vec3(x, y, z);
            
            const block = bot.world.raycast(bot.entity.position.offset(0, bot.entity.height, 0), direction, viewDistance);
            if (block) {
                const existingBlock = visibleBlocks.find(b => b.position === `${block.position.x},${block.position.y},${block.position.z}`);
                if (!existingBlock) {
                    visibleBlocks.push({
                        name: block.name,
                        position: `${block.position.x},${block.position.y},${block.position.z}`
                    });
                }
            }
        }
    }

    return {
        visiblePlayers,
        visibleMobs,
        visibleBlocks
    };
}

module.exports = { getEnvironmentInfo };
