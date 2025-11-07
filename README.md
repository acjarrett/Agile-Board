# Agile Feature Board

A multi-user collaborative agile board with real-time synchronization. Perfect for small teams (up to 100 people) to manage features across departments and sprints.

## Features

- **Multi-user collaboration**: Up to 100 users can work on the same board simultaneously
- **Session-based access**: Access code system for joining shared board instances
- **Real-time synchronization**: All changes are instantly synced across all connected users
- **Dynamic board management**: Add/remove departments and sprints on the fly
- **Feature management**: Create, edit, move, and delete features with detailed descriptions
- **Dependency tracking**: Visual dependency lines between features
- **Drag and drop**: Move features between departments and sprints easily

## Quick Start

### Prerequisites
- Node.js (version 14 or higher)
- npm

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000`

### Development Mode

For development with auto-restart:
```bash
npm run dev
```

## Usage

### Creating a New Session
1. Open the application
2. Click "Create New Session"
3. Share the generated access code with your team

### Joining an Existing Session
1. Open the application
2. Enter the access code provided by your session creator
3. Click "Join Session"

### Managing the Board

#### Adding Features
- Click the "+ Add Feature" button
- Fill in the feature details including title, department, sprint, assignee, and description
- Click "Save Feature"

#### Editing Features
- Click on any feature title to open the edit modal
- Modify any details and save
- Use the description field for detailed feature specifications

#### Moving Features
- Drag and drop features between different department/sprint cells
- Changes are immediately synced to all users

#### Managing Dependencies
- Click the "🔗 Dependencies" button to enter dependency mode
- Click on features to create dependency connections
- Dependencies are shown as red arrows
- Use "Clear Lines" to remove all dependencies

#### Board Management
- Click the "⚙️ Manage" button to add/remove departments and sprints
- Changes affect the entire board structure for all users

## Architecture

### Backend
- **Express.js**: Web server
- **Socket.io**: Real-time communication
- **File-based storage**: JSON files for data persistence
- **Session management**: Access code-based authentication

### Frontend
- **Vanilla JavaScript**: No framework dependencies
- **Socket.io client**: Real-time updates
- **CSS Grid**: Responsive board layout
- **Drag and Drop API**: Feature movement

## Data Storage

The application stores data in JSON files:
- `data/board-data.json`: Board configuration and features
- `data/sessions.json`: Active sessions and access codes

## Deployment Options

### Local Network
Run on a local server and access via IP address:
```bash
# Find your IP address
ipconfig  # Windows
ifconfig  # Mac/Linux

# Start server
npm start

# Access via http://YOUR_IP:3000
```

### Render (Recommended for quick free hosting)
1. Push this repository to GitHub.
2. Create a Render account and choose "New +" → "Web Service".
3. Select your repo.
4. Set Build Command (optional): `npm install`  (Render auto-installs by default).
5. Set Start Command: `node server.js`.
6. Ensure Environment has `NODE_VERSION` if you need a specific version.
7. Deploy and note the public URL (e.g. `https://agile-board.onrender.com`).
8. Test with multiple browser tabs.

Health check endpoint available at `/health`.

### Render Persistence Caveat
This app currently stores session state in `data/sessions.json`. On free tiers the instance may restart or redeploy, losing transient session data. For production:
- Replace file storage with a managed DB (Postgres, Redis, or Mongo).
- Or move sessions to a cloud key-value store.

### Environment Variables
- `PORT`: Server port (Render will inject one automatically)

### Keep Alive (Optional)
If cold starts are problematic, use an external uptime ping service to hit the root or `/health` endpoint every few minutes (respect platform policies).


### Environment Variables
- `PORT`: Server port (default: 3000)

## Customization

### Adding New Department Colors
Edit the CSS in `public/index.html`:
```css
.department-newdept { 
    background: linear-gradient(135deg, #color1, #color2); 
}
```

### Modifying Board Layout
Adjust the grid system in the CSS:
```css
.board-grid {
    grid-template-columns: 150px repeat(var(--sprint-count, 8), 1fr);
    grid-template-rows: 60px repeat(var(--dept-count, 6), minmax(120px, 1fr));
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use and modify for your organization's needs.

## Support

For issues or questions, please create an issue in the repository or contact your development team.
