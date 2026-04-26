#!/bin/bash

# Campus Ditto HK - Development Launcher
# Starts both Backend (Port 8787) and Frontend (Port 5173)

# Function to kill child processes on exit
cleanup() {
    echo ""
    echo "Stopping Campus Ditto services..."
    kill $(jobs -p)
    exit
}

trap cleanup SIGINT

echo "🚀 Starting Campus Ditto HK Development Environment..."

export ADMIN_SECRET="${ADMIN_SECRET:-dev-secret-change-me}"
export VITE_ADMIN_SECRET="${VITE_ADMIN_SECRET:-$ADMIN_SECRET}"

# 1. Backend Setup
cd backend
if [ ! -f .env ]; then
    echo "⚠️  Backend .env not found. Copying from .env.example..."
    cp .env.example .env
fi

# Ensure dotenv is installed (since we just added it)
if [ ! -d node_modules/dotenv ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

echo "🟢 Starting Backend on http://localhost:8787..."
ADMIN_SECRET="$ADMIN_SECRET" npm run dev &
BACKEND_PID=$!

# 2. Frontend Setup
cd ../frontend
if [ ! -d node_modules ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

echo "🔵 Starting Frontend on http://localhost:5173..."
VITE_ADMIN_SECRET="$VITE_ADMIN_SECRET" npm run dev &
FRONTEND_PID=$!

# Wait for processes
echo "✅ Both services are starting."
echo "👉 Backend: http://localhost:8787"
echo "👉 Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop both."

wait
