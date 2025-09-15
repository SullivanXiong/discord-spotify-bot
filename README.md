# Discord Spotify Connect to Discord Bot

A Discord bot that emulates a Spotify Connect device (via librespot) and streams that audio into a Discord voice channel. Includes `/device start` to expose a Connect device, and `/join`/`/leave` to manage voice. Also supports `/play` to search Spotify metadata.

## Features

- **Spotify Connect device**: Uses librespot with pipe backend to output raw PCM
- **Audio pipeline to Discord**: ffmpeg encodes PCM to Ogg/Opus for Discord voice
- **Slash commands**: `/join`, `/leave`, `/device start|stop|status`, `/play`
- **Spotify search**: Metadata search and track info via Spotify Web API
- **Token management**: Automatic Spotify Client Credentials token refresh

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

5. Install librespot (required). On Linux, you can download a release binary:
```bash
sudo install -Dm755 ./librespot /usr/local/bin/librespot
```
Or set `LIBRESPOT_PATH` in `.env` to point to your binary.

If audio sounds pitched or sped up, ensure resampling is correct. This bot treats librespot's pipe output as 44.1kHz and resamples to 48kHz for Discord. If you changed librespot's output rate, set `LIBRESPOT_SAMPLE_RATE` accordingly.

6. Install avahi (required). On Linux, you can download a release binary. This is necessary for managing the librespot zero-conf networking

### 4. Running the Bot

Start the bot:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## Usage

1. In a Discord server, run:
   - `/join` to have the bot join your voice channel
   - `/device start` to start the Spotify Connect device
2. Open Spotify on your phone/desktop, select device "Discord Connect" (or your `LIBRESPOT_DEVICE_NAME`) and press Play.
3. Use `/device status` to check state, `/device stop` to stop, `/leave` to disconnect.

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
├── index.js           # Main bot file and command wiring
├── lib/
│  ├── librespot.js    # Wrapper to run librespot with pipe backend -> FIFO
│  └── voice.js        # Voice connect and ffmpeg encode to Discord
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
