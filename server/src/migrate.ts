import { config } from './config.js';
import { migrate, openDatabase } from './db.js';
import { seedRolesAndSettings } from './seed.js';

const db = openDatabase(config.databasePath);
const version = migrate(db);
seedRolesAndSettings(db);
db.close();
console.log(`[migrate] database ready (schema v${version}) at ${config.databasePath}`);
