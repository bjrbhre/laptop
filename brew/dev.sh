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
brew install watchman

# Programming language prerequisites and package managers
brew install libyaml # should come after openssl
brew install coreutils
brew install yarn

# Manage multiple runtime versions with a single CLI tool
brew install asdf
asdf plugin add python
asdf plugin add nodejs

# Applications
# brew install --appdir="/Applications" amazon-workspaces
brew install --appdir="/Applications" aws-vault
# brew install --appdir="/Applications" charles
brew install --appdir="/Applications" discord
brew install --appdir="/Applications" docker
# brew install --appdir="/Applications" figma
brew install --appdir="/Applications" insomnia
brew install --appdir="/Applications" microsoft-teams

brew install --appdir="/Applications" slack
brew install --appdir="/Applications" sublime-text
# brew install --appdir="/Applications" visual-studio-code

# Final cleanup
brew cleanup
