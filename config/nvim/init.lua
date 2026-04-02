-- bootstrap lazy.nvim, LazyVim and your plugins
require("config.lazy")

-- ==========================================
-- WINDOW NAVIGATION (The "Pro" Setup)
-- ==========================================

-- Use Ctrl + h/j/k/l to move between splits
vim.keymap.set("n", "<C-h>", "<C-w>h", { desc = "Move to left split" })
vim.keymap.set("n", "<C-j>", "<C-w>j", { desc = "Move to bottom split" })
vim.keymap.set("n", "<C-k>", "<C-w>k", { desc = "Move to top split" })
vim.keymap.set("n", "<C-l>", "<C-w>l", { desc = "Move to right split" })

-- Quick split shortcuts
vim.keymap.set("n", "<leader>v", ":vsplit<CR>", { desc = "Vertical split" })
vim.keymap.set("n", "<leader>s", ":split<CR>", { desc = "Horizontal split" })

-- Optional: Show line numbers (standard for coding)
vim.opt.number = true
vim.opt.relativenumber = true
