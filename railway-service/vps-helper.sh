#!/bin/bash

# ============================================
# VPS Helper Script untuk HalloWa
# ============================================

COLOR_RESET='\033[0m'
COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_BLUE='\033[0;34m'

echo -e "${COLOR_BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   HalloWa VPS Management Helper        ║"
echo "╚════════════════════════════════════════╝"
echo -e "${COLOR_RESET}"

# Function untuk check service status
check_service() {
    echo -e "${COLOR_YELLOW}📊 Checking service status...${COLOR_RESET}"
    pm2 list
    echo ""
}

# Function untuk restart service
restart_service() {
    echo -e "${COLOR_YELLOW}🔄 Restarting multi-wa-mate service...${COLOR_RESET}"
    pm2 restart multi-wa-mate
    echo -e "${COLOR_GREEN}✅ Service restarted${COLOR_RESET}"
    echo ""
}

# Function untuk stop service
stop_service() {
    echo -e "${COLOR_YELLOW}⏹️  Stopping multi-wa-mate service...${COLOR_RESET}"
    pm2 stop multi-wa-mate
    echo -e "${COLOR_GREEN}✅ Service stopped${COLOR_RESET}"
    echo ""
}

# Function untuk start service
start_service() {
    echo -e "${COLOR_YELLOW}▶️  Starting multi-wa-mate service...${COLOR_RESET}"
    pm2 start multi-wa-mate
    echo -e "${COLOR_GREEN}✅ Service started${COLOR_RESET}"
    echo ""
}

# Function untuk view logs
view_logs() {
    echo -e "${COLOR_YELLOW}📋 Viewing logs (last 50 lines)...${COLOR_RESET}"
    pm2 logs multi-wa-mate --lines 50 --nostream
    echo ""
}

# Function untuk follow logs real-time
follow_logs() {
    echo -e "${COLOR_YELLOW}📋 Following logs (Ctrl+C to exit)...${COLOR_RESET}"
    pm2 logs multi-wa-mate
}

# Function untuk clear sessions
clear_sessions() {
    echo -e "${COLOR_RED}⚠️  This will delete all session files!${COLOR_RESET}"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        echo -e "${COLOR_YELLOW}🗑️  Clearing session files...${COLOR_RESET}"
        rm -rf /home/ubuntu/multi-wa-mate/railway-service/baileys_sessions/*
        echo -e "${COLOR_GREEN}✅ Sessions cleared${COLOR_RESET}"
        echo -e "${COLOR_YELLOW}💡 Remember to also clear session in database!${COLOR_RESET}"
    else
        echo -e "${COLOR_BLUE}Cancelled.${COLOR_RESET}"
    fi
    echo ""
}

# Function untuk check health
check_health() {
    echo -e "${COLOR_YELLOW}🏥 Checking health endpoint...${COLOR_RESET}"
    response=$(curl -s http://localhost:3000/health)
    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}✅ Health check passed${COLOR_RESET}"
        echo "Response: $response"
    else
        echo -e "${COLOR_RED}❌ Health check failed${COLOR_RESET}"
    fi
    echo ""
}

# Function untuk check ports
check_ports() {
    echo -e "${COLOR_YELLOW}🔌 Checking port 3000...${COLOR_RESET}"
    netstat -tlnp | grep :3000
    echo ""
}

# Function untuk fix conflict
fix_conflict() {
    echo -e "${COLOR_RED}🔧 Fix Conflict Error${COLOR_RESET}"
    echo ""
    echo "Steps to fix 'Stream Errored (conflict)':"
    echo "1. Stop all running services"
    echo "2. Clear session data in database (use fix-conflict.sql)"
    echo "3. Clear local session files"
    echo "4. Restart service"
    echo "5. Scan QR code again"
    echo ""
    read -p "Do you want to run automatic fix? (yes/no): " confirm

    if [ "$confirm" = "yes" ]; then
        echo -e "${COLOR_YELLOW}⏹️  Step 1: Stopping service...${COLOR_RESET}"
        pm2 stop multi-wa-mate
        sleep 2

        echo -e "${COLOR_YELLOW}🗑️  Step 2: Clearing local sessions...${COLOR_RESET}"
        rm -rf /home/ubuntu/multi-wa-mate/railway-service/baileys_sessions/*

        echo -e "${COLOR_YELLOW}▶️  Step 3: Starting service...${COLOR_RESET}"
        pm2 start multi-wa-mate

        echo ""
        echo -e "${COLOR_GREEN}✅ Automatic fix completed!${COLOR_RESET}"
        echo ""
        echo -e "${COLOR_RED}⚠️  IMPORTANT: You still need to:${COLOR_RESET}"
        echo "1. Clear session in database (run fix-conflict.sql in Supabase)"
        echo "2. Scan QR code again in the app"
        echo ""
    else
        echo -e "${COLOR_BLUE}Cancelled.${COLOR_RESET}"
    fi
    echo ""
}

# Function untuk update code
update_code() {
    echo -e "${COLOR_YELLOW}📥 Pulling latest code from git...${COLOR_RESET}"
    cd /home/ubuntu/multi-wa-mate
    git pull
    echo ""
    echo -e "${COLOR_YELLOW}📦 Installing dependencies...${COLOR_RESET}"
    cd railway-service
    npm install
    echo ""
    echo -e "${COLOR_YELLOW}🔄 Restarting service...${COLOR_RESET}"
    pm2 restart multi-wa-mate
    echo -e "${COLOR_GREEN}✅ Update completed${COLOR_RESET}"
    echo ""
}

# Function untuk backup
backup_db() {
    echo -e "${COLOR_YELLOW}💾 Backup database...${COLOR_RESET}"
    echo "This will backup session files only (database is in Supabase)"
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_dir="/home/ubuntu/backups/hallowa_$timestamp"
    mkdir -p "$backup_dir"
    cp -r /home/ubuntu/multi-wa-mate/railway-service/baileys_sessions/* "$backup_dir/"
    echo -e "${COLOR_GREEN}✅ Backup saved to: $backup_dir${COLOR_RESET}"
    echo ""
}

# Main menu
show_menu() {
    echo -e "${COLOR_BLUE}Select an option:${COLOR_RESET}"
    echo "1. Check service status"
    echo "2. Restart service"
    echo "3. Stop service"
    echo "4. Start service"
    echo "5. View logs (last 50 lines)"
    echo "6. Follow logs (real-time)"
    echo "7. Check health endpoint"
    echo "8. Check ports"
    echo "9. Clear session files"
    echo "10. Fix conflict error (auto)"
    echo "11. Update code from git"
    echo "12. Backup session files"
    echo "0. Exit"
    echo ""
    read -p "Enter option: " option
    echo ""

    case $option in
        1) check_service ;;
        2) restart_service ;;
        3) stop_service ;;
        4) start_service ;;
        5) view_logs ;;
        6) follow_logs ;;
        7) check_health ;;
        8) check_ports ;;
        9) clear_sessions ;;
        10) fix_conflict ;;
        11) update_code ;;
        12) backup_db ;;
        0) echo "Goodbye!" && exit 0 ;;
        *) echo -e "${COLOR_RED}Invalid option${COLOR_RESET}" ;;
    esac
}

# Run menu loop
while true; do
    show_menu
    echo ""
    read -p "Press Enter to continue..."
    clear
    echo -e "${COLOR_BLUE}"
    echo "╔════════════════════════════════════════╗"
    echo "║   HalloWa VPS Management Helper        ║"
    echo "╚════════════════════════════════════════╝"
    echo -e "${COLOR_RESET}"
done
