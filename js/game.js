// CONFIG block moved to js/config.js
const audioSynth = new AudioSynth();
let isMuted = false; // Mute state tracks if synthesizer sound outputs are disabled
let userSpeedMultiplier = 1.0;
const SPEED_MODE_KEY = 'hype_dodger_speed_mode';
try {
    userSpeedMultiplier = localStorage.getItem(SPEED_MODE_KEY) === 'chill' ? CONFIG.SPEED.CHILL_MULTIPLIER : 1.0;
} catch (e) {
    userSpeedMultiplier = 1.0;
}

document.getElementById('mute-btn').addEventListener('click', (e) => {
    isMuted = !isMuted;
    audioSynth.setMute(isMuted);
    document.getElementById('mute-btn').innerText = isMuted ? "SOUND: OFF" : "SOUND: ON";
    e.stopPropagation(); // Avoid triggering screen input event listener
});

// --- Three.js Setup & Graphics ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05050a, CONFIG.SYSTEM.FOG_DENSITY);

// Set up camera using modular controller
const camera = createCamera();

// Setup renderer (fixed 9:16 target aspect ratio)
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.SYSTEM.MAX_DPR));
container.insertBefore(renderer.domElement, container.firstChild);

// --- Retro Assets Generation (No External Assets) ---
const { gridTexture, shipGroup, leftLaser, rightLaser, sunsetMesh, dirLight } = createGameAssets(scene);

// --- High Performance Instanced Particle System ---
initParticles(scene);

// --- Speed Lines (Dynamic Warp Effect) ---
const speedLines = [];
const speedLineCount = CONFIG.SPEED_LINES.COUNT;
const speedLineGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 4)
]);
const speedLineMat = new THREE.LineBasicMaterial({
    color: 0x9d00ff,
    transparent: true,
    opacity: 0.35
});

for (let i = 0; i < speedLineCount; i++) {
    const line = new THREE.Line(speedLineGeom, speedLineMat);
    resetSpeedLine(line);
    scene.add(line);
    speedLines.push(line);
}

function resetSpeedLine(line) {
    line.position.x = (Math.random() - 0.5) * CONFIG.SPEED_LINES.X_SPAN;
    line.position.y = Math.random() * CONFIG.SPEED_LINES.Y_HEIGHT + CONFIG.SPEED_LINES.Y_BASE;
    line.position.z = CONFIG.SPEED_LINES.Z_FAR - Math.random() * CONFIG.SPEED_LINES.Z_RANGE;
}

function updateSpeedLines(spd, tScale) {
    speedLines.forEach(line => {
        line.position.z += spd * CONFIG.SPEED_LINES.V_MULT * tScale;
        if (line.position.z > CONFIG.SPEED_LINES.Z_RESET) {
            resetSpeedLine(line);
        }
    });
}

// CONFIG block moved to top

// --- Game State Variables ---
let player = {
    x: 0,
    vx: 0,
    roll: 0,
    targetRoll: 0
};

let obstacles = [];
let score = 0;
let highScore = 0;
let gameSpeed = CONFIG.SPEED.START;
let timeScale = 1.0;
let gameOver = false;
let gameStarted = false;
let frameCount = 0;
let comboCount = 0;
let comboTimer = 0.0;
const comboDuration = 2.5; // seconds

let isSteeringLeft = false;
let isSteeringRight = false;
let gates = []; // Holds list of active math gate panels
let nextPairId = 0; // Incrementing ID to identify gate pairs
let currentStageIndex = 0; // Tracks player's active visual and speed level stage
let hamiltonianIndex = 0; // Current node index in CONFIG.HAMILTONIAN_CYCLE
let feverActive = false; // Is invincibility fever mode active
let feverTimer = 0.0;    // Time remaining in fever mode
let statsNodesHit = 0;    // Telemetry: correct node captures
let statsNodesMissed = 0; // Telemetry: missed/incorrect node selections
let statsFeverCount = 0;  // Telemetry: total fever activations triggered

// Keyboard movement inputs
let keyLeft = false;
let keyRight = false;

// Shield hitpoints
let shieldHp = 2;

// Tutorial progression state machine
let inTutorial = false;
let tutorialStep = 0;
let tutorialCooldown = 0;    // Delays after completing a step
let tutorialSpawned = false; // Ensures tutorial spawns only one obstacle/gate at a time

// Node HUD progressive disclosure state machine
// HIDDEN → FLASH (on NODE gate spawn) → PERSISTENT (on first correct hit)
let nodeHudMode = 'HIDDEN'; // 'HIDDEN' | 'FLASH' | 'PERSISTENT'
let nodeFlashTimer = 0;     // Countdown for FLASH state in seconds
let nodeFlashTimeout = null; // Reference for clearing flash timer

// Load high score
const savedBest = localStorage.getItem('hype_dodger_high');
if (savedBest) {
    highScore = parseInt(savedBest, 10);
    updateScoreUI();
}

// --- Steer and Movement Inputs ---
container.addEventListener('mousedown', handleInputStart);
container.addEventListener('touchstart', handleInputStart, { passive: false });

window.addEventListener('mouseup', handleInputEnd);
window.addEventListener('touchend', handleInputEnd);
window.addEventListener('touchcancel', handleInputEnd);

function handleInputStart(e) {
    if (!gameStarted) return;
    if (gameOver) return;
    
    let clientX;
    if (e.type === 'touchstart') {
        clientX = e.touches[0].clientX;
    } else {
        clientX = e.clientX;
    }
    
    // Bounds check relative to window
    if (clientX < window.innerWidth / 2) {
        isSteeringLeft = true;
        isSteeringRight = false;
    } else {
        isSteeringRight = true;
        isSteeringLeft = false;
    }
}

function handleInputEnd() {
    isSteeringLeft = false;
    isSteeringRight = false;
}

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

function handleKeyDown(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        keyLeft = true;
        keyRight = false;
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        keyRight = true;
        keyLeft = false;
    } else if (e.code === 'Space') {
        if (!gameStarted) {
            startGame();
        } else if (gameOver) {
            restartGame();
        }
        e.preventDefault();
    }
}

function handleKeyUp(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        keyLeft = false;
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        keyRight = false;
    }
}

// Button actions
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', restartGame);
document.getElementById('reset-btn-start').addEventListener('click', resetAllData);
document.getElementById('reset-btn-gameover').addEventListener('click', resetAllData);

function resetAllData(e) {
    try {
        localStorage.removeItem('hype_dodger_tutorial_done');
        localStorage.removeItem('hype_dodger_high');
    } catch (err) {}
    
    highScore = 0;
    
    inTutorial = true;
    tutorialStep = 0;
    tutorialCooldown = 0;
    tutorialSpawned = false;
    
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.classList.add('hidden');
    
    const gameoverScreen = document.getElementById('gameover-screen');
    if (gameoverScreen) gameoverScreen.classList.add('hidden');
    
    const banner = document.getElementById('tutorial-banner');
    if (banner) banner.classList.remove('hidden');
    
    gameOver = false;
    gameStarted = true;
    audioSynth.start();
    initGame();
    
    if (e) e.stopPropagation();
}

document.getElementById('speed-btn').addEventListener('click', (e) => {
    const oldMultiplier = userSpeedMultiplier;
    const isChill = userSpeedMultiplier !== 1.0;
    if (!isChill) {
        userSpeedMultiplier = CONFIG.SPEED.CHILL_MULTIPLIER;
        try { localStorage.setItem(SPEED_MODE_KEY, 'chill'); } catch (err) {}
        document.getElementById('speed-btn').innerText = "SPEED: CHILL";
        document.getElementById('speed-btn').classList.add('chill-active');
        document.getElementById('speed-btn').setAttribute('aria-pressed', 'true');
    } else {
        userSpeedMultiplier = 1.0;
        try { localStorage.setItem(SPEED_MODE_KEY, 'normal'); } catch (err) {}
        document.getElementById('speed-btn').innerText = "SPEED: NORMAL";
        document.getElementById('speed-btn').classList.remove('chill-active');
        document.getElementById('speed-btn').setAttribute('aria-pressed', 'false');
    }
    if (typeof gameSpeed !== 'undefined' && oldMultiplier > 0) {
        gameSpeed = gameSpeed / oldMultiplier * userSpeedMultiplier;
    }
    e.stopPropagation();
});

const speedBtn = document.getElementById('speed-btn');
if (speedBtn) {
    if (userSpeedMultiplier === CONFIG.SPEED.CHILL_MULTIPLIER) {
        speedBtn.innerText = "SPEED: CHILL";
        speedBtn.classList.add('chill-active');
        speedBtn.setAttribute('aria-pressed', 'true');
    } else {
        speedBtn.innerText = "SPEED: NORMAL";
        speedBtn.setAttribute('aria-pressed', 'false');
    }
}

function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    gameStarted = true;
    audioSynth.start();

    const tutorialDone = localStorage.getItem('hype_dodger_tutorial_done') === 'true';
    if (!tutorialDone) {
        inTutorial = true;
        tutorialStep = 0;
        tutorialCooldown = 0;
        tutorialSpawned = false;
        const banner = document.getElementById('tutorial-banner');
        if (banner) banner.classList.remove('hidden');
    } else {
        inTutorial = false;
        const banner = document.getElementById('tutorial-banner');
        if (banner) banner.classList.add('hidden');
    }

    initGame();
}

function restartGame() {
    document.getElementById('gameover-screen').classList.add('hidden');
    gameOver = false;
    audioSynth.start();

    const tutorialDone = localStorage.getItem('hype_dodger_tutorial_done') === 'true';
    if (!tutorialDone) {
        inTutorial = true;
        tutorialStep = 0;
        tutorialCooldown = 0;
        tutorialSpawned = false;
        const banner = document.getElementById('tutorial-banner');
        if (banner) banner.classList.remove('hidden');
    } else {
        inTutorial = false;
        const banner = document.getElementById('tutorial-banner');
        if (banner) banner.classList.add('hidden');
    }

    initGame();
}

let gateShrinkIntervals = []; // Track active gate shrink animations for cleanup

function initGame() {
    player = {
        x: 0,
        vx: 0,
        roll: 0,
        targetRoll: 0
    };
    
    // Reset key input states
    keyLeft = false;
    keyRight = false;
    isSteeringLeft = false;
    isSteeringRight = false;
    
    // Reset shields
    shieldHp = 2;
    updateShieldUI();
    
    // Reset tutorial state guards
    tutorialSpawned = false;
    if (inTutorial) {
        updateTutorialBanner();
    }
    
    // Clear obstacles
    obstacles.forEach(obs => { scene.remove(obs.mesh); scene.remove(obs.shadowMesh); if (obs.dangerLight) scene.remove(obs.dangerLight); });
    obstacles = [];
    
    // Clear particles
    for (let i = 0; i < maxParticles; i++) {
        particles[i].active = false;
    }
    
    // Clear gates and shrink animations
    gateShrinkIntervals.forEach(id => clearInterval(id));
    gateShrinkIntervals = [];
    gates.forEach(g => { scene.remove(g.mesh); if (g.leftPost) scene.remove(g.leftPost); if (g.rightPost) scene.remove(g.rightPost); });
    gates = [];

    score = 0;
    gameSpeed = CONFIG.SPEED.START * userSpeedMultiplier;
    timeScale = 1.0;
    comboCount = 0;
    audioSynth.setComboCount(comboCount);
    comboTimer = 0.0;
    frameCount = 0;
    resetCamera(camera);
    
    currentStageIndex = 0;
    updateStageVisuals(CONFIG.STAGES[0]);
    
    // Reset Hamiltonian node chain
    hamiltonianIndex = 0;
    feverActive = false;
    feverTimer = 0.0;
    nodeHudMode = 'HIDDEN';
    if (nodeFlashTimeout) { clearTimeout(nodeFlashTimeout); nodeFlashTimeout = null; }
    const nodePanel = document.getElementById('node-panel');
    if (nodePanel) {
        nodePanel.classList.remove('hidden');
        nodePanel.classList.remove('hud-visible');
    }
    drawNodePips();

    
    // Reset play stats telemetry
    statsNodesHit = 0;
    statsNodesMissed = 0;
    statsFeverCount = 0;
    
    shipGroup.position.set(0, 0.25, -5);
    shipGroup.scale.set(1, 1, 1);
    
    const shieldMesh = shipGroup.getObjectByName("shieldMesh");
    if (shieldMesh) {
        shieldMesh.material.opacity = 0.0;
        shieldMesh.material.color.setHex(0x00ffcc);
    }
    
    updateScoreUI();
    updateComboUI();
    
    showFloatingText("SYSTEM INIT", "cyan-glow");
}

function triggerShieldHit() {
    if (shieldHp > 0) {
        shieldHp--;
        updateShieldUI();
    }
    
    audioSynth.playBounce();
    addCameraShake(0.3, 0.45);
    triggerFlash('#ff0055', 0.35);
    showFloatingText("SHIELD DAMAGED", "pink-glow");
    
    // Recovery bullet-time slowdown (automatically decays back to 1.0)
    timeScale = 0.15;
    
    // Shield visual halo flashes red
    const shieldMesh = shipGroup.getObjectByName("shieldMesh");
    if (shieldMesh) {
        shieldMesh.material.opacity = 0.7;
        shieldMesh.material.color.setHex(0xff0055);
    }
}

function triggerShieldRechargeEffect() {
    const shieldMesh = shipGroup.getObjectByName("shieldMesh");
    if (shieldMesh) {
        shieldMesh.material.opacity = 0.5;
        shieldMesh.material.color.setHex(0x00ffcc);
    }
}

function updateTutorialBanner() {
    const banner = document.getElementById('tutorial-banner');
    const textEl = document.getElementById('tutorial-text');
    if (!banner || !textEl) return;
    
    banner.classList.remove('hidden');
    
    if (tutorialStep === 0) {
        textEl.innerHTML = "STEER RIGHT TO DODGE!<br><span style='font-size: 11px; color: #ffcc00;'>Press [D] or ArrowRight</span>";
    } else if (tutorialStep === 1) {
        textEl.innerHTML = "DODGE CLOSE FOR A NEAR MISS COMBO!<br><span style='font-size: 11px; color: #ffcc00;'>Steer close to the oncoming obstacle</span>";
    } else if (tutorialStep === 2) {
        textEl.innerHTML = "COLLECT CYAN GATES, AVOID RED GATES!<br><span style='font-size: 11px; color: #ffcc00;'>Cyan restores shields + builds combos</span>";
    } else if (tutorialStep === 3) {
        textEl.innerHTML = "TRAINING COMPLETED!<br><span style='font-size: 11px; color: #00ffcc;'>GRID LOADED. GET READY FOR THE WAVE...</span>";
    }
}

function advanceTutorialStep() {
    tutorialStep++;
    tutorialSpawned = false;
    
    // Clear all obstacles and gates to keep a clean slate for the next training scenario
    obstacles.forEach(obs => { scene.remove(obs.mesh); scene.remove(obs.shadowMesh); if (obs.dangerLight) scene.remove(obs.dangerLight); });
    obstacles = [];
    gates.forEach(g => { scene.remove(g.mesh); if (g.leftPost) scene.remove(g.leftPost); if (g.rightPost) scene.remove(g.rightPost); });
    gates = [];
    
    updateTutorialBanner();
    
    if (tutorialStep === 3) {
        // Complete tutorial after a dramatic delay
        setTimeout(() => {
            localStorage.setItem('hype_dodger_tutorial_done', 'true');
            inTutorial = false;
            const banner = document.getElementById('tutorial-banner');
            if (banner) banner.classList.add('hidden');
            restartGame();
        }, 3200);
    }
}

function triggerWallBounce(isLeft) {
    audioSynth.playBounce();
    addCameraShake(CONFIG.MECHANICS.BOUNCE_SHAKE, CONFIG.MECHANICS.BOUNCE_SHAKE_MAX);
    triggerFlash(CONFIG.COLORS.BOUNCE_FLASH, CONFIG.MECHANICS.BOUNCE_FLASH);
    showFloatingText("DRIFT BOUNCE", "pink-glow");
    
    // Sparks shower at the impact wall
    let sparkX = isLeft ? -CONFIG.ASSETS.LASER_X : CONFIG.ASSETS.LASER_X;
    
    const minSparkVx = 0.02; // Minimum lateral velocity multiplier
    const sparkVxRange = 0.07; // Deviation lateral velocity range
    const maxSparkVy = 0.03; // Vertical velocity range
    const maxSparkVz = 0.03; // Forward/backward depth velocity range
    const baseLifespan = 15; // Base particle lifespan in frames
    const lifespanRange = 15; // Random lifespan variation range
    
    for (let i = 0; i < CONFIG.MECHANICS.BOUNCE_SPARKS; i++) {
        spawnParticle(
            sparkX,
            CONFIG.MECHANICS.BOUNCE_SPARK_HEIGHT,
            shipGroup.position.z,
            (isLeft ? 1 : -1) * (minSparkVx + Math.random() * sparkVxRange), // Shoot sparks inwards
            (Math.random() - 0.5) * maxSparkVy, // Random vertical dispersion centering around 0
            (Math.random() - 0.5) * maxSparkVz, // Random depth dispersion centering around 0
            CONFIG.COLORS.BOUNCE_SPARK[0], CONFIG.COLORS.BOUNCE_SPARK[1], CONFIG.COLORS.BOUNCE_SPARK[2], // Cyan spark color (RGB)
            baseLifespan + Math.random() * lifespanRange
        );
    }
}

function triggerNearMiss(obs) {
    audioSynth.playDodge();
    addCameraShake(CONFIG.MECHANICS.MISS_SHAKE, CONFIG.MECHANICS.MISS_SHAKE_MAX);
    timeScale = CONFIG.MECHANICS.MISS_TIME_SCALE; // Bullet-time slow motion!
    
    comboCount++;
    comboTimer = comboDuration;
    audioSynth.setComboCount(comboCount);
    
    let bonus = CONFIG.MECHANICS.MISS_SCORE_BASE * comboCount;
    score += bonus;
    
    triggerFlash(CONFIG.COLORS.NEAR_MISS_FLASH, CONFIG.MECHANICS.MISS_FLASH_OPACITY);
    showFloatingText(`NEAR MISS +${bonus}`, "yellow-glow");
    updateScoreUI();
    updateComboUI();

    if (inTutorial && tutorialStep === 1) {
        advanceTutorialStep();
    }
    
    // Spawn radial gold sparks
    spawnNearMissSparks(shipGroup.position.x, shipGroup.position.y, shipGroup.position.z);
    
    // Temporarily flash player wing colors
    // We get a reference to the wingMesh inside player's group
    const wing = shipGroup.children.find(child => child.geometry && child.geometry.type === 'BoxGeometry');
    if (wing) {
        wing.material.emissive.setHex(CONFIG.COLORS.NEAR_MISS_WING_FLASH);
        setTimeout(() => {
            if (!gameOver) wing.material.emissive.setHex(CONFIG.COLORS.NEAR_MISS_WING_BASE);
        }, CONFIG.MECHANICS.MISS_FLASH_DURATION);
    }
}

function triggerGameOver() {
    gameOver = true;
    audioSynth.stop();
    
    // Play dramatic explosion synth
    audioSynth.playExplosion();
    
    setCameraShake(CONFIG.MECHANICS.END_SHAKE);
    triggerFlash(CONFIG.COLORS.GAME_OVER_FLASH, CONFIG.MECHANICS.END_FLASH_OPACITY);
    
    // Spawn massive particle explosion (RGB color matching GAME_OVER_EXPLOSION config)
    spawnExplosion(
        shipGroup.position.x, 
        shipGroup.position.y, 
        shipGroup.position.z, 
        CONFIG.COLORS.GAME_OVER_EXPLOSION[0], 
        CONFIG.COLORS.GAME_OVER_EXPLOSION[1], 
        CONFIG.COLORS.GAME_OVER_EXPLOSION[2], 
        CONFIG.MECHANICS.END_EXPLOSION_COUNT
    );
    
    // Scale ship down to 0, 0, 0 (simulate shattered destruction)
    shipGroup.scale.set(0, 0, 0);
    
    // Save high score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('hype_dodger_high', highScore);
    }
    
    // Evaluate accuracy and letter grade
    let accuracy = 0;
    const totalNodes = statsNodesHit + statsNodesMissed;
    if (totalNodes > 0) {
        accuracy = Math.round((statsNodesHit / totalNodes) * 100);
    }
    
    let grade = "D";
    if (accuracy >= 85 && score >= 8000) grade = "S";
    else if (accuracy >= 70 && score >= 4000) grade = "A";
    else if (accuracy >= 50 && score >= 2000) grade = "B";
    else if (accuracy >= 30 && score >= 1000) grade = "C";
    
    // Update summary elements
    const accuracyEl = document.getElementById('stats-accuracy');
    if (accuracyEl) accuracyEl.innerText = `${accuracy}%`;
    
    const nodesEl = document.getElementById('stats-nodes');
    if (nodesEl) nodesEl.innerText = `${statsNodesHit} / ${totalNodes}`;
    
    const feverEl = document.getElementById('stats-fever');
    if (feverEl) feverEl.innerText = statsFeverCount;
    
    const gradeEl = document.getElementById('stats-grade');
    if (gradeEl) {
        gradeEl.innerText = grade;
        gradeEl.style.color = (grade === 'S' || grade === 'A') ? '#00ffcc' : '#ff0055';
        gradeEl.style.textShadow = (grade === 'S' || grade === 'A') 
            ? '0 0 15px rgba(0, 255, 204, 0.8)' 
            : '0 0 15px rgba(255, 0, 85, 0.8)';
    }
    
    // Record run stats to localStorage history log
    let history = [];
    try {
        const saved = localStorage.getItem('hype_dodger_runs');
        if (saved) history = JSON.parse(saved);
    } catch (e) {
        console.warn("Could not read runs history:", e);
    }
    
    history.push({
        date: new Date().toLocaleString(),
        score: score,
        accuracy: `${accuracy}%`,
        grade: grade,
        feverCycles: statsFeverCount
    });
    
    try {
        localStorage.setItem('hype_dodger_runs', JSON.stringify(history));
    } catch (e) {
        console.warn("Could not save runs history:", e);
    }
    
    // Output structured table list to developer console
    console.clear();
    console.log("%c=== RETRO PLAYTEST RUNS TELEMETRY LOG ===", "color: #ffcc00; font-weight: bold; font-size: 13px;");
    console.table(history);
    
    // Configure optional feedback submission button
    const telemetryBtn = document.getElementById('telemetry-btn');
    if (telemetryBtn) {
        telemetryBtn.onclick = () => {
            const prefillUrl = `${CONFIG.TELEMETRY.FORM_URL}?${CONFIG.TELEMETRY.ENTRY_SCORE}=${encodeURIComponent(score)}&${CONFIG.TELEMETRY.ENTRY_ACCURACY}=${encodeURIComponent(accuracy + '%')}&${CONFIG.TELEMETRY.ENTRY_GRADE}=${encodeURIComponent(grade)}&${CONFIG.TELEMETRY.ENTRY_FEVER}=${encodeURIComponent(statsFeverCount)}`;
            window.open(prefillUrl, '_blank');
        };
    }
    
    // Show game over overlay
    const finalScoreEl = document.getElementById('final-score');
    if (finalScoreEl) finalScoreEl.innerText = score;
    
    const finalBestEl = document.getElementById('final-best');
    if (finalBestEl) finalBestEl.innerText = highScore;
    
    const gameoverScreen = document.getElementById('gameover-screen');
    if (gameoverScreen) gameoverScreen.classList.remove('hidden');
    
    const nodePanelHide = document.getElementById('node-panel');
    if (nodePanelHide) nodePanelHide.classList.add('hidden');
}

// --- Obstacle Spawner ---
function spawnObstacle(customX = null, customZ = null) {
    let size = CONFIG.OBSTACLES.SIZE_MIN + Math.random() * CONFIG.OBSTACLES.SIZE_RANGE;
    let geom;
    let type = Math.floor(Math.random() * 3); // 3 different shape variants
    
    if (type === 0) {
        geom = new THREE.OctahedronGeometry(size);
    } else if (type === 1) {
        geom = new THREE.ConeGeometry(
            size * 0.65, // base width relative scalar
            size * 1.4,  // height relative scalar
            4            // 4 radial segments to make it look like a wireframe pyramid
        );
        geom.rotateX(Math.PI); // Orient point downwards
    } else {
        geom = new THREE.BoxGeometry(
            size * 1.1,  // Box width relative scale
            size * 1.1,  // Box height relative scale
            size * 1.1   // Box depth relative scale
        );
    }
    
    // Neon emissive standard material
    const obsMat = new THREE.MeshStandardMaterial({
        color: 0xff0055,   // Obstacle base neon pink color
        emissive: 0x440011, // Dark red glow
        roughness: 0.1,    // Glossy finish
        metalness: 0.8     // Metallic reflectiveness
    });
    
    const mesh = new THREE.Mesh(geom, obsMat);
    // Randomized lateral positioning across lanes
    const spawnX = customX !== null ? customX : (Math.random() - 0.5) * CONFIG.OBSTACLES.SPAN_X;
    const spawnZ = customZ !== null ? customZ : CONFIG.OBSTACLES.SPAWN_Z;
    mesh.position.set(spawnX, size / 2, spawnZ);
    scene.add(mesh);

    // Warning shadow — flat circle on grid, grows as obstacle approaches
    const shadowGeom = new THREE.CircleGeometry(size * 0.85, 16);
    shadowGeom.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
        color: 0xff0055,
        transparent: true,
        opacity: 0,
        depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
    shadowMesh.position.set(spawnX, 0.02, spawnZ);
    scene.add(shadowMesh);

    // Danger pulse light — red point light that pulses to scream "solid obstacle"
    const dangerLight = new THREE.PointLight(0xff0022, 1.5, 5);
    dangerLight.position.set(spawnX, size / 2, spawnZ);
    scene.add(dangerLight);

    obstacles.push({
        mesh: mesh,
        shadowMesh: shadowMesh,
        dangerLight: dangerLight,
        passed: false,
        rx: (Math.random() - 0.5) * CONFIG.OBSTACLES.ROT_MAX,
        ry: (Math.random() - 0.5) * CONFIG.OBSTACLES.ROT_MAX,
        rz: (Math.random() - 0.5) * CONFIG.OBSTACLES.ROT_MAX
    });
}

// --- Math Gates Spawner ---
function createGateTexture(text, isPositive) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, 256, 256);
    
    // Translucent background fill
    ctx.fillStyle = isPositive ? 'rgba(0, 255, 204, 0.12)' : 'rgba(255, 0, 85, 0.12)';
    ctx.fillRect(0, 0, 256, 256);
    
    // Glowing stroke border
    ctx.lineWidth = 14;
    ctx.strokeStyle = isPositive ? CONFIG.COLORS.GATE_POSITIVE_BORDER : CONFIG.COLORS.GATE_NEGATIVE_BORDER;
    ctx.strokeRect(7, 7, 242, 242);
    
    // Render operational label
    ctx.font = 'bold 72px "Outfit", Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Soft shadow glow
    ctx.shadowColor = isPositive ? CONFIG.COLORS.GATE_POSITIVE_BORDER : CONFIG.COLORS.GATE_NEGATIVE_BORDER;
    ctx.shadowBlur = 18;
    
    ctx.fillText(text, 128, 128);
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function createGateMesh(x, op) {
    const isPositive = op.type === 'mult' || op.type === 'add';
    const texture = createGateTexture(op.label, isPositive);
    
    const geom = new THREE.PlaneGeometry(CONFIG.GATES.WIDTH, CONFIG.GATES.HEIGHT);
    const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: CONFIG.GATES.OPACITY,
        side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, CONFIG.GATES.HEIGHT / 2, CONFIG.GATES.SPAWN_Z);

    // Neon goal-post pillars — make gates read as a portal, not an obstacle
    const postColor = isPositive ? 0x00ffcc : 0xff0055;
    const postH = 5.5;
    const postGeo = new THREE.BoxGeometry(0.08, postH, 0.08);
    const postMat = new THREE.MeshBasicMaterial({ color: postColor });
    const halfW = CONFIG.GATES.WIDTH / 2 + 0.12;

    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(x - halfW, postH / 2, CONFIG.GATES.SPAWN_Z);

    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(x + halfW, postH / 2, CONFIG.GATES.SPAWN_Z);
    
    return {
        mesh,
        leftPost,
        rightPost,
        op,
        passed: false,
        pairId: 0
    };
}

function spawnGatePair() {
    // 50% chance to spawn a Hamiltonian Node challenge gate, 50% chance for a standard math gate
    const isHamiltonianChallenge = Math.random() < 0.5;
    
    if (isHamiltonianChallenge && !feverActive) {
        // Correct next node in cycle
        const correctNode = CONFIG.HAMILTONIAN_CYCLE[hamiltonianIndex];
        
        // Find a random incorrect node (not matching the correct one)
        let incorrectNode = correctNode;
        while (incorrectNode === correctNode) {
            const randIdx = Math.floor(Math.random() * CONFIG.HAMILTONIAN_CYCLE.length);
            incorrectNode = CONFIG.HAMILTONIAN_CYCLE[randIdx];
        }
        
        const isLeftCorrect = Math.random() < 0.5;
        
        const leftOp = isLeftCorrect 
            ? { type: 'hamiltonian_correct', val: 0, label: `NODE ${correctNode}` } 
            : { type: 'hamiltonian_incorrect', val: 0, label: `NODE ${incorrectNode}` };
        const rightOp = isLeftCorrect 
            ? { type: 'hamiltonian_incorrect', val: 0, label: `NODE ${incorrectNode}` } 
            : { type: 'hamiltonian_correct', val: 0, label: `NODE ${correctNode}` };
            
    const leftGate = createGateMesh(-CONFIG.GATES.LANE_X, leftOp);
    const rightGate = createGateMesh(CONFIG.GATES.LANE_X, rightOp);
    
    scene.add(leftGate.mesh);
    scene.add(leftGate.leftPost);
    scene.add(leftGate.rightPost);
    scene.add(rightGate.mesh);
    scene.add(rightGate.leftPost);
    scene.add(rightGate.rightPost);
    
    const pairId = nextPairId++;
    leftGate.pairId = pairId;
    rightGate.pairId = pairId;
    
    gates.push(leftGate);
    gates.push(rightGate);

        // Trigger HUD flash — a NODE gate is on screen
        flashNodeHud();
        
        // Hazard block behind the correct node!
        const spawnHazardBehindSuccess = Math.random() < 0.85;
        if (spawnHazardBehindSuccess) {
            const correctLaneX = isLeftCorrect ? -CONFIG.GATES.LANE_X : CONFIG.GATES.LANE_X;
            const hazardDistanceBehind = 18;
            spawnObstacle(correctLaneX, CONFIG.GATES.SPAWN_Z - hazardDistanceBehind);
        }
        return;
    }

    const isLeftPositive = Math.random() < 0.5;
    
    // Set positive ops
    const positiveOps = [
        { type: 'mult', val: 2, label: 'x2' },
        { type: 'add', val: 50, label: '+50' },
        { type: 'add', val: 100, label: '+100' }
    ];
    // Set negative ops
    const negativeOps = [
        { type: 'div', val: 2, label: '/2' },
        { type: 'sub', val: 50, label: '-50' },
        { type: 'sub', val: 100, label: '-100' }
    ];
    
    const leftOp = isLeftPositive ? positiveOps[Math.floor(Math.random() * positiveOps.length)] : negativeOps[Math.floor(Math.random() * negativeOps.length)];
    const rightOp = isLeftPositive ? negativeOps[Math.floor(Math.random() * negativeOps.length)] : positiveOps[Math.floor(Math.random() * positiveOps.length)];
    
    const leftGate = createGateMesh(-CONFIG.GATES.LANE_X, leftOp);
    const rightGate = createGateMesh(CONFIG.GATES.LANE_X, rightOp);
    
    scene.add(leftGate.mesh);
    scene.add(leftGate.leftPost);
    scene.add(leftGate.rightPost);
    scene.add(rightGate.mesh);
    scene.add(rightGate.leftPost);
    scene.add(rightGate.rightPost);
    
    const pairId = nextPairId++;
    leftGate.pairId = pairId;
    rightGate.pairId = pairId;
    
    gates.push(leftGate);
    gates.push(rightGate);
    
    // Spawning hazard blocks directly behind the positive gate
    const spawnHazardBehindSuccess = Math.random() < 0.8;
    if (spawnHazardBehindSuccess) {
        const positiveLaneX = isLeftPositive ? -CONFIG.GATES.LANE_X : CONFIG.GATES.LANE_X;
        const hazardDistanceBehind = 18; // units behind the gate
        spawnObstacle(positiveLaneX, CONFIG.GATES.SPAWN_Z - hazardDistanceBehind);
    }
}

function applyGateEffect(op) {
    if (op.type === 'add') {
        score += op.val;
        comboCount++;
        comboTimer = comboDuration;
        audioSynth.setComboCount(comboCount);
        showFloatingText(`+${op.val}`, "cyan-glow");
        audioSynth.playDodge();
        triggerFlash(CONFIG.COLORS.GATE_POSITIVE_BG, 0.12);
        
        if (shieldHp < 2) {
            shieldHp++;
            updateShieldUI();
            triggerShieldRechargeEffect();
        }
        if (inTutorial && tutorialStep === 2) {
            advanceTutorialStep();
        }
    } else if (op.type === 'mult') {
        score *= op.val;
        comboCount += 2; // Extra reward combo bump
        comboTimer = comboDuration;
        audioSynth.setComboCount(comboCount);
        showFloatingText(`x${op.val}`, "yellow-glow");
        audioSynth.playDodge();
        triggerFlash(CONFIG.COLORS.GATE_POSITIVE_BG, 0.22);
        
        if (shieldHp < 2) {
            shieldHp++;
            updateShieldUI();
            triggerShieldRechargeEffect();
        }
        if (inTutorial && tutorialStep === 2) {
            advanceTutorialStep();
        }
    } else if (op.type === 'sub') {
        score = Math.max(0, score - op.val);
        comboCount = 0; // Break combo chain
        audioSynth.setComboCount(comboCount);
        showFloatingText(`-${op.val}`, "pink-glow");
        audioSynth.playBounce();
        triggerFlash(CONFIG.COLORS.GATE_NEGATIVE_BG, 0.12);
    } else if (op.type === 'div') {
        score = Math.floor(score / op.val);
        comboCount = 0; // Break combo chain
        audioSynth.setComboCount(comboCount);
        showFloatingText(`/${op.val}`, "pink-glow");
        audioSynth.playBounce();
        triggerFlash(CONFIG.COLORS.GATE_NEGATIVE_BG, 0.22);
    } else if (op.type === 'hamiltonian_correct') {
        hamiltonianIndex = (hamiltonianIndex + 1) % CONFIG.HAMILTONIAN_CYCLE.length;
        score += 100;
        comboCount++;
        comboTimer = comboDuration;
        audioSynth.setComboCount(comboCount);
        showFloatingText(`NODE CAPTURED`, "cyan-glow");
        audioSynth.playDodge();
        triggerFlash(CONFIG.COLORS.GATE_POSITIVE_BG, 0.15);
        statsNodesHit++;
        
        if (shieldHp < 2) {
            shieldHp++;
            updateShieldUI();
            triggerShieldRechargeEffect();
        }

        // FLASH → PERSISTENT: first correct hit unlocks the persistent pip ring
        if (nodeHudMode !== 'PERSISTENT') {
            nodeHudMode = 'PERSISTENT';
            if (nodeFlashTimeout) { clearTimeout(nodeFlashTimeout); nodeFlashTimeout = null; }
        }

        if (hamiltonianIndex === 0) {
            // Cycle complete! Trigger Fever Mode
            feverActive = true;
            feverTimer = CONFIG.FEVER.DURATION;
            score += CONFIG.FEVER.SCORE_BONUS;
            showFloatingText(`SINGULARITY FEVER!`, "yellow-glow");
            triggerFlash(CONFIG.FEVER.FLASH_COLOR, 0.45);
            audioSynth.playDodge();
            setTimeout(() => { if (!gameOver) audioSynth.playDodge(); }, 100);
            setTimeout(() => { if (!gameOver) audioSynth.playDodge(); }, 200);
            statsFeverCount++;
        }
        updateNodeUI();
    } else if (op.type === 'hamiltonian_incorrect') {
        hamiltonianIndex = 0; // Reset chain
        comboCount = 0; // Break combo chain
        audioSynth.setComboCount(comboCount);
        showFloatingText(`CHAIN BROKEN!`, "pink-glow");
        audioSynth.playBounce();
        triggerFlash(CONFIG.COLORS.GATE_NEGATIVE_BG, 0.2);
        statsNodesMissed++;
        updateNodeUI();
    }
    
    updateScoreUI();
    updateComboUI();
}

function drawNodePips() {
    const canvas = document.getElementById('node-pip-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const total = CONFIG.HAMILTONIAN_CYCLE.length; // 27
    const filled = hamiltonianIndex;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const pipR = 2;
    const gap = (W - total * pipR * 2) / (total + 1);

    for (let i = 0; i < total; i++) {
        const cx = gap + i * (pipR * 2 + gap) + pipR;
        const cy = H / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, pipR, 0, Math.PI * 2);
        if (i < filled) {
            // Captured node — gold fill
            ctx.fillStyle = '#ffcc00';
            ctx.shadowColor = '#ffcc00';
            ctx.shadowBlur = 6;
        } else {
            // Uncaptured — dim outline
            ctx.fillStyle = 'rgba(255,204,0,0.18)';
            ctx.shadowBlur = 0;
        }
        ctx.fill();
    }
    ctx.shadowBlur = 0;
}

function flashNodeHud() {
    // HIDDEN → FLASH: briefly show the panel when a NODE gate appears
    if (nodeHudMode === 'PERSISTENT') return;
    nodeHudMode = 'FLASH';
    const nodePanel = document.getElementById('node-panel');
    if (nodePanel) nodePanel.classList.add('hud-visible');
    if (nodeFlashTimeout) clearTimeout(nodeFlashTimeout);
    nodeFlashTimeout = setTimeout(() => {
        if (nodeHudMode === 'FLASH') {
            nodeHudMode = 'HIDDEN';
            const panel = document.getElementById('node-panel');
            if (panel) panel.classList.remove('hud-visible');
        }
    }, 3000);
}

function updateNodeUI() {
    const nodePanel = document.getElementById('node-panel');
    if (nodePanel && nodeHudMode === 'PERSISTENT') {
        nodePanel.classList.add('hud-visible');
    }
    const label = document.getElementById('node-flash-label');
    if (label) {
        if (nodeHudMode === 'FLASH') {
            const nextNode = CONFIG.HAMILTONIAN_CYCLE[hamiltonianIndex];
            label.textContent = `NODE ▸ ${nextNode}`;
        } else if (nodeHudMode === 'PERSISTENT') {
            label.textContent = 'CYCLE PROGRESS';
        }
    }
    drawNodePips();
}

function checkStageProgression() {
    // Search for the highest stage threshold we qualify for
    let nextStageIndex = 0;
    for (let i = 0; i < CONFIG.STAGES.length; i++) {
        if (score >= CONFIG.STAGES[i].threshold) {
            nextStageIndex = i;
        }
    }
    
    if (nextStageIndex !== currentStageIndex) {
        currentStageIndex = nextStageIndex;
        const stage = CONFIG.STAGES[currentStageIndex];
        
        // Display massive overlay stage upgrade alert banner
        showFloatingText(`STAGE ${currentStageIndex + 1}: ${stage.name}`, "yellow-glow");
        
        // Dramatic level-up screen flash using stage theme color
        triggerFlash(stage.laserLeft, 0.35);
        
        // Double synth chime sound alert
        audioSynth.playDodge();
        setTimeout(() => {
            if (!gameOver) audioSynth.playDodge();
        }, 120);
        
        // Transition scene styling to match stage theme
        updateStageVisuals(stage);
    }
}

function updateStageVisuals(stage) {
    // Update scene fog coloring and thickness
    scene.fog.color.set(stage.fogColor);
    scene.fog.density = stage.fogDensity;
    renderer.setClearColor(stage.fogColor);
    
    // Shift glowing side highway laser barriers
    leftLaser.material.color.set(stage.laserLeft);
    rightLaser.material.color.set(stage.laserRight);
    
    // Tint sunset circle to match stage theme
    sunsetMesh.material.color.set(stage.sunTint);
    
    // Update direct sunlight to project laser color
    dirLight.color.set(stage.laserLeft);
}

// --- Renderer Resizing ---
function resize() {
    let width = window.innerWidth;
    let height = window.innerHeight;
    const aspect = 9 / 16; // Standard mobile/arcade portrait target aspect ratio
    
    if (width / height > aspect) {
        width = height * aspect;
    } else {
        height = width / aspect;
    }
    
    renderer.setSize(width, height);
    renderer.domElement.style.width = width + 'px';
    renderer.domElement.style.height = height + 'px';
}
window.addEventListener('resize', resize);
resize();

// --- Core Game Loop ---
let lastTime = 0; // Tracks timestamp of the last executed loop iteration

function gameLoop(currentTime) {
    requestAnimationFrame(gameLoop);
    
    let dt = (currentTime - lastTime) / 1000; // Convert millisecond timestamp delta to seconds
    if (dt > CONFIG.SYSTEM.MAX_DT) dt = CONFIG.SYSTEM.MAX_DT; // Cap time delta to prevent giant leaps through walls
    lastTime = currentTime;
    
    if (!gameStarted) {
        // Run passive render so scene looks alive
        gridTexture.offset.y -= CONFIG.SYSTEM.PASSIVE_SCROLL;
        renderer.render(scene, camera);
        return;
    }
    
    // 1. Time dilation update (slow-motion recovery)
    const baseTimeScale = 1.0; // standard timescale unit representing 100% speed
    if (timeScale < baseTimeScale) {
        timeScale += (baseTimeScale - timeScale) * CONFIG.ENGINE.DILATION_REC;
        if (timeScale > 0.99) timeScale = baseTimeScale; // snap back to full speed when close enough
    }
    
    // Update synth audio state
    audioSynth.update(gameSpeed, player.vx);
    
    if (!gameOver) {
        frameCount++;
        
        if (feverActive) {
            feverTimer -= dt * timeScale;
            
            // Fast rainbow HSL shift during Fever mode
            const hue = (frameCount * 4) % 360;
            const rainbowColor = new THREE.Color(`hsl(${hue}, 100%, 50%)`);
            leftLaser.material.color.copy(rainbowColor);
            rightLaser.material.color.copy(rainbowColor);
            sunsetMesh.material.color.copy(rainbowColor);
            dirLight.color.copy(rainbowColor);
            
            if (feverTimer <= 0) {
                feverActive = false;
                // Restore normal stage visuals
                updateStageVisuals(CONFIG.STAGES[currentStageIndex]);
                showFloatingText(`FEVER OVER`, "pink-glow");
            }
        }
        
        // 2. Player horizontal drift physics
        if (isSteeringLeft || keyLeft) {
            player.vx -= CONFIG.PLAYER.ACCEL;
            player.targetRoll = 0.45; // target left visual wing tilt roll angle in radians
        } else if (isSteeringRight || keyRight) {
            player.vx += CONFIG.PLAYER.ACCEL;
            player.targetRoll = -0.45; // target right visual wing tilt roll angle in radians
        } else {
            player.vx *= CONFIG.PLAYER.DRAG;
            player.targetRoll = 0.0; // reset roll tilt to level when idle
        }
        
        // Max lateral drift speed
        if (player.vx < -CONFIG.PLAYER.MAX_VX) player.vx = -CONFIG.PLAYER.MAX_VX;
        if (player.vx > CONFIG.PLAYER.MAX_VX) player.vx = CONFIG.PLAYER.MAX_VX;
        
        player.x += player.vx * timeScale;
        
        // Wall elastic boundaries
        if (player.x < -CONFIG.PLAYER.BORDER) {
            player.x = -CONFIG.PLAYER.BORDER;
            player.vx = -player.vx * CONFIG.PLAYER.ELASTICITY; // reverse velocity elastically
            triggerWallBounce(true); // Bounce off left wall
        } else if (player.x > CONFIG.PLAYER.BORDER) {
            player.x = CONFIG.PLAYER.BORDER;
            player.vx = -player.vx * CONFIG.PLAYER.ELASTICITY; // reverse velocity elastically
            triggerWallBounce(false); // Bounce off right wall
        }
        
        // Smooth out wing roll rotation and translate position
        player.roll += (player.targetRoll - player.roll) * CONFIG.PLAYER.ROLL_SMOOTH;
        shipGroup.position.x = player.x;
        shipGroup.rotation.z = player.roll;
        shipGroup.rotation.y = player.vx * CONFIG.PLAYER.YAW_TILT; // yaw tilt
        
        let activeSpeed;
        if (inTutorial) {
            // Lock game speed slow for tutorial onboarding
            gameSpeed = 0.25;
            activeSpeed = 0.25;
            
            // Handle step-by-step tutorial spawning logic
            if (tutorialCooldown > 0) {
                tutorialCooldown -= dt * timeScale;
            } else if (!tutorialSpawned) {
                if (tutorialStep === 0) {
                    // Step 0: steer right to dodge obstacle on left
                    spawnObstacle(-2.2, CONFIG.OBSTACLES.SPAWN_Z);
                    tutorialSpawned = true;
                } else if (tutorialStep === 1) {
                    // Step 1: steer close to dodge obstacle on right (near-miss training)
                    spawnObstacle(2.2, CONFIG.OBSTACLES.SPAWN_Z);
                    tutorialSpawned = true;
                } else if (tutorialStep === 2) {
                    // Step 2: collect cyan positive gate on left
                    const leftOp = { type: 'add', val: 50, label: '+50' };
                    const rightOp = { type: 'sub', val: 50, label: '-50' };
                    const leftGate = createGateMesh(-CONFIG.GATES.LANE_X, leftOp);
                    const rightGate = createGateMesh(CONFIG.GATES.LANE_X, rightOp);
                    
                    scene.add(leftGate.mesh);
                    scene.add(leftGate.leftPost);
                    scene.add(leftGate.rightPost);
                    scene.add(rightGate.mesh);
                    scene.add(rightGate.leftPost);
                    scene.add(rightGate.rightPost);
                    
                    const pairId = nextPairId++;
                    leftGate.pairId = pairId;
                    rightGate.pairId = pairId;
                    
                    gates.push(leftGate);
                    gates.push(rightGate);
                    tutorialSpawned = true;
                }
            }
        } else {
            // Continuous speed increase with acceleration and clamping
            gameSpeed = Math.min(gameSpeed + CONFIG.SPEED.ACCEL * timeScale * userSpeedMultiplier, CONFIG.SPEED.MAX * userSpeedMultiplier);
            
            // Scale velocity based on the current stage speed scale configuration (boosted in Fever mode)
            const feverSpeedMultiplier = feverActive ? 1.5 : 1.0;
            activeSpeed = gameSpeed * CONFIG.STAGES[currentStageIndex].speedScale * feverSpeedMultiplier;
        }
        
        // 3. Grid texture animation
        gridTexture.offset.y -= activeSpeed * CONFIG.ENGINE.SCROLL_ACTIVE * timeScale;
        
        // 4. Obstacle Spawning (bypassed in Tutorial Mode)
        if (!inTutorial) {
            let spawnThreshold = Math.max(CONFIG.ENGINE.SPAWN_LIMIT_MIN, Math.floor(CONFIG.ENGINE.SPAWN_LIMIT_MAX - gameSpeed * CONFIG.ENGINE.SPAWN_SPEED_SCALE));
            if (frameCount % spawnThreshold === 0) {
                spawnObstacle();
            }
            
            // Spawn math gates at separate intervals
            if (frameCount % CONFIG.GATES.SPAWN_INTERVAL === 0) {
                spawnGatePair();
            }
        }
        
        // 5. Update Combo timer decay
        if (comboCount > 0) {
            comboTimer -= dt * timeScale;
            if (comboTimer <= 0) {
                comboCount = 0;
                audioSynth.setComboCount(comboCount);
                updateComboUI();
                showFloatingText("COMBO RESET", "pink-glow");
            } else {
                let pct = (comboTimer / comboDuration) * 100; // convert ratio to percentage for progress bar width
                const progressFill = document.getElementById('combo-progress-fill');
                if (progressFill) progressFill.style.width = `${pct}%`;
            }
        }
        
        // 6. Spawn exhaust engine particles
        let trailCol = CONFIG.COLORS.DEFAULT_EXHAUST; // Default cyan exhaust colors (RGB)
        if (comboCount >= 5) {
            trailCol = CONFIG.COLORS.HIGH_COMBO_EXHAUST; // Neon pink exhaust on high combo streaks
        } else if (comboCount >= 2) {
            trailCol = CONFIG.COLORS.MID_COMBO_EXHAUST; // Retro orange exhaust on minor combo streaks
        }
        
        // Define particle spawning offsets and dispersion bounds
        const shipExhaustXSpread = 0.15; // ship engine exhaust spawn width variance
        const shipExhaustYOffset = -0.08; // engine nozzle Y height offset
        const shipExhaustZOffset = 0.95; // engine nozzle Z depth offset
        const lateralDispersionVx = 0.04; // random particle side speed disperser
        const backwardBaseVz = 0.15; // base particle backward velocity
        const backwardVarVz = 0.12; // backward velocity random range
        const particleBaseLife = 25; // base life duration in frames
        const particleVarLife = 20; // life variation range in frames

        spawnParticle(
            shipGroup.position.x + (Math.random() - 0.5) * shipExhaustXSpread,
            shipGroup.position.y + shipExhaustYOffset,
            shipGroup.position.z + shipExhaustZOffset,
            (Math.random() - 0.5) * lateralDispersionVx,
            (Math.random() - 0.5) * lateralDispersionVx,
            backwardBaseVz + Math.random() * backwardVarVz, // shoot backwards
            trailCol[0], trailCol[1], trailCol[2],
            particleBaseLife + Math.random() * particleVarLife
        );
    }
    
    // 7. Update Obstacles
    let nearMissActive = false;
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        
        if (!gameOver) {
            // Obstacles fly down Z axis
            const activeSpeed = gameSpeed * CONFIG.STAGES[currentStageIndex].speedScale;
            obs.mesh.position.z += activeSpeed * timeScale;
            
            // Spin obstacles
            obs.mesh.rotation.x += obs.rx * timeScale;
            obs.mesh.rotation.y += obs.ry * timeScale;
            obs.mesh.rotation.z += obs.rz * timeScale;
            
            // Cinematic approach factor: 0 = far, 1 = at player
            const t = Math.max(0, Math.min(1, (obs.mesh.position.z - CONFIG.OBSTACLES.SPAWN_Z) / (-CONFIG.OBSTACLES.SPAWN_Z)));

            // A: Warning shadow — tracks obstacle, expands and brightens as it closes in
            obs.shadowMesh.position.z = obs.mesh.position.z;
            obs.shadowMesh.material.opacity = t * 0.6;
            const shadowScale = 0.1 + t * 0.9;
            obs.shadowMesh.scale.set(shadowScale, shadowScale, shadowScale);

            // B: Emissive ramp — dark far away, neon pink (0xff0055) up close
            obs.mesh.material.emissive.setRGB(t * 1.0, 0, t * 0.333);

            // Danger pulse light — intensity throbs to signal solid obstacle
            obs.dangerLight.position.z = obs.mesh.position.z;
            obs.dangerLight.intensity = (1.5 + 0.8 * Math.sin(frameCount * 0.18)) * t;

            // Pulsate/breathe obstacles on a synthesizer speed beat
            let beatScale = 1.0 + 0.08 * Math.sin(frameCount * 0.15);
            obs.mesh.scale.set(beatScale, beatScale, beatScale);
            
            // Collision Check (bounding box logic, bypassed if Fever Mode is active)
            let dx = Math.abs(shipGroup.position.x - obs.mesh.position.x);
            let dz = Math.abs(shipGroup.position.z - obs.mesh.position.z);
            
            // Visual target range check: if obstacle is close laterally and approaching
            if (!obs.passed && obs.mesh.position.z < shipGroup.position.z && obs.mesh.position.z > shipGroup.position.z - 15) {
                if (dx < CONFIG.COLLISION.NEAR_MISS_DIST) {
                    nearMissActive = true;
                }
            }
            
            if (!feverActive && dx < CONFIG.COLLISION.BOX_X && dz < CONFIG.COLLISION.BOX_Z) {
                if (inTutorial) {
                    // Tutorial buffer: shield absorbing hit or simple warning bounce
                    triggerShieldHit();
                    obs.passed = true;
                } else if (shieldHp > 0) {
                    triggerShieldHit();
                    obs.passed = true;
                } else {
                    triggerGameOver();
                }
            }
            // Near Miss Mechanic
            else if (!obs.passed && obs.mesh.position.z > shipGroup.position.z) {
                obs.passed = true;
                if (dx < CONFIG.COLLISION.NEAR_MISS_DIST) {
                    triggerNearMiss(obs);
                } else {
                     // Safe evade
                     score += CONFIG.COLLISION.EVADE_SCORE;
                     updateScoreUI();
                     
                     // Tutorial step 0 dodge completion check
                     if (inTutorial && tutorialStep === 0) {
                         advanceTutorialStep();
                     }
                }
            }
        }
        
        // Remove obstacles that have flown past the camera viewport
        if (obs.mesh.position.z > CONFIG.COLLISION.DESPAWN_Z) {
            scene.remove(obs.mesh);
            scene.remove(obs.shadowMesh);
            scene.remove(obs.dangerLight);
            obstacles.splice(i, 1);
            i--;
            
            // Tutorial step 1 retry: if they dodge it but fail to near-miss, let them retry
            if (inTutorial && tutorialStep === 1) {
                tutorialSpawned = false;
            }
        }
    }
    
    // 7a. Update Shield Aura Mesh visual based on current shield HP and proximity
    const shieldMesh = shipGroup.getObjectByName("shieldMesh");
    if (shieldMesh) {
        let targetOpacity = 0.0;
        if (shieldHp === 2) targetOpacity = 0.10;
        else if (shieldHp === 1) targetOpacity = 0.05;
        
        if (nearMissActive) {
            // Pulse bright yellow/gold warning aura when close to obstacle
            shieldMesh.material.color.setHex(0xffcc00);
            shieldMesh.material.opacity = 0.28 + 0.12 * Math.sin(frameCount * 0.22);
        } else {
            // Restore normal cyan color and fade back to base shield health opacity
            shieldMesh.material.color.setHex(0x00ffcc);
            shieldMesh.material.opacity += (targetOpacity - shieldMesh.material.opacity) * 0.08;
        }
    }
    
    // 7b. Update Gates
    for (let i = 0; i < gates.length; i++) {
        let gate = gates[i];
        
        if (!gameOver) {
            // Gates fly down Z axis
            const activeSpeed = gameSpeed * CONFIG.STAGES[currentStageIndex].speedScale;
            gate.mesh.position.z += activeSpeed * timeScale;

            // Sync pillar posts Z with panel
            gate.leftPost.position.z = gate.mesh.position.z;
            gate.rightPost.position.z = gate.mesh.position.z;

            // Portal bob — panels float up/down, reinforcing "fly-through" read
            gate.mesh.position.y = CONFIG.GATES.HEIGHT / 2 + 0.15 * Math.sin(frameCount * 0.04);
            gate.leftPost.position.y = gate.mesh.position.y;
            gate.rightPost.position.y = gate.mesh.position.y;
            
            // Collision Check (bounding box logic)
            let dx = Math.abs(shipGroup.position.x - gate.mesh.position.x);
            let dz = Math.abs(shipGroup.position.z - gate.mesh.position.z);
            
            if (!gate.passed && dx < (CONFIG.GATES.WIDTH / 2 + 0.2) && dz < 1.0) {
                // Mark both gates in the pair as collected to prevent double-resets or despawn misses
                gates.forEach(g => {
                    if (g.pairId === gate.pairId) {
                        g.passed = true;
                    }
                });
                
                applyGateEffect(gate.op);
                
                // Fade out/scale down visual gate and posts
                let scaleVal = 1.0;
                const shrinkAnim = setInterval(() => {
                    scaleVal -= 0.15;
                    if (scaleVal <= 0.0) {
                        clearInterval(shrinkAnim);
                        gateShrinkIntervals = gateShrinkIntervals.filter(id => id !== shrinkAnim);
                        scene.remove(gate.mesh);
                        scene.remove(gate.leftPost);
                        scene.remove(gate.rightPost);
                    } else {
                        gate.mesh.scale.set(scaleVal, scaleVal, scaleVal);
                        gate.leftPost.scale.set(scaleVal, scaleVal, scaleVal);
                        gate.rightPost.scale.set(scaleVal, scaleVal, scaleVal);
                    }
                }, 16);
                gateShrinkIntervals.push(shrinkAnim);
            }
        }
        
        // Remove gates that have flown past the camera viewport
        if (gate.mesh.position.z > CONFIG.COLLISION.DESPAWN_Z) {
            // Penalize player if they missed the correct gate entirely
            if (!gate.passed && gate.op.type === 'hamiltonian_correct') {
                statsNodesMissed++;
                hamiltonianIndex = 0; // break chain
                updateNodeUI();
                showFloatingText("CHAIN RESET", "pink-glow");
            }
            scene.remove(gate.mesh);
            scene.remove(gate.leftPost);
            scene.remove(gate.rightPost);
            gates.splice(i, 1);
            i--;
            
            // Tutorial step 2 retry: if they miss the gates, reset spawn guard to spawn another pair
            if (inTutorial && tutorialStep === 2) {
                tutorialSpawned = false;
            }
        }
    }
    
    // 7c. Check Stage Progression
    if (!gameOver) {
        checkStageProgression();
    }
    
    // 8. Update active particle systems and speed lines
    updateParticles(timeScale);
    const activeSpeed = gameSpeed * CONFIG.STAGES[currentStageIndex].speedScale;
    updateSpeedLines(activeSpeed, timeScale);
    
    // 9. Camera positioning (slight dynamic lag trailing the player lateral position) using modular controller
    updateCamera(camera, player.x);
    
    renderer.render(scene, camera);
}

// Start loop (will rendering background passively until tap start)
requestAnimationFrame(gameLoop);
