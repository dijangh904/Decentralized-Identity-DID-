const mongoose = require('mongoose');
const Migration = require('../models/Migration');
const fs = require('fs');
const path = require('path');
const { logger } = require('../middleware');

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

class MigrationRunner {
  async ensureMigrationsDir() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    }
  }

  async getAppliedMigrations() {
    const migrations = await Migration.find().sort({ version: 1 });
    return migrations.map(m => m.version);
  }

  async runMigrations() {
    await this.ensureMigrationsDir();
    const appliedVersions = await this.getAppliedMigrations();
    const latestVersion = appliedVersions.length > 0 ? Math.max(...appliedVersions) : 0;

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.js'))
      .sort();

    for (const file of files) {
      const version = parseInt(file.split('_')[0]);
      if (version > latestVersion) {
        logger.info(`Applying migration: ${file}`);
        const migration = require(path.join(MIGRATIONS_DIR, file));
        
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          await migration.up();
          await Migration.create([{ version, name: file }], { session });
          await session.commitTransaction();
          logger.info(`Successfully applied migration: ${file}`);
        } catch (error) {
          await session.abortTransaction();
          logger.error(`Failed to apply migration ${file}:`, error);
          throw error;
        } finally {
          session.endSession();
        }
      }
    }
  }

  async rollbackLatest() {
    const latestMigration = await Migration.findOne().sort({ version: -1 });
    if (!latestMigration) {
      logger.info('No migrations to rollback');
      return;
    }

    const file = latestMigration.name;
    logger.info(`Rolling back migration: ${file}`);
    const migration = require(path.join(MIGRATIONS_DIR, file));

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await migration.down();
      await Migration.deleteOne({ _id: latestMigration._id }, { session });
      await session.commitTransaction();
      logger.info(`Successfully rolled back migration: ${file}`);
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Failed to rollback migration ${file}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new MigrationRunner();
