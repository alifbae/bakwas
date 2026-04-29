#!/bin/bash
# Quick script to upgrade yt-dlp to the latest version

echo "Upgrading yt-dlp to the latest version..."
pip install --upgrade yt-dlp

echo ""
echo "Current yt-dlp version:"
yt-dlp --version

echo ""
echo "Done! Restart your Flask app for changes to take effect."
