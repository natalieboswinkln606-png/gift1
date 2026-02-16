const fs = require('fs');
const path = require('path');

const usersDir = path.join(__dirname, '..', 'public', 'users');
const exts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

try {
  const dirs = fs.readdirSync(usersDir, { withFileTypes: true }).filter(d => d.isDirectory());

  for (const dir of dirs) {
    const userDir = path.join(usersDir, dir.name);
    const configPath = path.join(userDir, 'config.json');
    const christmasDir = path.join(userDir, 'christmas');

    if (!fs.existsSync(configPath)) { console.log('SKIP ' + dir.name + ' (no config.json)'); continue; }
    if (!fs.existsSync(christmasDir)) { console.log('SKIP ' + dir.name + ' (no christmas/)'); continue; }

    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
      console.error(`ERROR [${dir.name}] Failed to parse config.json: ${err.message}`);
      continue;
    }

    const files = fs.readdirSync(christmasDir)
      .filter(f => exts.includes(path.extname(f).toLowerCase()))
      .sort()
      .map(f => 'christmas/' + f);

    const oldPhotos = config.christmasPhotos || [];
    config.christmasPhotos = files;

    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
    } catch (err) {
      console.error(`ERROR [${dir.name}] Failed to write config.json: ${err.message}`);
      continue;
    }

    const added = files.filter(f => !oldPhotos.includes(f));
    const removed = oldPhotos.filter(f => !files.includes(f));
    console.log(`[${dir.name}] ${files.length} photos (was ${oldPhotos.length}, +${added.length} -${removed.length})`);
    if (added.length) added.forEach(f => console.log('  + ' + f));
    if (removed.length) removed.forEach(f => console.log('  - ' + f));
  }
  console.log('Sync complete.');
} catch (err) {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
}
