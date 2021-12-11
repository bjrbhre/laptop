# Setup
brew update
brew upgrade $(brew outdated)

# Applications
brew install --appdir="/Applications" dropbox
# brew install --appdir="/Applications" goldencheetah
# brew install --appdir="/Applications" google-backup-and-sync
# brew install --appdir="/Applications" google-chrome
brew install --appdir="/Applications" klavaro
brew install --appdir="/Applications" molotov
brew install --appdir="/Applications" musescore
brew install --appdir="/Applications" nextcloud
brew install --appdir="/Applications" scratch
brew install --appdir="/Applications" steam
# brew install --appdir="/Applications" vlc

# Final cleanup
brew cleanup
