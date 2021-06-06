#! /usr/bin/env bash

# Recipe
# - check admin setup
# - setup dotfiles
# - install oh_my_zsh
# - update shell to zsh
# - set EMAIL
# - generate ssh key


set -e


#======== HELPERS =======#
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
echo "check admin setup"
command -v brew
command -v rcup
command -v direnv
command -v asdf


#===========================================#
# setup dotfiles
#===========================================#
echo "setup dotfiles"
[ -d "$HOME/.dotfiles" ] || mkdir $HOME/.dotfiles
rcup

for file in "envrc" \
            "envrc.local" \
            "gitconfig" \
            "gitignore_global" \
            "vimrc" \
            "zshrc" \
            "zshrc.local"
do
  if [ -L $HOME/.$file ]; then
    echo "$HOME/.$file is  symlink. Cannot process file."
  elif [ -f $HOME/.$file ]; then
    mkrc $HOME/.$file
  else
    touch $HOME/.dotfiles/$file
  fi
done
rcup
source .envrc.local
direnv allow .


#===========================================#
# install oh_my_zsh
#===========================================#
if ! [ -d .oh-my-zsh ]; then
  echo "install oh_my_zsh"
  sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
fi
append_to_zshrc 'export PATH="/usr/local/bin:$PATH"' 1
append_to_zshrc 'eval "$(direnv hook zsh)"' 1
append_to_zshrc 'source /usr/local/opt/asdf/asdf.sh' 1
append_to_zshrc 'source .zshrc.local' 1


#===========================================#
# update shell to zsh
#===========================================#
echo "update shell to $(command -v zsh)"
if [ "$SHELL" != '/usr/local/bin/zsh' ] ; then
  chsh -s "$(command -v zsh)" "$USER"
fi


#===========================================#
# set EMAIL
#===========================================#
if [ -z "$EMAIL" ];then
  echo -n "Define EMAIL = "
  read EMAIL
  echo "export EMAIL=$EMAIL" >> $HOME/.envrc.local
fi


#=======================#
# generate SSH_KEY (and source user.env to set $EMAIL)
#=======================#
echo "generate ssh key"
SSH_KEY=$HOME/.ssh/id_rsa
echo "Checking ssh key [ $SSH_KEY ]... "
[ -f $SSH_KEY ] && echo "OK" || ssh-keygen -f $SSH_KEY -N "" -C "$EMAIL"

SSH_PEM=$SSH_KEY.pub.pem
echo "Checking ssh public key [ $SSH_PEM ]... "
[ -f $SSH_PEM ] && echo "OK" || (ssh-keygen -f $SSH_KEY -e -m pem > $SSH_PEM)

