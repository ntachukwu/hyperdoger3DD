const CONFIG = {
    SPEED: {
        START: 0.8,    // Starting game velocity
        MAX: 2.5,      // Terminal velocity cap to keep obstacles avoidable
        ACCEL: 0.0003, // Forward speed increment per frame tick
        CHILL_MULTIPLIER: 0.65 // Optional slower speed mode multiplier
    },
    ENGINE: {
        DILATION_REC: 0.08,        // Timescale bullet-time recovery rate per frame
        SCROLL_ACTIVE: 0.045,      // Active road scrolling velocity scaling factor
        SPAWN_LIMIT_MIN: 32,       // Minimum floor of frame spawn interval (widened for playability)
        SPAWN_LIMIT_MAX: 90,       // Baseline frame spawn interval for obstacles (widened)
        SPAWN_SPEED_SCALE: 18,     // Legacy speed scale
        DIFFICULTY_DURATION: 36000 // Cumulative frame count to reach maximum density (10 minutes)
    },
    PLAYER: {
        ACCEL: 0.07,       // Horizontal thrust acceleration force per input frame
        DRAG: 0.91,        // Velocity damping coefficient when steering is idle
        MAX_VX: 0.35,      // Lateral velocity ceiling
        BORDER: 4.2,       // Track left/right boundary constraint
        ELASTICITY: 0.6,   // Elastic velocity retention multiplier on border collision
        ROLL_SMOOTH: 0.15, // Damping factor for ship wing roll interpolation
        YAW_TILT: -0.4      // Steering yaw rotation multiplier
    },
    OBSTACLES: {
        SIZE_MIN: 0.75,   // Minimum scale size for spawned obstacles
        SIZE_RANGE: 0.45, // Size scale variation range
        SPAWN_Z: -80,     // Starting Z distance in the distance where obstacles appear
        SPAN_X: 8.0,      // Lateral width across which obstacles distribute
        ROT_MAX: 0.05,    // Maximum rotational delta per frame for animations
        COLORS: [0xff0055, 0xff5e00, 0xaaff00, 0x9d00ff] // Vibrant multi-color retro obstacle palette
    },
    GATES: {
        SPAWN_INTERVAL: 120, // Spawn gates every 120 frames
        WIDTH: 1.5,          // Horizontal collision width (slimmer from 2.2)
        HEIGHT: 2.5,         // Visual panel height
        LANE_X: 2.2,         // Lane lateral coordinate offset (left/right)
        SPAWN_Z: -80,        // Inception depth where gates spawn
        OPACITY: 0.35        // Visual transparency factor
    },
    UI: {
        POPUP_DURATION: 800, // On-screen display lifespan of popups in milliseconds
        X_CENTER: 50,        // Default popup horizontal centering position in percent
        X_DEV: 25,           // Horizontal positioning noise deviation range
        Y_CENTER: 40,        // Default popup vertical centering position in percent
        Y_DEV: 15            // Vertical positioning noise deviation range
    },
    ASSETS: {
        STAR_COUNT: 150,     // Count of background dots to scatter in space
        LASER_X: 5.0,        // Lateral coordinate offset for boundary lasers (left/right)
        SUN_SIZE: 16.0,      // Radius scale of the retro sunset sun mesh
        COLOR_FUSE: 0x00ffcc, // Emissive ship fuselage color hex
        COLOR_WING: 0xff0055  // Emissive ship wing color hex
    },
    CAMERA: {
        DECAY: 0.88,   // Frame decay factor of the camera shake effect
        X_TRACK: 0.58, // Player follow position scalar on horizontal axis
        Y_BASE: 2.4,   // Baseline camera height from ground level
        Z_BASE: 5.0,   // Camera follow distance behind player
        X_LOOK: 0.28,  // Focal focus point tracking scalar relative to player X
        Y_LOOK: 0.4,   // Camera focus point target height Y
        Z_LOOK: -10.0  // Camera focus point target depth Z
    },
    SPEED_LINES: {
        COUNT: 15,    // Count of instantiated lines for the warp effect
        X_SPAN: 14,   // Lateral spawn spread range
        Y_HEIGHT: 3.5, // Vertical spawn height range
        Y_BASE: -0.2, // Base vertical height offset
        Z_FAR: -75,   // Far depth distance spawn target
        Z_RANGE: 25,  // Spawn depth offset range
        V_MULT: 1.5,  // Scroll speed modifier relative to global game velocity
        Z_RESET: 8.0  // Passing depth boundary where lines are recycled
    },
    SYSTEM: {
        FOV: 70,        // Camera perspective field of view angle in degrees
        NEAR: 0.1,      // Near clipping plane limit
        FAR: 1000,      // Far clipping plane limit
        FOG_DENSITY: 0.015, // Density modifier of the exponential scene fog
        MAX_DPR: 2,     // Cap for device pixel ratio scaling
        MAX_DT: 0.1,    // Maximum frame time delta cap in seconds to avoid collision tunneling
        PASSIVE_SCROLL: 0.01 // Road texture scroll speed when game is in passive menu state
    },
    COLLISION: {
        BOX_X: 1.05,        // Crash check bounding box size width
        BOX_Z: 1.05,        // Crash check bounding box size depth
        NEAR_MISS_DIST: 1.95, // Distance threshold check to trigger near miss combo
        EVADE_SCORE: 10,     // Points rewarded for clearing an obstacle safely
        DESPAWN_Z: 6.0      // Depth threshold boundary where obstacles are cleaned up
    },
    MECHANICS: {
        BOUNCE_SHAKE: 0.15, // Camera shake intensity gain on border bounce
        BOUNCE_SHAKE_MAX: 0.45, // Max shake cap for bounces
        BOUNCE_FLASH: 0.15, // Border collision screen flash opacity
        BOUNCE_SPARKS: 12,  // Particle count spawned on wall bounce
        BOUNCE_SPARK_HEIGHT: 0.15, // Base height where spark particles spawn
        MISS_SHAKE: 0.2,    // Camera shake intensity gain on near miss
        MISS_SHAKE_MAX: 0.5, // Max shake cap for near misses
        MISS_TIME_SCALE: 0.06, // Bullet-time time scale slowdown target
        MISS_SCORE_BASE: 50, // Base score bonus multiplier for near misses
        MISS_FLASH_OPACITY: 0.22, // Near miss screen flash opacity
        MISS_FLASH_DURATION: 250, // Wing flash animation duration in ms
        END_SHAKE: 0.65,    // Final explosion camera shake intensity
        END_FLASH_OPACITY: 0.5, // Game over screen flash opacity
        END_EXPLOSION_COUNT: 60 // Total particles spawned on ship destruction
    },
    COLORS: {
        DEFAULT_EXHAUST: [0.0, 1.0, 0.8],     // Cyan RGB exhaust particle color
        MID_COMBO_EXHAUST: [1.0, 0.5, 0.0],   // Orange RGB exhaust particle color
        HIGH_COMBO_EXHAUST: [1.0, 0.0, 0.35],  // Pink RGB exhaust particle color
        BOUNCE_SPARK: [0.0, 1.0, 0.8],        // Cyan RGB spark particle color
        BOUNCE_FLASH: '#ff0055',              // Neon pink hex string for screen bounce flash
        NEAR_MISS_WING_FLASH: 0x555500,       // Yellow-green emissive wing flash hex
        NEAR_MISS_WING_BASE: 0x220011,        // Baseline dark pink emissive wing hex
        NEAR_MISS_FLASH: '#ffff00',           // Yellow hex string for screen near miss flash
        GAME_OVER_EXPLOSION: [1.0, 0.0, 0.35], // Neon pink RGB explosion particle color
        GAME_OVER_FLASH: '#ff0055',            // Neon pink hex string for screen crash flash
        GATE_POSITIVE_BG: '#00ffcc',            // Green/Cyan neon glow background for positive gates
        GATE_POSITIVE_BORDER: '#00ff88',        // Emerald border for positive gates
        GATE_NEGATIVE_BG: '#ff0055',            // Pink/Red neon glow background for negative gates
        GATE_NEGATIVE_BORDER: '#ff3300'         // Orange/Red border for negative gates
    },
    STAGES: [
        {
            name: "GRID INCEPTION",
            threshold: 0,
            laserLeft: '#00ffcc',
            laserRight: '#ff0055',
            sunTint: '#ffffff',
            fogColor: '#05050a',
            fogDensity: 0.015,
            speedScale: 1.0
        },
        {
            name: "HYPER WARP",
            threshold: 1000,
            laserLeft: '#9d00ff',
            laserRight: '#ff7700',
            sunTint: '#ff7700',
            fogColor: '#0b0518',
            fogDensity: 0.02,
            speedScale: 1.25
        },
        {
            name: "NEON HELL",
            threshold: 2500,
            laserLeft: '#ff0055',
            laserRight: '#ff3300',
            sunTint: '#ff0000',
            fogColor: '#120202',
            fogDensity: 0.025,
            speedScale: 1.5
        },
        {
            name: "SINGULARITY",
            threshold: 5000,
            laserLeft: '#00ff88',
            laserRight: '#00ffff',
            sunTint: '#00ffcc',
            fogColor: '#02120e',
            fogDensity: 0.03,
            speedScale: 1.8
        }
    ],
    HAMILTONIAN_CYCLE: [
        "022", "002", "000", "001", "011", "012", "010", "020", "021",
        "121", "101", "111", "112", "122", "102", "100", "110", "120",
        "220", "221", "201", "202", "200", "210", "211", "212", "222"
    ],
    FEVER: {
        DURATION: 6.0,            // Fever mode duration in seconds
        SCORE_BONUS: 5000,        // Bonus points awarded on completing a cycle
        FLASH_COLOR: '#ffcc00'    // Golden flash color for fever activation
    },
    TELEMETRY: {
        FORM_URL: "https://docs.google.com/forms/d/e/1FAIpQLSdnzoxpA7tMVl91OksUbrBdTZSbSCMUnY-oqQ_SFdD-I4UMHA/viewform", // Google Form URL
        ENTRY_SCORE: "entry.340307017", // Prefilled field ID for Score
        ENTRY_ACCURACY: "entry.1132452730", // Prefilled field ID for Accuracy
        ENTRY_GRADE: "entry.93926803", // Prefilled field ID for Grade
        ENTRY_FEVER: "entry.1824015540"  // Prefilled field ID for Fever
    }
};
