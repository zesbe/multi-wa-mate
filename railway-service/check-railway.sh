#!/bin/bash

# ============================================
# Check if Railway Service is Still Running
# ============================================

COLOR_RESET='\033[0m'
COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'

# Ganti dengan Railway URL lama kamu
RAILWAY_URL="https://your-old-railway-url.railway.app"

echo -e "${COLOR_YELLOW}🔍 Checking if Railway service is still running...${COLOR_RESET}"
echo ""

# Test health endpoint
echo "Testing: $RAILWAY_URL/health"
response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$RAILWAY_URL/health")

if [ "$response" = "200" ]; then
    echo -e "${COLOR_RED}❌ PROBLEM DETECTED!${COLOR_RESET}"
    echo -e "${COLOR_RED}Railway service is still running (HTTP $response)${COLOR_RESET}"
    echo ""
    echo "This will cause 'Stream Errored (conflict)' because:"
    echo "- Railway service trying to connect to WhatsApp"
    echo "- VPS service also trying to connect to WhatsApp"
    echo "- Both use same session data from database"
    echo "- WhatsApp detects conflict and closes connection"
    echo ""
    echo -e "${COLOR_YELLOW}ACTION REQUIRED:${COLOR_RESET}"
    echo "1. Go to Railway dashboard: https://railway.app"
    echo "2. Select your project"
    echo "3. Stop or delete the service"
    echo "4. Verify by running this script again"
    echo ""
elif [ "$response" = "000" ]; then
    echo -e "${COLOR_GREEN}✅ GOOD!${COLOR_RESET}"
    echo -e "${COLOR_GREEN}Railway service is NOT running (connection timeout)${COLOR_RESET}"
    echo "This is what we want - only VPS service should be running"
    echo ""
else
    echo -e "${COLOR_YELLOW}⚠️  UNKNOWN STATUS${COLOR_RESET}"
    echo "HTTP response code: $response"
    echo "Railway might be down or URL is incorrect"
    echo ""
fi

# Test base URL
echo "Testing: $RAILWAY_URL"
response2=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$RAILWAY_URL")

if [ "$response2" = "200" ] || [ "$response2" = "404" ]; then
    echo -e "${COLOR_RED}Railway server is responding (HTTP $response2)${COLOR_RESET}"
    echo -e "${COLOR_RED}You MUST stop the Railway service!${COLOR_RESET}"
elif [ "$response2" = "000" ]; then
    echo -e "${COLOR_GREEN}Railway server is not responding - looks good!${COLOR_RESET}"
fi

echo ""
echo -e "${COLOR_YELLOW}💡 TIP:${COLOR_RESET}"
echo "If Railway is still running, you can also check environment variables in Supabase:"
echo "1. Supabase Dashboard → Edge Functions → Settings"
echo "2. Find BAILEYS_SERVICE_URL"
echo "3. Should point to VPS, not Railway"
echo ""
