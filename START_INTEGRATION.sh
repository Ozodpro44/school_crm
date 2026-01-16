#!/bin/bash

# Frontend Dev Integration - Automated Setup Script
# This script sets up frontend_for_dev with backend integration

set -e  # Exit on error

echo "🚀 Frontend Dev Integration Setup"
echo "=================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get project root
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend_for_dev"
BACKEND_DIR="$PROJECT_ROOT/backend_school_crm"

echo -e "${BLUE}Project Root: $PROJECT_ROOT${NC}"
echo -e "${BLUE}Frontend: $FRONTEND_DIR${NC}"
echo -e "${BLUE}Backend: $BACKEND_DIR${NC}"

# Check if directories exist
if [ ! -d "$FRONTEND_DIR" ]; then
  echo -e "${RED}Error: frontend_for_dev directory not found${NC}"
  exit 1
fi

if [ ! -d "$BACKEND_DIR" ]; then
  echo -e "${RED}Error: backend_school_crm directory not found${NC}"
  exit 1
fi

# Step 1: Setup Frontend Environment
echo -e "\n${YELLOW}Step 1: Setting up frontend environment${NC}"
if [ ! -f "$FRONTEND_DIR/.env.local" ]; then
  cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env.local"
  echo -e "${GREEN}✓ Created .env.local${NC}"
else
  echo -e "${YELLOW}ℹ .env.local already exists${NC}"
fi

# Step 2: Install Dependencies
echo -e "\n${YELLOW}Step 2: Installing frontend dependencies${NC}"
cd "$FRONTEND_DIR"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Step 3: Create necessary directories
echo -e "\n${YELLOW}Step 3: Creating directory structure${NC}"
mkdir -p "$FRONTEND_DIR/src/lib"
mkdir -p "$FRONTEND_DIR/src/services"
mkdir -p "$FRONTEND_DIR/src/hooks"
mkdir -p "$FRONTEND_DIR/src/components/dev"
echo -e "${GREEN}✓ Directories created${NC}"

# Step 4: Summary
echo -e "\n${GREEN}Setup Complete!${NC}"
echo "=================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Edit .env.local with your settings:"
echo -e "   ${BLUE}code $FRONTEND_DIR/.env.local${NC}"
echo ""
echo "2. Update these variables:"
echo "   VITE_API_BASE_URL=http://localhost:8080/api"
echo "   VITE_RAILWAY_API_KEY=your_key (optional)"
echo "   VITE_RAILWAY_PROJECT_ID=your_id (optional)"
echo ""
echo "3. Start backend (Terminal 1):"
echo -e "   ${BLUE}cd $BACKEND_DIR${NC}"
echo -e "   ${BLUE}go run main.go${NC}"
echo ""
echo "4. Start frontend (Terminal 2):"
echo -e "   ${BLUE}cd $FRONTEND_DIR${NC}"
echo -e "   ${BLUE}npm run dev${NC}"
echo ""
echo "5. Open browser:"
echo "   http://localhost:5173"
echo ""
echo "6. Test API in browser console:"
echo "   import { apiClient } from './src/lib/api-client'"
echo "   await apiClient.healthCheck()"
echo ""
echo "📖 Documentation:"
echo "   - FRONTEND_DEV_QUICK_START.md"
echo "   - FRONTEND_DEV_INTEGRATION_SETUP.md"
echo "   - INTEGRATION_COMPLETE_INDEX.md"
echo ""
