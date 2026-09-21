#!/bin/sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}[1/5] Updating packages...${NC}"
apk update && echo -e "${GREEN}[1/5] Update complete${NC}"

echo -e "${BLUE}[2/5] Upgrading packages...${NC}"
apk upgrade && echo -e "${GREEN}[2/5] Upgrade complete${NC}"

echo -e "${BLUE}[3/5] Checking nodejs...${NC}"
if command -v node &> /dev/null; then
    echo -e "${GREEN}[3/5] nodejs is already installed${NC}"
else
    echo -e "${YELLOW}[3/5] nodejs not found${NC}"
    echo -e "${BLUE}[3/5] Installing nodejs...${NC}"
    apk add nodejs && echo -e "${GREEN}[3/5] nodejs installed successfully${NC}"
fi

echo -e "${BLUE}[4/5] Checking yt-dlp...${NC}"
if command -v yt-dlp &> /dev/null; then
    echo -e "${GREEN}[4/5] yt-dlp is already installed${NC}"
else
    echo -e "${YELLOW}[4/5] yt-dlp not found${NC}"
    echo -e "${BLUE}[4/5] Installing yt-dlp...${NC}"
    apk add yt-dlp && echo -e "${GREEN}[4/5] yt-dlp installed successfully${NC}"
fi

echo -e "${BLUE}[5/5] Checking deno (JS runtime for social media)...${NC}"
if command -v deno &> /dev/null; then
    echo -e "${GREEN}[5/5] deno is already installed${NC}"
else
    echo -e "${YELLOW}[5/5] deno not found${NC}"
    echo -e "${BLUE}[5/5] Installing deno...${NC}"
    apk add deno && echo -e "${GREEN}[5/5] deno installed successfully${NC}"
fi

echo -e "${GREEN}All done.${NC}"