const LiquidStateDB = require('./src/database/liquid-state/LiquidStateDB');
const logger = require('./simple-logger');

async function demonstrateLiquidStateDB() {
    console.log('🧪 Starting Liquid State Database Demonstration...\n');
    
    // Initialize the Liquid State Database
    const liquidDB = new LiquidStateDB({
        dataDir: './data/liquid-state-demo'
    });
    
    console.log('✅ Liquid State Database initialized\n');
    
    // Show database statistics
    console.log('📊 Initial Database Stats:');
    console.log(JSON.stringify(liquidDB.getStats(), null, 2));
    console.log('');
    
    // 1. CREATE A USER OBJECT
    console.log('👤 Creating a user object...');
    const user = liquidDB.createObject('user', {
        username: 'johndoe',
        email: 'john@example.com',
        preferences: {
            theme: 'dark',
            notifications: true,
            timezone: 'UTC-5'
        },
        profile: {
            firstName: 'John',
            lastName: 'Doe',
            bio: 'Software developer interested in productivity tools'
        }
    }, {
        author: 'system',
        tags: ['user', 'developer', 'active']
    });
    
    console.log('📝 Created user:', user.id);
    console.log('');
    
    // 2. CREATE A PROJECT OBJECT
    console.log('📁 Creating a project object...');
    const project = liquidDB.createObject('project', {
        name: 'SocraTask Development',
        description: 'Building the ultimate productivity system',
        status: 'active',
        priority: 'high',
        tags: ['development', 'productivity', 'ai']
    }, {
        author: 'johndoe',
        tags: ['project', 'development', 'active']
    });
    
    console.log('📝 Created project:', project.id);
    console.log('');
    
    // 3. CREATE MULTIPLE TASKS WITH DIFFERENT PROPERTIES
    console.log('📋 Creating multiple tasks...');
    
    const task1 = liquidDB.createObject('task', {
        title: 'Implement Liquid State DB',
        description: 'Create the core database architecture',
        status: 'completed',
        priority: 'high',
        energyLevel: 'deep',
        context: '@computer',
        dueDate: '2024-12-15T10:00:00Z',
        estimatedHours: 8,
        tags: ['database', 'implementation', 'core']
    }, {
        author: 'johndoe',
        tags: ['task', 'completed', 'high-priority']
    });
    
    const task2 = liquidDB.createObject('task', {
        title: 'Design UI Components',
        description: 'Create reusable UI components for dashboard',
        status: 'in-progress',
        priority: 'medium',
        energyLevel: 'focused',
        context: '@computer',
        dueDate: '2024-12-20T18:00:00Z',
        estimatedHours: 6,
        tags: ['ui', 'design', 'frontend']
    }, {
        author: 'johndoe',
        tags: ['task', 'in-progress', 'medium-priority']
    });
    
    const task3 = liquidDB.createObject('task', {
        title: 'Research AI Models',
        description: 'Investigate different AI model architectures',
        status: 'pending',
        priority: 'low',
        energyLevel: 'light',
        context: '@reading',
        dueDate: '2024-12-25T12:00:00Z',
        estimatedHours: 4,
        tags: ['research', 'ai', 'models']
    }, {
        author: 'johndoe',
        tags: ['task', 'pending', 'low-priority']
    });
    
    console.log(`📝 Created tasks: ${task1.id}, ${task2.id}, ${task3.id}`);
    console.log('');
    
    // 4. CREATE RELATIONSHIPS BETWEEN OBJECTS
    console.log('🔗 Creating relationships...');
    
    // Link tasks to the project
    liquidDB.addRelationship(task1.id, project.id, 'belongs_to', {
        type: 'task_project'
    });
    
    liquidDB.addRelationship(task2.id, project.id, 'belongs_to', {
        type: 'task_project'
    });
    
    liquidDB.addRelationship(task3.id, project.id, 'belongs_to', {
        type: 'task_project'
    });
    
    // Link user to the project
    liquidDB.addRelationship(user.id, project.id, 'owns', {
        type: 'user_project'
    });
    
    // Create dependency relationship between tasks
    liquidDB.addRelationship(task1.id, task2.id, 'blocks', {
        type: 'task_dependency',
        reason: 'UI components depend on DB implementation'
    });
    
    console.log('✅ Relationships created');
    console.log('');
    
    // 5. QUERY OBJECTS
    console.log('🔍 Querying objects...');
    
    // Get all tasks
    const allTasks = liquidDB.queryObjects({ type: 'task' });
    console.log(`📋 Found ${allTasks.length} tasks`);
    
    // Get tasks with specific tags
    const highPriorityTasks = liquidDB.queryObjects({ 
        type: 'task', 
        tags: ['high-priority'] 
    });
    console.log(`🔺 Found ${highPriorityTasks.length} high priority tasks`);
    
    // Get tasks by status
    const completedTasks = liquidDB.queryObjects({ 
        type: 'task', 
        properties: { status: 'completed' } 
    });
    console.log(`✅ Found ${completedTasks.length} completed tasks`);
    
    // Get all projects
    const projects = liquidDB.queryObjects({ type: 'project' });
    console.log(`📁 Found ${projects.length} projects`);
    console.log('');
    
    // 6. GET RELATED OBJECTS
    console.log('🔗 Getting related objects for the project...');
    
    const projectRelations = liquidDB.getRelatedObjects(project.id);
    console.log(`The project "${project.properties.name}" has ${projectRelations.length} related objects:`);
    
    for (const relation of projectRelations) {
        console.log(`  - ${relation.relationship.type}: ${relation.object.type} (${relation.object.id})`);
    }
    console.log('');
    
    // 7. UPDATE AN OBJECT
    console.log('✏️ Updating a task...');
    
    const updatedTask = liquidDB.updateObject(task2.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        actualHours: 7.5
    }, {
        author: 'johndoe',
        tags: ['updated', 'completed']
    });
    
    console.log(`✅ Updated task ${task2.id} status to completed`);
    console.log(`🔄 New version: ${updatedTask.metadata.version}`);
    console.log(`📋 History entries: ${updatedTask.history.length}`);
    console.log('');
    
    // 8. SHOW OBJECT DETAILS
    console.log('📋 Detailed view of updated task:');
    console.log(JSON.stringify({
        id: updatedTask.id,
        type: updatedTask.type,
        properties: updatedTask.properties,
        metadata: updatedTask.metadata,
        relationships: updatedTask.relationships,
        historyCount: updatedTask.history.length
    }, null, 2));
    console.log('');
    
    // 9. SHOW RECENT HISTORY
    console.log('⏳ Recent history of the updated task:');
    for (const entry of updatedTask.history.slice(-2)) {
        console.log(`  Version ${entry.version} (${entry.timestamp}): ${entry.action} by ${entry.author}`);
    }
    console.log('');
    
    // 10. DATABASE STATISTICS
    console.log('📊 Final Database Stats:');
    const stats = liquidDB.getStats();
    console.log(JSON.stringify(stats, null, 2));
    console.log('');
    
    // 11. CRDT SYNCHRONIZATION DEMO
    console.log('🔄 Demonstrating CRDT synchronization capabilities...');
    
    // Export data for sync
    const syncData = liquidDB.exportForSync();
    console.log(`📦 Exported ${syncData.objects.length} objects and ${syncData.changeLog.length} changes`);
    
    // Create a second database instance to simulate another device
    const liquidDB2 = new LiquidStateDB({
        dataDir: './data/liquid-state-demo-sync'
    });
    
    // Import the data to the second instance
    liquidDB2.importFromSync(syncData);
    
    // Make a change in the second database
    const taskInDB2 = liquidDB2.getObject(task3.id);
    if (taskInDB2) {
        liquidDB2.updateObject(task3.id, {
            status: 'in-progress',
            startedAt: new Date().toISOString()
        });
    } else {
        // If the task doesn't exist in DB2 (which it shouldn't since we're simulating sync),
        // we'll create it with different data to demonstrate conflict resolution
        const newTask = liquidDB2.createObject('task', {
            title: 'Sync Test Task',
            description: 'A task created to test sync',
            status: 'in-progress'
        }, {
            author: 'sync-test',
            tags: ['test', 'sync']
        });
        
        // Now export from DB2 and import back to original DB to show merging
        const syncData2 = liquidDB2.exportForSync();
        console.log(`📱 Second DB exported ${syncData2.objects.length} objects`);
        
        // Import DB2 changes back to original DB
        liquidDB.importFromSync(syncData2);
    }
    
    console.log('✅ Synchronization demo completed');
    console.log('');
    
    // 12. FINAL SUMMARY
    console.log('🎯 Liquid State Database Demonstration Summary:');
    console.log('- ✅ Dynamic object creation with flexible schemas');
    console.log('- ✅ Rich metadata and tagging system');
    console.log('- ✅ Complex relationship mapping between objects');
    console.log('- ✅ Full version history and audit trail');
    console.log('- ✅ Powerful query capabilities');
    console.log('- ✅ CRDT-style synchronization for distributed systems');
    console.log('- ✅ Built-in encryption for data security');
    console.log('- ✅ Conflict resolution mechanisms');
    console.log('');
    
    console.log('🔐 The Liquid State Database provides a revolutionary approach to data management');
    console.log('where every piece of information is a living, breathing object with relationships,');
    console.log('history, and the ability to synchronize seamlessly across devices.');
    
    return liquidDB;
}

// Run the demonstration
if (require.main === module) {
    demonstrateLiquidStateDB()
        .then(db => {
            console.log('\n🎉 Demonstration completed successfully!');
        })
        .catch(error => {
            console.error('❌ Error during demonstration:', error);
            process.exit(1);
        });
}

module.exports = { demonstrateLiquidStateDB };