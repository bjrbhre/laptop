return {
  "yetone/avante.nvim",
  event = "VeryLazy",
  lazy = false,
  version = false,
  opts = {
    -- On dit à Avante d'utiliser notre fournisseur personnalisé ci-dessous
    provider = "openrouter",
    auto_suggestions_provider = "openrouter",

    vendors = {
      openrouter = {
        __inherited_from = "openai",
        endpoint = "https://openrouter.ai/api/v1",
        api_key_name = "OPENROUTER_API_KEY",
        -- Vous pouvez changer ce modèle à la volée selon vos besoins !
        model = "anthropic/claude-3.7-sonnet",
      },
    },
  },
  build = "make",
  dependencies = {
    "stevearc/dressing.nvim",
    "nvim-lua/plenary.nvim",
    "MunifTanjim/nui.nvim",
  },
}
