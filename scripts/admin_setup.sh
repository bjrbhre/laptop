#! /usr/bin/env bash

# Recipe
# - update system software
# - install command line tools
# - install brew
# - update shells


#======== HELPERS =======#
fancy_echo() {
  local fmt="$1"; shift

  # shellcheck disable=SC2059
  printf "\\n$fmt\\n" "$@"
}
#=======================#


#=======================#
# update system software
#=======================#
fancy_echo "Updating system software...\n"
if [ "$(uname)" = "Darwin" ];then
  sudo softwareupdate --install --all
else
  sudo apt-get update -y
fi


#===========================#
# install command line tools
#===========================#

if [ "$(uname)" = "Darwin" ];then
  developer_dir=$(xcode-select -print-path 2>/dev/null)
  if [ "x" = "x$developer_dir" ];then
    fancy_echo "Installing the Command Line Tools (expect a GUI popup)...\n"
    sudo xcode-select --install
    fancy_echo "Press any key when the installation has completed..."
    read text
  else
    fancy_echo "Command Line Tools already installed.\n"
  fi
fi


# shellcheck disable=SC2154
trap 'ret=$?; test $ret -ne 0 && printf "failed\n\n" >&2; exit $ret' EXIT
# exit on error
set -e # error mode causes failure is there is no software update (:up:)


#===========================#
# install brew
#===========================#
HOMEBREW_PREFIX="/usr/local"
if [ -d "$HOMEBREW_PREFIX" ]; then
  if ! [ -r "$HOMEBREW_PREFIX" ]; then
    sudo chown -R "$LOGNAME:admin" /usr/local
  fi
else
  sudo mkdir "$HOMEBREW_PREFIX"
  sudo chflags norestricted "$HOMEBREW_PREFIX"
  sudo chown -R "$LOGNAME:admin" "$HOMEBREW_PREFIX"
fi

if ! command -v brew >/dev/null; then
  fancy_echo "Installing Homebrew ..."
    /bin/bash -c \
      "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
fi
export PATH="/usr/local/bin:$PATH"

if brew list | grep -Fq brew-cask; then
  fancy_echo "Uninstalling old Homebrew-Cask ..."
  brew uninstall --force brew-cask
fi

# Authorize other admins
sudo chmod -R g+w /usr/local/Homebrew
sudo chmod -R g+w /usr/local/share

fancy_echo "Installing brew basic packages"
touch $HOME/.laptop.local
grep "brew install zsh" $HOME/.laptop.local > /dev/null || (echo brew install zsh >> $HOME/.laptop.local) 
grep "brew install rcm" $HOME/.laptop.local > /dev/null || (echo brew install rcm >> $HOME/.laptop.local) 
grep "brew install direnv" $HOME/.laptop.local > /dev/null || (echo brew install direnv >> $HOME/.laptop.local) 
grep "brew install asdf" $HOME/.laptop.local > /dev/null || (echo brew install asdf >> $HOME/.laptop.local) 
source $HOME/.laptop.local

# Fix Insecure completion-dependent directories
# compaudit | xargs chmod g-w,o-w
# chmod g-w,o-w /usr/local/share/zsh/site-functions
# chmod g-w,o-w /usr/local/share/zsh


#===========================#
# update shells
#===========================#
update_shells() {
  local shell_path;
  shell_path="$(command -v zsh)"

  fancy_echo "Updating /etc/shells ..."
  if ! grep "$shell_path" /etc/shells > /dev/null 2>&1 ; then
    fancy_echo "Adding '$shell_path' to /etc/shells"
    sudo sh -c "echo $shell_path >> /etc/shells"
  fi
}

update_shells

