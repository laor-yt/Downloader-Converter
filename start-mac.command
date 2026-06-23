#!/bin/bash

echo "=============================================="
echo "  Download-Converter Setup & Start Script"
echo "=============================================="

# Go to the directory of the script
cd "$(dirname "$0")"

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "Node.js is not installed."
    if command -v brew &> /dev/null
    then
        echo "Installing Node.js via Homebrew..."
        brew install node
    else
        echo "Homebrew not found. Opening Node.js download page..."
        open https://nodejs.org/
        echo "Please install Node.js and run this script again."
        exit 1
    fi
fi

echo "Node.js is installed."

# Check Backend Dependencies
if [ ! -d "backend/node_modules" ]; then
    echo "Installing Backend dependencies..."
    cd backend
    npm install
    cd ..
else
    echo "Backend dependencies already installed."
fi

# Check Frontend Dependencies
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing Frontend dependencies..."
    cd frontend
    npm install
    cd ..
else
    echo "Frontend dependencies already installed."
fi

echo "Starting Servers..."

# Start Backend in a new Terminal window
osascript -e 'tell app "Terminal"
    do script "cd \"'$(pwd)'/backend\" && node server.js"
end tell'

# Start Frontend in a new Terminal window
osascript -e 'tell app "Terminal"
    do script "cd \"'$(pwd)'/frontend\" && npm run dev"
end tell'

echo "Waiting for servers to start..."
sleep 3

echo "Opening Browser..."
open http://localhost:5173

echo "All done! Servers are running in the new Terminal windows."
