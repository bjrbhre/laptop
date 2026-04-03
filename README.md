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

```\n[ -d laptop ] || git clone git@github.com:bjrbhre/laptop.git
[ -d .dotfiles ] || ln -s laptop/dotfiles .dotfiles
./laptop/scripts/user_setup.sh
./laptop/brew/defaults.sh
./laptop/scripts/macos_preferences_setup.sh
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Third-Party Licenses

- **LazyVim**: This project includes configuration files derived from [LazyVim](https://github.com/LazyVim/LazyVim), which is licensed under the Apache License 2.0. See [config/nvim/LICENSE](config/nvim/LICENSE) for the full Apache License text.

- **Anthropic skill-creator**: The skill-creator skill ([agents/skills/skill-creator/](agents/skills/skill-creator/)) is inspired by and derived from [Anthropic's skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator), which is licensed under the Apache License 2.0.
