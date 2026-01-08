const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const logger = require('../utils/logger');

class PointsSystem {
    constructor() {
        this.db = getDb();
    }

    initialize(app, io) {
        // Mount routes
        app.use('/api/economy', router);
        
        // Initialize default achievements
        this.initializeDefaultAchievements();
        
        logger.info('Points & Economy System initialized');
    }

    initializeDefaultAchievements() {
        const defaultAchievements = [
            {
                name: 'First Task',
                description: 'Complete your first task',
                category: 'productivity',
                pointsReward: 10
            },
            {
                name: 'Task Master',
                description: 'Complete 1000 tasks',
                category: 'productivity',
                pointsReward: 500
            },
            {
                name: 'Habit Hero',
                description: 'Maintain a 100-day streak on any habit',
                category: 'productivity',
                pointsReward: 200
            },
            {
                name: 'Focus Champion',
                description: 'Complete 1000 hours of focused work',
                category: 'productivity',
                pointsReward: 300
            },
            {
                name: 'Quiz Creator',
                description: 'Create 100 quizzes',
                category: 'learning',
                pointsReward: 250
            },
            {
                name: 'Subject Expert',
                description: 'Master 10 subjects',
                category: 'learning',
                pointsReward: 400
            },
            {
                name: 'Community Helper',
                description: 'Help others with 1000 helpful answers',
                category: 'social',
                pointsReward: 150
            },
            {
                name: 'Learning Streak',
                description: '365 days of continuous learning',
                category: 'learning',
                pointsReward: 500
            },
            {
                name: 'Friend Collector',
                description: 'Connect with 100 friends',
                category: 'social',
                pointsReward: 100
            },
            {
                name: 'Tournament Champion',
                description: 'Win 50 tournaments',
                category: 'social',
                pointsReward: 600
            }
        ];

        // Insert default achievements if they don't exist
        for (const achievement of defaultAchievements) {
            this.db.get('SELECT id FROM achievements WHERE name = ?', [achievement.name], (err, existing) => {
                if (!existing) {
                    const stmt = this.db.prepare(`
                        INSERT INTO achievements (name, description, category, points_reward)
                        VALUES (?, ?, ?, ?)
                    `);
                    
                    stmt.run([achievement.name, achievement.description, achievement.category, achievement.pointsReward]);
                    stmt.finalize();
                }
            });
        }
    }

    // Award points to a user
    awardPoints(userId, type, amount, reason) {
        const stmt = this.db.prepare(`
            INSERT INTO points_transactions (user_id, type, amount, reason)
            VALUES (?, ?, ?, ?)
        `);
        
        stmt.run([userId, type, amount, reason]);
        stmt.finalize();
        
        logger.info(`Awarded ${amount} ${type} points to user ${userId} for: ${reason}`);
    }

    // Deduct points from a user
    deductPoints(userId, type, amount, reason) {
        // Check if user has enough points
        this.getUserPoints(userId, type, (err, currentPoints) => {
            if (err) {
                logger.error('Error getting user points:', err);
                return;
            }
            
            if (currentPoints < amount) {
                logger.warn(`Insufficient ${type} points for user ${userId} to deduct ${amount} points`);
                return;
            }
            
            const stmt = this.db.prepare(`
                INSERT INTO points_transactions (user_id, type, amount, reason)
                VALUES (?, ?, ?, ?)
            `);
            
            stmt.run([userId, type, -amount, reason]);
            stmt.finalize();
            
            logger.info(`Deducted ${amount} ${type} points from user ${userId} for: ${reason}`);
        });
    }

    // Get user's current points balance
    getUserPoints(userId, type, callback) {
        let query = `
            SELECT SUM(amount) as total_points
            FROM points_transactions
            WHERE user_id = ? AND type = ?
        `;
        
        this.db.get(query, [userId, type], (err, result) => {
            if (err) {
                return callback(err, null);
            }
            
            const totalPoints = result && result.total_points ? parseInt(result.total_points) : 0;
            callback(null, Math.max(0, totalPoints)); // Ensure non-negative
        });
    }

    // Get user's points history
    getUserPointsHistory(req, res) {
        const { userId, type, limit } = req.query;
        
        let query = 'SELECT * FROM points_transactions WHERE user_id = ?';
        const params = [userId];
        
        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }
        
        query += ' ORDER BY created_at DESC';
        
        if (limit) {
            query += ' LIMIT ?';
            params.push(parseInt(limit));
        }
        
        this.db.all(query, params, (err, transactions) => {
            if (err) {
                logger.error('Error fetching points history:', err);
                return res.status(500).json({ error: 'Failed to fetch points history' });
            }
            
            res.json(transactions);
        });
    }

    // Get user's overall points summary
    getUserPointsSummary(req, res) {
        const { userId } = req.query;
        
        this.getUserPoints(userId, 'clarity', (err, clarityPoints) => {
            if (err) {
                logger.error('Error getting clarity points:', err);
                return res.status(500).json({ error: 'Failed to fetch clarity points' });
            }
            
            this.getUserPoints(userId, 'knowledge', (err, knowledgePoints) => {
                if (err) {
                    logger.error('Error getting knowledge points:', err);
                    return res.status(500).json({ error: 'Failed to fetch knowledge points' });
                }
                
                res.json({
                    userId,
                    clarityPoints: clarityPoints || 0,
                    knowledgePoints: knowledgePoints || 0,
                    totalPoints: (clarityPoints || 0) + (knowledgePoints || 0)
                });
            });
        });
    }

    // Spend points on items/features
    spendPoints(req, res) {
        const { userId, type, amount, item } = req.body;
        
        if (!userId || !type || !amount || !item) {
            return res.status(400).json({ error: 'userId, type, amount, and item are required' });
        }
        
        // Check if user has enough points
        this.getUserPoints(userId, type, (err, currentPoints) => {
            if (err) {
                logger.error('Error getting user points:', err);
                return res.status(500).json({ error: 'Failed to verify points balance' });
            }
            
            if (currentPoints < amount) {
                return res.status(400).json({ error: `Insufficient ${type} points` });
            }
            
            // Deduct points
            const stmt = this.db.prepare(`
                INSERT INTO points_transactions (user_id, type, amount, reason)
                VALUES (?, ?, ?, ?)
            `);
            
            try {
                stmt.run([userId, type, -amount, `Purchase: ${item}`]);
                
                res.json({
                    success: true,
                    message: `Successfully spent ${amount} ${type} points on ${item}`,
                    remainingBalance: currentPoints - amount
                });
            } catch (error) {
                logger.error('Error spending points:', error);
                res.status(500).json({ error: 'Failed to process purchase' });
            } finally {
                stmt.finalize();
            }
        });
    }

    // Award points for completing tasks
    awardPointsForTaskCompletion(task, userId) {
        // Award 10 clarity points for completing a task
        this.awardPoints(userId, 'clarity', 10, `Completed task: ${task.title}`);
        
        // Additional points based on priority
        switch (task.priority) {
            case 'high':
                this.awardPoints(userId, 'clarity', 5, `High priority task bonus: ${task.title}`);
                break;
            case 'urgent':
                this.awardPoints(userId, 'clarity', 10, `Urgent task bonus: ${task.title}`);
                break;
        }
    }

    // Award points for completing habits
    awardPointsForHabitCompletion(habit, userId) {
        // Award 5 clarity points for completing a habit
        this.awardPoints(userId, 'clarity', 5, `Completed habit: ${habit.name}`);
        
        // Additional points for streak milestones
        if (habit.current_streak % 7 === 0) {
            this.awardPoints(userId, 'clarity', 10, `Week streak milestone: ${habit.name}`);
        }
        
        if (habit.current_streak % 30 === 0) {
            this.awardPoints(userId, 'clarity', 25, `Month streak milestone: ${habit.name}`);
        }
    }

    // Award points for completing quizzes
    awardPointsForQuizCompletion(attempt, quiz, userId) {
        // Base points based on quiz difficulty
        let basePoints = 20;
        switch (quiz.difficulty) {
            case 'easy':
                basePoints = 10;
                break;
            case 'medium':
                basePoints = 20;
                break;
            case 'hard':
                basePoints = 30;
                break;
            case 'expert':
                basePoints = 50;
                break;
        }
        
        // Scale points based on score
        const scaledPoints = Math.round(basePoints * (attempt.score / 100));
        this.awardPoints(userId, 'knowledge', scaledPoints, `Completed quiz: ${quiz.title} (${attempt.score}%)`);
        
        // Bonus for perfect scores
        if (attempt.score >= 95) {
            this.awardPoints(userId, 'knowledge', 10, `Perfect score bonus: ${quiz.title}`);
        }
    }

    // Award points for creating quizzes
    awardPointsForQuizCreation(quiz, userId) {
        this.awardPoints(userId, 'knowledge', 25, `Created quiz: ${quiz.title}`);
        
        // Additional points if quiz gets attempted by others
        // This would be handled separately when others take the quiz
    }

    // Award points for helping others (in forums, etc.)
    awardPointsForHelpingOthers(userId, helpDetails) {
        this.awardPoints(userId, 'knowledge', 5, `Helped others: ${helpDetails}`);
    }

    // Check and award achievements
    checkAndAwardAchievements(userId, action, details) {
        // Get user's achievement progress
        this.db.all(`
            SELECT ua.achievement_id, a.name, a.description, a.category, a.points_reward
            FROM user_achievements ua
            JOIN achievements a ON ua.achievement_id = a.id
            WHERE ua.user_id = ?
        `, [userId], (err, earnedAchievements) => {
            if (err) {
                logger.error('Error fetching earned achievements:', err);
                return;
            }
            
            // Convert to a set of earned achievement IDs for quick lookup
            const earnedIds = new Set(earnedAchievements.map(a => a.achievement_id));
            
            // Get all possible achievements
            this.db.all('SELECT * FROM achievements', (err, allAchievements) => {
                if (err) {
                    logger.error('Error fetching all achievements:', err);
                    return;
                }
                
                // Check each unearned achievement against the user's progress
                for (const achievement of allAchievements) {
                    if (earnedIds.has(achievement.id)) continue; // Skip already earned
                    
                    // Check if the user qualifies for this achievement
                    if (this.checkAchievementQualification(userId, achievement, action, details)) {
                        // Award the achievement
                        this.awardAchievement(userId, achievement.id);
                    }
                }
            });
        });
    }

    // Check if user qualifies for a specific achievement
    checkAchievementQualification(userId, achievement, action, details) {
        // This is a simplified version - in a real system, this would be much more complex
        switch (achievement.name) {
            case 'First Task':
                return action === 'task_completed' && details.count === 1;
            case 'Task Master':
                // Would need to count total tasks completed by user
                return false; // Placeholder
            case 'Habit Hero':
                // Would need to track habit streaks
                return false; // Placeholder
            case 'Quiz Creator':
                // Would need to track number of quizzes created
                return false; // Placeholder
            case 'Subject Expert':
                // Would need to track subject mastery
                return false; // Placeholder
            case 'Community Helper':
                // Would need to track help given to others
                return false; // Placeholder
            case 'Learning Streak':
                // Would need to track consecutive learning days
                return false; // Placeholder
            case 'Friend Collector':
                // Would need to track number of friends
                return false; // Placeholder
            case 'Tournament Champion':
                // Would need to track tournament wins
                return false; // Placeholder
            default:
                return false;
        }
    }

    // Award an achievement to a user
    awardAchievement(userId, achievementId) {
        // Check if user already has this achievement
        this.db.get('SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?', [userId, achievementId], (err, existing) => {
            if (existing) {
                return; // Already earned
            }
            
            // Get achievement details
            this.db.get('SELECT * FROM achievements WHERE id = ?', [achievementId], (err, achievement) => {
                if (err || !achievement) {
                    logger.error('Error fetching achievement details:', err);
                    return;
                }
                
                // Insert user achievement record
                const stmt = this.db.prepare(`
                    INSERT INTO user_achievements (user_id, achievement_id)
                    VALUES (?, ?)
                `);
                
                stmt.run([userId, achievementId]);
                stmt.finalize();
                
                // Award points for earning achievement
                this.awardPoints(userId, 
                    achievement.category === 'productivity' ? 'clarity' : 'knowledge', 
                    achievement.points_reward, 
                    `Earned achievement: ${achievement.name}`
                );
                
                logger.info(`Awarded achievement ${achievement.name} to user ${userId}`);
            });
        });
    }

    // Get user's achievements
    getUserAchievements(req, res) {
        const { userId } = req.query;
        
        this.db.all(`
            SELECT a.name, a.description, a.category, a.points_reward, ua.earned_at
            FROM user_achievements ua
            JOIN achievements a ON ua.achievement_id = a.id
            WHERE ua.user_id = ?
            ORDER BY ua.earned_at DESC
        `, [userId], (err, achievements) => {
            if (err) {
                logger.error('Error fetching user achievements:', err);
                return res.status(500).json({ error: 'Failed to fetch user achievements' });
            }
            
            res.json(achievements);
        });
    }

    // Get leaderboard
    getLeaderboard(req, res) {
        const { type, limit } = req.query;
        const pointType = type || 'clarity';
        const topLimit = parseInt(limit) || 10;
        
        // Query to get top users by point type
        this.db.all(`
            SELECT u.id, u.username, SUM(pt.amount) as total_points
            FROM users u
            LEFT JOIN points_transactions pt ON u.id = pt.user_id AND pt.type = ?
            GROUP BY u.id, u.username
            HAVING total_points > 0
            ORDER BY total_points DESC
            LIMIT ?
        `, [pointType, topLimit], (err, leaderboard) => {
            if (err) {
                logger.error('Error fetching leaderboard:', err);
                return res.status(500).json({ error: 'Failed to fetch leaderboard' });
            }
            
            res.json({
                type: pointType,
                leaderboard: leaderboard.map((user, index) => ({
                    rank: index + 1,
                    userId: user.id,
                    username: user.username,
                    points: parseInt(user.total_points) || 0
                }))
            });
        });
    }
}

const pointsSystem = new PointsSystem();

// Define routes
router.get('/points/history', (req, res) => pointsSystem.getUserPointsHistory(req, res));
router.get('/points/summary', (req, res) => pointsSystem.getUserPointsSummary(req, res));
router.post('/points/spend', (req, res) => pointsSystem.spendPoints(req, res));
router.get('/achievements', (req, res) => pointsSystem.getUserAchievements(req, res));
router.get('/leaderboard', (req, res) => pointsSystem.getLeaderboard(req, res));

// These methods would be called internally by other parts of the system
// But we'll expose them as endpoints for testing purposes
router.post('/points/award', (req, res) => {
    const { userId, type, amount, reason } = req.body;
    pointsSystem.awardPoints(userId, type, amount, reason);
    res.json({ success: true, message: `Awarded ${amount} ${type} points` });
});

router.post('/points/deduct', (req, res) => {
    const { userId, type, amount, reason } = req.body;
    pointsSystem.deductPoints(userId, type, amount, reason);
    res.json({ success: true, message: `Deducted ${amount} ${type} points` });
});

function initializePointsSystem(app, io) {
    pointsSystem.initialize(app, io);
    return pointsSystem;
}

module.exports = {
    initializePointsSystem
};