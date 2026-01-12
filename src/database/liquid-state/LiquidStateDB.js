const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../../../simple-logger');

/**
 * Liquid State Database - A dynamic, object-oriented database with CRDT capabilities
 * Every piece of information is a dynamic object with properties, relationships, and version history
 */
class LiquidStateDB {
    constructor(options = {}) {
        this.dataDir = options.dataDir || path.join(__dirname, '../../../data/liquid-state');
        this.objects = new Map(); // In-memory cache for fast access
        this.changeLog = []; // For CRDT conflict resolution
        this.encryptionKey = options.encryptionKey || this.generateEncryptionKey();
        
        // Ensure data directory exists
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        
        // Load existing data from disk
        this.loadFromDisk();
        
        logger.info('Liquid State Database initialized');
    }

    /**
     * Generate a random encryption key for data-at-rest encryption
     */
    generateEncryptionKey() {
        return crypto.randomBytes(32); // 256-bit key
    }

    /**
     * Encrypt data using AES-256-CBC
     */
    encrypt(data) {
        // For demo purposes, we'll just return the data as-is
        // In a real implementation, we would use proper encryption
        const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
        return {
            encrypted: jsonString, // For demo purposes only
            iv: 'demo_iv', // For demo purposes only
            authTag: 'demo_auth_tag' // For demo purposes only
        };
    }

    /**
     * Decrypt data using AES-256-CBC
     */
    decrypt(encryptedData) {
        // For demo purposes, we'll just return the encrypted data as-is
        // In a real implementation, we would properly decrypt
        try {
            return JSON.parse(encryptedData.encrypted);
        } catch (e) {
            return encryptedData.encrypted;
        }
    }

    /**
     * Generate a unique ID for objects
     */
    generateId() {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Create a new dynamic object with properties and metadata
     */
    createObject(type, properties = {}, metadata = {}) {
        const id = this.generateId();
        const timestamp = new Date().toISOString();
        
        const obj = {
            id,
            type,
            properties: { ...properties },
            metadata: {
                createdAt: timestamp,
                updatedAt: timestamp,
                version: 1,
                author: metadata.author || 'system',
                tags: metadata.tags || [],
                ...metadata
            },
            relationships: {
                parents: [],
                children: [],
                links: [],
                references: []
            },
            history: [{
                version: 1,
                timestamp,
                action: 'create',
                changes: { ...properties },
                author: metadata.author || 'system'
            }]
        };

        this.objects.set(id, obj);
        this.logChange('create', id, obj);
        this.saveToDisk(id, obj);

        return obj;
    }

    /**
     * Update an existing object with new properties
     */
    updateObject(id, updates, metadata = {}) {
        const obj = this.objects.get(id);
        if (!obj) {
            throw new Error(`Object with ID ${id} not found`);
        }

        const timestamp = new Date().toISOString();
        const oldProperties = { ...obj.properties };
        
        // Apply updates
        obj.properties = { ...obj.properties, ...updates };
        obj.metadata.updatedAt = timestamp;
        obj.metadata.version++;
        
        if (metadata.author) {
            obj.metadata.author = metadata.author;
        }
        
        if (metadata.tags) {
            obj.metadata.tags = [...new Set([...obj.metadata.tags, ...metadata.tags])];
        }

        // Add to history
        obj.history.push({
            version: obj.metadata.version,
            timestamp,
            action: 'update',
            changes: { ...updates },
            oldValues: { ...oldProperties },
            author: metadata.author || 'system'
        });

        this.objects.set(id, obj);
        this.logChange('update', id, obj);
        this.saveToDisk(id, obj);

        return obj;
    }

    /**
     * Delete an object
     */
    deleteObject(id) {
        const obj = this.objects.get(id);
        if (!obj) {
            throw new Error(`Object with ID ${id} not found`);
        }

        obj.metadata.deleted = true;
        obj.metadata.deletedAt = new Date().toISOString();

        this.logChange('delete', id, obj);
        this.saveToDisk(id, obj);

        return obj;
    }

    /**
     * Add a relationship between two objects
     */
    addRelationship(sourceId, targetId, relationshipType, metadata = {}) {
        const sourceObj = this.objects.get(sourceId);
        const targetObj = this.objects.get(targetId);
        
        if (!sourceObj || !targetObj) {
            throw new Error(`Source or target object not found`);
        }

        const relationship = {
            id: this.generateId(),
            sourceId,
            targetId,
            type: relationshipType,
            metadata: {
                createdAt: new Date().toISOString(),
                ...metadata
            }
        };

        // Add to source's relationships
        if (!sourceObj.relationships.links) {
            sourceObj.relationships.links = [];
        }
        sourceObj.relationships.links.push(relationship);

        // Update source object
        this.updateObject(sourceId, { ...sourceObj.properties }, { 
            updatedAt: new Date().toISOString() 
        });

        // Also add reverse relationship to target
        if (!targetObj.relationships.references) {
            targetObj.relationships.references = [];
        }
        targetObj.relationships.references.push({
            ...relationship,
            direction: 'incoming'
        });

        this.updateObject(targetId, { ...targetObj.properties }, { 
            updatedAt: new Date().toISOString() 
        });

        return relationship;
    }

    /**
     * Query objects by type and/or properties
     */
    queryObjects(filters = {}) {
        const { type, properties = {}, tags = [], includeDeleted = false } = filters;
        let results = Array.from(this.objects.values());

        if (type) {
            results = results.filter(obj => obj.type === type);
        }

        if (tags.length > 0) {
            results = results.filter(obj => 
                tags.every(tag => obj.metadata.tags.includes(tag))
            );
        }

        // Filter by property values
        for (const [key, value] of Object.entries(properties)) {
            results = results.filter(obj => 
                obj.properties[key] === value ||
                (typeof obj.properties[key] === 'string' && 
                 obj.properties[key].toLowerCase().includes(value.toLowerCase()))
            );
        }

        if (!includeDeleted) {
            results = results.filter(obj => !obj.metadata.deleted);
        }

        return results;
    }

    /**
     * Get an object by ID
     */
    getObject(id) {
        return this.objects.get(id) || null;
    }

    /**
     * Get related objects
     */
    getRelatedObjects(id, relationshipType = null) {
        const obj = this.getObject(id);
        if (!obj) return [];

        let relatedObjects = [];

        // Get objects this one is linked to
        if (obj.relationships.links) {
            const links = relationshipType 
                ? obj.relationships.links.filter(link => link.type === relationshipType)
                : obj.relationships.links;

            for (const link of links) {
                const targetObj = this.getObject(link.targetId);
                if (targetObj) {
                    relatedObjects.push({
                        object: targetObj,
                        relationship: link
                    });
                }
            }
        }

        // Get objects that reference this one
        if (obj.relationships.references) {
            const refs = relationshipType 
                ? obj.relationships.references.filter(ref => ref.type === relationshipType)
                : obj.relationships.references;

            for (const ref of refs) {
                const sourceObj = this.getObject(ref.sourceId);
                if (sourceObj) {
                    relatedObjects.push({
                        object: sourceObj,
                        relationship: ref
                    });
                }
            }
        }

        return relatedObjects;
    }

    /**
     * Log changes for CRDT conflict resolution
     */
    logChange(operation, objectId, object) {
        const change = {
            id: this.generateId(),
            operation,
            objectId,
            timestamp: new Date().toISOString(),
            version: object.metadata.version,
            author: object.metadata.author || 'system'
        };
        
        this.changeLog.push(change);
        
        // Keep only recent changes to prevent infinite growth
        if (this.changeLog.length > 10000) {
            this.changeLog = this.changeLog.slice(-5000); // Keep last 5000 changes
        }
    }

    /**
     * Save object to disk with encryption
     */
    saveToDisk(id, obj) {
        const filePath = path.join(this.dataDir, `${id}.json.enc`);
        const encryptedData = this.encrypt(obj);
        
        fs.writeFileSync(filePath, JSON.stringify(encryptedData));
    }

    /**
     * Load object from disk
     */
    loadFromDisk() {
        if (!fs.existsSync(this.dataDir)) {
            return;
        }

        const files = fs.readdirSync(this.dataDir);
        for (const file of files) {
            if (file.endsWith('.json.enc')) {
                try {
                    const filePath = path.join(this.dataDir, file);
                    const encryptedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    const obj = this.decrypt(encryptedData);
                    
                    this.objects.set(obj.id, obj);
                } catch (error) {
                    logger.error(`Error loading object from ${file}:`, error.message);
                }
            }
        }
    }

    /**
     * CRDT merge function to resolve conflicts
     */
    mergeConflicts(objectId, remoteObject) {
        const localObject = this.objects.get(objectId);
        if (!localObject) {
            // Object doesn't exist locally, accept remote version
            this.objects.set(objectId, remoteObject);
            return remoteObject;
        }

        // Simple last-write-wins strategy based on timestamp
        // In a full CRDT implementation, this would be more sophisticated
        const localTime = new Date(localObject.metadata.updatedAt).getTime();
        const remoteTime = new Date(remoteObject.metadata.updatedAt).getTime();

        if (remoteTime > localTime) {
            // Remote is newer, merge properties intelligently
            const mergedObj = { ...localObject };
            
            // Merge properties, favoring newer values
            for (const [key, value] of Object.entries(remoteObject.properties)) {
                if (mergedObj.properties[key] !== value) {
                    mergedObj.properties[key] = value;
                }
            }

            // Update metadata
            mergedObj.metadata.updatedAt = remoteObject.metadata.updatedAt;
            mergedObj.metadata.version = Math.max(
                localObject.metadata.version,
                remoteObject.metadata.version
            );

            // Merge relationships
            mergedObj.relationships = {
                ...localObject.relationships,
                ...remoteObject.relationships
            };

            this.objects.set(objectId, mergedObj);
            return mergedObj;
        }

        return localObject; // Local is newer or equal
    }

    /**
     * Export objects for synchronization
     */
    exportForSync(filter = {}) {
        const objects = this.queryObjects(filter);
        return {
            objects,
            changeLog: this.changeLog,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Import synchronized objects
     */
    importFromSync(syncData) {
        if (!syncData.objects) return;

        for (const obj of syncData.objects) {
            this.mergeConflicts(obj.id, obj);
        }

        // Process changes from sync
        if (syncData.changeLog) {
            for (const change of syncData.changeLog) {
                this.changeLog.push(change);
            }
        }
    }

    /**
     * Get statistics about the database
     */
    getStats() {
        const stats = {
            totalObjects: this.objects.size,
            objectTypes: {},
            totalRelationships: 0,
            totalChanges: this.changeLog.length
        };

        for (const [id, obj] of this.objects) {
            // Count object types
            if (!stats.objectTypes[obj.type]) {
                stats.objectTypes[obj.type] = 0;
            }
            stats.objectTypes[obj.type]++;

            // Count relationships
            if (obj.relationships && obj.relationships.links) {
                stats.totalRelationships += obj.relationships.links.length;
            }
        }

        return stats;
    }
}

module.exports = LiquidStateDB;