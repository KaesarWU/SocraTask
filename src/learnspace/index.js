const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const logger = require('../utils/logger');
const { getQwenNexus } = require('../ai/qwen-nexus');
const multer = require('multer');
const path = require('path');

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

class LearnSpace {
    constructor() {
        this.db = getDb();
        this.qwenNexus = getQwenNexus();
    }

    initialize(app, io) {
        // Mount routes
        app.use('/api/learnspace', router);
        
        // Socket.io event handlers
        this.setupSocketHandlers(io);
        
        logger.info('LearnSpace initialized');
    }

    setupSocketHandlers(io) {
        io.on('connection', (socket) => {
            logger.info('LearnSpace socket connected:', socket.id);
            
            socket.on('quiz.created', (quiz) => {
                io.emit('quiz.created.global', quiz);
            });
            
            socket.on('quiz.attempted', (attempt) => {
                io.emit('quiz.attempted.global', attempt);
            });
            
            socket.on('disconnect', () => {
                logger.info('LearnSpace socket disconnected:', socket.id);
            });
        });
    }

    // Quiz Management
    createQuiz(req, res) {
        const { title, subject, description, difficulty, isPublic, questions } = req.body;
        const creatorId = req.body.userId; // This would come from authentication
        
        if (!title || !subject || !creatorId) {
            return res.status(400).json({ error: 'Title, subject, and creatorId are required' });
        }
        
        // Begin transaction
        this.db.serialize(() => {
            // Insert quiz
            const quizStmt = this.db.prepare(`
                INSERT INTO quizzes (title, subject, description, difficulty, creator_id, is_public)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            try {
                const quizResult = quizStmt.run([title, subject, description, difficulty, creatorId, isPublic]);
                const quizId = quizResult.lastID;
                
                // Insert questions if provided
                if (questions && questions.length > 0) {
                    const questionStmt = this.db.prepare(`
                        INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `);
                    
                    for (const question of questions) {
                        questionStmt.run([
                            quizId,
                            question.questionText,
                            question.questionType || 'multiple_choice',
                            JSON.stringify(question.options || []),
                            question.correctAnswer,
                            question.explanation || ''
                        ]);
                    }
                    
                    questionStmt.finalize();
                }
                
                const newQuiz = {
                    id: quizId,
                    title,
                    subject,
                    description,
                    difficulty: difficulty || 'medium',
                    creatorId,
                    isPublic: isPublic || false,
                    createdAt: new Date().toISOString()
                };
                
                // Emit socket event
                req.app.get('io').emit('quiz.created', newQuiz);
                
                res.status(201).json(newQuiz);
            } catch (error) {
                logger.error('Error creating quiz:', error);
                res.status(500).json({ error: 'Failed to create quiz' });
            } finally {
                quizStmt.finalize();
            }
        });
    }

    getQuizzes(req, res) {
        const { subject, difficulty, isPublic, creatorId } = req.query;
        
        let query = 'SELECT * FROM quizzes WHERE 1=1';
        const params = [];
        
        if (subject) {
            query += ' AND subject = ?';
            params.push(subject);
        }
        
        if (difficulty) {
            query += ' AND difficulty = ?';
            params.push(difficulty);
        }
        
        if (isPublic !== undefined) {
            query += ' AND is_public = ?';
            params.push(isPublic);
        }
        
        if (creatorId) {
            query += ' AND creator_id = ?';
            params.push(creatorId);
        }
        
        query += ' ORDER BY created_at DESC';
        
        this.db.all(query, params, (err, quizzes) => {
            if (err) {
                logger.error('Error fetching quizzes:', err);
                return res.status(500).json({ error: 'Failed to fetch quizzes' });
            }
            
            res.json(quizzes);
        });
    }

    getQuizById(req, res) {
        const { id } = req.params;
        
        // Get quiz details
        this.db.get('SELECT * FROM quizzes WHERE id = ?', [id], (err, quiz) => {
            if (err) {
                logger.error('Error fetching quiz:', err);
                return res.status(500).json({ error: 'Failed to fetch quiz' });
            }
            
            if (!quiz) {
                return res.status(404).json({ error: 'Quiz not found' });
            }
            
            // Get questions for the quiz
            this.db.all('SELECT * FROM quiz_questions WHERE quiz_id = ?', [id], (err, questions) => {
                if (err) {
                    logger.error('Error fetching quiz questions:', err);
                    return res.status(500).json({ error: 'Failed to fetch quiz questions' });
                }
                
                // Parse options from JSON
                const parsedQuestions = questions.map(q => ({
                    ...q,
                    options: JSON.parse(q.options || '[]')
                }));
                
                res.json({
                    ...quiz,
                    questions: parsedQuestions
                });
            });
        });
    }

    // Quiz Attempt Management
    createQuizAttempt(req, res) {
        const { quizId, userId, answers } = req.body;
        
        if (!quizId || !userId || !answers) {
            return res.status(400).json({ error: 'QuizId, userId, and answers are required' });
        }
        
        // Get quiz and questions to calculate score
        this.db.get('SELECT * FROM quizzes WHERE id = ?', [quizId], (err, quiz) => {
            if (err) {
                logger.error('Error fetching quiz for attempt:', err);
                return res.status(500).json({ error: 'Failed to fetch quiz' });
            }
            
            if (!quiz) {
                return res.status(404).json({ error: 'Quiz not found' });
            }
            
            // Get questions and correct answers
            this.db.all('SELECT * FROM quiz_questions WHERE quiz_id = ?', [quizId], (err, questions) => {
                if (err) {
                    logger.error('Error fetching quiz questions for attempt:', err);
                    return res.status(500).json({ error: 'Failed to fetch quiz questions' });
                }
                
                // Calculate score
                let correctAnswers = 0;
                let totalQuestions = questions.length;
                
                for (const question of questions) {
                    const userAnswer = answers.find(a => a.questionId == question.id);
                    if (userAnswer && userAnswer.answer === question.correct_answer) {
                        correctAnswers++;
                    }
                }
                
                const score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
                
                // Insert quiz attempt
                const stmt = this.db.prepare(`
                    INSERT INTO quiz_attempts (user_id, quiz_id, score, max_score, answers)
                    VALUES (?, ?, ?, ?, ?)
                `);
                
                try {
                    const result = stmt.run([userId, quizId, score, 100, JSON.stringify(answers)]);
                    
                    const newAttempt = {
                        id: result.lastID,
                        userId,
                        quizId,
                        score,
                        maxScore: 100,
                        answers,
                        startedAt: new Date().toISOString()
                    };
                    
                    // Emit socket event
                    req.app.get('io').emit('quiz.attempted', newAttempt);
                    
                    res.status(201).json(newAttempt);
                } catch (error) {
                    logger.error('Error creating quiz attempt:', error);
                    res.status(500).json({ error: 'Failed to create quiz attempt' });
                } finally {
                    stmt.finalize();
                }
            });
        });
    }

    getQuizAttempts(req, res) {
        const { userId, quizId } = req.query;
        
        let query = 'SELECT * FROM quiz_attempts WHERE 1=1';
        const params = [];
        
        if (userId) {
            query += ' AND user_id = ?';
            params.push(userId);
        }
        
        if (quizId) {
            query += ' AND quiz_id = ?';
            params.push(quizId);
        }
        
        query += ' ORDER BY started_at DESC';
        
        this.db.all(query, params, (err, attempts) => {
            if (err) {
                logger.error('Error fetching quiz attempts:', err);
                return res.status(500).json({ error: 'Failed to fetch quiz attempts' });
            }
            
            // Parse answers from JSON
            const parsedAttempts = attempts.map(a => ({
                ...a,
                answers: JSON.parse(a.answers || '[]')
            }));
            
            res.json(parsedAttempts);
        });
    }

    // AI-Powered Quiz Creation from Image (Visual Importer)
    async createQuizFromImage(req, res) {
        if (!req.file) {
            return res.status(400).json({ error: 'Image file is required' });
        }
        
        const { subject, title, description } = req.body;
        const creatorId = req.body.userId; // This would come from authentication
        
        try {
            // Use Qwen AI with vision capabilities to analyze the image and create a quiz
            const qwen = this.qwenNexus;
            if (!qwen) {
                throw new Error('Qwen AI Nexus not initialized');
            }
            
            // Find a vision-capable model if available, otherwise use regular model
            let modelId = null;
            for (const [id, model] of qwen.models) {
                if (model.name.toLowerCase().includes('vl') || model.name.toLowerCase().includes('vision')) {
                    modelId = id;
                    break;
                }
            }
            
            // If no vision model found, use the default model
            if (!modelId) {
                modelId = qwen.activeModel || Array.from(qwen.models.keys())[0];
                if (!modelId) {
                    throw new Error('No AI model available');
                }
            }
            
            // Create a prompt for the AI to generate quiz questions from the image
            // In a real implementation, we would process the image file and send it to the AI
            // For this example, we'll simulate the process
            const prompt = `Analyze this image and create a quiz about ${subject || 'the content shown'}. 
Generate 5 multiple-choice questions based on the content. 
Each question should have 4 options with one correct answer.
Response in the following JSON format:
{
  "title": "Generated Quiz Title",
  "description": "Description of the quiz",
  "questions": [
    {
      "questionText": "Question text here",
      "questionType": "multiple_choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Explanation for the correct answer"
    }
  ]
}`;
            
            const result = await qwen.runInference(modelId, prompt);
            
            // Try to parse the AI response as JSON
            let parsedQuiz;
            try {
                // Extract JSON from the response
                const jsonMatch = result.response.match(/\{[\s\S]*\}/s);
                if (jsonMatch) {
                    parsedQuiz = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No valid JSON found in AI response');
                }
            } catch (parseError) {
                logger.error('Error parsing AI response:', parseError);
                return res.status(500).json({ error: 'Failed to parse AI response' });
            }
            
            // Create the quiz in the database
            this.db.serialize(() => {
                // Insert quiz
                const quizStmt = this.db.prepare(`
                    INSERT INTO quizzes (title, subject, description, creator_id, is_public)
                    VALUES (?, ?, ?, ?, ?)
                `);
                
                try {
                    const quizResult = quizStmt.run([
                        parsedQuiz.title || `${subject} Quiz from Image`,
                        subject || 'General',
                        parsedQuiz.description || `Quiz generated from image analysis`,
                        creatorId,
                        true // Public by default
                    ]);
                    const quizId = quizResult.lastID;
                    
                    // Insert questions
                    const questionStmt = this.db.prepare(`
                        INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `);
                    
                    for (const question of parsedQuiz.questions || []) {
                        questionStmt.run([
                            quizId,
                            question.questionText,
                            question.questionType || 'multiple_choice',
                            JSON.stringify(question.options || []),
                            question.correctAnswer,
                            question.explanation || ''
                        ]);
                    }
                    
                    questionStmt.finalize();
                    
                    const newQuiz = {
                        id: quizId,
                        title: parsedQuiz.title || `${subject} Quiz from Image`,
                        subject: subject || 'General',
                        description: parsedQuiz.description || `Quiz generated from image analysis`,
                        creatorId,
                        isPublic: true,
                        createdAt: new Date().toISOString()
                    };
                    
                    // Emit socket event
                    req.app.get('io').emit('quiz.created', newQuiz);
                    
                    res.status(201).json(newQuiz);
                } catch (error) {
                    logger.error('Error creating quiz from image:', error);
                    res.status(500).json({ error: 'Failed to create quiz from image' });
                } finally {
                    quizStmt.finalize();
                }
            });
        } catch (error) {
            logger.error('Error creating quiz from image:', error);
            res.status(500).json({ error: 'Failed to create quiz from image' });
        }
    }

    // AI-Powered Quiz Creation from Text
    async createQuizFromText(req, res) {
        const { text, subject, title, description, numQuestions } = req.body;
        const creatorId = req.body.userId; // This would come from authentication
        
        if (!text || !subject) {
            return res.status(400).json({ error: 'Text content and subject are required' });
        }
        
        try {
            // Use Qwen AI to generate quiz from text
            const qwen = this.qwenNexus;
            if (!qwen) {
                throw new Error('Qwen AI Nexus not initialized');
            }
            
            // Find an available model
            const modelId = qwen.activeModel || Array.from(qwen.models.keys())[0];
            if (!modelId) {
                throw new Error('No AI model available');
            }
            
            // Create a prompt for the AI to generate quiz questions from text
            const prompt = `Create a quiz about the following text content:
            
Text: "${text}"

Subject: ${subject}

Generate ${numQuestions || 5} multiple-choice questions based on this content. 
Each question should have 4 options with one correct answer.
Response in the following JSON format:
{
  "title": "Generated Quiz Title",
  "description": "Description of the quiz",
  "questions": [
    {
      "questionText": "Question text here",
      "questionType": "multiple_choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Explanation for the correct answer"
    }
  ]
}`;
            
            const result = await qwen.runInference(modelId, prompt);
            
            // Try to parse the AI response as JSON
            let parsedQuiz;
            try {
                // Extract JSON from the response
                const jsonMatch = result.response.match(/\{[\s\S]*\}/s);
                if (jsonMatch) {
                    parsedQuiz = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No valid JSON found in AI response');
                }
            } catch (parseError) {
                logger.error('Error parsing AI response:', parseError);
                return res.status(500).json({ error: 'Failed to parse AI response' });
            }
            
            // Create the quiz in the database
            this.db.serialize(() => {
                // Insert quiz
                const quizStmt = this.db.prepare(`
                    INSERT INTO quizzes (title, subject, description, creator_id, is_public)
                    VALUES (?, ?, ?, ?, ?)
                `);
                
                try {
                    const quizResult = quizStmt.run([
                        parsedQuiz.title || `${subject} Quiz from Text`,
                        subject,
                        parsedQuiz.description || `Quiz generated from text content`,
                        creatorId,
                        true // Public by default
                    ]);
                    const quizId = quizResult.lastID;
                    
                    // Insert questions
                    const questionStmt = this.db.prepare(`
                        INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `);
                    
                    for (const question of parsedQuiz.questions || []) {
                        questionStmt.run([
                            quizId,
                            question.questionText,
                            question.questionType || 'multiple_choice',
                            JSON.stringify(question.options || []),
                            question.correctAnswer,
                            question.explanation || ''
                        ]);
                    }
                    
                    questionStmt.finalize();
                    
                    const newQuiz = {
                        id: quizId,
                        title: parsedQuiz.title || `${subject} Quiz from Text`,
                        subject,
                        description: parsedQuiz.description || `Quiz generated from text content`,
                        creatorId,
                        isPublic: true,
                        createdAt: new Date().toISOString()
                    };
                    
                    // Emit socket event
                    req.app.get('io').emit('quiz.created', newQuiz);
                    
                    res.status(201).json(newQuiz);
                } catch (error) {
                    logger.error('Error creating quiz from text:', error);
                    res.status(500).json({ error: 'Failed to create quiz from text' });
                } finally {
                    quizStmt.finalize();
                }
            });
        } catch (error) {
            logger.error('Error creating quiz from text:', error);
            res.status(500).json({ error: 'Failed to create quiz from text' });
        }
    }

    // AI-Powered Content Moderation
    async moderateContent(req, res) {
        const { content, contentType } = req.body;
        
        try {
            // Use Qwen AI to moderate content
            const qwen = this.qwenNexus;
            if (!qwen) {
                throw new Error('Qwen AI Nexus not initialized');
            }
            
            // Find an available model
            const modelId = qwen.activeModel || Array.from(qwen.models.keys())[0];
            if (!modelId) {
                throw new Error('No AI model available');
            }
            
            let prompt = '';
            if (contentType === 'quiz') {
                prompt = `Moderate the following quiz content for appropriateness, accuracy, and educational value:
                
Quiz: "${content}"

Evaluate the following criteria:
1. Appropriateness: Is the content suitable for educational use?
2. Accuracy: Are the questions factually correct?
3. Educational Value: Does this quiz provide learning value?
4. Quality: Is the quiz well-structured and clear?

Response in the following JSON format:
{
  "approved": true/false,
  "issues": ["List of issues if any"],
  "suggestions": ["Improvement suggestions if any"],
  "confidence": "high/medium/low"
}`;
            } else if (contentType === 'question') {
                prompt = `Moderate the following quiz question for appropriateness, accuracy, and educational value:
                
Question: "${content}"

Evaluate the following criteria:
1. Appropriateness: Is the content suitable for educational use?
2. Accuracy: Is the question factually correct?
3. Educational Value: Does this question provide learning value?
4. Quality: Is the question well-structured and clear?

Response in the following JSON format:
{
  "approved": true/false,
  "issues": ["List of issues if any"],
  "suggestions": ["Improvement suggestions if any"],
  "confidence": "high/medium/low"
}`;
            }
            
            const result = await qwen.runInference(modelId, prompt);
            
            // Try to parse the AI response as JSON
            let moderationResult;
            try {
                // Extract JSON from the response
                const jsonMatch = result.response.match(/\{[\s\S]*\}/s);
                if (jsonMatch) {
                    moderationResult = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No valid JSON found in AI response');
                }
            } catch (parseError) {
                logger.error('Error parsing AI moderation response:', parseError);
                return res.status(500).json({ error: 'Failed to parse AI moderation response' });
            }
            
            res.json(moderationResult);
        } catch (error) {
            logger.error('Error moderating content:', error);
            res.status(500).json({ error: 'Failed to moderate content' });
        }
    }

    // Adaptive Learning Path Generation
    async generateLearningPath(req, res) {
        const { userId, subject, currentLevel, goals } = req.body;
        
        try {
            // Use Qwen AI to generate a personalized learning path
            const qwen = this.qwenNexus;
            if (!qwen) {
                throw new Error('Qwen AI Nexus not initialized');
            }
            
            // Find an available model
            const modelId = qwen.activeModel || Array.from(qwen.models.keys())[0];
            if (!modelId) {
                throw new Error('No AI model available');
            }
            
            // Get user's quiz attempt history to assess current level
            this.db.all(`
                SELECT qa.*, q.subject 
                FROM quiz_attempts qa 
                JOIN quizzes q ON qa.quiz_id = q.id 
                WHERE qa.user_id = ? AND q.subject = ?
                ORDER BY qa.started_at DESC
                LIMIT 10
            `, [userId, subject], async (err, attempts) => {
                if (err) {
                    logger.error('Error fetching user attempts:', err);
                    return res.status(500).json({ error: 'Failed to fetch user attempts' });
                }
                
                const avgScore = attempts.length > 0 
                    ? attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length 
                    : 0;
                
                // Create a prompt for the AI to generate a learning path
                const prompt = `Generate a personalized learning path for a user in ${subject}.
Current performance level: ${currentLevel || 'intermediate'} (based on average score of ${avgScore.toFixed(2)})
Learning goals: ${goals || 'General improvement'}

Consider the user's past quiz performance:
${attempts.map(a => `Quiz: ${a.quiz_id}, Score: ${a.score}%`).join('\n')}

Create a learning path with the following structure:
{
  "subject": "${subject}",
  "currentLevel": "${currentLevel || 'intermediate'}",
  "recommendedQuizzes": [
    {
      "quizId": "ID of recommended quiz",
      "title": "Title of quiz",
      "difficulty": "easy/medium/hard",
      "reason": "Why this quiz is recommended"
    }
  ],
  "learningPath": [
    {
      "topic": "Topic name",
      "description": "Brief description",
      "resources": ["Resource links or suggestions"],
      "estimatedTime": "Time to complete"
    }
  ],
  "nextSteps": ["Suggested next steps for the learner"]
}`;
                
                const result = await qwen.runInference(modelId, prompt);
                
                // Try to parse the AI response as JSON
                let learningPath;
                try {
                    // Extract JSON from the response
                    const jsonMatch = result.response.match(/\{[\s\S]*\}/s);
                    if (jsonMatch) {
                        learningPath = JSON.parse(jsonMatch[0]);
                    } else {
                        throw new Error('No valid JSON found in AI response');
                    }
                } catch (parseError) {
                    logger.error('Error parsing AI learning path response:', parseError);
                    return res.status(500).json({ error: 'Failed to parse AI learning path response' });
                }
                
                res.json(learningPath);
            });
        } catch (error) {
            logger.error('Error generating learning path:', error);
            res.status(500).json({ error: 'Failed to generate learning path' });
        }
    }
}

const learnSpace = new LearnSpace();

// Define routes
router.post('/quizzes', (req, res) => learnSpace.createQuiz(req, res));
router.get('/quizzes', (req, res) => learnSpace.getQuizzes(req, res));
router.get('/quizzes/:id', (req, res) => learnSpace.getQuizById(req, res));

router.post('/attempts', (req, res) => learnSpace.createQuizAttempt(req, res));
router.get('/attempts', (req, res) => learnSpace.getQuizAttempts(req, res));

router.post('/create-from-image', upload.single('image'), (req, res) => learnSpace.createQuizFromImage(req, res));
router.post('/create-from-text', (req, res) => learnSpace.createQuizFromText(req, res));

router.post('/moderate', (req, res) => learnSpace.moderateContent(req, res));
router.post('/learning-path', (req, res) => learnSpace.generateLearningPath(req, res));

function initializeLearnSpace(app, io) {
    learnSpace.initialize(app, io);
    return learnSpace;
}

module.exports = {
    initializeLearnSpace
};