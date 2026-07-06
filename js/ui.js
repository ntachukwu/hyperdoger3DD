// --- UI Trigger & Update Functions ---

function updateScoreUI() {
    // Expects global score and highScore
    const currentScore = typeof score !== 'undefined' ? score : 0;
    const currentBest = typeof highScore !== 'undefined' ? highScore : 0;
    document.getElementById('score-text').innerText = String(currentScore).padStart(5, '0');
    document.getElementById('best-text').innerText = String(currentBest).padStart(5, '0');
}

function updateComboUI() {
    // Expects global comboCount
    const currentCombo = typeof comboCount !== 'undefined' ? comboCount : 0;
    const comboContainer = document.getElementById('combo-container');
    const comboBadge = document.getElementById('combo-badge');
    
    if (currentCombo > 0) {
        comboBadge.innerText = `COMBO x${currentCombo}`;
        comboContainer.classList.add('active');
        
        // Dynamically shift badge color based on combo scale
        if (currentCombo >= 5) {
            comboBadge.style.color = 'var(--neon-pink)';
            comboBadge.style.textShadow = '0 0 15px rgba(255,0,85,0.8)';
        } else if (currentCombo >= 2) {
            comboBadge.style.color = 'var(--neon-cyan)';
            comboBadge.style.textShadow = '0 0 15px rgba(0,255,204,0.8)';
        } else {
            comboBadge.style.color = 'var(--neon-yellow)';
            comboBadge.style.textShadow = '0 0 15px rgba(255,255,0,0.8)';
        }
    } else {
        comboContainer.classList.remove('active');
    }
}

function showFloatingText(text, glowClass) {
    const container = document.getElementById('popup-container');
    const popup = document.createElement('div');
    popup.className = `floating-text ${glowClass}`;
    popup.innerText = text;
    
    const popupDuration = CONFIG.UI && CONFIG.UI.POPUP_DURATION ? CONFIG.UI.POPUP_DURATION : 800;
    const xCenter = CONFIG.UI && CONFIG.UI.X_CENTER ? CONFIG.UI.X_CENTER : 50;
    const xDev = CONFIG.UI && CONFIG.UI.X_DEV ? CONFIG.UI.X_DEV : 25;
    const yCenter = CONFIG.UI && CONFIG.UI.Y_CENTER ? CONFIG.UI.Y_CENTER : 40;
    const yDev = CONFIG.UI && CONFIG.UI.Y_DEV ? CONFIG.UI.Y_DEV : 15;

    // Position randomly centered
    let x = xCenter + (Math.random() - 0.5) * xDev;
    let y = yCenter + (Math.random() - 0.5) * yDev;
    popup.style.left = `${x}%`;
    popup.style.top = `${y}%`;
    
    container.appendChild(popup);
    
    setTimeout(() => {
        popup.remove();
    }, popupDuration);
}

// Flash overlay for near misses/bounces
function triggerFlash(color, opacity = 0.25) {
    const flash = document.getElementById('flash-overlay');
    flash.style.backgroundColor = color;
    flash.style.opacity = opacity;
    
    let fade = setInterval(() => {
        let currentOp = parseFloat(flash.style.opacity);
        if (currentOp <= 0.02) {
            flash.style.opacity = 0;
            clearInterval(fade);
        } else {
            flash.style.opacity = currentOp * 0.85;
        }
    }, 20);
}
