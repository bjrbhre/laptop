# Laptop Setup

Inspired by [thoughtbot/laptop](https://github.com/thoughtbot/laptop)


## 🍏 Mac OS

### Bootable Installer

Here is a guide on how to create a bootable installer for MacOS => [link](https://support.apple.com/HT201372)


### Admin Setup

Login to your root account and run

```
curl --remote-name https://raw.githubusercontent.com/bjrbhre/laptop/master/scripts/admin_setup.sh
bash admin_setup.sh
```


### User Setup

Login as user (with admin privileges) and run

```
git clone git@github.com:bjrbhre/laptop.git
ln -s laptop/dotfiles .dotfiles
cd laptop
./scripts/user_setup.sh
./brew/defaults.sh
./scripts/macos_preferences_setup.sh
```
