const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '../..');
const packageJsonPath =
  process.env['PKG_JSON_PATH'] ?
    path.resolve(process.cwd(), process.env['PKG_JSON_PATH'])
  : path.join(repositoryRoot, 'package.json');
const relativePackageJsonPath = path.relative(repositoryRoot, packageJsonPath);

if (relativePackageJsonPath.startsWith('..') || path.isAbsolute(relativePackageJsonPath)) {
  throw new Error('PKG_JSON_PATH must resolve within the repository.');
}

const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

function processExportMap(m) {
  for (const key in m) {
    const value = m[key];
    if (typeof value === 'string') m[key] = value.replace(/^\.\/dist\//, './');
    else processExportMap(value);
  }
}
processExportMap(pkgJson.exports);

for (const key of ['types', 'main', 'module']) {
  if (typeof pkgJson[key] === 'string') pkgJson[key] = pkgJson[key].replace(/^(\.\/)?dist\//, './');
}
// Fix bin paths if present
if (pkgJson.bin) {
  for (const key in pkgJson.bin) {
    if (typeof pkgJson.bin[key] === 'string') {
      pkgJson.bin[key] = pkgJson.bin[key].replace(/^(\.\/)?dist\//, './');
    }
  }
}

delete pkgJson.devDependencies;
delete pkgJson.scripts.prepack;
delete pkgJson.scripts.prepublishOnly;
delete pkgJson.scripts.prepare;

console.log(JSON.stringify(pkgJson, null, 2));
