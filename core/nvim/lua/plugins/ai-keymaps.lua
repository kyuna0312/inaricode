local keymap = vim.keymap.set

keymap("n", "<leader>ai", function()
    local buf = vim.api.nvim_create_buf(false, true)
    vim.api.nvim_buf_set_name(buf, "OpenCode")
    vim.api.nvim_open_win(buf, true, {
        relative = "editor",
        width = math.floor(vim.o.columns * 0.5),
        height = math.floor(vim.o.lines * 0.4),
        row = vim.o.lines - math.floor(vim.o.lines * 0.4) - 2,
        col = vim.o.columns - math.floor(vim.o.columns * 0.5),
        border = "rounded",
        title = " OpenCode AI ",
        title_pos = "center",
    })
    vim.fn.termopen("opencode", {
        on_exit = function()
            vim.api.nvim_buf_delete(buf, { force = true })
        end
    })
end, { noremap = true, silent = true, desc = "Open AI terminal" })

keymap("v", "<leader>ar", function()
    local lines = vim.fn.getline("'<", "'>")
    local selection = table.concat(lines, "\n")
    local cmd = string.format("echo '%s' | opencode refactor", vim.fn.shellescape(selection))
    vim.fn.system(cmd)
end, { noremap = true, silent = true, desc = "Refactor with AI" })

keymap("n", "<leader>af", function()
    local error_msg = vim.fn.getline(".")
    local cmd = string.format("echo '%s' | opencode fix", vim.fn.shellescape(error_msg))
    vim.fn.system(cmd)
end, { noremap = true, silent = true, desc = "Fix error with AI" })