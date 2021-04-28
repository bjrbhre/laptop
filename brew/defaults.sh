# Setup
brew tap "homebrew/services"

brew update
brew upgrade $(brew outdated)

# Binaries
brew install git
brew install openssl
brew install rcm
brew install vim
brew install zsh
brew install direnv
brew install tree
brew install wget
brew install curl
brew install gnu-sed --with-default-names
brew install gnu-tar
brew install jq

# Image manipulation
brew install imagemagick

# Applications
brew install --appdir="/Applications" 1password
brew install --appdir="/Applications" alfred
#brew install --appdir="/Applications" clamav
brew install --appdir="/Applications" caffeine
brew install --appdir="/Applications" cryptomator
brew install --appdir="/Applications" firefox
brew install --appdir="/Applications" google-drive
brew install --appdir="/Applications" iterm2
brew install --appdir="/Applications" istat-menus
brew install --appdir="/Applications" rectangle
# brew install --appdir="/Applications" libreoffice
brew install --appdir="/Applications" zoom

# Final cleanup
brew cleanup