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
            // NOTE: previously we limited rendering to the first 4 cards per cell.
            // That prevented persisted dependencies from finding card DOM nodes
            // when a saved board had more than 4 stickies in a cell. To ensure
            // dependencies are visible on load, render all saved stickies here.
            const stickiesInCell = boardData.stickies.filter(s => 
                s.team === team.id && s.sprint === sprint.id
            );
            
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
    
    // Redraw dependencies after layout/paint. Use requestAnimationFrame twice
    // (ensures drawing after the next paint and any synchronous layout changes)
    // and a fallback timeout. This fixes cases where dependencies only appear
    // after the user scrolls (scroll previously triggered a repaint that
    // exposed the correct coordinates).
    try {
        requestAnimationFrame(() => {
            try { drawDependencies(); } catch (e) {}
            requestAnimationFrame(() => { try { drawDependencies(); } catch (e) {} });
        });
    } catch (e) {
        // If rAF not available for any reason, fallback to timeout
        setTimeout(() => { try { drawDependencies(); } catch (e) {} }, 120);
    }
    // Extra fallback in case the browser/layout is particularly slow
    setTimeout(() => { try { drawDependencies(); } catch (e) {} }, 350);
}

function createStickyElement(sticky) {
    const card = document.createElement('div');
    // Normalize type for CSS class (replace spaces with hyphens)
    const typeClass = (sticky.type || 'Feature').toString().replace(/\s+/g, '-');
    card.className = `card sticky-${typeClass}`; // Default to Feature if type not set
    card.draggable = true;
    card.dataset.cardId = sticky.id;
    card.innerHTML = `
        <div class="dependency-dot start" title="Click to connect"></div>
        <div class="dependency-dot end" title="Click to connect"></div>
        <div class="card-title" title="Click to edit">${sticky.title}</div>
    `;

    // Add dependency click handlers (attach after innerHTML set)
    const startDot = card.querySelector('.dependency-dot.start');
    const endDot = card.querySelector('.dependency-dot.end');
        if (startDot) startDot.addEventListener('mousedown', (e) => handleDependencyClick(sticky.id, e, 'start'));
        if (endDot) endDot.addEventListener('mousedown', (e) => handleDependencyClick(sticky.id, e, 'end'));

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
            Number(s.team) === Number(newTeam) && Number(s.sprint) === Number(newSprint)
        );

        if (cardsInCell.length >= 4) {
            alert('Maximum of 4 stickies allowed per cell');
            return;
        }

        // Find sticky by comparing stringified ids so temp string ids match
        const sticky = boardData.stickies.find(s => String(s.id) === String(stickyIdRaw));
        if (sticky) {
            // Normalize to numeric IDs where appropriate
            sticky.team = Number(newTeam);
            sticky.sprint = Number(newSprint);

            // Emit move event to server only if sticky has a non-temp numeric id
            if (!String(sticky.id).startsWith('temp-')) {
                socket.emit('move-sticky', {
                    sessionId,
                    stickyId: sticky.id,
                    team: Number(newTeam),
                    sprint: Number(newSprint)
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

    const svg = document.getElementById('dependencySvg');

    if (dependencyMode) {
        document.body.classList.add('dependency-mode');

        // Show dependency lines when entering dependency mode
        window.showDependencies = true;
        if (svg) {
            svg.style.display = 'block';
            try { drawDependencies(); } catch (e) {}
        }
    } else {
        document.body.classList.remove('dependency-mode');
        document.querySelectorAll('.card').forEach(card => {
            card.classList.remove('selected-for-dependency');
        });

        // Hide dependency lines when exiting dependency mode
        window.showDependencies = false;
        if (svg) {
            svg.innerHTML = '';
            svg.style.display = 'none';
        }
    }
}

// Draw dependency lines between stickies into the full-page SVG overlay
function drawDependencies() {
    const svg = document.getElementById('dependencySvg');
    if (!svg) return;
    
    if (typeof window.showDependencies !== 'undefined' && !window.showDependencies) {
        svg.innerHTML = '';
        svg.style.display = 'none';
        return;
    }

    svg.style.display = 'block';
    svg.innerHTML = '';

    const ctm = svg.getScreenCTM && svg.getScreenCTM();
    if (!ctm) {
        // Force a layout read to encourage the browser to compute styles/CTM
        svg.getBoundingClientRect();
        requestAnimationFrame(drawDependencies);
        return;
    }

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);

    // helper: convert client coordinates to SVG user coordinates
    function clientToSvg(svgEl, clientX, clientY) {
        const pt = svgEl.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        return pt.matrixTransform(svgEl.getScreenCTM().inverse());
    }

    // Diagnostics: track dependencies that couldn't be matched to rendered cards
    const unmatched = [];
    console.debug && console.debug('Drawing dependencies:', boardData.dependencies.length);
    boardData.dependencies.forEach(dep => {
        const fromCard = document.querySelector(`[data-card-id="${dep.from}"]`);
        const toCard = document.querySelector(`[data-card-id="${dep.to}"]`);

        if (fromCard && toCard) {
            // Support dot types. Backwards-compat: default fromDot=start (left), toDot=end (right)
            const fromDot = dep.fromDot || 'start';
            const toDot = dep.toDot || 'end';

            const fromDotEl = fromCard.querySelector(`.dependency-dot.${fromDot}`) || fromCard.querySelector('.dependency-dot');
            const toDotEl = toCard.querySelector(`.dependency-dot.${toDot}`) || toCard.querySelector('.dependency-dot');
            if (!fromDotEl || !toDotEl) return;

            const fromRect = fromDotEl.getBoundingClientRect();
            const toRect = toDotEl.getBoundingClientRect();

            // Convert client coords to SVG coords
            const start = clientToSvg(svg, fromRect.left + fromRect.width / 2, fromRect.top + fromRect.height / 2);
            const end = clientToSvg(svg, toRect.left + toRect.width / 2, toRect.top + toRect.height / 2);

            const x1 = start.x;
            const y1 = start.y;
            const x2 = end.x;
            const y2 = end.y;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

            const controlPoint1X = x1 - Math.abs(x2 - x1) * -0.3;
            const controlPoint2X = x2 + Math.abs(x2 - x1) * -0.3;

            path.setAttribute('d', `M ${x1} ${y1} C ${controlPoint1X} ${y1}, ${controlPoint2X} ${y2}, ${x2} ${y2}`);
            path.setAttribute('stroke', '#dc2626');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            path.setAttribute('opacity', '0.8');
            path.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))';
            path.style.cursor = 'pointer';

            // Store explicit metadata on the path for easier debugging and deletion
            path.setAttribute('data-from', dep.from);
            path.setAttribute('data-to', dep.to);
            path.setAttribute('data-from-dot', fromDot);
            path.setAttribute('data-to-dot', toDot);

            // Tooltip text
            const fromSticky = boardData.stickies.find(s => s.id === dep.from);
            const toSticky = boardData.stickies.find(s => s.id === dep.to);
            path.setAttribute('title', `${fromSticky?.title} (${fromDot}) → ${toSticky?.title} (${toDot})\nClick to delete`);

            // Click to delete - match all fields (backwards compat checks by id only)
            path.addEventListener('click', (e) => {
                if (confirm('Delete this dependency?')) {
                    boardData.dependencies = boardData.dependencies.filter(d => {
                        // If stored dot types exist, require exact match; otherwise fall back to id-only match
                        if (d.fromDot || d.toDot || dep.fromDot || dep.toDot) {
                            return !(d.from === dep.from && d.to === dep.to && (d.fromDot || 'start') === fromDot && (d.toDot || 'end') === toDot);
                        }
                        return !(d.from === dep.from && d.to === dep.to);
                    });
                    socket.emit('update-dependencies', { sessionId, dependencies: boardData.dependencies });
                    drawDependencies();
                }
            });

            svg.appendChild(path);
        }
        else {
            // Couldn't find one or both cards in the DOM. Record for debugging.
            unmatched.push(dep);
        }
    });

    if (unmatched.length) {
        console.warn(`drawDependencies: ${unmatched.length} dependency(ies) could not be matched to DOM cards. They will be skipped.`, unmatched);
    }
}

// Diagnostic helper: verify dependencies on initial load and provide detailed logs
function verifyDependenciesOnLoad() {
    if (!boardData || !Array.isArray(boardData.dependencies)) return;
    const deps = boardData.dependencies;
    console.info('verifyDependenciesOnLoad: checking', deps.length, 'dependencies against', (boardData.stickies || []).length, 'stickies in boardData');

    const missing = [];
    deps.forEach(d => {
        const fromCard = document.querySelector(`[data-card-id="${d.from}"]`);
        const toCard = document.querySelector(`[data-card-id="${d.to}"]`);
        if (!fromCard || !toCard) {
            missing.push({ dep: d, fromFound: !!fromCard, toFound: !!toCard });
        }
    });

    if (missing.length === 0) {
        console.info('verifyDependenciesOnLoad: all dependencies matched DOM cards');
        // Force a draw just in case
        try { drawDependencies(); } catch (e) {}
        return;
    }

    console.warn('verifyDependenciesOnLoad: some dependencies could not be matched to DOM cards:', missing.length);
    missing.forEach(m => {
        console.groupCollapsed(`Dependency ${m.dep.from} → ${m.dep.to}`);
        console.log('dep object:', m.dep);
        console.log('from card found?', m.fromFound);
        console.log('to card found?', m.toFound);
        // Print sticky presence in boardData
        const fromSticky = boardData.stickies.find(s => String(s.id) === String(m.dep.from));
        const toSticky = boardData.stickies.find(s => String(s.id) === String(m.dep.to));
        console.log('fromSticky in boardData?', !!fromSticky, fromSticky);
        console.log('toSticky in boardData?', !!toSticky, toSticky);
        console.groupEnd();
    });

    // As a fallback, attempt a re-draw after a slightly longer delay to catch late layout
    setTimeout(() => { try { drawDependencies(); } catch (e) {} }, 300);
}

// Drag-enabled dependency creation handler
function handleDependencyClick(stickyId, event, dotType) {
    if (!dependencyMode) return;

    event.stopPropagation();
    event.preventDefault();

    const dot = event.target;
    const card = document.querySelector(`[data-card-id="${stickyId}"]`);
    const svg = document.getElementById('dependencySvg');
    if (!card || !svg) return;

    let tempPath = null;
    let isDragging = false;
    let startPt = null; // SVG-space start point for the drag

    // convert client coordinates to SVG user coordinates
    function clientToSvg(clientX, clientY) {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        return pt.matrixTransform(svg.getScreenCTM().inverse());
    }

    function startDrag(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        isDragging = true;
        dot.classList.add('dragging');

    const dotRect = dot.getBoundingClientRect();
    const startClientX = dotRect.left + dotRect.width / 2;
    const startClientY = dotRect.top + dotRect.height / 2;
    startPt = clientToSvg(startClientX, startClientY);

    tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempPath.setAttribute('stroke', '#dc2626');
        tempPath.setAttribute('stroke-width', '2');
        tempPath.setAttribute('fill', 'none');
        tempPath.setAttribute('opacity', '0.8');
        tempPath.classList.add('temp-dependency');
        svg.appendChild(tempPath);

        const mousePt = clientToSvg(ev.clientX, ev.clientY);
        const controlPoint1X = startPt.x - Math.abs(mousePt.x - startPt.x) * 0.3;
        const controlPoint2X = mousePt.x + Math.abs(mousePt.x - startPt.x) * 0.3;
        tempPath.setAttribute('d', `M ${startPt.x} ${startPt.y} C ${controlPoint1X} ${startPt.y}, ${controlPoint2X} ${mousePt.y}, ${mousePt.x} ${mousePt.y}`);
    }

    function drag(ev) {
        if (!isDragging || !tempPath) return;
        ev.stopPropagation();
        ev.preventDefault();

        const mouseClientX = ev.clientX;
        const mouseClientY = ev.clientY;
        const mousePt = clientToSvg(mouseClientX, mouseClientY);

        // Update temp path in SVG coordinates
        const controlPoint1X = startPt.x - Math.abs(mousePt.x - startPt.x) * 0.3;
        const controlPoint2X = mousePt.x + Math.abs(mousePt.x - startPt.x) * 0.3;
        tempPath.setAttribute('d', `M ${startPt.x} ${startPt.y} C ${controlPoint1X} ${startPt.y}, ${controlPoint2X} ${mousePt.y}, ${mousePt.x} ${mousePt.y}`);

        // Highlight potential target dots using client coordinates
        document.querySelectorAll('.dependency-dot').forEach(d => {
            const rect = d.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            if (Math.abs(mouseClientX - centerX) < 20 && Math.abs(mouseClientY - centerY) < 20) {
                d.style.transform = 'scale(1.5)';
                d.style.background = '#b91c1c';
            } else {
                d.style.transform = '';
                d.style.background = '';
            }
        });
    }

    function endDrag(ev) {
        if (!isDragging) return;
        isDragging = false;
        dot.classList.remove('dragging');

        if (tempPath) {
            tempPath.remove();
            tempPath = null;
        }

        document.querySelectorAll('.dependency-dot').forEach(d => {
            d.style.transform = '';
            d.style.background = '';
        });

        // Find the nearest dependency-dot to the mouse release point within a threshold
        const mouseX = ev.clientX;
        const mouseY = ev.clientY;
        const threshold = 30; // pixels
        let nearestDot = null;
        let nearestDist = Infinity;
        document.querySelectorAll('.dependency-dot').forEach(d => {
            const rect = d.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = cx - mouseX;
            const dy = cy - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestDot = d;
            }
        });

        if (nearestDot && nearestDist <= threshold && nearestDot.closest('.card') !== card) {
            const targetDot = nearestDot;
            const targetCard = targetDot.closest('.card');
            const targetId = targetCard.dataset.cardId;

            // Prevent self-connection
            if (targetId === stickyId) return;

            // Determine dot types
            const targetDotType = targetDot.classList.contains('start') ? 'start' : 'end';

            // Prevent duplicate connections (exact match or mirrored exact match)
            const existsExact = boardData.dependencies.some(d =>
                d.from === stickyId && d.to === targetId && (d.fromDot || 'start') === dotType && (d.toDot || 'end') === targetDotType
            );
            const existsMirrored = boardData.dependencies.some(d =>
                d.from === targetId && d.to === stickyId && (d.fromDot || 'start') === targetDotType && (d.toDot || 'end') === dotType
            );

            if (!existsExact && !existsMirrored) {
                const newDependency = {
                    from: stickyId,
                    to: targetId,
                    fromDot: dotType,
                    toDot: targetDotType
                };
                boardData.dependencies.push(newDependency);
                    socket.emit('update-dependencies', { sessionId, dependencies: boardData.dependencies });
                drawDependencies();
            }
        }
    }

    document.addEventListener('mousemove', drag);
    const mouseUpHandler = (e) => {
        endDrag(e);
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', mouseUpHandler);
    };
    document.addEventListener('mouseup', mouseUpHandler);

    startDrag(event);
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
    const team = Number(document.getElementById('stickyTeam').value);
    const sprint = Number(document.getElementById('stickySprint').value);
    const description = document.getElementById('stickyDescription').value.trim();
    
    if (!title) {
        alert('Title is required');
        return;
    }

    // Validate cell capacity: max 4 stickies per cell
    const cardsInCell = boardData.stickies.filter(s =>
        Number(s.team) === Number(team) &&
        Number(s.sprint) === Number(sprint) &&
        (!currentEditingSticky || String(s.id) !== String(currentEditingSticky.id))
    );

    if (currentEditingSticky) {
        // If moving to a different cell that's already full, block it
        const isSameCell = Number(currentEditingSticky.team) === Number(team) && Number(currentEditingSticky.sprint) === Number(sprint);
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
                socket.emit('update-dependencies', { sessionId, dependencies: boardData.dependencies });
        
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
    
    // Create teams list with delegated event handling
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
    
    // Use event delegation for team remove buttons
    teamsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-team-btn')) {
            e.preventDefault();
            const teamIdRaw = e.target.dataset.teamId;
            const teamId = teamIdRaw ? Number(teamIdRaw) : null;
            if (!isNaN(teamId)) removeTeam(teamId);
        }
    });
    
    // Create sprints list with delegated event handling
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
    
    // Use event delegation for sprint remove buttons
    sprintsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-sprint-btn')) {
            e.preventDefault();
            const sprintId = parseInt(e.target.dataset.sprintId);
            if (!isNaN(sprintId)) removeSprint(sprintId);
        }
    });
}

function addTeam() {
    const name = prompt('Enter team name:');
    if (name && name.trim()) {
        console.log('Adding team:', name.trim());

        // Create temporary team with temp ID for optimistic update
        const tempId = Date.now();
        const newTeam = {
            id: tempId,
            name: name.trim(),
            isTemp: true
        };
        
        // Optimistic update: Add team locally first
        boardData.teams.push(newTeam);
        renderBoard();
        renderManagementModal();
        
        // Then notify server
        socket.emit('add-team', { name: name.trim(), tempId: tempId });

        // Queue a delayed cleanup to remove temp team if server doesn't respond
        const cleanup = setTimeout(() => {
            // Only remove this specific temp team
            const index = boardData.teams.findIndex(s => s.id === tempId && s.isTemp);
            if (index !== -1) {
                boardData.teams.splice(index, 1);
                renderBoard();
                renderManagementModal();
            }
        }, 5000);

        // Store cleanup timeout so we can cancel it if server responds
        window._teamCleanupTimeouts = window._teamCleanupTimeouts || {};
        window._teamCleanupTimeouts[tempId] = cleanup;        
    }
}

function addSprint() {
    const name = prompt('Enter sprint name:');
    if (name && name.trim()) {
        console.log('Adding sprint:', name.trim());
        
        // Create temporary sprint with temp ID for optimistic update
        const tempId = Date.now();
        const newSprint = {
            id: tempId,
            name: name.trim(),
            isTemp: true
        };
        
        // Optimistic update: Add sprint locally first
        boardData.sprints.push(newSprint);
        renderBoard();
        renderManagementModal();
        
        // Then notify server
        socket.emit('add-sprint', { name: name.trim(), tempId: tempId });
        
        // Queue a delayed cleanup to remove temp sprint if server doesn't respond
        const cleanup = setTimeout(() => {
            // Only remove this specific temp sprint
            const index = boardData.sprints.findIndex(s => s.id === tempId && s.isTemp);
            if (index !== -1) {
                boardData.sprints.splice(index, 1);
                renderBoard();
                renderManagementModal();
            }
        }, 5000);

        // Store cleanup timeout so we can cancel it if server responds
        window._sprintCleanupTimeouts = window._sprintCleanupTimeouts || {};
        window._sprintCleanupTimeouts[tempId] = cleanup;
    }
}

function removeTeam(teamId) {
    // Coerce teamId to a number for consistent comparisons (matches removeSprint behavior)
    const tid = Number(teamId);
    if (isNaN(tid)) return;

    const team = boardData.teams.find(t => Number(t.id) === tid);
    if (!team) return;
    
    const stickiesInTeam = boardData.stickies.filter(t => Number(t.team) === tid);
    let confirmMessage = `Remove team "${team.name}"?`;
    
    if (stickiesInTeam.length > 0) {
        confirmMessage += `\n\nThis will also remove ${stickiesInTeam.length} sticky note(s) in this team.`;
    }
    
    if (confirm(confirmMessage)) {
        // Update local state immediately
        boardData.teams = boardData.teams.filter(d => Number(d.id) !== tid);
        boardData.stickies = boardData.stickies.filter(s => Number(s.team) !== tid);
        
        // Update UI
        renderBoard();
        renderManagementModal();
        
        // Then notify server
        socket.emit('remove-team', tid);
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


