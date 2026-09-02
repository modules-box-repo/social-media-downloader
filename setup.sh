#!/bin/sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}[1/7] Updating packages...${NC}"
apk update && echo -e "${GREEN}[1/7] Update complete${NC}"

echo -e "${BLUE}[2/7] Upgrading packages...${NC}"
apk upgrade && echo -e "${GREEN}[2/7] Upgrade complete${NC}"

echo -e "${BLUE}[3/7] Checking nodejs...${NC}"
if command -v node &> /dev/null; then
    echo -e "${GREEN}[3/7] nodejs is already installed${NC}"
else
    echo -e "${YELLOW}[3/7] nodejs not found${NC}"
    echo -e "${BLUE}[3/7] Installing nodejs...${NC}"
    apk add nodejs && echo -e "${GREEN}[3/7] nodejs installed successfully${NC}"
fi

echo -e "${BLUE}[4/7] Checking npm...${NC}"
if command -v npm &> /dev/null; then
    echo -e "${GREEN}[4/7] npm is already installed${NC}"
else
    echo -e "${YELLOW}[4/7] npm not found${NC}"
    echo -e "${BLUE}[4/7] Installing npm...${NC}"
    apk add npm && echo -e "${GREEN}[4/7] npm installed successfully${NC}"
fi

echo -e "${BLUE}[5/7] Checking yt-dlp...${NC}"
if command -v yt-dlp &> /dev/null; then
    echo -e "${GREEN}[5/7] yt-dlp is already installed${NC}"
else
    echo -e "${YELLOW}[5/7] yt-dlp not found${NC}"
    echo -e "${BLUE}[5/7] Installing yt-dlp...${NC}"
    apk add yt-dlp && echo -e "${GREEN}[5/7] yt-dlp installed successfully${NC}"
fi

echo -e "${BLUE}[6/7] Checking deno (JS runtime for social media)...${NC}"
if command -v deno &> /dev/null; then
    echo -e "${GREEN}[6/7] deno is already installed${NC}"
else
    echo -e "${YELLOW}[6/7] deno not found${NC}"
    echo -e "${BLUE}[6/7] Installing deno...${NC}"
    apk add deno && echo -e "${GREEN}[6/7] deno installed successfully${NC}"
fi

echo -e "${BLUE}[7/7] Installing Express library...${NC}"
if npm list -g express --depth=0 &> /dev/null; then
    echo -e "${GREEN}[7/7] Express is already installed${NC}"
else
    echo -e "${YELLOW}[7/7] Express not found${NC}"
    echo -e "${BLUE}[7/7] Installing express...${NC}"
    npm install -g express && echo -e "${GREEN}[7/7] Express installed successfully${NC}"
fi

echo -e "${GREEN}All done.${NC}"
