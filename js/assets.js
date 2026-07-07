// --- Retro Assets Generation (No External Assets) ---

function createGameAssets(scene) {
    const starCount = CONFIG.ASSETS && CONFIG.ASSETS.STAR_COUNT ? CONFIG.ASSETS.STAR_COUNT : 150;
    const laserX = CONFIG.ASSETS && CONFIG.ASSETS.LASER_X ? CONFIG.ASSETS.LASER_X : 5.0;
    const sunSize = CONFIG.ASSETS && CONFIG.ASSETS.SUN_SIZE ? CONFIG.ASSETS.SUN_SIZE : 16.0;
    const colorFuse = CONFIG.ASSETS && CONFIG.ASSETS.COLOR_FUSE ? CONFIG.ASSETS.COLOR_FUSE : 0x00ffcc;
    const colorWing = CONFIG.ASSETS && CONFIG.ASSETS.COLOR_WING ? CONFIG.ASSETS.COLOR_WING : 0xff0055;

    // Lights
    const ambientLight = new THREE.AmbientLight(0x0c0818);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xff00bb, 1.8);
    dirLight.position.set(0, 6, 4);
    scene.add(dirLight);

    // 1. Grid Floor scrolling
    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = 64;
    gridCanvas.height = 64;
    const gCtx = gridCanvas.getContext('2d');
    gCtx.fillStyle = '#05050c';
    gCtx.fillRect(0, 0, 64, 64);
    // Grid borders
    gCtx.strokeStyle = '#9d00ff';
    gCtx.lineWidth = 1.5;
    gCtx.strokeRect(0, 0, 64, 64);
    
    const gridTexture = new THREE.CanvasTexture(gridCanvas);
    gridTexture.wrapS = THREE.RepeatWrapping;
    gridTexture.wrapT = THREE.RepeatWrapping;
    gridTexture.repeat.set(8, 40); // 8 lanes, 40 divisions along length
    
    const gridMat = new THREE.MeshBasicMaterial({
        map: gridTexture,
        depthWrite: false
    });
    const gridGeom = new THREE.PlaneGeometry(10, 100);
    gridGeom.rotateX(-Math.PI / 2); // lie horizontal
    const gridMesh = new THREE.Mesh(gridGeom, gridMat);
    gridMesh.position.set(0, 0, -40);
    scene.add(gridMesh);
    
    // 2. Glowing side laser barriers
    const laserGeo = new THREE.BoxGeometry(0.1, 0.2, 100);
    const leftLaserMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    const rightLaserMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    
    const leftLaser = new THREE.Mesh(laserGeo, leftLaserMat);
    leftLaser.position.set(-laserX, 0.1, -40);
    scene.add(leftLaser);
    
    const rightLaser = new THREE.Mesh(laserGeo, rightLaserMat);
    rightLaser.position.set(laserX, 0.1, -40);
    scene.add(rightLaser);
    
    // 3. Outrun neon sunset
    const sunsetCanvas = document.createElement('canvas');
    sunsetCanvas.width = 256;
    sunsetCanvas.height = 256;
    const sCtx = sunsetCanvas.getContext('2d');
    const sunsetGrad = sCtx.createLinearGradient(0, 0, 0, 256);
    sunsetGrad.addColorStop(0, '#ff0055');
    sunsetGrad.addColorStop(0.5, '#ff7700');
    sunsetGrad.addColorStop(1, '#ffdd00');
    sCtx.fillStyle = sunsetGrad;
    sCtx.fillRect(0, 0, 256, 256);
    
    // Retro scanline grid cutouts
    sCtx.fillStyle = '#05050a';
    for (let y = 130; y < 256; y += 8) {
        let thickness = (y - 130) / 14;
        sCtx.fillRect(0, y, 256, thickness);
    }
    
    const sunsetTex = new THREE.CanvasTexture(sunsetCanvas);
    const sunsetMat = new THREE.MeshBasicMaterial({
        map: sunsetTex,
        transparent: true,
        depthWrite: false
    });
    const sunsetGeom = new THREE.CircleGeometry(sunSize, 32);
    const sunsetMesh = new THREE.Mesh(sunsetGeom, sunsetMat);
    sunsetMesh.position.set(0, 2, -75);
    scene.add(sunsetMesh);
    
    // 4. Background Starfield
    const starGeom = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
        starPositions[i] = (Math.random() - 0.5) * 80;     // X
        starPositions[i + 1] = Math.random() * 25;         // Y (above ground)
        starPositions[i + 2] = -70 - Math.random() * 20;   // Z (far back)
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.25,
        transparent: true,
        opacity: 0.8
    });
    const stars = new THREE.Points(starGeom, starMat);
    scene.add(stars);
    
    // --- Custom Player Ship ---
    const shipGroup = new THREE.Group();
    
    // Fuselage (tip points forward along negative Z)
    const fuselageGeom = new THREE.ConeGeometry(0.35, 1.8, 5);
    fuselageGeom.rotateX(-Math.PI / 2);
    const fuselageMat = new THREE.MeshStandardMaterial({
        color: colorFuse,
        emissive: 0x002233,
        roughness: 0.1,
        metalness: 0.9
    });
    const fuselageMesh = new THREE.Mesh(fuselageGeom, fuselageMat);
    shipGroup.add(fuselageMesh);
    
    // Wings
    const wingGeom = new THREE.BoxGeometry(1.6, 0.08, 0.45);
    const wingMat = new THREE.MeshStandardMaterial({
        color: colorWing,
        emissive: 0x220011,
        roughness: 0.1,
        metalness: 0.9
    });
    const wingMesh = new THREE.Mesh(wingGeom, wingMat);
    wingMesh.position.set(0, -0.05, 0.1);
    shipGroup.add(wingMesh);
    
    // Glowing Thruster
    const thrusterGeom = new THREE.CylinderGeometry(0.12, 0.04, 0.35, 8);
    thrusterGeom.rotateX(Math.PI / 2);
    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const thrusterMesh = new THREE.Mesh(thrusterGeom, thrusterMat);
    thrusterMesh.position.set(0, 0, 0.95);
    shipGroup.add(thrusterMesh);
    
    // Point light attached to player engine for dynamic glow
    const engineLight = new THREE.PointLight(0x00ffcc, 1.5, 6);
    engineLight.position.set(0, 0, 1.0);
    shipGroup.add(engineLight);

    // Visual shield mesh around shipGroup (radius matching near miss zone, 1.25)
    const shieldGeo = new THREE.SphereGeometry(1.25, 16, 16);
    const shieldMat = new THREE.MeshBasicMaterial({
        color: 0x00ffcc,
        wireframe: true,
        transparent: true,
        opacity: 0.0, // Initial state, will be updated by gameplay script
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.name = "shieldMesh";
    shipGroup.add(shieldMesh);
    
    shipGroup.position.set(0, 0.25, -5);
    scene.add(shipGroup);

    // Faint parallel lane guide lasers on the grid floor dividing Left, Center, Right lanes
    const laneGeo1 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-1.1, 0.015, 10),
        new THREE.Vector3(-1.1, 0.015, -100)
    ]);
    const laneGeo2 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(1.1, 0.015, 10),
        new THREE.Vector3(1.1, 0.015, -100)
    ]);
    const laneMat = new THREE.LineBasicMaterial({
        color: 0x9d00ff,
        transparent: true,
        opacity: 0.12
    });
    const laneLine1 = new THREE.Line(laneGeo1, laneMat);
    const laneLine2 = new THREE.Line(laneGeo2, laneMat);
    scene.add(laneLine1);
    scene.add(laneLine2);
    
    return { 
        gridTexture, 
        shipGroup,
        leftLaser,
        rightLaser,
        sunsetMesh,
        dirLight
    };
}
