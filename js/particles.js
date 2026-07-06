// --- High Performance Instanced Particle System ---
const maxParticles = 350;
const particleGeom = new THREE.BoxGeometry(0.12, 0.12, 0.12);
const particleMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9
});
const instancedParticles = new THREE.InstancedMesh(particleGeom, particleMat, maxParticles);

const particles = [];
for (let i = 0; i < maxParticles; i++) {
    particles.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        r: 1.0, g: 1.0, b: 1.0,
        life: 0,
        maxLife: 0,
        scale: 1.0
    });
}

function initParticles(targetScene) {
    targetScene.add(instancedParticles);
}

function spawnParticle(x, y, z, vx, vy, vz, r, g, b, maxLife) {
    let p = particles.find(part => !part.active);
    if (!p) return; // Full capacity
    p.active = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.r = r; p.g = g; p.b = b;
    p.life = maxLife;
    p.maxLife = maxLife;
    p.scale = 1.0;
}

function spawnExplosion(x, y, z, r, g, b, count = 35) {
    for (let i = 0; i < count; i++) {
        let theta = Math.random() * Math.PI * 2;
        let phi = Math.acos((Math.random() * 2) - 1);
        let speed = 0.05 + Math.random() * 0.15;
        
        let vx = Math.sin(phi) * Math.cos(theta) * speed;
        let vy = Math.sin(phi) * Math.sin(theta) * speed;
        let vz = Math.cos(phi) * speed;
        
        spawnParticle(x, y, z, vx, vy, vz, r, g, b, 30 + Math.random() * 30);
    }
}

function spawnNearMissSparks(x, y, z) {
    // Radial expansion ring of sparks
    for (let i = 0; i < 24; i++) {
        let angle = (i / 24) * Math.PI * 2;
        let speed = 0.08 + Math.random() * 0.08;
        let vx = Math.cos(angle) * speed;
        let vy = Math.sin(angle) * speed;
        spawnParticle(x, y, z, vx, vy, -0.05, 1.0, 0.9, 0.0, 20 + Math.random() * 15);
    }
}

function updateParticles(tScale) {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    
    for (let i = 0; i < maxParticles; i++) {
        let p = particles[i];
        if (p.active) {
            p.x += p.vx * tScale;
            p.y += p.vy * tScale;
            p.z += p.vz * tScale;
            p.life -= 1 * tScale;
            
            if (p.life <= 0) {
                p.active = false;
                dummy.scale.set(0, 0, 0);
                dummy.updateMatrix();
                instancedParticles.setMatrixAt(i, dummy.matrix);
            } else {
                let pct = p.life / p.maxLife;
                p.scale = pct;
                dummy.position.set(p.x, p.y, p.z);
                dummy.scale.set(p.scale, p.scale, p.scale);
                dummy.updateMatrix();
                instancedParticles.setMatrixAt(i, dummy.matrix);
                
                color.setRGB(p.r, p.g, p.b);
                instancedParticles.setColorAt(i, color);
            }
        } else {
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            instancedParticles.setMatrixAt(i, dummy.matrix);
        }
    }
    instancedParticles.instanceMatrix.needsUpdate = true;
    if (instancedParticles.instanceColor) {
        instancedParticles.instanceColor.needsUpdate = true;
    }
}
