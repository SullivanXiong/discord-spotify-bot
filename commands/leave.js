"use strict";

const { SlashCommandBuilder } = require("discord.js");

function initializeLeaveCommand() {
    return {
        data: new SlashCommandBuilder()
            .setName('leave')
            .setDescription('Leave the voice channel and stop playback'),
        async execute(interaction) {
            await interaction.deferReply({ ephemeral: true });
            try {
                this.voice.leave();
                await interaction.editReply('Left the voice channel.');
            } catch (err) {
                await interaction.editReply(`Failed to leave: ${err.message}`);
            }
        }
    };
}

module.exports = { initializeLeaveCommand };

