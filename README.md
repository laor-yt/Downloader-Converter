# ⚡ Download & Convert Tool 

A powerful, high-performance local web application that allows you to download and transcode media via URLs (like YouTube, TikTok, Facebook) or upload local files. It features real-time progress tracking, 8K video support, format conversion, and intelligent error handling.

## ✨ Features
- **Ultra-Fast Info Fetching**: Instantly pulls metadata (title, duration, thumbnail) from any media URL.
- **Up to 8K Resolution Support**: Downloads media at the highest possible quality without loss, perfectly merging video and audio streams seamlessly using Matroska (MKV) wrappers.
- **Local File Conversion**: Upload your own local media for format conversion and manipulation.
- **Smart Retries**: If a job fails, the app preserves your file/URL and allows you to instantly retry the job without re-uploading or re-entering data.
- **Dynamic Orientation**: Crop and adjust video orientation (Portrait/Landscape) effortlessly.
- **Live Progress**: Real-time progress bars, speed metrics (MB/s), and ETA calculations.

---

## 🚀 Quick Start (Auto-Start Scripts)

We have included automated startup scripts to make running the project as easy as possible. These scripts will automatically install Node.js (if missing), install all project dependencies, and launch both the backend and frontend servers, followed by opening your browser.

### Windows
1. Open the project folder.
2. Double-click the **`start-windows.bat`** file.
3. Your browser will automatically open to `http://localhost:5173`.

### macOS
1. Open your terminal and navigate to the project folder.
2. Make the script executable (only needed once): `chmod +x start-mac.command`
3. Double-click **`start-mac.command`** in Finder (or run `./start-mac.command` in the terminal).
4. Your browser will automatically open to `http://localhost:5173`.

---

## Troubleshooting

### YouTube "Sign in to confirm you're not a bot"
If you deploy this application to a cloud provider like Render, AWS, or DigitalOcean, YouTube may block the server's IP address and return a `403 Forbidden` or `Sign in to confirm you're not a bot` error.

To bypass this, you need to provide your YouTube cookies:
1. Install a browser extension like [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) on Chrome.
2. Go to youtube.com and ensure you are signed in (or at least loaded the page).
3. Export your cookies and save the file exactly as `cookies.txt`.
4. Place the `cookies.txt` file inside the `backend/` directory of your project.
5. Deploy or push your code again. The backend will automatically detect `cookies.txt` and use it to bypass the block!

---

## 🛠 Manual Installation & Setup

If you prefer to run the project manually, follow these steps:

### Requirements
- **Node.js** (v18 or higher)
  - Windows: 
    ```bash
    winget install OpenJS.NodeJS
    ```
  - macOS: 
    ```bash
    brew install node
    ```
- **Python 3** (Required for the media fetcher)
  - Windows: 
    ```bash
    winget install Python.Python.3.11
    ```
  - macOS: 
    ```bash
    brew install python
    ```
- **FFmpeg** (Installed automatically by the backend)

### 1. Start the Backend Server
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install the necessary dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   node server.js
   ```
   *(You should see "Server is running on port 5000")*

### 2. Start the Frontend Application
1. Open a **second, new terminal window** and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install the necessary dependencies:
   ```bash
   npm install
   ```
3. Start the React development server:
   ```bash
   npm run dev
   ```
4. Open your web browser and navigate to `http://localhost:5173`.

---
## 💡 Troubleshooting
- **Detailed Error Logs**: If a download or conversion fails, the app will now display the exact error message from the engine.
- **Stuck at 0%**: Uploads now instantly calculate duration before processing to ensure the progress bar updates accurately.
- **Python Missing**: If downloads fail instantly, make sure Python 3 is installed and added to your system PATH.
