let cameraShake = 0.0; // Encapsulated camera shake intensity

/**
 * Creates and initializes the PerspectiveCamera with configuration values.
 * @returns {THREE.PerspectiveCamera} The configured camera.
 */
function createCamera() {
    const camera = new THREE.PerspectiveCamera(
        CONFIG.SYSTEM.FOV, 
        9 / 16, // Target vertical portrait aspect ratio standard for mobile/arcade views
        CONFIG.SYSTEM.NEAR, 
        CONFIG.SYSTEM.FAR
    );
    resetCamera(camera);
    return camera;
}

/**
 * Resets camera to default baseline coordinates.
 * @param {THREE.PerspectiveCamera} camera
 */
function resetCamera(camera) {
    camera.position.set(0, CONFIG.CAMERA.Y_BASE, CONFIG.CAMERA.Z_BASE);
    camera.lookAt(0, CONFIG.CAMERA.Y_LOOK, CONFIG.CAMERA.Z_LOOK);
    cameraShake = 0.0;
}

/**
 * Adds camera shake intensity up to a maximum limit.
 * @param {number} intensity
 * @param {number} limit
 */
function addCameraShake(intensity, limit) {
    cameraShake = Math.min(cameraShake + intensity, limit);
}

/**
 * Sets camera shake intensity directly.
 * @param {number} intensity
 */
function setCameraShake(intensity) {
    cameraShake = intensity;
}

/**
 * Updates camera position trailing the player's horizontal coordinate with noise shake.
 * @param {THREE.PerspectiveCamera} camera
 * @param {number} playerX
 */
function updateCamera(camera, playerX) {
    let camShakeX = 0;
    let camShakeY = 0;
    let camShakeZ = 0;
    
    // Check if shake intensity is above minimum threshold
    const minShakeThreshold = 0.005;
    if (cameraShake > minShakeThreshold) {
        camShakeX = (Math.random() - 0.5) * cameraShake;
        camShakeY = (Math.random() - 0.5) * cameraShake;
        camShakeZ = (Math.random() - 0.5) * cameraShake;
        cameraShake *= CONFIG.CAMERA.DECAY; // decay shake
    } else {
        cameraShake = 0.0;
    }
    
    let targetCamX = playerX * CONFIG.CAMERA.X_TRACK;
    camera.position.x = targetCamX + camShakeX;
    camera.position.y = CONFIG.CAMERA.Y_BASE + camShakeY;
    camera.position.z = CONFIG.CAMERA.Z_BASE + camShakeZ;
    
    camera.lookAt(
        playerX * CONFIG.CAMERA.X_LOOK, 
        CONFIG.CAMERA.Y_LOOK + camShakeY, 
        CONFIG.CAMERA.Z_LOOK + camShakeZ
    );
}
