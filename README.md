# Discord Spotify Bot

A Discord bot that allows users to search and query music from Spotify using slash commands. Share music with friends in Discord!

## Features

- Search songs by name, artist, or album
- Get track information from Spotify URLs
- Fast slash command interface using `/play`
- Display detailed track information including duration, popularity, and preview links
- Automatic Spotify API token management

## Commands

### `/play [query]`
Search for music on Spotify. You can use:
- Song names: `/play Bohemian Rhapsody`
- Artist and song: `/play Queen Bohemian Rhapsody`
- Spotify URLs: `/play https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv`

## Setup Instructions

### Prerequisites
- Node.js 16.0 or higher
- A Discord Application and Bot Token
- Spotify Developer Application credentials

### 1. Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section and create a bot
4. Copy the bot token
5. Under "OAuth2" > "URL Generator":
   - Select "bot" and "applications.commands" scopes
   - Select "Send Messages", "Use Slash Commands", and "Connect" permissions
   - Use the generated URL to invite the bot to your server

### 2. Spotify API Setup

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Copy the Client ID and Client Secret

### 3. Installation

1. Clone this repository:
```bash
git clone https://github.com/SullivanXiong/discord-spotify-bot.git
cd discord-spotify-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Fill in your credentials in the `.env` file:
```env
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_application_client_id_here
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
```

### 4. Running the Bot

Start the bot:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## Usage Examples

### Search by song name:
```
/play Imagine Dragons Radioactive
```

### Search by artist:
```
/play Taylor Swift
```

### Use Spotify URL:
```
/play https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv
```

## Project Structure

```
discord-spotify-bot/
├── index.js           # Main bot file with Discord and Spotify integration
├── package.json       # Node.js dependencies and scripts
├── .env.example       # Environment variables template
├── .gitignore        # Git ignore file
└── README.md         # This file
```

## Dependencies

- **discord.js**: Discord API wrapper for creating the bot
- **spotify-web-api-node**: Spotify Web API wrapper for music queries
- **dotenv**: Environment variable management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License

## Support

If you encounter any issues:
1. Ensure all environment variables are correctly set
2. Check that your Discord bot has the necessary permissions
3. Verify your Spotify API credentials are valid
4. Check the console logs for detailed error messages
