const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Data storage
const DATA_FILE = path.join(__dirname, 'data', 'board-data.json');
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize default board data
const defaultBoardData = {
  teams: [
    { id: 'dev', name: 'IT Devs', color: 'team-dev' },
    { id: 'design', name: 'R&G', color: 'team-design' },
    { id: 'qa', name: 'People Ops', color: 'team-qa' },
    { id: 'devops', name: 'Payments', color: 'team-devops' },
    { id: 'product', name: 'Mortgage', color: 'team-product' },
    { id: 'marketing', name: 'Marketing', color: 'team-marketing' }
  ],
  sprints: [
    { id: 1, name: 'Iteration 1' },
    { id: 2, name: 'Iteration 2' },
    { id: 3, name: 'Iteration 3' },
    { id: 4, name: 'Iteration 4' },
    { id: 5, name: 'Iteration 5' },
    { id: 6, name: 'Iteration 6' }
  ],
  stickies: [
    { id: 1, title: "User Authentication System", type: "Feature", team: "dev", sprint: 1, description: "Implement secure login/logout functionality with session management, password hashing, and multi-factor authentication support." },
    { id: 2, title: "Database Performance Optimization", type: "Feature", team: "dev", sprint: 1, description: "Optimize database queries, add proper indexing, implement connection pooling, and reduce response times for high-traffic scenarios." },
    { id: 3, title: "Mobile App UI Redesign", type: "Feature", team: "design", sprint: 2, description: "Create modern, responsive mobile interface with improved navigation, accessibility features, and consistent design patterns." },
    { id: 4, title: "Payment Gateway Integration", type: "Milestone", team: "dev", sprint: 3, description: "Integrate multiple payment providers (Stripe, PayPal, etc.) with secure transaction processing, refund handling, and fraud detection." },
    { id: 5, title: "Automated Testing Suite", type: "Feature", team: "qa", sprint: 3, description: "Build comprehensive test automation framework covering unit tests, integration tests, and end-to-end testing scenarios." },
    { id: 6, title: "CI/CD Pipeline Setup", type: "Milestone", team: "devops", sprint: 2, description: "Configure automated build, test, and deployment pipeline with staging environments and rollback capabilities." },
    { id: 7, title: "Employee Onboarding Portal", type: "Feature", team: "product", sprint: 1, description: "Develop self-service portal for new employee registration, document uploads, and workflow automation for HR processes." },
    { id: 8, title: "Customer Support Chat", type: "Feature", team: "product", sprint: 4, description: "Implement real-time chat system with agent routing, chat history, file sharing, and integration with support ticketing system." },
    { id: 9, title: "Load Testing & Performance", type: "Major Dependency", team: "qa", sprint: 4, description: "Conduct comprehensive load testing to validate system performance under expected traffic volumes and identify bottlenecks." },
    { id: 10, title: "Security Vulnerability Assessment", type: "Major Dependency", team: "devops", sprint: 5, description: "Perform security audit including penetration testing, code review, and compliance validation for data protection standards." },
    { id: 11, title: "User Feedback Dashboard", type: "Feature", team: "product", sprint: 3, description: "Create analytics dashboard to collect, categorize, and visualize user feedback with sentiment analysis and reporting features." },
    { id: 12, title: "Data Analytics Platform", type: "Feature", team: "dev", sprint: 6, description: "Build real-time data processing and visualization platform with custom dashboards, data export, and business intelligence tools." }
  ],
  dependencies: [
  ],
    nextStickyId: 13
};

// Session data structure
const defaultSessions = {
  sessions: {},
  activeCodes: []
};

// Load or create data files
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

      // Migrate legacy 'features' -> 'stickies' if needed
      if (data && data.features && !data.stickies) {
        data.stickies = data.features.map(feature => {
          const team = feature.team || feature.dept;
          const sticky = { ...feature, type: feature.type || 'Feature', team };
          if (sticky.dept) delete sticky.dept;
          return sticky;
        });
        delete data.features;
        if (data.nextFeatureId && !data.nextStickyId) {
          data.nextStickyId = data.nextFeatureId;
          delete data.nextFeatureId;
        }
      }

      return data;
    }
  } catch (error) {
    console.log('Error loading board data, using defaults:', error.message);
  }
  return defaultBoardData;
}

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      
      // Migrate existing sessions to new structure
      Object.values(sessions.sessions || {}).forEach(session => {
        // Add activeUsers if missing (convert from array if needed)
        if (!session.activeUsers) {
          session.activeUsers = new Set();
        } else if (Array.isArray(session.activeUsers)) {
          session.activeUsers = new Set(session.activeUsers);
        }
        
        
        // Ensure dependencies have the new structure
        if (session.boardData && session.boardData.dependencies) {
          session.boardData.dependencies.forEach(dep => {
            if (!dep.relationship) {
              dep.relationship = 'depends on';
            }
            if (!dep.additionalInfo) {
              dep.additionalInfo = '';
            }
          });
        }
      });
      
      return sessions;
    }
  } catch (error) {
    console.log('Error loading sessions, using defaults:', error.message);
  }
  return defaultSessions;
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving board data:', error.message);
  }
}

function saveSessions(sessions) {
  try {
    // Create a copy for saving, converting Sets to arrays
    const sessionsToSave = JSON.parse(JSON.stringify(sessions, (key, value) => {
      if (key === 'activeUsers' && value instanceof Set) {
        return Array.from(value);
      }
      return value;
    }));
    
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsToSave, null, 2));
  } catch (error) {
    console.error('Error saving sessions:', error.message);
  }
}

let boardData = loadData();
let sessionData = loadSessions();

// Track all connected users globally
const globalActiveUsers = new Set();

// Generate access code
function generateAccessCode() {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  return code;
}

// Create new session
function createSession() {
  const code = generateAccessCode();
  const sessionId = uuidv4();
  
  sessionData.sessions[sessionId] = {
    code,
    created: new Date().toISOString(),
    users: [],
    activeUsers: new Set(),
    boardData: JSON.parse(JSON.stringify(boardData)) // Deep copy
  };
  
  sessionData.activeCodes.push(code);
  saveSessions(sessionData);
  
  return { sessionId, code };
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/create-session', (req, res) => {
  const session = createSession();
  res.json(session);
});

app.post('/api/join-session', (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Access code required' });
  }
  
  // Find session by code
  const sessionEntry = Object.entries(sessionData.sessions).find(
    ([id, session]) => session.code === code.toUpperCase()
  );
  
  if (!sessionEntry) {
    return res.status(404).json({ error: 'Invalid access code' });
  }
  
  const [sessionId, session] = sessionEntry;
  res.json({ sessionId, boardData: session.boardData });
});

app.get('/api/board/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessionData.sessions[sessionId];
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json(session.boardData);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Add user to global active users immediately
  globalActiveUsers.add(socket.id);
  
  // Broadcast updated count to all users
  io.emit('global-participant-count', globalActiveUsers.size);
  
  socket.on('join-session', (sessionId) => {
    const session = sessionData.sessions[sessionId];
    if (session) {
      socket.join(sessionId);
      socket.sessionId = sessionId;
      
      // Initialize activeUsers Set if it doesn't exist (for existing sessions)
      if (!session.activeUsers) {
        session.activeUsers = new Set();
      }
      
      // Add user to active users set
      session.activeUsers.add(socket.id);
      
      console.log(`User ${socket.id} joined session ${sessionId}`);
      
      // Send current board state
      socket.emit('board-data', session.boardData);
      
      // Send current participant count to the joining user
      socket.emit('participant-count', session.activeUsers.size);
      socket.emit('global-participant-count', globalActiveUsers.size);
      
      // Notify others in the session about new user and updated count
      socket.to(sessionId).emit('user-joined', { userId: socket.id });
      socket.to(sessionId).emit('participant-count', session.activeUsers.size);
    } else {
      socket.emit('error', { message: 'Session not found' });
    }
  });
  
  // Handle sticky updates
  socket.on('update-sticky', (data) => {
    const sid = socket.sessionId || data.sessionId;
    if (sid) {
      const session = sessionData.sessions[sid];
      if (session) {
        if (data.deleted) {
          session.boardData.stickies = session.boardData.stickies.filter(s => s.id !== data.id);
        } else {
          const stickyIndex = session.boardData.stickies.findIndex(s => s.id === data.id);
          if (stickyIndex !== -1) {
            session.boardData.stickies[stickyIndex] = { ...session.boardData.stickies[stickyIndex], ...data };
          }
        }
        saveSessions(sessionData);
        
        // Broadcast to all users in session
        io.to(sid).emit('sticky-updated', data);
      }
    }
  });
  
  // Handle sticky creation
  socket.on('create-sticky', (data) => {
    // allow sessionId passed in payload as fallback
    const sid = socket.sessionId || data.sessionId;
    if (sid) {
      const session = sessionData.sessions[sid];
      if (session) {
        const payload = { ...data };
        // remove sessionId from payload before storing
        delete payload.sessionId;

        const newSticky = {
          id: session.boardData.nextStickyId++,
          ...payload,
          description: payload.description || ''
        };
        session.boardData.stickies.push(newSticky);
        saveSessions(sessionData);

        // Broadcast to all users in session
        io.to(sid).emit('sticky-created', newSticky);
      }
    }
  });
  
  // Handle sticky movement
  socket.on('move-sticky', (data) => {
    const sid = socket.sessionId || data.sessionId;
    if (sid) {
      const session = sessionData.sessions[sid];
      if (session) {
        const stickyIndex = session.boardData.stickies.findIndex(s => s.id === data.stickyId);
        if (stickyIndex !== -1) {
          session.boardData.stickies[stickyIndex].team = data.team;
          session.boardData.stickies[stickyIndex].sprint = data.sprint;
          saveSessions(sessionData);
          
          // Broadcast to all users in session
          io.to(sid).emit('sticky-moved', data);
        }
      }
    }
  });
  
  // Handle dependency updates
  socket.on('update-dependencies', (dependencies) => {
    if (socket.sessionId) {
      const session = sessionData.sessions[socket.sessionId];
      if (session) {
        session.boardData.dependencies = dependencies;
        saveSessions(sessionData);
        
        // Broadcast to all users in session
        socket.to(socket.sessionId).emit('dependencies-updated', dependencies);
      }
    }
  });
  
  // Handle team management
  socket.on('add-team', (team) => {
    if (socket.sessionId) {
      const session = sessionData.sessions[socket.sessionId];
      if (session) {
        // Check for duplicates
        if (!session.boardData.teams.some(t => t.id === team.id)) {
          session.boardData.teams.push(team);
          saveSessions(sessionData);
          
          // Broadcast to all users in session
          io.to(socket.sessionId).emit('team-added', team);
        }
      }
    }
  });
  
  socket.on('remove-team', (teamId) => {
    if (socket.sessionId) {
      const session = sessionData.sessions[socket.sessionId];
      if (session) {
        // Remove team and its stickies
        session.boardData.teams = session.boardData.teams.filter(d => d.id !== teamId);
        session.boardData.stickies = session.boardData.stickies.filter(s => s.team !== teamId);
        
        // Also remove any dependencies involving stickies from this team
        session.boardData.dependencies = session.boardData.dependencies.filter(d => {
          const fromSticky = session.boardData.stickies.find(s => s.id === d.from);
          const toSticky = session.boardData.stickies.find(s => s.id === d.to);
          return fromSticky && toSticky; // Only keep dependencies where both stickies still exist
        });
        
        // Save changes to file
        saveSessions(sessionData);
        
        // Broadcast to all users in session
        io.to(socket.sessionId).emit('team-removed', teamId);
      }
    }
  });
  
  // Handle sprint management
  socket.on('add-sprint', (sprint) => {
    if (socket.sessionId) {
      const session = sessionData.sessions[socket.sessionId];
      if (session) {
        // Ensure unique ID
        const newId = Math.max(...session.boardData.sprints.map(s => s.id), 0) + 1;
        const newSprint = {
          ...sprint,
          id: newId
        };

        session.boardData.sprints.push(newSprint);
        saveSessions(sessionData);
        
        // Broadcast to all users in session
        io.to(socket.sessionId).emit('sprint-added', newSprint);
      }
    }
  });
  
  socket.on('remove-sprint', (sprintId) => {
    if (socket.sessionId) {
      const session = sessionData.sessions[socket.sessionId];
      if (session) {
        // Remove sprint and its stickies
        session.boardData.sprints = session.boardData.sprints.filter(s => s.id !== sprintId);
        session.boardData.stickies = session.boardData.stickies.filter(s => s.sprint !== sprintId);
        
        // Also remove any dependencies involving removed stickies
        session.boardData.dependencies = session.boardData.dependencies.filter(d => {
          const fromSticky = session.boardData.stickies.find(s => s.id === d.from);
          const toSticky = session.boardData.stickies.find(s => s.id === d.to);
          return fromSticky && toSticky; // Only keep dependencies where both stickies still exist
        });
        
        // Save changes to file
        saveSessions(sessionData);
        
        // Broadcast to all users in session
        io.to(socket.sessionId).emit('sprint-removed', sprintId);
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from global active users
    globalActiveUsers.delete(socket.id);
    
    // Broadcast updated global count to all users
    io.emit('global-participant-count', globalActiveUsers.size);
    
    if (socket.sessionId) {
      const session = sessionData.sessions[socket.sessionId];
      if (session) {
        // Initialize activeUsers Set if it doesn't exist (for existing sessions)
        if (!session.activeUsers) {
          session.activeUsers = new Set();
        }
        
        // Remove user from active users set
        session.activeUsers.delete(socket.id);
        
        // Notify remaining users about user leaving and updated count
        socket.to(socket.sessionId).emit('user-left', { userId: socket.id });
        socket.to(socket.sessionId).emit('participant-count', session.activeUsers.size);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});