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
    { id: 1, name: 'IT Devs'},
    { id: 2, name: 'R&G'},
    { id: 3, name: 'People Ops'},
    { id: 4, name: 'Payments'},
    { id: 5, name: 'Mortgage'},
    { id: 6, name: 'Marketing'}
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
//    { id: 1, title: "User Authentication System", type: "Feature", team: 1, sprint: 1, description: "Implement secure login/logout functionality with session management, password hashing, and multi-factor authentication support." },
//    { id: 2, title: "Database Performance Optimization", type: "Feature", team: 1, sprint: 1, description: "Optimize database queries, add proper indexing, implement connection pooling, and reduce response times for high-traffic scenarios." },
//    { id: 3, title: "Mobile App UI Redesign", type: "Feature", team: 2, sprint: 2, description: "Create modern, responsive mobile interface with improved navigation, accessibility features, and consistent design patterns." },
//    { id: 4, title: "Payment Gateway Integration", type: "Milestone", team: 1, sprint: 3, description: "Integrate multiple payment providers (Stripe, PayPal, etc.) with secure transaction processing, refund handling, and fraud detection." },
//    { id: 5, title: "Automated Testing Suite", type: "Feature", team: 3, sprint: 3, description: "Build comprehensive test automation framework covering unit tests, integration tests, and end-to-end testing scenarios." },
//    { id: 6, title: "CI/CD Pipeline Setup", type: "Milestone", team: 4, sprint: 2, description: "Configure automated build, test, and deployment pipeline with staging environments and rollback capabilities." },
//    { id: 7, title: "Employee Onboarding Portal", type: "Feature", team: 4, sprint: 1, description: "Develop self-service portal for new employee registration, document uploads, and workflow automation for HR processes." },
//    { id: 8, title: "Customer Support Chat", type: "Feature", team: 4, sprint: 4, description: "Implement real-time chat system with agent routing, chat history, file sharing, and integration with support ticketing system." },
//    { id: 9, title: "Load Testing & Performance", type: "Major Dependency", team: 5, sprint: 4, description: "Conduct comprehensive load testing to validate system performance under expected traffic volumes and identify bottlenecks." },
//    { id: 10, title: "Security Vulnerability Assessment", type: "Major Dependency", team: 3, sprint: 5, description: "Perform security audit including penetration testing, code review, and compliance validation for data protection standards." },
//    { id: 11, title: "User Feedback Dashboard", type: "Feature", team: 5, sprint: 3, description: "Create analytics dashboard to collect, categorize, and visualize user feedback with sentiment analysis and reporting features." },
//    { id: 12, title: "Data Analytics Platform", type: "Feature", team: 1, sprint: 6, description: "Build real-time data processing and visualization platform with custom dashboards, data export, and business intelligence tools." }
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
    fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), (err) => {
      if (err) console.error('Error saving board data:', err.message);
    });
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

    fs.writeFile(SESSIONS_FILE, JSON.stringify(sessionsToSave, null, 2), (err) => {
      if (err) console.error('Error saving sessions:', err.message);
    });
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
  // Generate a code that's 6 characters long, using only uppercase letters and numbers
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create new session
function createSession(customCode = null) {
  // Use custom code if provided, otherwise generate one
  const code = customCode || generateAccessCode();
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
  const customCode = req.body.code;
  
  // Validate custom code if provided
  if (customCode) {
    // Check format (alphanumeric, 3-6 chars)
    if (!/^[A-Z0-9]{3,6}$/.test(customCode)) {
      return res.status(400).json({ error: 'Access code must be 3-6 alphanumeric characters' });
    }
    
    // Check if code already exists
    if (sessionData.activeCodes.includes(customCode)) {
      return res.status(400).json({ error: 'Access code already in use' });
    }
  }
  
  const session = createSession(customCode);
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
          team: Number(payload.team), // Ensure team is numeric
          sprint: Number(payload.sprint), // Ensure sprint is numeric
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
          session.boardData.stickies[stickyIndex].team = Number(data.team);
          session.boardData.stickies[stickyIndex].sprint = Number(data.sprint);
          saveSessions(sessionData);
          
          // Broadcast to all users in session
          io.to(sid).emit('sticky-moved', data);
        }
      }
    }
  });
  
  // Handle dependency updates
  socket.on('update-dependencies', (payload) => {
    // Support two payload shapes: (dependenciesArray) or ({ sessionId, dependencies })
    let deps = null;
    let targetSessionId = socket.sessionId;
    if (Array.isArray(payload)) {
      deps = payload;
    } else if (payload && payload.dependencies) {
      deps = payload.dependencies;
      if (!targetSessionId && payload.sessionId) targetSessionId = payload.sessionId;
    } else {
      // Invalid payload
      return;
    }

    if (targetSessionId) {
      const session = sessionData.sessions[targetSessionId];
      if (session) {
        session.boardData.dependencies = deps;
        saveSessions(sessionData);

        // Broadcast to all other users in session
        socket.to(targetSessionId).emit('dependencies-updated', deps);
      }
    }
  });

  // Import entire board state for a session
  socket.on('import-board-data', (payload) => {
    try {
      const sid = socket.sessionId || (payload && payload.sessionId);
      if (!sid) {
        socket.emit('error', { message: 'Missing sessionId for import' });
        return;
      }
      const session = sessionData.sessions[sid];
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }
      const incoming = payload && payload.boardData;
      if (!incoming || typeof incoming !== 'object') {
        socket.emit('error', { message: 'Invalid import payload' });
        return;
      }
      // Basic schema validation
      if (!Array.isArray(incoming.teams) || !Array.isArray(incoming.sprints) || !Array.isArray(incoming.stickies) || !Array.isArray(incoming.dependencies)) {
        socket.emit('error', { message: 'Import JSON must include teams, sprints, stickies, dependencies arrays' });
        return;
      }

      // Sanitize and normalize
      const teams = incoming.teams.map(t => ({ id: Number(t.id), name: String(t.name || '').trim() })).filter(t => !!t.name && !isNaN(t.id));
      const sprints = incoming.sprints.map(s => ({ id: Number(s.id), name: String(s.name || '').trim() })).filter(s => !!s.name && !isNaN(s.id));

      const validTeamIds = new Set(teams.map(t => t.id));
      const validSprintIds = new Set(sprints.map(s => s.id));

      const stickies = incoming.stickies
        .map(s => ({
          id: Number(s.id),
          title: String(s.title || '').trim(),
          type: s.type ? String(s.type) : 'Feature',
          team: Number(s.team),
          sprint: Number(s.sprint),
          description: s.description ? String(s.description) : ''
        }))
        .filter(s => !!s.title && !isNaN(s.id) && validTeamIds.has(s.team) && validSprintIds.has(s.sprint));

      // Drop dependencies referencing missing stickies; ensure fields
      const stickyIds = new Set(stickies.map(s => s.id));
      const dependencies = incoming.dependencies
        .map(d => ({
          from: Number(d.from),
          to: Number(d.to),
          fromDot: d.fromDot || 'start',
          toDot: d.toDot || 'end',
          relationship: d.relationship || 'depends on',
          additionalInfo: d.additionalInfo || ''
        }))
        .filter(d => stickyIds.has(d.from) && stickyIds.has(d.to));

      // Compute nextStickyId
      const maxId = stickies.reduce((m, s) => Math.max(m, s.id), 0);
      const nextStickyId = Number.isFinite(maxId) ? maxId + 1 : 1;

      session.boardData = { teams, sprints, stickies, dependencies, nextStickyId };
      saveSessions(sessionData);

      // Broadcast full board data to everyone in the session (including importer)
      io.to(sid).emit('board-data', session.boardData);
      // Notify importer
      socket.emit('import-complete', { message: 'Board imported successfully' });
    } catch (e) {
      socket.emit('error', { message: 'Import failed: ' + (e.message || String(e)) });
    }
  });
  
  // Handle team management
  socket.on('add-team', (data) => {
    if (socket.sessionId) {
      const session = sessionData.sessions[socket.sessionId];
      if (session && data && data.name) {
        // Ensure unique ID
        const newId = Math.max(...session.boardData.teams.map(s => s.id), 0) + 1;    
        const newTeam = {
          id: newId,
          name: data.name
        };
        
        console.log('Server creating new team:', newTeam);

        // Check for duplicate names
        const duplicate = session.boardData.teams.find(s => s.name === data.name);
        if (duplicate) {
          console.log('Duplicate team name found:', duplicate);
          socket.emit('error', { message: 'Team with this name already exists' });
          return;
        }
          
        session.boardData.teams.push(newTeam);
        saveSessions(sessionData);
        
        // Emit to everyone including sender
        io.to(socket.sessionId).emit('team-added', newTeam);
      } else {
        console.log('Invalid team data:', data);
      } 
    } else {
        console.log('No session ID for socket:', socket.id);
      }
  });
  
  // Handle sprint management
  socket.on('add-sprint', (data) => {
    
    if (socket.sessionId) {
      const session = sessionData.sessions[socket.sessionId];
      if (session && data && data.name) {
        // Ensure unique ID
        const newId = Math.max(...session.boardData.sprints.map(s => s.id), 0) + 1;
        const newSprint = {
          id: newId,
          name: data.name
        };

        console.log('Server creating new sprint:', newSprint);

        // Check for duplicate names
        const duplicate = session.boardData.sprints.find(s => s.name === data.name);
        if (duplicate) {
          console.log('Duplicate sprint name found:', duplicate);
          socket.emit('error', { message: 'Sprint with this name already exists' });
          return;
        }

        session.boardData.sprints.push(newSprint);
        saveSessions(sessionData);
        
        console.log('Server broadcasting sprint-added to session', socket.sessionId);
        // Emit to everyone including sender
        io.to(socket.sessionId).emit('sprint-added', newSprint);
      } else {
        console.log('Invalid sprint data:', data);
      }
    } else {
      console.log('No session ID for socket:', socket.id);
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

// Health endpoint for platform probes
app.get('/health', (req, res) => {
  try {
    const sessionsCount = Object.keys(sessionData.sessions || {}).length;
    res.json({ status: 'ok', time: new Date().toISOString(), sessions: sessionsCount });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e?.message || 'unknown' });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});