#! /usr/bin/env bash

# Source this file to overwrite defaults MacOS preferences
#
# You can script most of the settings changes using the `defaults` command
# A manual way to figure out the actual keys/values that correspond to the UI preferences
# ```
# defaults read > ~/defaults.bak.txt
# # edit your preferences
# defaults read > ~/defaults.txt
# diff defaults.bak.txt defaults.txt
# ```
# 
# You can start by reviewing those config examples
# https://github.com/mathiasbynens/dotfiles/blob/main/.macos
# https://gist.github.com/bradp/bea76b16d3325f5c47d4#file-setup-sh-L136
# 


SCRIPTS_DIR=$(dirname $0)
ROOT_DIR=$(dirname $SCRIPTS_DIR)
DEFAULTS=$ROOT_DIR/logs/defaults.txt
DEFAULTS_BACKUP=$ROOT_DIR/logs/defaults.bak.txt

# ===================================== #
# Backup defaults (to compute diffs)
# ===================================== #
if [ -f $DEFAULTS_BACKUP ]; then
  echo -n "Do you want to override $DEFAULTS_BACKUP w. current defaults? "
  read response
  [ "y" == "$response" ] && defaults read > $DEFAULTS_BACKUP
else
  echo -n "Do you want to backup current defaults to $DEFAULTS_BACKUP? "
  read response
  [ "y" == "$response" ] && defaults read > $DEFAULTS_BACKUP
fi


# ===================================== #
# Close any open System Preferences panes, to prevent them from overriding
# settings we’re about to change
# ===================================== #
osascript -e 'tell application "System Preferences" to quit'


echo -n "Applying settings..."
source $ROOT_DIR/preferences/macos.plist
echo "done"


# ===================================== #
# Displaying diffs
# ===================================== #
if [ -f $DEFAULTS_BACKUP ]; then
  echo "Back up defaults to $DEFAULTS"
  defaults read > $DEFAULTS
  echo -n "Do you want to display diffs? "
  read response
  [ "y" == "$response" ] && diff $DEFAULTS_BACKUP $DEFAULTS
fi


# ===================================== #
# Kill affected applications
# ===================================== #
echo -n "Kill affected applications..."
for app in "Activity Monitor" \
	"Address Book" \
	"Calendar" \
	"cfprefsd" \
	"Contacts" \
	"Dock" \
	"Finder" \
	"Google Chrome Canary" \
	"Google Chrome" \
	"Mail" \
	"Messages" \
	"Opera" \
	"Photos" \
	"Safari" \
	"SizeUp" \
	"Spectacle" \
	"SystemUIServer" \
	"Terminal" \
	"Transmission" \
	"Tweetbot" \
	"Twitter" \
	"iCal"; do
	killall "${app}" &> /dev/null
done
echo "done"
echo "Note that some of these changes might require a logout/restart to take effect"
