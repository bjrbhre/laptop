#! /usr/bin/env bash

# Recipe
# - check admin setup
# - install oh_my_zsh
# - setup dotfiles
# - update shell to zsh
# - set EMAIL
# - generate ssh key


set -e


#======== HELPERS =======#
fancy_echo() {
  local fmt="$1"; shift

  # shellcheck disable=SC2059
  printf "\\n$fmt\\n" "$@"
}

append_to_zshrc() {
  local text="$1" zshrc
  local skip_new_line="${2:-0}"

  # if [ -w "$HOME/.zshrc.local" ]; then
  #   zshrc="$HOME/.zshrc.local"
  # else
  #   zshrc="$HOME/.zshrc"
  # fi  
  
  zshrc="$HOME/.zshrc"

  if ! grep -Fqs "$text" "$zshrc"; then
    if [ "$skip_new_line" -eq 1 ]; then
      printf "%s\\n" "$text" >> "$zshrc"
    else
      printf "\\n%s\\n" "$text" >> "$zshrc"
    fi
  fi
}
#=======================#


#===========================================#
# check admin setup
#===========================================#
# make sure you run admin_setup.sh (as admin)
# this should have installed the following
fancy_echo "check admin setup"
command -v brew
command -v rcup
command -v direnv
command -v asdf


#===========================================#
# install oh_my_zsh
#===========================================#
if ! [ -d .oh-my-zsh ]; then
  fancy_echo "install oh_my_zsh"
  sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
fi
append_to_zshrc 'export PATH="/usr/local/bin:$PATH"' 1
append_to_zshrc 'eval "$(direnv hook zsh)"' 1
append_to_zshrc 'source /usr/local/opt/asdf/asdf.sh' 1
append_to_zshrc 'source .zshrc.local' 1


#===========================================#
# setup dotfiles
#===========================================#
fancy_echo "setup dotfiles"
touch $HOME/.zshrc
touch $HOME/.envrc
touch $HOME/.zshrc.local
touch $HOME/.laptop.local

[ -d "$HOME/.dotfiles" ] || mkdir $HOME/.dotfiles
[ -f "$HOME/.dotfiles/zshrc" ] || cp $HOME/.zshrc $HOME/.dotfiles/zshrc
[ -f "$HOME/.dotfiles/envrc" ] || cp $HOME/.envrc $HOME/.dotfiles/envrc
[ -f "$HOME/.dotfiles/zshrc.local" ] || cp $HOME/.zshrc.local $HOME/.dotfiles/zshrc.local
[ -f "$HOME/.dotfiles/laptop.local" ] || cp $HOME/.laptop.local $HOME/.dotfiles/laptop.local
rcup
direnv allow .


#===========================================#
# update shell to zsh
#===========================================#
fancy_echo "update shell to $(command -v zsh)"
if [ "$SHELL" != '/usr/local/bin/zsh' ] ; then
  chsh -s "$(command -v zsh)" "$USER"
fi


#===========================================#
# set EMAIL
#===========================================#
if [ -z "$EMAIL" ];then
  echo -n "Define EMAIL = "
  read EMAIL
  echo "export EMAIL=$EMAIL" >> $HOME/.envrc
fi


#=======================#
# generate SSH_KEY (and source user.env to set $EMAIL)
#=======================#
fancy_echo "generate ssh key"
SSH_KEY=$HOME/.ssh/id_rsa
fancy_echo "Checking ssh key [ $SSH_KEY ]... "
[ -f $SSH_KEY ] && echo "OK" || ssh-keygen -f $SSH_KEY -N "" -C "$EMAIL"

SSH_PEM=$SSH_KEY.pub.pem
fancy_echo "Checking ssh public key [ $SSH_PEM ]... "
[ -f $SSH_PEM ] && echo "OK" || (ssh-keygen -f $SSH_KEY -e -m pem > $SSH_PEM)

