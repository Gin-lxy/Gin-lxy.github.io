// Hexo loads every file in scripts/ as JavaScript, including shell scripts.
// Keep the regular CLI behavior while loading only this site's JavaScript hooks.
const fs = require('node:fs');
const path = require('node:path');
const Hexo = require('hexo');

const initialize = Hexo.prototype.init;
Hexo.prototype.init = function (...args) {
  this.script_dir = '';
  return initialize.apply(this, args).then(async () => {
    const scriptDirectory = path.join(this.base_dir, 'scripts');
    for (const entry of fs.readdirSync(scriptDirectory, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.js')) {
        await this.loadPlugin(path.join(scriptDirectory, entry.name));
      }
    }
  });
};

require('hexo-cli/dist/hexo')();
