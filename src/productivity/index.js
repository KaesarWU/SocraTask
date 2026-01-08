const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const logger = require('../utils/logger');
const { getQwenNexus } = require('../ai/qwen-nexus');

class ProductivityEngine {
    constructor() {
        this.db = getDb();
        this.qwenNexus = getQwenNexus();
    }

    initialize(app, io) {
        // Mount routes
        app.use('/api/productivity', router);
        
        // Socket.io event handlers
        this.setupSocketHandlers(io);
        
        logger.info('Productivity Engine initialized');
    }

    setupSocketHandlers(io) {
        io.on('connection', (socket) => {
            logger.info('Productivity Engine socket connected:', socket.id);
            
            socket.on('task.created', (task) => {
                io.emit('task.created.global', task);
            });
            
            socket.on('task.updated', (task) => {
                io.emit('task.updated.global', task);
            });
            
            socket.on('task.deleted', (taskId) => {
                io.emit('task.deleted.global', taskId);
            });
            
            socket.on('disconnect', () => {
                logger.info('Productivity Engine socket disconnected:', socket.id);
            });
        });
    }

    // Task Management
    createTask(req, res) {
        const { title, description, userId, projectId, priority, energyLevel, context, dueDate } = req.body;
        
        if (!title || !userId) {
            return res.status(400).json({ error: 'Title and userId are required' });
        }
        
        const stmt = this.db.prepare(`
            INSERT INTO tasks (title, description, user_id, project_id, priority, energy_level, context, due_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        try {
            const result = stmt.run([title, description, userId, projectId, priority, energyLevel, context, dueDate]);
            const newTask = {
                id: result.lastID,
                title,
                description,
                userId,
                projectId,
                priority: priority || 'medium',
                energyLevel: energyLevel || 'medium',
                context: context || 'any',
                dueDate,
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            
            // Emit socket event
            req.app.get('io').emit('task.created', newTask);
            
            res.status(201).json(newTask);
        } catch (error) {
            logger.error('Error creating task:', error);
            res.status(500).json({ error: 'Failed to create task' });
        } finally {
            stmt.finalize();
        }
    }

    getTasks(req, res) {
        const { userId, status, projectId } = req.query;
        
        let query = 'SELECT * FROM tasks WHERE user_id = ?';
        const params = [userId];
        
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        
        if (projectId) {
            query += ' AND project_id = ?';
            params.push(projectId);
        }
        
        query += ' ORDER BY created_at DESC';
        
        this.db.all(query, params, (err, tasks) => {
            if (err) {
                logger.error('Error fetching tasks:', err);
                return res.status(500).json({ error: 'Failed to fetch tasks' });
            }
            
            res.json(tasks);
        });
    }

    updateTask(req, res) {
        const { id } = req.params;
        const { title, description, status, priority, energyLevel, context, dueDate, completedAt } = req.body;
        
        const stmt = this.db.prepare(`
            UPDATE tasks 
            SET title = COALESCE(?, title), 
                description = COALESCE(?, description), 
                status = COALESCE(?, status), 
                priority = COALESCE(?, priority), 
                energy_level = COALESCE(?, energy_level), 
                context = COALESCE(?, context), 
                due_date = COALESCE(?, due_date),
                completed_at = CASE 
                    WHEN ? = 'completed' THEN CURRENT_TIMESTAMP 
                    ELSE completed_at 
                END
            WHERE id = ?
        `);
        
        try {
            stmt.run([title, description, status, priority, energyLevel, context, dueDate, status, id]);
            
            // Get updated task
            this.db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
                if (err) {
                    logger.error('Error fetching updated task:', err);
                    return res.status(500).json({ error: 'Failed to fetch updated task' });
                }
                
                // Emit socket event
                req.app.get('io').emit('task.updated', task);
                
                res.json(task);
            });
        } catch (error) {
            logger.error('Error updating task:', error);
            res.status(500).json({ error: 'Failed to update task' });
        } finally {
            stmt.finalize();
        }
    }

    deleteTask(req, res) {
        const { id } = req.params;
        
        this.db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
            if (err) {
                logger.error('Error fetching task for deletion:', err);
                return res.status(500).json({ error: 'Failed to fetch task' });
            }
            
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }
            
            const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
            
            try {
                stmt.run([id]);
                
                // Emit socket event
                req.app.get('io').emit('task.deleted', id);
                
                res.status(200).json({ message: 'Task deleted successfully' });
            } catch (error) {
                logger.error('Error deleting task:', error);
                res.status(500).json({ error: 'Failed to delete task' });
            } finally {
                stmt.finalize();
            }
        });
    }

    // Project Management
    createProject(req, res) {
        const { name, description, userId } = req.body;
        
        if (!name || !userId) {
            return res.status(400).json({ error: 'Name and userId are required' });
        }
        
        const stmt = this.db.prepare(`
            INSERT INTO projects (name, description, user_id)
            VALUES (?, ?, ?)
        `);
        
        try {
            const result = stmt.run([name, description, userId]);
            const newProject = {
                id: result.lastID,
                name,
                description,
                userId,
                status: 'active',
                createdAt: new Date().toISOString()
            };
            
            res.status(201).json(newProject);
        } catch (error) {
            logger.error('Error creating project:', error);
            res.status(500).json({ error: 'Failed to create project' });
        } finally {
            stmt.finalize();
        }
    }

    getProjects(req, res) {
        const { userId } = req.query;
        
        this.db.all('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, projects) => {
            if (err) {
                logger.error('Error fetching projects:', err);
                return res.status(500).json({ error: 'Failed to fetch projects' });
            }
            
            res.json(projects);
        });
    }

    // Habit Management
    createHabit(req, res) {
        const { name, description, userId, frequency, target } = req.body;
        
        if (!name || !userId) {
            return res.status(400).json({ error: 'Name and userId are required' });
        }
        
        const stmt = this.db.prepare(`
            INSERT INTO habits (name, description, user_id, frequency, target)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        try {
            const result = stmt.run([name, description, userId, frequency, target]);
            const newHabit = {
                id: result.lastID,
                name,
                description,
                userId,
                frequency: frequency || 'daily',
                target: target || 1,
                currentStreak: 0,
                longestStreak: 0,
                createdAt: new Date().toISOString()
            };
            
            res.status(201).json(newHabit);
        } catch (error) {
            logger.error('Error creating habit:', error);
            res.status(500).json({ error: 'Failed to create habit' });
        } finally {
            stmt.finalize();
        }
    }

    getHabits(req, res) {
        const { userId } = req.query;
        
        this.db.all('SELECT * FROM habits WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, habits) => {
            if (err) {
                logger.error('Error fetching habits:', err);
                return res.status(500).json({ error: 'Failed to fetch habits' });
            }
            
            res.json(habits);
        });
    }

    completeHabit(req, res) {
        const { habitId, userId } = req.body;
        
        // Update habit streak
        const updateStmt = this.db.prepare(`
            UPDATE habits 
            SET current_streak = current_streak + 1,
                longest_streak = CASE 
                    WHEN current_streak + 1 > longest_streak THEN current_streak + 1 
                    ELSE longest_streak 
                END,
                last_completed = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `);
        
        // Record completion
        const insertStmt = this.db.prepare(`
            INSERT INTO habit_completions (habit_id, user_id)
            VALUES (?, ?)
        `);
        
        this.db.serialize(() => {
            try {
                updateStmt.run([habitId, userId]);
                insertStmt.run([habitId, userId]);
                
                // Get updated habit
                this.db.get('SELECT * FROM habits WHERE id = ? AND user_id = ?', [habitId, userId], (err, habit) => {
                    if (err) {
                        logger.error('Error fetching updated habit:', err);
                        return res.status(500).json({ error: 'Failed to fetch updated habit' });
                    }
                    
                    res.json(habit);
                });
            } catch (error) {
                logger.error('Error completing habit:', error);
                res.status(500).json({ error: 'Failed to complete habit' });
            } finally {
                updateStmt.finalize();
                insertStmt.finalize();
            }
        });
    }

    // Calendar Management
    createCalendarEvent(req, res) {
        const { title, description, startTime, endTime, location, userId } = req.body;
        
        if (!title || !startTime || !endTime || !userId) {
            return res.status(400).json({ error: 'Title, start time, end time, and userId are required' });
        }
        
        const stmt = this.db.prepare(`
            INSERT INTO calendar_events (title, description, start_time, end_time, location, user_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        try {
            const result = stmt.run([title, description, startTime, endTime, location, userId]);
            const newEvent = {
                id: result.lastID,
                title,
                description,
                startTime,
                endTime,
                location,
                userId,
                createdAt: new Date().toISOString()
            };
            
            res.status(201).json(newEvent);
        } catch (error) {
            logger.error('Error creating calendar event:', error);
            res.status(500).json({ error: 'Failed to create calendar event' });
        } finally {
            stmt.finalize();
        }
    }

    getCalendarEvents(req, res) {
        const { userId, startDate, endDate } = req.query;
        
        let query = 'SELECT * FROM calendar_events WHERE user_id = ?';
        const params = [userId];
        
        if (startDate && endDate) {
            query += ' AND start_time BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }
        
        query += ' ORDER BY start_time ASC';
        
        this.db.all(query, params, (err, events) => {
            if (err) {
                logger.error('Error fetching calendar events:', err);
                return res.status(500).json({ error: 'Failed to fetch calendar events' });
            }
            
            res.json(events);
        });
    }

    // Automation Rules
    createAutomationRule(req, res) {
        const { name, triggerType, triggerConditions, actionType, actionParams, userId } = req.body;
        
        if (!name || !triggerType || !actionType || !userId) {
            return res.status(400).json({ error: 'Name, trigger type, action type, and userId are required' });
        }
        
        const stmt = this.db.prepare(`
            INSERT INTO automation_rules (name, trigger_type, trigger_conditions, action_type, action_params, user_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        try {
            const result = stmt.run([name, triggerType, JSON.stringify(triggerConditions), actionType, JSON.stringify(actionParams), userId]);
            const newRule = {
                id: result.lastID,
                name,
                triggerType,
                triggerConditions,
                actionType,
                actionParams,
                userId,
                isActive: true,
                createdAt: new Date().toISOString()
            };
            
            res.status(201).json(newRule);
        } catch (error) {
            logger.error('Error creating automation rule:', error);
            res.status(500).json({ error: 'Failed to create automation rule' });
        } finally {
            stmt.finalize();
        }
    }

    getAutomationRules(req, res) {
        const { userId } = req.query;
        
        this.db.all('SELECT * FROM automation_rules WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rules) => {
            if (err) {
                logger.error('Error fetching automation rules:', err);
                return res.status(500).json({ error: 'Failed to fetch automation rules' });
            }
            
            // Parse JSON fields
            const parsedRules = rules.map(rule => ({
                ...rule,
                triggerConditions: JSON.parse(rule.trigger_conditions || '{}'),
                actionParams: JSON.parse(rule.action_params || '{}')
            }));
            
            res.json(parsedRules);
        });
    }

    // Natural Language Processing for Tasks
    async processNaturalLanguageTask(req, res) {
        const { input, userId } = req.body;
        
        if (!input || !userId) {
            return res.status(400).json({ error: 'Input and userId are required' });
        }
        
        try {
            // Use Qwen AI to parse natural language input
            const qwen = this.qwenNexus;
            if (!qwen) {
                throw new Error('Qwen AI Nexus not initialized');
            }
            
            // Find an available model
            const modelId = qwen.activeModel || Array.from(qwen.models.keys())[0];
            if (!modelId) {
                throw new Error('No AI model available');
            }
            
            // Create a prompt for the AI to parse the natural language task
            const prompt = `Parse the following natural language input and extract task information in JSON format:
Input: "${input}"

Extract the following information if available:
- title (string)
- description (string)
- due_date (ISO date string)
- priority (low, medium, high, urgent)
- energy_level (low, medium, high, deep)
- context (any, @computer, @phone, @errand, @waiting, etc.)

Response in JSON format only, no other text:`;
            
            const result = await qwen.runInference(modelId, prompt);
            
            // Try to parse the AI response as JSON
            let parsedTask;
            try {
                // Extract JSON from the response
                const jsonMatch = result.response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsedTask = JSON.parse(jsonMatch[0]);
                } else {
                    // If no JSON found, try to extract information differently
                    parsedTask = { title: input };
                }
            } catch (parseError) {
                // If JSON parsing fails, create a basic task
                parsedTask = { title: input };
            }
            
            // Create the task in the database
            const stmt = this.db.prepare(`
                INSERT INTO tasks (title, description, user_id, priority, energy_level, context, due_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            const resultTask = stmt.run([
                parsedTask.title || input,
                parsedTask.description || '',
                userId,
                parsedTask.priority || 'medium',
                parsedTask.energyLevel || 'medium',
                parsedTask.context || 'any',
                parsedTask.due_date || null
            ]);
            
            const newTask = {
                id: resultTask.lastID,
                title: parsedTask.title || input,
                description: parsedTask.description || '',
                userId,
                priority: parsedTask.priority || 'medium',
                energyLevel: parsedTask.energyLevel || 'medium',
                context: parsedTask.context || 'any',
                dueDate: parsedTask.due_date || null,
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            
            // Emit socket event
            req.app.get('io').emit('task.created', newTask);
            
            res.json(newTask);
        } catch (error) {
            logger.error('Error processing natural language task:', error);
            res.status(500).json({ error: 'Failed to process natural language task' });
        }
    }
}

const productivityEngine = new ProductivityEngine();

// Define routes
router.post('/tasks', (req, res) => productivityEngine.createTask(req, res));
router.get('/tasks', (req, res) => productivityEngine.getTasks(req, res));
router.put('/tasks/:id', (req, res) => productivityEngine.updateTask(req, res));
router.delete('/tasks/:id', (req, res) => productivityEngine.deleteTask(req, res));

router.post('/projects', (req, res) => productivityEngine.createProject(req, res));
router.get('/projects', (req, res) => productivityEngine.getProjects(req, res));

router.post('/habits', (req, res) => productivityEngine.createHabit(req, res));
router.get('/habits', (req, res) => productivityEngine.getHabits(req, res));
router.post('/habits/complete', (req, res) => productivityEngine.completeHabit(req, res));

router.post('/calendar', (req, res) => productivityEngine.createCalendarEvent(req, res));
router.get('/calendar', (req, res) => productivityEngine.getCalendarEvents(req, res));

router.post('/automation', (req, res) => productivityEngine.createAutomationRule(req, res));
router.get('/automation', (req, res) => productivityEngine.getAutomationRules(req, res));

router.post('/natural-language-task', (req, res) => productivityEngine.processNaturalLanguageTask(req, res));

function initializeProductivityEngine(app, io) {
    productivityEngine.initialize(app, io);
    return productivityEngine;
}

module.exports = {
    initializeProductivityEngine
};