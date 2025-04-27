// CyberGrid Runner - Phaser 3 Implementation with Placeholder Assets

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 } }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);
let runner, gridLayer, cursors, dpad, hudText, dataNodes, drones, dataNodesCollected = 0, gameState = 'playing';
let dpadDirection = '';
let bgm, moveSound, nodeSound, gameOverSound, victorySound;
let victoryScreen, gameOverScreen, restartButton, muteButton, restartText;
let isMuted = false;
let moveLock = false; // Add a lock for debounced movement
let totalDataNodes = 10; // Track total number of data nodes
let moveInterval = null; // Timer for continuous movement
let bullets; // Group for bullets
let lastFired = 0; // For fire rate limiting
const BULLET_SPEED = 400;
const BULLET_LIFESPAN = 10000; // ms (effectively infinite for most shots)
const BULLET_FIRE_RATE = 300; // ms (was 200)
let lastDirection = 'up'; // Track last movement direction
let bulletMoveInterval = 100; // ms between bullet moves
let spaceBarHeld = false; // Track if space bar is held
let fireInterval = null; // Timer for rapid fire
let dronesRemaining = 0; // Track number of drones remaining
let droneEliminatedMsg = null; // Reference to the popup message

function preload() {
    // No image loading needed for runner
}

function create() {
    // Background (placeholder: dark rectangle with neon cityscape effect)
    this.add.rectangle(400, 300, 800, 600, 0x181828).setDepth(0);
    for (let i = 0; i < 10; i++) {
        this.add.rectangle(80 + i * 70, 550 - (i % 2) * 30, 60, 120, 0x2222aa, 0.2).setDepth(0);
        this.add.rectangle(80 + i * 70, 590 - (i % 2) * 30, 60, 10, 0x00ffff, 0.5).setDepth(0);
    }

    // Grid (tilemap placeholder)
    gridLayer = this.add.layer();
    for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
            const tile = this.add.rectangle(x * 32 + 16, y * 32 + 16, 32, 32, 0x0033ff, 0.15)
                .setStrokeStyle(2, 0x00bfff, 0.5)
                .setDepth(1);
            gridLayer.add(tile);
        }
    }

    // Runner (drawn as a stylized cyberpunk car using Phaser graphics)
    const car = this.add.container(25 * 32 + 16, 25 * 32 + 16);
    // Car body
    const body = this.add.rectangle(0, 0, 22, 32, 0x00bfff).setStrokeStyle(3, 0xffffff, 1);
    // Windshield
    const windshield = this.add.rectangle(0, -8, 16, 8, 0x66ccff).setStrokeStyle(2, 0xffffff, 0.7);
    // Roof
    const roof = this.add.rectangle(0, 0, 14, 12, 0x222244).setStrokeStyle(2, 0x00ffff, 0.7);
    // Headlights
    const headlightL = this.add.rectangle(-6, -15, 4, 4, 0xffffff).setAlpha(0.8);
    const headlightR = this.add.rectangle(6, -15, 4, 4, 0xffffff).setAlpha(0.8);
    // Taillights
    const taillightL = this.add.rectangle(-6, 15, 4, 4, 0xff33cc).setAlpha(0.8);
    const taillightR = this.add.rectangle(6, 15, 4, 4, 0xff33cc).setAlpha(0.8);
    // Neon underglow
    const underglow = this.add.ellipse(0, 12, 24, 8, 0x00ffff, 0.3);
    car.add([underglow, body, windshield, roof, headlightL, headlightR, taillightL, taillightR]);
    car.setDepth(2);

    // Add physics to the car container
    runner = this.physics.add.existing(car);
    runner.body.setSize(22, 32);
    runner.body.setCollideWorldBounds(true);
    runner.setPosition(25 * 32 + 16, 25 * 32 + 16);
    this.physics.world.setBounds(0, 0, 1600, 1600);

    // Data Nodes (glowing orbs)
    dataNodes = this.physics.add.group();
    let nodePositions = [];
    for (let i = 0; i < totalDataNodes; i++) {
        let x, y, pos;
        do {
            x = Phaser.Math.Between(0, 49);
            y = Phaser.Math.Between(0, 49);
            pos = `${x},${y}`;
        } while (
            (x === 25 && y === 25) ||
            nodePositions.includes(pos)
        );
        nodePositions.push(pos);
        let orb = this.add.circle(x * 32 + 16, y * 32 + 16, 16, 0xff33cc, 0.7).setDepth(2);
        let spark = this.add.circle(x * 32 + 16, y * 32 + 16, 20, 0xffffff, 0.1).setDepth(2);
        let node = this.physics.add.sprite(x * 32 + 16, y * 32 + 16, null).setDisplaySize(32, 32).setDepth(2);
        node.orb = orb;
        node.spark = spark;
        dataNodes.add(node);
    }

    // Security Drones (cyberpunk drone graphics)
    drones = this.physics.add.group();
    let dronePositions = [];
    for (let i = 0; i < 10; i++) {
        let x, y, pos;
        do {
            x = Phaser.Math.Between(0, 49);
            y = Phaser.Math.Between(0, 49);
            pos = `${x},${y}`;
        } while (
            (x === 25 && y === 25) ||
            nodePositions.includes(pos) ||
            dronePositions.includes(pos) ||
            isAdjacentToAnyNode(x, y, nodePositions) ||
            Math.abs(x - 25) < 5 || Math.abs(y - 25) < 5
        );
        dronePositions.push(pos);
        // Draw drone as a container
        const droneContainer = this.add.container(x * 32 + 16, y * 32 + 16);
        // Central body
        const body = this.add.ellipse(0, 0, 20, 16, 0xff3333).setStrokeStyle(2, 0xffffff, 0.7);
        // Side arms
        const armL = this.add.rectangle(-14, 0, 8, 4, 0x880000).setAngle(20);
        const armR = this.add.rectangle(14, 0, 8, 4, 0x880000).setAngle(-20);
        // Glowing red eye
        const eye = this.add.circle(0, 0, 4, 0xffffff, 1).setStrokeStyle(2, 0xff3333, 1);
        // Neon underglow
        const underglow = this.add.ellipse(0, 8, 24, 8, 0xff3333, 0.18);
        // Health bar background
        const healthBarBg = this.add.rectangle(0, -22, 24, 5, 0x222222, 0.8);
        // Health bar foreground
        const healthBar = this.add.rectangle(0, -22, 24, 5, 0x00ff00, 1);
        healthBar.setOrigin(0.5, 0.5);
        healthBarBg.setOrigin(0.5, 0.5);
        droneContainer.add([underglow, armL, armR, body, eye, healthBarBg, healthBar]);
        droneContainer.setDepth(2);
        // Add physics
        const dronePhysics = this.physics.add.existing(droneContainer);
        dronePhysics.body.setSize(24, 16);
        dronePhysics.body.setCollideWorldBounds(true);
        dronePhysics.setPosition(x * 32 + 16, y * 32 + 16);
        drones.add(droneContainer);
        droneContainer.prevPos = { x: x * 32 + 16, y: y * 32 + 16 };
        // Add hitCount to drones
        droneContainer.hitCount = 0;
        droneContainer.healthBar = healthBar;
    }
    dronesRemaining = drones.getChildren().length;

    // Camera
    this.cameras.main.startFollow(runner, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, 1600, 1600);

    // Inputs
    cursors = this.input.keyboard.createCursorKeys();
    cursors.wasd = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
    });

    // Mobile D-pad (placeholder: blue cross)
    dpad = this.add.container(100, 500).setDepth(3).setAlpha(0.7);
    let dpadBg = this.add.rectangle(0, 0, 100, 100, 0x0033ff, 0.2).setStrokeStyle(2, 0x00bfff, 0.7);
    let up = this.add.triangle(0, -30, 0, 30, 50, 100, 100, 30, 0x00bfff, 0.7).setAngle(-90);
    let down = this.add.triangle(0, 30, 0, 30, 50, 100, 100, 30, 0x00bfff, 0.7).setAngle(90);
    let left = this.add.triangle(-30, 0, 0, 30, 50, 100, 100, 30, 0x00bfff, 0.7).setAngle(180);
    let right = this.add.triangle(30, 0, 0, 30, 50, 100, 100, 30, 0x00bfff, 0.7);
    dpad.add([dpadBg, up, down, left, right]);
    dpad.setScrollFactor(0);
    dpad.setInteractive(new Phaser.Geom.Rectangle(-50, -50, 100, 100), Phaser.Geom.Rectangle.Contains);
    dpad.on('pointerdown', (pointer) => {
        const localX = pointer.x - dpad.x;
        const localY = pointer.y - dpad.y;
        if (localX < -25) dpadDirection = 'left';
        else if (localX > 25) dpadDirection = 'right';
        else if (localY < -25) dpadDirection = 'up';
        else if (localY > 25) dpadDirection = 'down';
    });
    dpad.on('pointerup', () => dpadDirection = '');

    // HUD background
    const hudBg = this.add.rectangle(400, 28, 260, 36, 0x000000, 0.55)
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(3);
    hudText = this.add.text(400, 20, 'X: 25, Y: 25 | Nodes: 0/10', {
        fontFamily: 'Orbitron, monospace',
        fontSize: '22px',
        color: '#00ffcc',
        stroke: '#0033ff',
        strokeThickness: 3,
        align: 'center',
        padding: { left: 8, right: 8, top: 4, bottom: 4 }
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(4);

    // Audio (placeholder: no sound, but structure in place)
    bgm = { play: () => { }, stop: () => { } };
    moveSound = { play: () => { } };
    nodeSound = { play: () => { } };
    gameOverSound = { play: () => { } };
    victorySound = { play: () => { } };

    // Collisions
    this.physics.add.overlap(runner, dataNodes, collectNode, null, this);
    this.physics.add.overlap(runner, drones, hitDrone, null, this);

    // Drone Movement
    this.time.addEvent({
        delay: 500,
        callback: moveDrones,
        callbackScope: this,
        loop: true
    });

    // Pause
    this.input.keyboard.on('keydown-P', () => {
        if (gameState === 'playing') {
            gameState = 'paused';
            this.physics.world.isPaused = true;
        } else if (gameState === 'paused') {
            gameState = 'playing';
            this.physics.world.isPaused = false;
        }
    });

    // Mute button (top-left)
    muteButton = this.add.text(20, 20, isMuted ? '🔇' : '🔊', {
        fontFamily: 'Orbitron, monospace',
        fontSize: '32px',
        color: '#00bfff',
        backgroundColor: '#111a',
        padding: { left: 10, right: 10, top: 5, bottom: 5 },
        borderRadius: 8
    }).setInteractive().setScrollFactor(0).setDepth(4);
    muteButton.on('pointerdown', () => {
        isMuted = !isMuted;
        muteButton.setText(isMuted ? '🔇' : '🔊');
        // Would mute/unmute audio here
    });

    // Add bullets group
    bullets = this.physics.add.group();

    // Fire bullet on spacebar (rapid fire)
    this.input.keyboard.on('keydown-SPACE', () => {
        if (gameState !== 'playing') return;
        if (!spaceBarHeld) {
            spaceBarHeld = true;
            // Fire immediately
            fireBullet.call(this);
            // Start rapid fire interval
            fireInterval = this.time.addEvent({
                delay: BULLET_FIRE_RATE,
                callback: () => fireBullet.call(this),
                loop: true
            });
        }
    });
    this.input.keyboard.on('keyup-SPACE', () => {
        spaceBarHeld = false;
        if (fireInterval) {
            fireInterval.remove();
            fireInterval = null;
        }
    });
    // Bullet-drone collision
    this.physics.add.overlap(bullets, drones, (bullet, drone) => {
        if (!drone.hitCount) drone.hitCount = 0;
        drone.hitCount++;
        bullet.destroy();
        // Update health bar
        if (drone.healthBar) {
            let percent = Math.max(0, 1 - drone.hitCount / 3);
            drone.healthBar.width = 24 * percent;
            if (percent > 0.5) drone.healthBar.fillColor = 0x00ff00;
            else if (percent > 0.25) drone.healthBar.fillColor = 0xffff00;
            else drone.healthBar.fillColor = 0xff3333;
        }
        if (drone.hitCount >= 3) {
            drone.destroy();
            dronesRemaining--;
            if (dronesRemaining === 0) {
                showAllDronesEliminatedMsg.call(this);
            }
        }
    });
}

function collectNode(runner, node) {
    if (gameState !== 'playing') return;
    // Only collect if runner and node are on the same grid cell
    const runnerGridX = Math.round((runner.x - 16) / 32);
    const runnerGridY = Math.round((runner.y - 16) / 32);
    const nodeGridX = Math.round((node.x - 16) / 32);
    const nodeGridY = Math.round((node.y - 16) / 32);
    if (runnerGridX !== nodeGridX || runnerGridY !== nodeGridY) return;
    node.orb.destroy();
    node.spark.destroy();
    node.destroy();
    dataNodesCollected++;
    nodeSound.play();
    if (dataNodesCollected === totalDataNodes) {
        gameState = 'victory';
        this.physics.world.isPaused = true;
        showVictoryScreen.call(this);
    }
}

function hitDrone() {
    if (gameState !== 'playing') return;
    gameState = 'gameover';
    this.physics.world.isPaused = true;
    gameOverSound.play();
    showGameOverScreen.call(this);
}

function moveDrones() {
    if (gameState !== 'playing') return;
    drones.getChildren().forEach(drone => {
        // Find the closest data node
        let closestNode = null;
        let minDist = Infinity;
        dataNodes.getChildren().forEach(node => {
            const dist = Phaser.Math.Distance.Between(drone.x, drone.y, node.x, node.y);
            if (dist < minDist) {
                minDist = dist;
                closestNode = node;
            }
        });
        if (!closestNode) return; // No nodes left
        // Determine best direction to move toward the node
        const dx = closestNode.x - drone.x;
        const dy = closestNode.y - drone.y;
        let directions = [];
        if (Math.abs(dx) > Math.abs(dy)) {
            directions.push(dx > 0 ? 'right' : 'left');
            if (dy !== 0) directions.push(dy > 0 ? 'down' : 'up');
        } else if (dy !== 0) {
            directions.push(dy > 0 ? 'down' : 'up');
            if (dx !== 0) directions.push(dx > 0 ? 'right' : 'left');
        }
        ['up', 'down', 'left', 'right'].forEach(dir => {
            if (!directions.includes(dir)) directions.push(dir);
        });
        if (directions.length > 1) {
            const first = directions[0];
            const rest = directions.slice(1);
            Phaser.Utils.Array.Shuffle(rest);
            directions = [first, ...rest];
        }
        // Try each direction in order, skipping the previous position
        let moved = false;
        for (let dir of directions) {
            let newX = drone.x, newY = drone.y;
            if (dir === 'up') newY -= 32;
            else if (dir === 'down') newY += 32;
            else if (dir === 'left') newX -= 32;
            else if (dir === 'right') newX += 32;
            // Skip if this is the previous position
            if (drone.prevPos && drone.prevPos.x === newX && drone.prevPos.y === newY) continue;
            const isAdjacentToNode = dataNodes.getChildren().some(n =>
                Math.abs(n.x - newX) <= 32 && Math.abs(n.y - newY) <= 32 && !(n.x === newX && n.y === newY)
            );
            if (
                newX >= 16 && newX <= 1584 && newY >= 16 && newY <= 1584 &&
                !drones.getChildren().some(d => d !== drone && d.x === newX && d.y === newY) &&
                !dataNodes.getChildren().some(n => n.x === newX && n.y === newY) &&
                !isAdjacentToNode
            ) {
                // Update prevPos before moving
                drone.prevPos = { x: drone.x, y: drone.y };
                drone.setPosition(newX, newY);
                moved = true;
                break;
            }
        }
        // If no move is possible, drone stays in place (rare)
    });
}

function isAdjacentToAnyNode(x, y, nodePositions) {
    return nodePositions.some(pos => {
        const [nx, ny] = pos.split(',').map(Number);
        return Math.abs(nx - x) <= 1 && Math.abs(ny - y) <= 1 && !(nx === x && ny === y);
    });
}

function showVictoryScreen() {
    victoryScreen = this.add.rectangle(400, 300, 800, 600, 0x00ffff, 0.3).setDepth(4).setScrollFactor(0);
    this.add.text(400, 250, 'Victory! All Data Nodes Collected', {
        fontFamily: 'Orbitron, monospace',
        fontSize: '32px',
        color: '#00ffcc',
        stroke: '#0033ff',
        strokeThickness: 4
    }).setOrigin(0.5).setDepth(4).setScrollFactor(0);
    restartButton = this.add.rectangle(400, 350, 100, 50, 0x0033ff, 0.8).setDepth(4).setScrollFactor(0).setInteractive();
    restartText = this.add.text(400, 350, 'Restart', {
        fontFamily: 'Orbitron, monospace',
        fontSize: '24px',
        color: '#fff',
        stroke: '#00bfff',
        strokeThickness: 2
    }).setOrigin(0.5).setDepth(4).setScrollFactor(0);
    restartButton.on('pointerdown', () => restartGame.call(this));
    victorySound.play();
}

function showGameOverScreen() {
    gameOverScreen = this.add.rectangle(400, 300, 800, 600, 0xff3333, 0.3).setDepth(4).setScrollFactor(0);
    this.add.text(400, 250, 'Game Over! Caught by Drone', {
        fontFamily: 'Orbitron, monospace',
        fontSize: '32px',
        color: '#ff3333',
        stroke: '#fff',
        strokeThickness: 4
    }).setOrigin(0.5).setDepth(4).setScrollFactor(0);
    restartButton = this.add.rectangle(400, 350, 100, 50, 0x0033ff, 0.8).setDepth(4).setScrollFactor(0).setInteractive();
    restartText = this.add.text(400, 350, 'Restart', {
        fontFamily: 'Orbitron, monospace',
        fontSize: '24px',
        color: '#fff',
        stroke: '#00bfff',
        strokeThickness: 2
    }).setOrigin(0.5).setDepth(4).setScrollFactor(0);
    restartButton.on('pointerdown', () => restartGame.call(this));
}

function restartGame() {
    dataNodesCollected = 0;
    gameState = 'playing';
    this.physics.world.isPaused = false;
    runner.setPosition(25 * 32 + 16, 25 * 32 + 16);
    if (runner.body) {
        runner.body.x = runner.x - runner.body.width / 2;
        runner.body.y = runner.y - runner.body.height / 2;
    }
    dataNodes.clear(true, true);
    drones.clear(true, true);
    // Remove all placeholder graphics for nodes and drones
    this.children.list.filter(c => c.depth === 2 && (c.type === 'Ellipse' || c.type === 'Triangle')).forEach(c => c.destroy());
    // Respawn Data Nodes
    let nodePositions = [];
    for (let i = 0; i < totalDataNodes; i++) {
        let x, y, pos;
        do {
            x = Phaser.Math.Between(0, 49);
            y = Phaser.Math.Between(0, 49);
            pos = `${x},${y}`;
        } while ((x === 25 && y === 25) || nodePositions.includes(pos));
        nodePositions.push(pos);
        let orb = this.add.circle(x * 32 + 16, y * 32 + 16, 16, 0xff33cc, 0.7).setDepth(2);
        let spark = this.add.circle(x * 32 + 16, y * 32 + 16, 20, 0xffffff, 0.1).setDepth(2);
        let node = this.physics.add.sprite(x * 32 + 16, y * 32 + 16, null).setDisplaySize(32, 32).setDepth(2);
        node.orb = orb;
        node.spark = spark;
        dataNodes.add(node);
    }
    // Respawn Drones
    let dronePositions = [];
    for (let i = 0; i < 10; i++) {
        let x, y, pos;
        do {
            x = Phaser.Math.Between(0, 49);
            y = Phaser.Math.Between(0, 49);
            pos = `${x},${y}`;
        } while ((x === 25 && y === 25) || nodePositions.includes(pos) || dronePositions.includes(pos) || isAdjacentToAnyNode(x, y, nodePositions) || Math.abs(x - 25) < 5 || Math.abs(y - 25) < 5);
        dronePositions.push(pos);
        // Draw drone as a container
        const droneContainer = this.add.container(x * 32 + 16, y * 32 + 16);
        // Central body
        const body = this.add.ellipse(0, 0, 20, 16, 0xff3333).setStrokeStyle(2, 0xffffff, 0.7);
        // Side arms
        const armL = this.add.rectangle(-14, 0, 8, 4, 0x880000).setAngle(20);
        const armR = this.add.rectangle(14, 0, 8, 4, 0x880000).setAngle(-20);
        // Glowing red eye
        const eye = this.add.circle(0, 0, 4, 0xffffff, 1).setStrokeStyle(2, 0xff3333, 1);
        // Neon underglow
        const underglow = this.add.ellipse(0, 8, 24, 8, 0xff3333, 0.18);
        // Health bar background
        const healthBarBg = this.add.rectangle(0, -22, 24, 5, 0x222222, 0.8);
        // Health bar foreground
        const healthBar = this.add.rectangle(0, -22, 24, 5, 0x00ff00, 1);
        healthBar.setOrigin(0.5, 0.5);
        healthBarBg.setOrigin(0.5, 0.5);
        droneContainer.add([underglow, armL, armR, body, eye, healthBarBg, healthBar]);
        droneContainer.setDepth(2);
        // Add physics
        const dronePhysics = this.physics.add.existing(droneContainer);
        dronePhysics.body.setSize(24, 16);
        dronePhysics.body.setCollideWorldBounds(true);
        dronePhysics.setPosition(x * 32 + 16, y * 32 + 16);
        drones.add(droneContainer);
        droneContainer.prevPos = { x: x * 32 + 16, y: y * 32 + 16 };
        // Add hitCount to drones
        droneContainer.hitCount = 0;
        droneContainer.healthBar = healthBar;
    }
    dronesRemaining = drones.getChildren().length;
    // Remove overlays
    if (victoryScreen) victoryScreen.destroy();
    if (gameOverScreen) gameOverScreen.destroy();
    if (restartButton) restartButton.destroy();
    if (restartText) restartText.destroy();
    this.children.list.filter(c => c.depth === 4 && c.type === 'Text' && c.text.startsWith('Victory')).forEach(c => c.destroy());
    this.children.list.filter(c => c.depth === 4 && c.type === 'Text' && c.text.startsWith('Game Over')).forEach(c => c.destroy());
    if (droneEliminatedMsg) {
        droneEliminatedMsg.destroy();
        droneEliminatedMsg = null;
    }
}

function moveRunner(scene) {
    if (gameState !== 'playing') return;
    let move = null;
    if (cursors.left.isDown || cursors.wasd.left.isDown || dpadDirection === 'left') {
        move = { dx: -1, dy: 0 };
        lastDirection = 'left';
    } else if (cursors.right.isDown || cursors.wasd.right.isDown || dpadDirection === 'right') {
        move = { dx: 1, dy: 0 };
        lastDirection = 'right';
    } else if (cursors.up.isDown || cursors.wasd.up.isDown || dpadDirection === 'up') {
        move = { dx: 0, dy: -1 };
        lastDirection = 'up';
    } else if (cursors.down.isDown || cursors.wasd.down.isDown || dpadDirection === 'down') {
        move = { dx: 0, dy: 1 };
        lastDirection = 'down';
    }
    if (move) {
        let gridX = Math.round((runner.x - 16) / 32);
        let gridY = Math.round((runner.y - 16) / 32);
        let newX = gridX + move.dx;
        let newY = gridY + move.dy;
        if (newX >= 0 && newX <= 49 && newY >= 0 && newY <= 49 && (newX !== gridX || newY !== gridY)) {
            runner.setPosition(newX * 32 + 16, newY * 32 + 16);
            // Set rotation based on direction
            if (move.dx === -1) {
                runner.rotation = -Math.PI / 2; // Left
            } else if (move.dx === 1) {
                runner.rotation = Math.PI / 2; // Right
            } else if (move.dy === -1) {
                runner.rotation = 0; // Up
            } else if (move.dy === 1) {
                runner.rotation = Math.PI; // Down
            }
            moveSound.play();
        }
    }
}

function update() {
    if (gameState !== 'playing') return;

    // Movement: start/stop interval for continuous movement
    const anyKeyDown =
        cursors.left.isDown || cursors.right.isDown ||
        cursors.up.isDown || cursors.down.isDown ||
        cursors.wasd.left.isDown || cursors.wasd.right.isDown ||
        cursors.wasd.up.isDown || cursors.wasd.down.isDown ||
        dpadDirection !== '';
    if (anyKeyDown && !moveInterval) {
        moveRunner(this); // Move immediately on press
        moveInterval = this.time.addEvent({
            delay: 200,
            callback: () => moveRunner(this),
            loop: true
        });
    } else if (!anyKeyDown && moveInterval) {
        moveInterval.remove();
        moveInterval = null;
    }

    // Update HUD
    const gridX = Math.floor(runner.x / 32);
    const gridY = Math.floor(runner.y / 32);
    hudText.setText(`X: ${gridX}, Y: ${gridY} | Nodes: ${dataNodesCollected}/${totalDataNodes} | Drones: ${dronesRemaining}`);

    // Bullet grid movement and cleanup
    bullets.getChildren().forEach(bullet => {
        if (this.time.now - bullet.lastMove >= bulletMoveInterval) {
            bullet.gridX += bullet.dx;
            bullet.gridY += bullet.dy;
            bullet.x = bullet.gridX * 32 + 16;
            bullet.y = bullet.gridY * 32 + 16;
            bullet.lastMove = this.time.now;
        }
        // Remove if out of bounds
        if (
            bullet.gridX < 0 || bullet.gridX > 49 ||
            bullet.gridY < 0 || bullet.gridY > 49
        ) {
            bullet.destroy();
        }
    });
}

// Helper function to fire a bullet
function fireBullet() {
    if (gameState !== 'playing') return;
    // Fire bullet in lastDirection
    let dx = 0, dy = 0;
    if (lastDirection === 'left') dx = -1;
    else if (lastDirection === 'right') dx = 1;
    else if (lastDirection === 'up') dy = -1;
    else if (lastDirection === 'down') dy = 1;
    // Get grid position
    let gridX = Math.round((runner.x - 16) / 32);
    let gridY = Math.round((runner.y - 16) / 32);
    // Create bullet as a sprite (no texture, just color)
    let bullet = this.add.ellipse(gridX * 32 + 16, gridY * 32 + 16, 16, 16, 0xff33cc).setDepth(3);
    bullet.gridX = gridX;
    bullet.gridY = gridY;
    bullet.dx = dx;
    bullet.dy = dy;
    bullet.lastMove = this.time.now;
    bullets.add(bullet);
}

// Show a temporary message when all drones are eliminated
function showAllDronesEliminatedMsg() {
    if (droneEliminatedMsg) droneEliminatedMsg.destroy();
    droneEliminatedMsg = this.add.text(400, 180, 'All Drones Eliminated!', {
        fontFamily: 'Orbitron, monospace',
        fontSize: '36px',
        color: '#00ffcc',
        stroke: '#0033ff',
        strokeThickness: 5,
        align: 'center',
        backgroundColor: '#111a',
        padding: { left: 16, right: 16, top: 8, bottom: 8 }
    }).setOrigin(0.5).setDepth(5).setScrollFactor(0);
    this.time.delayedCall(2000, () => {
        if (droneEliminatedMsg) {
            droneEliminatedMsg.destroy();
            droneEliminatedMsg = null;
        }
    });
}
