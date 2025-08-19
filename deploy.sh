#!/bin/bash

# LegalEase AI Production Deployment Script
# This script helps deploy the application to production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="legal-ai"
BACKEND_PORT=5000
FRONTEND_PORT=3000
PRODUCTION_USER="legalai"
PRODUCTION_GROUP="legalai"
APP_DIR="/opt/legal-ai"
SERVICE_NAME="legal-ai"

echo -e "${BLUE}🚀 LegalEase AI Production Deployment${NC}"
echo "=========================================="

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ This script should not be run as root${NC}"
   exit 1
fi

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check if Python 3.9+ is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3.9+ is required but not installed${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
if [[ $(echo "$PYTHON_VERSION < 3.9" | bc -l) -eq 1 ]]; then
    echo -e "${RED}❌ Python 3.9+ is required. Current version: $PYTHON_VERSION${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Python $PYTHON_VERSION found${NC}"

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo -e "${RED}❌ pip3 is required but not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ pip3 found${NC}"

# Check if systemd is available
if ! command -v systemctl &> /dev/null; then
    echo -e "${YELLOW}⚠️  systemd not found. Service installation will be skipped${NC}"
    SYSTEMD_AVAILABLE=false
else
    SYSTEMD_AVAILABLE=true
    echo -e "${GREEN}✅ systemd found${NC}"
fi

# Check if nginx is available
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}⚠️  nginx not found. Reverse proxy setup will be skipped${NC}"
    NGINX_AVAILABLE=false
else
    NGINX_AVAILABLE=true
    echo -e "${GREEN}✅ nginx found${NC}"
fi

echo ""

# Create production user and group
echo -e "${YELLOW}👤 Setting up production user...${NC}"

if ! id "$PRODUCTION_USER" &>/dev/null; then
    sudo useradd -r -s /bin/bash -d "$APP_DIR" "$PRODUCTION_USER"
    echo -e "${GREEN}✅ Created user: $PRODUCTION_USER${NC}"
else
    echo -e "${GREEN}✅ User $PRODUCTION_USER already exists${NC}"
fi

# Create application directory
echo -e "${YELLOW}📁 Setting up application directory...${NC}"

sudo mkdir -p "$APP_DIR"
sudo chown "$PRODUCTION_USER:$PRODUCTION_GROUP" "$APP_DIR"
sudo chmod 755 "$APP_DIR"

echo -e "${GREEN}✅ Application directory created: $APP_DIR${NC}"

# Copy application files
echo -e "${YELLOW}📦 Copying application files...${NC}"

sudo cp -r backend/* "$APP_DIR/"
sudo cp -r frontend "$APP_DIR/"
sudo chown -R "$PRODUCTION_USER:$PRODUCTION_GROUP" "$APP_DIR"

echo -e "${GREEN}✅ Application files copied${NC}"

# Set up Python virtual environment
echo -e "${YELLOW}🐍 Setting up Python virtual environment...${NC}"

cd "$APP_DIR"
sudo -u "$PRODUCTION_USER" python3 -m venv venv
sudo -u "$PRODUCTION_USER" venv/bin/pip install --upgrade pip
sudo -u "$PRODUCTION_USER" venv/bin/pip install -r requirements.txt

echo -e "${GREEN}✅ Python environment configured${NC}"

# Create production environment file
echo -e "${YELLOW}⚙️  Setting up environment configuration...${NC}"

if [ ! -f "$APP_DIR/.env" ]; then
    sudo -u "$PRODUCTION_USER" cp env.example .env
    echo -e "${YELLOW}⚠️  Please edit $APP_DIR/.env with your production settings${NC}"
    echo -e "${YELLOW}⚠️  Required: GOOGLE_API_KEY, SECRET_KEY${NC}"
else
    echo -e "${GREEN}✅ Environment file already exists${NC}"
fi

# Create systemd service
if [ "$SYSTEMD_AVAILABLE" = true ]; then
    echo -e "${YELLOW}🔧 Creating systemd service...${NC}"
    
    sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null <<EOF
[Unit]
Description=LegalEase AI Backend
After=network.target

[Service]
Type=exec
User=$PRODUCTION_USER
Group=$PRODUCTION_GROUP
WorkingDirectory=$APP_DIR
Environment=PATH=$APP_DIR/venv/bin
ExecStart=$APP_DIR/venv/bin/gunicorn -w 4 -b 127.0.0.1:$BACKEND_PORT --timeout 120 --access-logfile $APP_DIR/logs/access.log --error-logfile $APP_DIR/logs/error.log app:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Create logs directory
    sudo mkdir -p "$APP_DIR/logs"
    sudo chown "$PRODUCTION_USER:$PRODUCTION_GROUP" "$APP_DIR/logs"
    
    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable $SERVICE_NAME
    
    echo -e "${GREEN}✅ Systemd service created and enabled${NC}"
fi

# Set up nginx reverse proxy
if [ "$NGINX_AVAILABLE" = true ]; then
    echo -e "${YELLOW}🌐 Setting up nginx reverse proxy...${NC}"
    
    sudo tee /etc/nginx/sites-available/$SERVICE_NAME > /dev/null <<EOF
server {
    listen 80;
    server_name _;
    
    # Frontend static files
    location / {
        root $APP_DIR/frontend;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Health check
    location /health {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_set_header Host \$host;
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
EOF

    # Enable site
    sudo ln -sf /etc/nginx/sites-available/$SERVICE_NAME /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default  # Remove default site
    
    # Test nginx configuration
    if sudo nginx -t; then
        sudo systemctl reload nginx
        echo -e "${GREEN}✅ Nginx configuration applied${NC}"
    else
        echo -e "${RED}❌ Nginx configuration test failed${NC}"
        exit 1
    fi
fi

# Set up firewall (if ufw is available)
if command -v ufw &> /dev/null; then
    echo -e "${YELLOW}🔥 Configuring firewall...${NC}"
    
    sudo ufw allow 22/tcp  # SSH
    sudo ufw allow 80/tcp  # HTTP
    sudo ufw allow 443/tcp # HTTPS
    
    echo -e "${GREEN}✅ Firewall configured${NC}"
fi

# Final setup
echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Edit $APP_DIR/.env with your production settings"
echo "2. Start the service: sudo systemctl start $SERVICE_NAME"
echo "3. Check status: sudo systemctl status $SERVICE_NAME"
echo "4. View logs: sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo -e "${BLUE}🌐 Access your application:${NC}"
if [ "$NGINX_AVAILABLE" = true ]; then
    echo "   Frontend: http://your-server-ip"
    echo "   Backend API: http://your-server-ip/api/"
else
    echo "   Backend: http://your-server-ip:$BACKEND_PORT"
    echo "   Frontend: Copy frontend files to your web server"
fi
echo ""
echo -e "${BLUE}🔧 Useful commands:${NC}"
echo "   Start service: sudo systemctl start $SERVICE_NAME"
echo "   Stop service: sudo systemctl stop $SERVICE_NAME"
echo "   Restart service: sudo systemctl restart $SERVICE_NAME"
echo "   View logs: sudo journalctl -u $SERVICE_NAME -f"
echo "   Check status: sudo systemctl status $SERVICE_NAME"
echo ""
echo -e "${YELLOW}⚠️  Important security notes:${NC}"
echo "   - Change the SECRET_KEY in .env"
echo "   - Set up SSL/TLS certificates for production"
echo "   - Configure proper firewall rules"
echo "   - Set up monitoring and logging"
echo "   - Regular security updates"
echo ""
echo -e "${GREEN}✅ LegalEase AI is ready for production!${NC}"
