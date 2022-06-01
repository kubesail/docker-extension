# KubeSail Docker Extension

- Install Docker 4.8.0 or newer which has beta extension support
- Install the extension CLI from https://github.com/docker/extensions-sdk/releases/tag/v0.2.4
  - ```bash
       tar -xvzf desktop-extension-cli-darwin-amd64.tar.gz
       mkdir -p ~/.docker/cli-plugins
       mv docker-extension ~/.docker/cli-plugins```
- make && make install
