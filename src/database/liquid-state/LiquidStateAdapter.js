const LiquidStateDB = require('./LiquidStateDB');
const logger = require('../../../simple-logger');

/**
 * Adapter class to provide SQLite-compatible interface for Liquid State DB
 * This allows us to gradually migrate from the existing SQL-based system
 */
class LiquidStateAdapter {
    constructor(options = {}) {
        this.liquidDB = new LiquidStateDB(options);
        this.tableMappings = {
            'users': 'user',
            'tasks': 'task',
            'projects': 'project',
            'habits': 'habit',
            'habits_completions': 'habit_completion',
            'quizzes': 'quiz',
            'quiz_questions': 'quiz_question',
            'quiz_attempts': 'quiz_attempt',
            'points_transactions': 'points_transaction',
            'friends': 'friendship',
            'clubs': 'club',
            'club_members': 'club_member',
            'tournaments': 'tournament',
            'tournament_participants': 'tournament_participant',
            'achievements': 'achievement',
            'user_achievements': 'user_achievement',
            'calendar_events': 'calendar_event',
            'automation_rules': 'automation_rule'
        };
    }

    /**
     * Convert SQL-style operations to Liquid State operations
     */
    
    // User operations
    createUser(userData) {
        const user = this.liquidDB.createObject('user', userData, {
            tags: ['user'],
            author: userData.username
        });
        return user;
    }

    getUser(userId) {
        return this.liquidDB.getObject(userId);
    }

    updateUser(userId, updates) {
        return this.liquidDB.updateObject(userId, updates);
    }

    // Task operations
    createTask(taskData) {
        const task = this.liquidDB.createObject('task', taskData, {
            tags: ['task', taskData.status || 'pending'],
            author: taskData.user_id
        });
        
        // If task has a project, create relationship
        if (taskData.project_id) {
            this.liquidDB.addRelationship(task.id, taskData.project_id, 'belongs_to', {
                relationship: 'task_project'
            });
        }
        
        return task;
    }

    getTask(taskId) {
        return this.liquidDB.getObject(taskId);
    }

    updateTask(taskId, updates) {
        return this.liquidDB.updateObject(taskId, updates);
    }

    getTasks(userId, filters = {}) {
        const queryFilters = {
            type: 'task',
            properties: { user_id: userId },
            ...filters
        };
        
        return this.liquidDB.queryObjects(queryFilters);
    }

    // Project operations
    createProject(projectData) {
        return this.liquidDB.createObject('project', projectData, {
            tags: ['project'],
            author: projectData.user_id
        });
    }

    getProject(projectId) {
        return this.liquidDB.getObject(projectId);
    }

    // Habit operations
    createHabit(habitData) {
        return this.liquidDB.createObject('habit', habitData, {
            tags: ['habit'],
            author: habitData.user_id
        });
    }

    getHabit(habitId) {
        return this.liquidDB.getObject(habitId);
    }

    // Quiz operations
    createQuiz(quizData) {
        const quiz = this.liquidDB.createObject('quiz', quizData, {
            tags: ['quiz', quizData.subject],
            author: quizData.creator_id
        });
        
        return quiz;
    }

    getQuiz(quizId) {
        return this.liquidDB.getObject(quizId);
    }

    // Calendar operations
    createCalendarEvent(eventData) {
        return this.liquidDB.createObject('calendar_event', eventData, {
            tags: ['event', 'calendar'],
            author: eventData.user_id
        });
    }

    getCalendarEvent(eventId) {
        return this.liquidDB.getObject(eventId);
    }

    // Points operations
    createPointsTransaction(transactionData) {
        return this.liquidDB.createObject('points_transaction', transactionData, {
            tags: ['points', transactionData.type],
            author: transactionData.user_id
        });
    }

    // Relationship operations
    linkTaskToProject(taskId, projectId) {
        return this.liquidDB.addRelationship(taskId, projectId, 'belongs_to', {
            relationship: 'task_project'
        });
    }

    linkUserToQuizAttempt(userId, attemptId) {
        return this.liquidDB.addRelationship(userId, attemptId, 'completed', {
            relationship: 'user_quiz_attempt'
        });
    }

    // Generic query method
    queryObjects(filters) {
        return this.liquidDB.queryObjects(filters);
    }

    // Get object by ID
    getObject(id) {
        return this.liquidDB.getObject(id);
    }

    // Get related objects
    getRelatedObjects(id, relationshipType = null) {
        return this.liquidDB.getRelatedObjects(id, relationshipType);
    }

    // Stats
    getStats() {
        return this.liquidDB.getStats();
    }

    // Synchronization methods
    exportForSync(filter = {}) {
        return this.liquidDB.exportForSync(filter);
    }

    importFromSync(syncData) {
        return this.liquidDB.importFromSync(syncData);
    }

    /**
     * Migration methods to convert from existing SQL data to Liquid State format
     */
    migrateFromSQL(sqlData) {
        logger.info('Starting migration from SQL data to Liquid State format...');
        
        const migratedObjects = [];
        
        // Migrate users
        if (sqlData.users && sqlData.users.length > 0) {
            for (const userData of sqlData.users) {
                const migratedUser = this.createUser(userData);
                migratedObjects.push(migratedUser);
            }
        }
        
        // Migrate tasks
        if (sqlData.tasks && sqlData.tasks.length > 0) {
            for (const taskData of sqlData.tasks) {
                const migratedTask = this.createTask(taskData);
                migratedObjects.push(migratedTask);
                
                // Create relationships
                if (taskData.project_id) {
                    try {
                        this.linkTaskToProject(migratedTask.id, taskData.project_id);
                    } catch (e) {
                        logger.warn(`Could not create relationship for task ${migratedTask.id} and project ${taskData.project_id}`);
                    }
                }
            }
        }
        
        // Migrate projects
        if (sqlData.projects && sqlData.projects.length > 0) {
            for (const projectData of sqlData.projects) {
                const migratedProject = this.createProject(projectData);
                migratedObjects.push(migratedProject);
            }
        }
        
        // Migrate habits
        if (sqlData.habits && sqlData.habits.length > 0) {
            for (const habitData of sqlData.habits) {
                const migratedHabit = this.createHabit(habitData);
                migratedObjects.push(migratedHabit);
            }
        }
        
        // Migrate quizzes
        if (sqlData.quizzes && sqlData.quizzes.length > 0) {
            for (const quizData of sqlData.quizzes) {
                const migratedQuiz = this.createQuiz(quizData);
                migratedObjects.push(migratedQuiz);
            }
        }
        
        // Migrate calendar events
        if (sqlData.calendar_events && sqlData.calendar_events.length > 0) {
            for (const eventData of sqlData.calendar_events) {
                const migratedEvent = this.createCalendarEvent(eventData);
                migratedObjects.push(migratedEvent);
            }
        }
        
        logger.info(`Migration completed. Migrated ${migratedObjects.length} objects.`);
        
        return {
            success: true,
            migratedCount: migratedObjects.length,
            objects: migratedObjects
        };
    }
}

module.exports = LiquidStateAdapter;