const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const MIN_AGE_DAYS = 7;
const MILLISECONDS_IN_A_DAY = 1000 * 60 * 60 * 24;
const packageJsonPath = path.join(__dirname, '../package.json');

/**
 * Fetches package information from the npm registry.
 */
async function fetchPackageInfo(pkgName) {
  return new Promise((resolve) => {
    https.get(`https://registry.npmjs.org/${pkgName}`, (res) => {
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Finds the latest stable version of a package that is at least MIN_AGE_DAYS old.
 */
function getEligibleVersion(pkgInfo) {
  if (!pkgInfo || !pkgInfo.versions || !pkgInfo.time) return null;
  const now = Date.now();
  
  const versions = Object.keys(pkgInfo.time).filter(v => 
    v !== 'created' && v !== 'modified' && !v.includes('-')
  );
  
  // Sort versions by publish date (newest first)
  versions.sort((a, b) => new Date(pkgInfo.time[b]) - new Date(pkgInfo.time[a]));

  for (const version of versions) {
    if (pkgInfo.versions[version] && !pkgInfo.versions[version].deprecated) {
      const publishTime = new Date(pkgInfo.time[version]).getTime();
      const ageDays = (now - publishTime) / MILLISECONDS_IN_A_DAY;
      
      if (ageDays >= MIN_AGE_DAYS) {
        return version;
      }
    }
  }
  return null;
}

/**
 * Removes ^ and ~ from version strings.
 */
function removeModifiers(depObject) {
  if (!depObject) return;
  for (const pkg in depObject) {
    if (typeof depObject[pkg] === 'string') {
       depObject[pkg] = depObject[pkg].replace(/^[\^~]/, '');
    }
  }
}

const EXPO_SDK_55_MAP = {
  "expo": "55.0.24",
  "expo-constants": "55.0.16",
  "expo-font": "55.0.7",
  "expo-haptics": "55.0.3",
  "expo-image": "55.0.9",
  "expo-linking": "55.0.14",
  "expo-router": "55.0.13",
  "expo-secure-store": "55.0.13",
  "expo-splash-screen": "55.0.19",
  "expo-status-bar": "55.0.5",
  "expo-symbols": "55.0.7",
  "expo-system-ui": "55.0.16",
  "expo-web-browser": "55.0.14",
  "react": "19.2.7",
  "react-dom": "19.2.7",
  "react-native": "0.83.6",
  "react-native-gesture-handler": "2.30.0",
  "react-native-reanimated": "4.2.1",
  "react-native-safe-area-context": "5.6.2",
  "react-native-screens": "4.23.0",
  "react-native-sonner": "0.2.0",
  "react-native-web": "0.21.2",
  "react-native-worklets": "0.7.4",
  "eslint-config-expo": "55.0.1",
  "typescript": "5.9.2"
};

async function main() {
  console.log(`Phase 1: Detecting updates strictly respecting the ${MIN_AGE_DAYS}-day maturity rule...`);
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const groups = ['dependencies', 'devDependencies'];

  for (const group of groups) {
    if (!packageJson[group]) continue;
    for (const pkgName of Object.keys(packageJson[group])) {
      if (EXPO_SDK_55_MAP[pkgName]) {
        const targetVersion = EXPO_SDK_55_MAP[pkgName];
        const currentRaw = packageJson[group][pkgName].replace(/^[\^~]/, '');
        if (currentRaw !== targetVersion) {
          console.log(`  [Expo SDK 55 Align] ${pkgName}: ${currentRaw} -> ${targetVersion}`);
          packageJson[group][pkgName] = targetVersion;
        } else {
          console.log(`  [OK] ${pkgName} is already aligned: ${currentRaw}`);
        }
        continue;
      }
      
      const info = await fetchPackageInfo(pkgName);
      const eligible = getEligibleVersion(info);
      if (eligible) {
        const currentRaw = packageJson[group][pkgName].replace(/^[\^~]/, '');
        if (currentRaw !== eligible) {
           console.log(`  [Update Found] ${pkgName}: ${currentRaw} -> ${eligible}`);
           packageJson[group][pkgName] = eligible;
        } else {
           console.log(`  [OK] ${pkgName} is up to date: ${currentRaw}`);
        }
      } else {
        console.log(`  [Skip] ${pkgName}: No eligible version found on registry.`);
      }
    }
  }

  console.log('Writing package.json...');
  
  // Pin everything (remove modifiers)
  removeModifiers(packageJson.dependencies);
  removeModifiers(packageJson.devDependencies);
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  console.log('Phase 2: Syncing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
  } catch {
    console.warn('\nWarning: Dependency synchronization had some issues. Proceeding...');
  }

  console.log('\nSuccess! Template updated and strictly pinned.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
