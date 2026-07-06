class AudioSynth {
    constructor() {
        this.ctx = null;
        this.tempo = 125;
        this.isPlaying = false;
        this.lastStepTime = 0;
        this.stepLength = 0;
        this.stepCount = 0;
        this.basePitch = 36; // C2 base pitch
        this.isMuted = false;
        this.engineOsc = null;
        this.engineGain = null;
        
        // Retrowave chord pattern arpeggio (C minor / Eb major feel)
        // midi offsets: C, Eb, G, Bb, C, G, Eb, Bb
        this.pattern = [0, 3, 7, 10, 12, 7, 3, 10, 0, 3, 7, 10, 12, 10, 7, 3];
    }
    
    init() {
        if (this.ctx) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
    }
    
    start() {
        this.init();
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.isPlaying = true;
        this.lastStepTime = this.ctx.currentTime;
        this.stepCount = 0;
        this.startEngineHum();
    }
    
    stop() {
        this.isPlaying = false;
        if (this.engineOsc) {
            try { this.engineOsc.stop(); } catch(e) {}
            this.engineOsc = null;
        }
    }
    
    setMute(mute) {
        this.isMuted = mute;
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.3, this.ctx.currentTime, 0.05);
        }
    }
    
    update(speed, playerVx) {
        if (!this.isPlaying || !this.ctx || this.isMuted) return;
        
        // Update engine noise frequency based on forward speed and drift speed
        if (this.engineOsc) {
            let targetFreq = 45 + speed * 15 + Math.abs(playerVx) * 120;
            this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
        }
        
        // Increase tempo slightly as game speed scales
        this.tempo = 125 + Math.min(speed * 20, 80);
        this.stepLength = 60 / this.tempo / 2; // eighth notes
        
        let time = this.ctx.currentTime;
        while (this.lastStepTime < time + 0.1) {
            this.scheduleStep(this.stepCount, this.lastStepTime);
            this.lastStepTime += this.stepLength;
            this.stepCount = (this.stepCount + 1) % 16;
        }
    }
    
    scheduleStep(step, time) {
        // Play Kick drum on 1 and 3 beats (0, 4, 8, 12 in 16th/8th notes grid)
        if (step % 4 === 0) {
            this.playKick(time);
        }
        
        // Arpeggiator note
        let noteOffset = this.pattern[step];
        let pitch = this.basePitch + noteOffset;
        
        // Transpose based on combo streaks (expects global comboCount)
        const currentCombo = typeof comboCount !== 'undefined' ? comboCount : 0;
        if (currentCombo >= 2 && currentCombo < 5) {
            pitch += 12; // up one octave
        } else if (currentCombo >= 5) {
            pitch += 24; // up two octaves (super hype!)
        }
        
        this.playSynthNote(pitch, time);
    }
    
    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }
    
    playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.2);
        
        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        
        osc.start(time);
        osc.stop(time + 0.2);
    }
    
    playSynthNote(midi, time) {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(this.midiToFreq(midi), time);
        
        filter.type = 'lowpass';
        // Add dynamic filter modulation based on combo (expects global comboCount)
        const currentCombo = typeof comboCount !== 'undefined' ? comboCount : 0;
        let baseCutoff = 350 + Math.sin(time * 3) * 150 + (currentCombo * 120);
        filter.frequency.setValueAtTime(baseCutoff, time);
        filter.frequency.exponentialRampToValueAtTime(60, time + 0.18);
        filter.Q.value = 4;
        
        gain.gain.setValueAtTime(0.08, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(time);
        osc.stop(time + 0.18);
    }
    
    startEngineHum() {
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        
        this.engineOsc.type = 'triangle';
        this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);
        
        this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        
        this.engineOsc.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);
        
        this.engineOsc.start();
    }
    
    playDodge() {
        if (!this.ctx || this.isMuted) return;
        let time = this.ctx.currentTime;
        
        // Two quick high notes (chime)
        this.playChimeNote(784, time, 0.1);    // G5
        this.playChimeNote(1174.66, time + 0.05, 0.15); // D6
        
        // Lateral sweep whoosh
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, time);
        osc.frequency.exponentialRampToValueAtTime(1800, time + 0.3);
        
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, time);
        filter.frequency.exponentialRampToValueAtTime(3200, time + 0.3);
        filter.Q.value = 10;
        
        gain.gain.setValueAtTime(0.25, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(time);
        osc.stop(time + 0.3);
    }
    
    playBounce() {
        if (!this.ctx || this.isMuted) return;
        let time = this.ctx.currentTime;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(240, time);
        osc.frequency.exponentialRampToValueAtTime(50, time + 0.15);
        
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(time);
        osc.stop(time + 0.15);
    }
    
    playExplosion() {
        if (!this.ctx || this.isMuted) return;
        let time = this.ctx.currentTime;
        
        // Generate white noise buffer
        let bufferSize = this.ctx.sampleRate * 1.2;
        let buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        let data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        let noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        let filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, time);
        filter.frequency.exponentialRampToValueAtTime(30, time + 1.0);
        
        let gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 1.0);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        noise.start(time);
        noise.stop(time + 1.0);
    }
    
    playChimeNote(freq, time, duration) {
        let osc = this.ctx.createOscillator();
        let gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        osc.connect(gain);
        gain.connect(this.masterGain);
        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        osc.start(time);
        osc.stop(time + duration);
    }
}
