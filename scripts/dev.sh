#!/bin/bash

# Campus Ditto HK - One-Click Dev Setup
# This script ensures dependencies are up to date, seeds the DB, and starts the full stack.

echo "🚀 Starting Campus Ditto HK Development Environment..."

# 1. Install Dependencies
echo "📦 Installing/Updating dependencies..."
npm install
npm --prefix backend install
npm --prefix frontend install

# 2. Seed Data
echo "🌱 Seeding demo data..."
npm run seed

# 3. Start full stack
echo "🔥 Launching full stack demo..."
npm run demo
