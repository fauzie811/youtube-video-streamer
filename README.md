# YouTube Video Streamer

A desktop application that allows you to schedule and stream video files to YouTube. Built with Electron and FFmpeg.

<img width="626" height="393" alt="youtube-video-streamer" src="https://github.com/user-attachments/assets/6e41f04b-e54e-4d1d-a6b4-3507a1f33e18" />

## Features

- Schedule video streams to YouTube
- Stream local video files
- Loop videos for specified duration
- Support for multiple video formats (MP4, AVI, MKV)
- Cross-platform support (Windows, macOS, Linux)

## Installation

### Download

Download the latest release for your platform from the [Releases](https://github.com/fauzie811/youtube-video-streamer/releases) page.

### Build from Source

If you want to build the application from source, follow these steps:

1. Clone the repository
```bash
git clone https://github.com/fauzie811/youtube-video-streamer.git
cd youtube-video-streamer
```

2. Install dependencies
```bash
npm install
```

3. Start the development version
```bash
npm start
```

4. Build for your platform
```bash
# Build for all platforms
npm run build

# Build for specific platforms
npm run build:win # Windows
npm run build:mac # macOS
npm run build:linux # Linux
```

## Usage

1. Launch the application
2. Click "Select Video File" to choose your video
3. Enter your YouTube stream key
4. Set the start time for your stream
5. Set the duration (how long the video should loop)
6. Click "Schedule Stream" to start/schedule the stream
7. Use "Stop Stream" to end the stream at any time

### Getting Your YouTube Stream Key

1. Go to YouTube Studio
2. Click on "Go Live" in the top right corner
3. Copy your stream key from the stream settings
4. Never share your stream key with anyone

## Development

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- For building:
  - Windows: Windows 10/11
  - macOS: macOS 10.15 or later
  - Linux: Any modern distribution

### Project Structure
```
youtube-video-streamer/
├── index.js # Main process
├── index.html # Renderer process
├── package.json # Project configuration
└── README.md # This file
```

### Technologies Used

- Electron
- FFmpeg
- Node Schedule
- Electron Builder

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [FFmpeg](https://ffmpeg.org/) for video processing
- [Electron](https://www.electronjs.org/) for the desktop application framework
- [Node Schedule](https://github.com/node-schedule/node-schedule) for task scheduling

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/fauzie811/youtube-video-streamer/issues).
