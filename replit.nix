{ pkgs }: {
    deps = [
        pkgs.killall
        pkgs.nodejs
        pkgs.ruby_3_0
        pkgs.nodePackages.vscode-langservers-extracted
    ];
}