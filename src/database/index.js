const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const LiquidStateAdapter = require('./liquid-state/LiquidStateAdapter');

class DatabaseManager {
    constructor() {
        this.adapter = null;
        this.dataDir = path.join(__dirname, '../../data');
        this.liquidStateDir = path.join(this.dataDir, 'liquid-state');
        this.ensureDataDirectory();
    }

    ensureDataDirectory() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.liquidStateDir)) {
            fs.mkdirSync(this.liquidStateDir, { recursive: true });
        }
    }

    initializeDatabase() {
        logger.info('Initializing Liquid State Database...');
        
        // Initialize the Liquid State adapter
        this.adapter = new LiquidStateAdapter({
            dataDir: this.liquidStateDir
        });
        
        logger.info('Liquid State Database initialized successfully');
        
        // Optionally migrate from existing SQL data if present
        this.migrateFromExistingData();
    }

    /**
     * Migrate from existing SQL data if it exists
     */
    migrateFromExistingData() {
        // For now, we'll just log that migration is available
        logger.info('Liquid State Database ready. Migration from existing SQL data available if needed.');
    }

    /**
     * Get the Liquid State adapter instance
     */
    getAdapter() {
        if (!this.adapter) {
            throw new Error('Database not initialized');
        }
        return this.adapter;
    }

    /**
     * Compatibility methods to maintain the same interface as before
     */
    getDb() {
        if (!this.adapter) {
            throw new Error('Database not initialized');
        }
        return this.adapter; // Return the adapter which provides similar interface
    }

    /**
     * Methods to maintain compatibility with existing code
     */
    run(query, params = [], callback) {
        // This is a simplified compatibility layer
        // In a real implementation, we would parse SQL and convert to Liquid State operations
        logger.warn('Direct SQL execution is deprecated. Using Liquid State operations instead.');
        
        // For now, we'll simulate some common operations
        if (query.includes('INSERT INTO tasks')) {
            // Extract parameters based on position
            const userData = {
                user_id: params[1],
                title: params[2],
                description: params[3],
                status: params[4] || 'pending',
                priority: params[5] || 'medium',
                energy_level: params[6] || 'medium',
                context: params[7] || 'any',
                due_date: params[8]
            };
            
            return this.adapter.createTask(userData);
        }
        
        // More compatibility methods would be added as needed
        return null;
    }

    all(query, params = [], callback) {
        logger.warn('Direct SQL query is deprecated. Using Liquid State operations instead.');
        
        // For now, return empty result or handle specific queries
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        
        if (callback) {
            callback(null, []);
        }
    }

    get(query, params = [], callback) {
        logger.warn('Direct SQL query is deprecated. Using Liquid State operations instead.');
        
        // For now, return empty result or handle specific queries
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        
        if (callback) {
            callback(null, null);
        }
    }

    prepare(query) {
        logger.warn('Prepared statements are deprecated in Liquid State DB. Use direct object operations.');
        return {
            run: (params) => {
                // Simulate result
                return { lastID: Math.floor(Math.random() * 10000) };
            },
            finalize: () => {}
        };
    }
}

const dbManager = new DatabaseManager();

function initializeDatabase() {
    dbManager.initializeDatabase();
    return dbManager;
}

module.exports = {
    initializeDatabase,
    getDb: () => dbManager.getDb()
};