const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const logger = require('../utils/logger');

class SocialArena {
    constructor() {
        this.db = getDb();
    }

    initialize(app, io) {
        // Mount routes
        app.use('/api/social', router);
        
        // Socket.io event handlers
        this.setupSocketHandlers(io);
        
        logger.info('Social Arena initialized');
    }

    setupSocketHandlers(io) {
        io.on('connection', (socket) => {
            logger.info('Social Arena socket connected:', socket.id);
            
            socket.on('friend.request', (request) => {
                io.emit('friend.request.global', request);
            });
            
            socket.on('club.created', (club) => {
                io.emit('club.created.global', club);
            });
            
            socket.on('tournament.created', (tournament) => {
                io.emit('tournament.created.global', tournament);
            });
            
            socket.on('disconnect', () => {
                logger.info('Social Arena socket disconnected:', socket.id);
            });
        });
    }

    // Friend System
    sendFriendRequest(req, res) {
        const { userId, friendId } = req.body;
        
        if (!userId || !friendId) {
            return res.status(400).json({ error: 'userId and friendId are required' });
        }
        
        if (userId === friendId) {
            return res.status(400).json({ error: 'Cannot send friend request to yourself' });
        }
        
        // Check if users exist
        this.db.get('SELECT id FROM users WHERE id = ?', [userId], (err, user) => {
            if (err) {
                logger.error('Error checking user:', err);
                return res.status(500).json({ error: 'Failed to validate user' });
            }
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            this.db.get('SELECT id FROM users WHERE id = ?', [friendId], (err, friend) => {
                if (err) {
                    logger.error('Error checking friend:', err);
                    return res.status(500).json({ error: 'Failed to validate friend' });
                }
                
                if (!friend) {
                    return res.status(404).json({ error: 'Friend not found' });
                }
                
                // Check if friendship already exists
                this.db.get(`
                    SELECT * FROM friends 
                    WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
                `, [userId, friendId, friendId, userId], (err, existing) => {
                    if (err) {
                        logger.error('Error checking existing friendship:', err);
                        return res.status(500).json({ error: 'Failed to check existing friendship' });
                    }
                    
                    if (existing) {
                        return res.status(400).json({ error: 'Friendship already exists or request pending' });
                    }
                    
                    // Create friend request
                    const stmt = this.db.prepare(`
                        INSERT INTO friends (user_id, friend_id, status)
                        VALUES (?, ?, ?)
                    `);
                    
                    try {
                        const result = stmt.run([userId, friendId, 'pending']);
                        
                        const newRequest = {
                            id: result.lastID,
                            userId,
                            friendId,
                            status: 'pending',
                            createdAt: new Date().toISOString()
                        };
                        
                        // Emit socket event
                        req.app.get('io').emit('friend.request', newRequest);
                        
                        res.status(201).json(newRequest);
                    } catch (error) {
                        logger.error('Error sending friend request:', error);
                        res.status(500).json({ error: 'Failed to send friend request' });
                    } finally {
                        stmt.finalize();
                    }
                });
            });
        });
    }

    getFriendRequests(req, res) {
        const { userId, status } = req.query;
        
        let query = 'SELECT * FROM friends WHERE friend_id = ?';
        const params = [userId];
        
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY created_at DESC';
        
        this.db.all(query, params, (err, requests) => {
            if (err) {
                logger.error('Error fetching friend requests:', err);
                return res.status(500).json({ error: 'Failed to fetch friend requests' });
            }
            
            res.json(requests);
        });
    }

    respondToFriendRequest(req, res) {
        const { requestId, response } = req.body; // response: 'accept' or 'reject'
        const currentUserId = req.body.currentUserId; // This would come from authentication
        
        if (!requestId || !response || !['accept', 'reject'].includes(response)) {
            return res.status(400).json({ error: 'requestId and valid response (accept/reject) are required' });
        }
        
        // Get the request to validate
        this.db.get('SELECT * FROM friends WHERE id = ?', [requestId], (err, request) => {
            if (err) {
                logger.error('Error fetching friend request:', err);
                return res.status(500).json({ error: 'Failed to fetch friend request' });
            }
            
            if (!request) {
                return res.status(404).json({ error: 'Friend request not found' });
            }
            
            // Validate that the current user is the one being requested
            if (request.friend_id !== currentUserId) {
                return res.status(403).json({ error: 'Not authorized to respond to this request' });
            }
            
            // Update the request status
            const stmt = this.db.prepare('UPDATE friends SET status = ? WHERE id = ?');
            
            try {
                stmt.run([response === 'accept' ? 'accepted' : 'rejected', requestId]);
                
                // If accepted, create reciprocal friendship
                if (response === 'accept') {
                    const reciprocalStmt = this.db.prepare(`
                        INSERT OR IGNORE INTO friends (user_id, friend_id, status)
                        VALUES (?, ?, ?)
                    `);
                    
                    reciprocalStmt.run([request.friend_id, request.user_id, 'accepted']);
                    reciprocalStmt.finalize();
                }
                
                res.json({ 
                    id: requestId, 
                    status: response === 'accept' ? 'accepted' : 'rejected',
                    message: `Friend request ${response === 'accept' ? 'accepted' : 'rejected'}`
                });
            } catch (error) {
                logger.error('Error responding to friend request:', error);
                res.status(500).json({ error: 'Failed to respond to friend request' });
            } finally {
                stmt.finalize();
            }
        });
    }

    getFriends(req, res) {
        const { userId } = req.query;
        
        // Get friends of the user
        this.db.all(`
            SELECT u.id, u.username, u.email, f.status, f.created_at
            FROM friends f
            JOIN users u ON (f.friend_id = u.id)
            WHERE f.user_id = ? AND f.status = 'accepted'
            UNION
            SELECT u.id, u.username, u.email, f.status, f.created_at
            FROM friends f
            JOIN users u ON (f.user_id = u.id)
            WHERE f.friend_id = ? AND f.status = 'accepted'
        `, [userId, userId], (err, friends) => {
            if (err) {
                logger.error('Error fetching friends:', err);
                return res.status(500).json({ error: 'Failed to fetch friends' });
            }
            
            res.json(friends);
        });
    }

    // Club System
    createClub(req, res) {
        const { name, description, type, createdBy } = req.body;
        
        if (!name || !type || !createdBy) {
            return res.status(400).json({ error: 'Name, type, and createdBy are required' });
        }
        
        // Check if club name already exists
        this.db.get('SELECT id FROM clubs WHERE name = ?', [name], (err, existing) => {
            if (err) {
                logger.error('Error checking existing club:', err);
                return res.status(500).json({ error: 'Failed to check existing club' });
            }
            
            if (existing) {
                return res.status(400).json({ error: 'Club name already exists' });
            }
            
            // Check if user exists
            this.db.get('SELECT id FROM users WHERE id = ?', [createdBy], (err, user) => {
                if (err) {
                    logger.error('Error checking user:', err);
                    return res.status(500).json({ error: 'Failed to validate user' });
                }
                
                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }
                
                // Create club
                const clubStmt = this.db.prepare(`
                    INSERT INTO clubs (name, description, type, created_by)
                    VALUES (?, ?, ?, ?)
                `);
                
                try {
                    const clubResult = clubStmt.run([name, description, type, createdBy]);
                    const clubId = clubResult.lastID;
                    
                    // Add creator as admin member
                    const memberStmt = this.db.prepare(`
                        INSERT INTO club_members (club_id, user_id, role)
                        VALUES (?, ?, ?)
                    `);
                    
                    memberStmt.run([clubId, createdBy, 'admin']);
                    memberStmt.finalize();
                    
                    const newClub = {
                        id: clubId,
                        name,
                        description,
                        type,
                        createdBy,
                        createdAt: new Date().toISOString()
                    };
                    
                    // Emit socket event
                    req.app.get('io').emit('club.created', newClub);
                    
                    res.status(201).json(newClub);
                } catch (error) {
                    logger.error('Error creating club:', error);
                    res.status(500).json({ error: 'Failed to create club' });
                } finally {
                    clubStmt.finalize();
                }
            });
        });
    }

    getClubs(req, res) {
        const { type, search } = req.query;
        
        let query = 'SELECT * FROM clubs WHERE 1=1';
        const params = [];
        
        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }
        
        if (search) {
            query += ' AND (name LIKE ? OR description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        query += ' ORDER BY created_at DESC';
        
        this.db.all(query, params, (err, clubs) => {
            if (err) {
                logger.error('Error fetching clubs:', err);
                return res.status(500).json({ error: 'Failed to fetch clubs' });
            }
            
            res.json(clubs);
        });
    }

    joinClub(req, res) {
        const { clubId, userId } = req.body;
        
        if (!clubId || !userId) {
            return res.status(400).json({ error: 'clubId and userId are required' });
        }
        
        // Check if club exists
        this.db.get('SELECT id FROM clubs WHERE id = ?', [clubId], (err, club) => {
            if (err) {
                logger.error('Error checking club:', err);
                return res.status(500).json({ error: 'Failed to validate club' });
            }
            
            if (!club) {
                return res.status(404).json({ error: 'Club not found' });
            }
            
            // Check if user exists
            this.db.get('SELECT id FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) {
                    logger.error('Error checking user:', err);
                    return res.status(500).json({ error: 'Failed to validate user' });
                }
                
                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }
                
                // Check if user is already a member
                this.db.get('SELECT id FROM club_members WHERE club_id = ? AND user_id = ?', [clubId, userId], (err, existing) => {
                    if (err) {
                        logger.error('Error checking existing membership:', err);
                        return res.status(500).json({ error: 'Failed to check existing membership' });
                    }
                    
                    if (existing) {
                        return res.status(400).json({ error: 'User is already a member of this club' });
                    }
                    
                    // Add user to club as member
                    const stmt = this.db.prepare(`
                        INSERT INTO club_members (club_id, user_id, role)
                        VALUES (?, ?, ?)
                    `);
                    
                    try {
                        const result = stmt.run([clubId, userId, 'member']);
                        
                        const newMembership = {
                            id: result.lastID,
                            clubId,
                            userId,
                            role: 'member',
                            joinedAt: new Date().toISOString()
                        };
                        
                        res.status(201).json(newMembership);
                    } catch (error) {
                        logger.error('Error joining club:', error);
                        res.status(500).json({ error: 'Failed to join club' });
                    } finally {
                        stmt.finalize();
                    }
                });
            });
        });
    }

    getClubMembers(req, res) {
        const { clubId } = req.query;
        
        this.db.all(`
            SELECT u.id, u.username, cm.role, cm.joined_at
            FROM club_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.club_id = ?
            ORDER BY cm.joined_at DESC
        `, [clubId], (err, members) => {
            if (err) {
                logger.error('Error fetching club members:', err);
                return res.status(500).json({ error: 'Failed to fetch club members' });
            }
            
            res.json(members);
        });
    }

    // Tournament System
    createTournament(req, res) {
        const { name, type, description, startDate, endDate, entryFee, prizePool, createdBy } = req.body;
        
        if (!name || !type || !startDate || !endDate || !createdBy) {
            return res.status(400).json({ error: 'Name, type, start date, end date, and createdBy are required' });
        }
        
        // Check if user exists
        this.db.get('SELECT id FROM users WHERE id = ?', [createdBy], (err, user) => {
            if (err) {
                logger.error('Error checking user:', err);
                return res.status(500).json({ error: 'Failed to validate user' });
            }
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            // Create tournament
            const stmt = this.db.prepare(`
                INSERT INTO tournaments (name, type, description, start_date, end_date, entry_fee, prize_pool, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            try {
                const result = stmt.run([name, type, description, startDate, endDate, entryFee, prizePool, createdBy]);
                
                const newTournament = {
                    id: result.lastID,
                    name,
                    type,
                    description,
                    startDate,
                    endDate,
                    entryFee: entryFee || 0,
                    prizePool: prizePool || 0,
                    createdBy,
                    createdAt: new Date().toISOString()
                };
                
                // Emit socket event
                req.app.get('io').emit('tournament.created', newTournament);
                
                res.status(201).json(newTournament);
            } catch (error) {
                logger.error('Error creating tournament:', error);
                res.status(500).json({ error: 'Failed to create tournament' });
            } finally {
                stmt.finalize();
            }
        });
    }

    getTournaments(req, res) {
        const { type, status, search } = req.query; // status: upcoming, ongoing, completed
        
        let query = 'SELECT * FROM tournaments WHERE 1=1';
        const params = [];
        
        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }
        
        if (status) {
            const now = new Date().toISOString();
            switch (status) {
                case 'upcoming':
                    query += ' AND start_date > ?';
                    params.push(now);
                    break;
                case 'ongoing':
                    query += ' AND start_date <= ? AND end_date >= ?';
                    params.push(now, now);
                    break;
                case 'completed':
                    query += ' AND end_date < ?';
                    params.push(now);
                    break;
            }
        }
        
        if (search) {
            query += ' AND (name LIKE ? OR description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        query += ' ORDER BY created_at DESC';
        
        this.db.all(query, params, (err, tournaments) => {
            if (err) {
                logger.error('Error fetching tournaments:', err);
                return res.status(500).json({ error: 'Failed to fetch tournaments' });
            }
            
            res.json(tournaments);
        });
    }

    joinTournament(req, res) {
        const { tournamentId, userId } = req.body;
        
        if (!tournamentId || !userId) {
            return res.status(400).json({ error: 'tournamentId and userId are required' });
        }
        
        // Check if tournament exists and is still accepting participants
        this.db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId], (err, tournament) => {
            if (err) {
                logger.error('Error checking tournament:', err);
                return res.status(500).json({ error: 'Failed to validate tournament' });
            }
            
            if (!tournament) {
                return res.status(404).json({ error: 'Tournament not found' });
            }
            
            // Check if tournament has started
            const now = new Date().toISOString();
            if (tournament.start_date < now) {
                return res.status(400).json({ error: 'Tournament has already started' });
            }
            
            // Check if user exists
            this.db.get('SELECT id FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) {
                    logger.error('Error checking user:', err);
                    return res.status(500).json({ error: 'Failed to validate user' });
                }
                
                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }
                
                // Check if user is already participating
                this.db.get('SELECT id FROM tournament_participants WHERE tournament_id = ? AND user_id = ?', [tournamentId, userId], (err, existing) => {
                    if (err) {
                        logger.error('Error checking existing participation:', err);
                        return res.status(500).json({ error: 'Failed to check existing participation' });
                    }
                    
                    if (existing) {
                        return res.status(400).json({ error: 'User is already participating in this tournament' });
                    }
                    
                    // Add user to tournament
                    const stmt = this.db.prepare(`
                        INSERT INTO tournament_participants (tournament_id, user_id)
                        VALUES (?, ?)
                    `);
                    
                    try {
                        const result = stmt.run([tournamentId, userId]);
                        
                        const newParticipant = {
                            id: result.lastID,
                            tournamentId,
                            userId,
                            joinedAt: new Date().toISOString(),
                            score: 0
                        };
                        
                        res.status(201).json(newParticipant);
                    } catch (error) {
                        logger.error('Error joining tournament:', error);
                        res.status(500).json({ error: 'Failed to join tournament' });
                    } finally {
                        stmt.finalize();
                    }
                });
            });
        });
    }

    getTournamentParticipants(req, res) {
        const { tournamentId } = req.query;
        
        this.db.all(`
            SELECT u.id, u.username, tp.score, tp.joined_at
            FROM tournament_participants tp
            JOIN users u ON tp.user_id = u.id
            WHERE tp.tournament_id = ?
            ORDER BY tp.score DESC, tp.joined_at ASC
        `, [tournamentId], (err, participants) => {
            if (err) {
                logger.error('Error fetching tournament participants:', err);
                return res.status(500).json({ error: 'Failed to fetch tournament participants' });
            }
            
            res.json(participants);
        });
    }
}

const socialArena = new SocialArena();

// Define routes
router.post('/friends/request', (req, res) => socialArena.sendFriendRequest(req, res));
router.get('/friends/requests', (req, res) => socialArena.getFriendRequests(req, res));
router.post('/friends/respond', (req, res) => socialArena.respondToFriendRequest(req, res));
router.get('/friends', (req, res) => socialArena.getFriends(req, res));

router.post('/clubs', (req, res) => socialArena.createClub(req, res));
router.get('/clubs', (req, res) => socialArena.getClubs(req, res));
router.post('/clubs/join', (req, res) => socialArena.joinClub(req, res));
router.get('/clubs/members', (req, res) => socialArena.getClubMembers(req, res));

router.post('/tournaments', (req, res) => socialArena.createTournament(req, res));
router.get('/tournaments', (req, res) => socialArena.getTournaments(req, res));
router.post('/tournaments/join', (req, res) => socialArena.joinTournament(req, res));
router.get('/tournaments/participants', (req, res) => socialArena.getTournamentParticipants(req, res));

function initializeSocialArena(app, io) {
    socialArena.initialize(app, io);
    return socialArena;
}

module.exports = {
    initializeSocialArena
};