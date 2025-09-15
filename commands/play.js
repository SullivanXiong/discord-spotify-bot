const { SlashCommandBuilder } = require("discord.js");

function initializePlayCommand() {
	return {
		data: new SlashCommandBuilder()
			 .setName('play')
			 .setDescription('Search and display information about a song on Spotify')
			 .addStringOption(option =>
				  option.setName('query')
						.setDescription('Song name, artist, or Spotify URL')
						.setRequired(true)
			 ),
		async execute(interaction, spotify) {
			 await interaction.deferReply();

			 const query = interaction.options.getString('query');
			 
			 try {
				  // Check if the query is a Spotify URL
				  if (this.isSpotifyUrl(query)) {
						const trackData = await this.getTrackFromUrl(query, spotify);
						await interaction.editReply(this.formatTrackResponse(trackData));
				  } else {
						// Search for the song
						const searchResult = await this.searchSpotify(query, spotify);
						await interaction.editReply(searchResult);
				  }
			 } catch (error) {
				  console.error('Error executing play command:', error);
				  await interaction.editReply('Sorry, there was an error processing your request. Please try again.');
			 }
		}
	};
}

module.exports = { initializePlayCommand };
