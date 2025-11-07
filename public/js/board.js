// Board rendering and management functions

function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    // Defensive defaults in case server sent older/partial data
    boardData = boardData || {};
    boardData.teams = boardData.teams || [];
    boardData.sprints = boardData.sprints || [];
    boardData.stickies = boardData.stickies || [];
    boardData.dependencies = boardData.dependencies || [];

    // Update CSS custom properties for grid
    document.documentElement.style.setProperty('--sprint-count', boardData.sprints.length);
    document.documentElement.style.setProperty('--team-count', boardData.teams.length);
    
    // Create header row
    const cornerCell = document.createElement('div');
    cornerCell.className = 'header-cell corner';
    cornerCell.textContent = '';
    board.appendChild(cornerCell);
    
    // Sprint headers
    boardData.sprints.forEach(sprint => {
        const sprintHeader = document.createElement('div');
        sprintHeader.className = 'header-cell sprint-header';
        sprintHeader.innerHTML = `${sprint.name}`;
        board.appendChild(sprintHeader);
    });
    
    // Team rows
    boardData.teams.forEach(team => {
        // Team header
        const teamHeader = document.createElement('div');
        teamHeader.className = 'header-cell team-header';
        teamHeader.innerHTML = `${team.name}`;
        board.appendChild(teamHeader);
        
        // Grid cells for each sprint
        boardData.sprints.forEach(sprint => {
            const gridCell = document.createElement('div');
            gridCell.className = 'grid-cell';
            gridCell.dataset.team = team.id;
            gridCell.dataset.sprint = sprint.id;
            
            // Add stickies to this cell
            const stickiesInCell = boardData.stickies.filter(s => 
                s.team === team.id && s.sprint === sprint.id
            ).slice(0, 4); // Limit to 4 cards
            
            stickiesInCell.forEach(sticky => {
                const card = createStickyElement(sticky);
                gridCell.appendChild(card);
            });
            
            // Add drag event listeners
            gridCell.addEventListener('dragover', handleDragOver);
            gridCell.addEventListener('drop', handleDrop);
            gridCell.addEventListener('dragleave', handleDragLeave);
            
                // Add click handler for creating new stickies
            gridCell.addEventListener('click', (e) => {
                // Only handle clicks directly on the grid cell, not on cards
                if (e.target === gridCell) {
                    // Check if the cell already has 4 cards
                    const cardsInCell = boardData.stickies.filter(s => 
                        s.team === team.id && s.sprint === sprint.id
                    );
                    
                    if (cardsInCell.length >= 4) {
                        alert('Maximum of 4 stickies allowed per cell');
                        return;
                    }
                    
                    addNewSticky(team.id, sprint.id);
                }
            });
            
            board.appendChild(gridCell);
        });
    });
    
    // Update form options
    updateFormOptions();
    
    // Redraw dependencies
    setTimeout(drawDependencies, 100);
}

function createStickyElement(sticky) {
    const card = document.createElement('div');
    // Normalize type for CSS class (replace spaces with hyphens)
    const typeClass = (sticky.type || 'Feature').toString().replace(/\s+/g, '-');
    card.className = `card sticky-${typeClass}`; // Default to Feature if type not set
    card.draggable = true;
    card.dataset.cardId = sticky.id;
    card.innerHTML = `
        <div class="status-indicator"></div>
        <div class="dependency-dot start" title="Click to connect"></div>
        <div class="dependency-dot end" title="Click to connect"></div>
        <div class="card-title" title="Click to edit">${sticky.title}</div>
    `;

    // Add dependency click handlers (attach after innerHTML set)
    const startDot = card.querySelector('.dependency-dot.start');
    const endDot = card.querySelector('.dependency-dot.end');
    if (startDot) startDot.addEventListener('click', (e) => handleDependencyClick(sticky.id, e));
    if (endDot) endDot.addEventListener('click', (e) => handleDependencyClick(sticky.id, e));

    // Attach click handler for editing - use closure to capture sticky.id (works for numeric and string temp ids)
    const titleEl = card.querySelector('.card-title');
    if (titleEl) titleEl.addEventListener('click', (e) => { e.stopPropagation(); editSticky(sticky.id); });
    
    // Drag events
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    
    return card;
}

function updateFormOptions() {
    const teamSelect = document.getElementById('stickyTeam');
    const sprintSelect = document.getElementById('stickySprint');
    
    // Update team options
    teamSelect.innerHTML = '';
    boardData.teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        teamSelect.appendChild(option);
    });
    
    // Update sprint options
    sprintSelect.innerHTML = '';
    boardData.sprints.forEach(sprint => {
        const option = document.createElement('option');
        option.value = sprint.id;
        option.textContent = sprint.name;
        sprintSelect.appendChild(option);
    });
}

// Drag and drop functionality
function handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('cardId', e.target.dataset.cardId);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    setTimeout(drawDependencies, 50);
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const stickyIdRaw = e.dataTransfer.getData('cardId');
    const dragging = document.querySelector('.dragging');

    if (dragging && e.currentTarget.classList.contains('grid-cell')) {
        const newTeam = e.currentTarget.dataset.team;
        const newSprint = parseInt(e.currentTarget.dataset.sprint);

        // Check if the target cell already has 4 cards
        const cardsInCell = boardData.stickies.filter(s => 
            String(s.team) === String(newTeam) && Number(s.sprint) === Number(newSprint)
        );

        if (cardsInCell.length >= 4) {
            alert('Maximum of 4 stickies allowed per cell');
            return;
        }

        // Find sticky by comparing stringified ids so temp string ids match
        const sticky = boardData.stickies.find(s => String(s.id) === String(stickyIdRaw));
        if (sticky) {
            sticky.team = newTeam;
            sticky.sprint = newSprint;

            // Emit move event to server only if sticky has a non-temp numeric id
            if (!String(sticky.id).startsWith('temp-')) {
                socket.emit('move-sticky', {
                    sessionId,
                    stickyId: sticky.id,
                    team: newTeam,
                    sprint: newSprint
                });
            }

            // Update card and move it; preserve type class
            const typeClass = (sticky.type || 'Feature').toString().replace(/\s+/g, '-');
            // Preserve other classes like 'dragging' by replacing only the sticky-... class
            dragging.className = `card sticky-${typeClass}`;
            e.currentTarget.appendChild(dragging);
        }
    }
}

function handleDragLeave(e) {
    if (e.currentTarget.classList.contains('grid-cell')) {
        e.currentTarget.classList.remove('drag-over');
    }
}

// Dependency management
function toggleDependencyMode() {
    dependencyMode = !dependencyMode;
    selectedCardForDependency = null;
    
    const btn = document.querySelector('.btn-secondary');
    btn.style.background = dependencyMode ? '#dc2626' : '#48bb78';
    btn.textContent = dependencyMode ? '🔗 Exit Dependency Mode' : '🔗 Dependencies';
    
    if (dependencyMode) {
        document.body.classList.add('dependency-mode');
    } else {
        document.body.classList.remove('dependency-mode');
        document.querySelectorAll('.card').forEach(card => {
            card.classList.remove('selected-for-dependency');
        });
    }
}

function handleDependencyClick(stickyId, event) {
    event.stopPropagation();
    event.preventDefault();
    
    if (!dependencyMode) return;
    
    const card = document.querySelector(`[data-card-id="${stickyId}"]`);
    
    if (!selectedCardForDependency) {
        selectedCardForDependency = stickyId;
        card.classList.add('selected-for-dependency');
    } else {
        if (selectedCardForDependency !== stickyId) {
            const exists = boardData.dependencies.some(d => 
                (d.from === selectedCardForDependency && d.to === stickyId) ||
                (d.from === stickyId && d.to === selectedCardForDependency)
            );
            
            if (!exists) {
                const newDependency = {
                    from: stickyId,
                    to: selectedCardForDependency
                };
                boardData.dependencies.push(newDependency);
                socket.emit('update-dependencies', boardData.dependencies);
                drawDependencies();
            }
        }
        
        document.querySelector(`[data-card-id="${selectedCardForDependency}"]`).classList.remove('selected-for-dependency');
        selectedCardForDependency = null;
    }
}

function drawDependencies() {
    const svg = document.getElementById('dependencySvg');
    svg.innerHTML = '';
    
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);
    
    boardData.dependencies.forEach(dep => {
        const fromCard = document.querySelector(`[data-card-id="${dep.from}"]`);
        const toCard = document.querySelector(`[data-card-id="${dep.to}"]`);
        
        if (fromCard && toCard) {
            const fromRect = fromCard.getBoundingClientRect();
            const toRect = toCard.getBoundingClientRect();
            
            // Connect from left dot to right dot
            const x1 = fromRect.left;
            const y1 = fromRect.top + fromRect.height / 2;
            const x2 = toRect.right;
            const y2 = toRect.top + toRect.height / 2;
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            
            const controlPoint1X = x1 - Math.abs(x2 - x1) * 0.3;
            const controlPoint2X = x2 + Math.abs(x2 - x1) * 0.3;
            
            path.setAttribute('d', `M ${x1} ${y1} C ${controlPoint1X} ${y1}, ${controlPoint2X} ${y2}, ${x2} ${y2}`);
            path.setAttribute('stroke', '#dc2626'); 
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            path.setAttribute('opacity', '0.8');
            path.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))';
            path.style.cursor = 'pointer';
            path.setAttribute('data-dependency', `${dep.from}-${dep.to}`);
            
            // Add basic tooltip and click handling
            const fromSticky = boardData.stickies.find(s => s.id === dep.from);
            const toSticky = boardData.stickies.find(s => s.id === dep.to);
            path.setAttribute('title', `${fromSticky?.title} depends on ${toSticky?.title}\nClick to delete`);
            
            // Add click handler for deletion
            path.addEventListener('click', (e) => {
                if (confirm('Delete this dependency?')) {
                    boardData.dependencies = boardData.dependencies.filter(d => 
                        !(d.from === dep.from && d.to === dep.to)
                    );
                    socket.emit('update-dependencies', boardData.dependencies);
                    drawDependencies();
                }
            });
            
            svg.appendChild(path);
        }
    });
}

// Sticky management
function addNewSticky(teamId = null, sprintId = null) {
    currentEditingSticky = null;
    document.getElementById('stickyModalTitle').textContent = 'Add New Sticky';
    document.getElementById('stickyType').value = 'Feature';
    document.getElementById('stickyTitle').value = '';
    document.getElementById('stickyTeam').value = teamId || boardData.teams[0]?.id || '';
    document.getElementById('stickySprint').value = sprintId || boardData.sprints[0]?.id || '';
    document.getElementById('stickyDescription').value = '';
    document.getElementById('deleteStickyBtn').style.display = 'none';
    document.getElementById('stickyModal').style.display = 'block';
}

function editSticky(stickyId) {
    const sticky = boardData.stickies.find(s => s.id === stickyId);
    if (!sticky) return;
    
    currentEditingSticky = sticky;
    document.getElementById('stickyModalTitle').textContent = 'Edit Sticky';
    document.getElementById('stickyType').value = sticky.type || 'Feature';
    document.getElementById('stickyTitle').value = sticky.title;
    document.getElementById('stickyTeam').value = sticky.team;
    document.getElementById('stickySprint').value = sticky.sprint;
    document.getElementById('stickyDescription').value = sticky.description || '';
    document.getElementById('deleteStickyBtn').style.display = 'block';
    document.getElementById('stickyModal').style.display = 'block';
}

function saveSticky() {
    const title = document.getElementById('stickyTitle').value.trim();
    const type = document.getElementById('stickyType').value;
    const team = document.getElementById('stickyTeam').value;
    const sprint = parseInt(document.getElementById('stickySprint').value);
    const description = document.getElementById('stickyDescription').value.trim();
    
    if (!title) {
        alert('Title is required');
        return;
    }

    // Validate cell capacity: max 4 stickies per cell
    const cardsInCell = boardData.stickies.filter(s =>
        String(s.team) === String(team) &&
        Number(s.sprint) === Number(sprint) &&
        (!currentEditingSticky || String(s.id) !== String(currentEditingSticky.id))
    );

    if (currentEditingSticky) {
        // If moving to a different cell that's already full, block it
        const isSameCell = String(currentEditingSticky.team) === String(team) && Number(currentEditingSticky.sprint) === Number(sprint);
        if (!isSameCell && cardsInCell.length >= 4) {
            alert('The selected cell already has 4 stickies. Please choose a different cell before saving.');
            return;
        }
    } else {
        // Creating new sticky: disallow if cell already has 4
        if (cardsInCell.length >= 4) {
            alert('The selected cell already has 4 stickies. Please choose a different cell before saving.');
            return;
        }
    }
    
    if (currentEditingSticky) {
        // Update existing sticky
        const updatedSticky = {
            id: currentEditingSticky.id,
            title,
            type,
            team,
            sprint,
            description
        };
        
        // Update local data
        const index = boardData.stickies.findIndex(s => s.id === currentEditingSticky.id);
        if (index !== -1) {
            boardData.stickies[index] = updatedSticky;
        }
        
    // Emit update to server
    socket.emit('update-sticky', { sessionId, ...updatedSticky });
    } else {
        // Create new sticky
        const newSticky = {
            title,
            type,
            team,
            sprint,
            description
        };
        
        // Optimistic UI: add a temporary sticky locally so it appears immediately
        const tempId = `temp-${Date.now()}`;
        const tempSticky = { id: tempId, ...newSticky, pending: true };
        boardData.stickies.push(tempSticky);
        renderBoard();

    // Emit creation to server (server will assign real id and broadcast)
    socket.emit('create-sticky', { sessionId, ...newSticky });
    }
    
    closeStickyModal();
    renderBoard();
}

function deleteSticky() {
    if (!currentEditingSticky) return;
    
    if (confirm('Are you sure you want to delete this sticky?')) {
        // Remove from local data
        boardData.stickies = boardData.stickies.filter(s => s.id !== currentEditingSticky.id);
        
        // Remove dependencies
        boardData.dependencies = boardData.dependencies.filter(d => 
            d.from !== currentEditingSticky.id && d.to !== currentEditingSticky.id
        );
        
    // Emit updates to server
    socket.emit('update-sticky', { sessionId, id: currentEditingSticky.id, deleted: true });
    socket.emit('update-dependencies', boardData.dependencies);
        
        closeStickyModal();
        renderBoard();
    }
}

function closeStickyModal() {
    document.getElementById('stickyModal').style.display = 'none';
    currentEditingSticky = null;
}

// Management functions
function showManagement() {
    renderManagementModal();
    document.getElementById('managementModal').style.display = 'block';
}

function renderManagementModal() {
    const teamsList = document.getElementById('teamsList');
    const sprintsList = document.getElementById('sprintsList');
    
    // Render teams
    teamsList.innerHTML = '';
    boardData.teams.forEach(team => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #1a202c; margin: 5px 0; border-radius: 6px;';
        item.innerHTML = `
            <span>${team.name}</span>
            <button class="btn btn-danger remove-team-btn" data-team-id="${team.id}" style="padding: 4px 8px; font-size: 12px;">Remove</button>
        `;
        teamsList.appendChild(item);
    });
    
    // Add event listeners for team remove buttons
    document.querySelectorAll('.remove-team-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const teamId = e.target.dataset.teamId;
            removeTeam(teamId);
        });
    });
    
    // Render sprints
    sprintsList.innerHTML = '';
    boardData.sprints.forEach(sprint => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #1a202c; margin: 5px 0; border-radius: 6px;';
        item.innerHTML = `
            <span>${sprint.name}</span>
            <button class="btn btn-danger remove-sprint-btn" data-sprint-id="${sprint.id}" style="padding: 4px 8px; font-size: 12px;">Remove</button>
        `;
        sprintsList.appendChild(item);
    });
    
    // Add event listeners for sprint remove buttons
    document.querySelectorAll('.remove-sprint-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const sprintId = parseInt(e.target.dataset.sprintId);
            removeSprint(sprintId);
        });
    });
}

function addTeam() {
    const name = prompt('Enter team name:');
    if (name && name.trim()) {
        const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const newTeam = {
            id,
            name: name.trim()
        };
        
            // Optimistic update: Add team locally first
            boardData.teams.push(newTeam);
            renderBoard();
            renderManagementModal();
        
            // Then notify server
            socket.emit('add-team', newTeam);
    }
}

function addSprint() {
    const name = prompt('Enter sprint name:');
    if (name && name.trim()) {
            // Create temporary ID for optimistic update
            const tempId = Date.now();
            const newSprint = {
                id: tempId,
                name: name.trim()
            };
        
            // Optimistic update: Add sprint locally first
            boardData.sprints.push(newSprint);
            renderBoard();
            renderManagementModal();
        
            // Then notify server
            socket.emit('add-sprint', newSprint);
    }
}

function removeTeam(teamId) {
    const team = boardData.teams.find(d => d.id === teamId);
    if (!team) return;
    
    const stickiesInTeam = boardData.stickies.filter(s => s.team === teamId);
    let confirmMessage = `Remove team "${team.name}"?`;
    
    if (stickiesInTeam.length > 0) {
        confirmMessage += `\n\nThis will also remove ${stickiesInTeam.length} sticky note(s) in this team.`;
    }
    
    if (confirm(confirmMessage)) {
        // Update local state immediately
        boardData.teams = boardData.teams.filter(d => d.id !== teamId);
        boardData.stickies = boardData.stickies.filter(s => s.team !== teamId);
        
        // Update UI
        renderBoard();
        renderManagementModal();
        
        // Then notify server
        socket.emit('remove-team', teamId);
    }
}

function removeSprint(sprintId) {
    const sprint = boardData.sprints.find(s => s.id === sprintId);
    if (!sprint) return;
    
    const stickiesInSprint = boardData.stickies.filter(s => s.sprint === sprintId);
    let confirmMessage = `Remove sprint "${sprint.name}"?`;
    
    if (stickiesInSprint.length > 0) {
        confirmMessage += `\n\nThis will also remove ${stickiesInSprint.length} sticky note(s) in this sprint.`;
    }
    
    if (confirm(confirmMessage)) {
        // Update local state immediately
        boardData.sprints = boardData.sprints.filter(s => s.id !== sprintId);
        boardData.stickies = boardData.stickies.filter(s => s.sprint !== sprintId);
        
        // Update UI
        renderBoard();
        renderManagementModal();
        
        // Then notify server
        socket.emit('remove-sprint', sprintId);
    }
}

function closeManagementModal() {
    document.getElementById('managementModal').style.display = 'none';
}

// Event listeners for scrolling and resizing
document.querySelector('.board-wrapper').addEventListener('scroll', () => {
    drawDependencies();
});

window.addEventListener('resize', drawDependencies);

// Handle access code input
document.getElementById('accessCode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinSession();
    }
});

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});


