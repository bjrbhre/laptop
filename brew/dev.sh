# Setup
brew tap "universal-ctags/universal-ctags"

brew update
brew upgrade $(brew outdated)

# Binaries
brew install awscli@1
brew install --HEAD universal-ctags/universal-ctags/universal-ctags
brew install reattach-to-user-namespace
brew install the_silver_searcher
brew install tmux
brew install watch
brew install watchman
brew install gnupg
brew install ack
brew install entr

# Programming language prerequisites and package managers
brew install libyaml # should come after openssl
brew install coreutils
brew install yarn

# Databases
brew install redis

# Fix issue installing python 3.7.6
# See https://github.com/pyenv/pyenv/issues/1740
brew install zlib
brew install bzip2

# Manage multiple runtime versions with a single CLI tool
brew install asdf
asdf plugin add python
asdf plugin add nodejs

# Applications
# brew install --appdir="/Applications" amazon-workspaces
brew install --appdir="/Applications" aws-vault
brew install --appdir="/Applications" charles
brew install --appdir="/Applications" discord
brew install --appdir="/Applications" homebrew/cask/docker
# brew install --appdir="/Applications" figma
brew install --appdir="/Applications" insomnia
brew install --appdir="/Applications" microsoft-teams
# wget https://download.seald.io/download/Seald-2.7.0.dmg
brew install --appdir="/Applications" slack
brew install --appdir="/Applications" sublime-text
# brew install --appdir="/Applications" visual-studio-code

# Final cleanup
brew cleanup
