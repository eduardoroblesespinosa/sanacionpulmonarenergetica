document.addEventListener('DOMContentLoaded', () => {
    // --- Canvas & Animation Setup ---
    const canvas = document.getElementById('lung-canvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('canvas-container');
    let particles = [];
    let animationFrameId;
    let isHealing = false;
    let isBreathingExerciseRunning = false;
    let isMeditating = false; // New state for meditation
    let breathingPhase = 'none'; // 'inhale', 'hold-in', 'exhale', 'hold-out'
    let breathingCycleTimeout;

    // --- Audio Setup ---
    let audioContext;
    let oscillator; // For single frequency
    let oscillatorL, oscillatorR; // For binaural beats
    let gainNode;
    let panner; // For binaural beats
    let musicSource, musicGain; // For background music
    const STATE_STOPPED = "stopped";
    const STATE_PLAYING = "playing";
    let audioState = STATE_STOPPED;

    // --- DOM Elements ---
    const sintomasSelect = document.getElementById('sintomas');
    const energiaSelect = document.getElementById('energia');
    const emocionSelect = document.getElementById('emocion');
    const frequencyButtons = document.querySelectorAll('.frequency-btn');
    const stopBtn = document.getElementById('stop-btn');
    const currentFrequencyDisplay = document.getElementById('current-frequency');
    const startBreathingBtn = document.getElementById('start-breathing-btn');
    const breathingInstruction = document.getElementById('breathing-instruction');
    const lungsImg = document.getElementById('lungs-img');

    // Meditation Elements
    const startMeditationBtn = document.getElementById('start-meditation-btn');
    const meditationInstruction = document.getElementById('meditation-instruction');
    const meditationProgressContainer = document.getElementById('meditation-progress-container');
    const meditationProgressBar = document.getElementById('meditation-progress-bar');
    const meditationTimerDisplay = document.getElementById('meditation-timer');
    let meditationInterval;
    let meditationTimeout;

    // Journal Elements
    const journalForm = document.getElementById('journal-form');
    const journalDate = document.getElementById('journal-date');
    const journalProgress = document.getElementById('journal-progress');
    const journalProgressValue = document.getElementById('journal-progress-value');
    const journalImprovements = document.getElementById('journal-improvements');
    const journalDreams = document.getElementById('journal-dreams');
    const journalEntriesContainer = document.getElementById('journal-entries');
    const clearJournalBtn = document.getElementById('clear-journal-btn');

    // --- Particle Class ---
    class Particle {
        constructor(x, y, radius, color, velocity) {
            this.x = x;
            this.y = y;
            this.radius = radius;
            this.color = color;
            this.velocity = velocity;
            this.initialX = x;
            this.alpha = 1;
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.restore();
        }

        update() {
            // Breathing exercise has top priority for particle movement
            if (isBreathingExerciseRunning) {
                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;
                let targetColor = this.color;

                switch (breathingPhase) {
                    case 'inhale':
                        // Move towards center, brighten, and grow
                        let dx = centerX - this.x;
                        let dy = centerY - this.y;
                        this.velocity.x += dx * 0.0005;
                        this.velocity.y += dy * 0.0005;
                        targetColor = '#87CEFA'; // LightSkyBlue
                        if (this.radius < 4) this.radius += 0.01;
                        break;
                    case 'exhale':
                        // Move away from center, darken, and shrink
                        let dx_e = this.x - centerX;
                        let dy_e = this.y - centerY;
                        this.velocity.x += dx_e * 0.0003;
                        this.velocity.y += dy_e * 0.0003;
                        targetColor = '#4682B4'; // SteelBlue
                        if (this.radius > 1.5) this.radius -= 0.01;
                        break;
                    case 'hold-in':
                    case 'hold-out':
                        // Slow down movement significantly
                        this.velocity.x *= 0.9;
                        this.velocity.y *= 0.9;
                        break;
                }
                 this.color = lerpColor(this.color, targetColor, 0.02);

            } else if (isMeditating) {
                // Gentle spiraling towards center
                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;
                const dx = this.x - centerX;
                const dy = this.y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Spiral inwards
                this.velocity.x += -dx * 0.0001 - dy * 0.0001;
                this.velocity.y += -dy * 0.0001 + dx * 0.0001;

                if (distance < 50) {
                    // When close to the center, glow and fade
                     this.color = lerpColor(this.color, '#FFFFFF', 0.05);
                     this.alpha -= 0.005;
                } else {
                    // Otherwise, gentle color shift
                    this.color = lerpColor(this.color, '#8A2BE2', 0.01); // BlueViolet
                }

                if (this.alpha <= 0) {
                    // Reset particle
                    this.x = Math.random() * canvas.width;
                    this.y = Math.random() * canvas.height;
                    this.alpha = 1;
                    this.velocity = { x: 0, y: 0 };
                }

            } else if (isHealing) {
                 // Move towards a sine wave pattern
                this.velocity.x += (Math.random() - 0.5) * 0.1;
                this.velocity.y *= 0.98; // slow down vertical movement
                if(this.radius > 1) this.radius -= 0.01;
                // Transition color to a healing green/blue
                this.color = lerpColor(this.color, '#00ffaa', 0.01);

            } else {
                 // Reset to chaotic movement based on score
                this.velocity.x += (Math.random() - 0.5) * (getCurrentScore() / 15);
                this.velocity.y += (Math.random() - 0.5) * (getCurrentScore() / 15);
            }

             // Apply general physics
            this.velocity.x *= 0.99; // Velocity damping
            this.velocity.y *= 0.99;

            this.x += this.velocity.x;
            this.y += this.velocity.y;

             // Boundary checks
            if (this.x - this.radius < 0 || this.x + this.radius > canvas.width) this.velocity.x *= -1;
            if (this.y - this.radius < 0 || this.y + this.radius > canvas.height) this.velocity.y *= -1;

            this.draw();
        }
    }

    // --- Core Functions ---

    function init() {
        resizeCanvas();
        createParticles();
        animate();
        addEventListeners();
        loadJournalEntries();
    }

    function resizeCanvas() {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }

    function createParticles() {
        particles = [];
        const particleCount = 150;
        const score = getCurrentScore(); // 0 (good) to 9 (bad)

        const baseColor = `hsl(0, 70%, 50%)`; // Red
        const targetColor = `hsl(120, 70%, 50%)`; // Green
        const color = lerpColor(targetColor, baseColor, score / 9);

        for (let i = 0; i < particleCount; i++) {
            const radius = 1 + Math.random() * 3;
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;

            const chaos = 1 + score; // More score = more chaos
            const velocity = {
                x: (Math.random() - 0.5) * chaos * 0.3,
                y: (Math.random() - 0.5) * chaos * 0.3,
            };

            particles.push(new Particle(x, y, radius, color, velocity));
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => p.update());
        animationFrameId = requestAnimationFrame(animate);
    }

    function addEventListeners() {
        window.addEventListener('resize', () => {
            resizeCanvas();
            createParticles();
        });

        [sintomasSelect, energiaSelect, emocionSelect].forEach(select => {
            select.addEventListener('change', () => {
                isHealing = false; // Stop healing on settings change
                stopSound();
                stopBreathingExercise(false); // Stop breathing exercise without changing button text
                stopMeditation(false);
                createParticles();
            });
        });
        
        frequencyButtons.forEach(button => {
            button.addEventListener('click', () => {
                stopBreathingExercise(false); // Stop breathing if it's running
                stopMeditation(false); // Stop meditation
                const freq = parseFloat(button.dataset.freq);
                playSound(freq);
                isHealing = true;
                
                // Visual feedback for active button
                frequencyButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            });
        });

        stopBtn.addEventListener('click', () => {
            stopSound();
            isHealing = false;
            stopBreathingExercise(false);
            stopMeditation(false);
            createParticles(); // Reset particles to current state
        });

        startBreathingBtn.addEventListener('click', toggleBreathingExercise);
        startMeditationBtn.addEventListener('click', toggleMeditation);
        journalForm.addEventListener('submit', handleJournalSubmit);
        clearJournalBtn.addEventListener('click', clearJournal);
        journalProgress.addEventListener('input', () => {
            journalProgressValue.textContent = `${journalProgress.value}%`;
        });
    }

    // --- Audio Functions (Web Audio API) ---

    function initAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    async function playBinauralAndMusic() {
        initAudioContext();
        if (audioState === STATE_PLAYING) {
            stopSound(false);
        }

        // --- Setup Binaural Beats (6Hz Theta wave on 136.1Hz carrier) ---
        oscillatorL = audioContext.createOscillator();
        oscillatorR = audioContext.createOscillator();
        const pannerNode = audioContext.createStereoPanner();
        gainNode = audioContext.createGain();

        oscillatorL.frequency.setValueAtTime(136.1, audioContext.currentTime);
        oscillatorR.frequency.setValueAtTime(136.1 + 6, audioContext.currentTime);

        oscillatorL.connect(pannerNode);
        oscillatorR.connect(pannerNode);
        pannerNode.connect(gainNode);
        
        // This part is a bit of a trick. By connecting both to a stereo panner
        // and then manipulating the pan, we can simulate sending to L/R channels.
        // A more robust way uses ChannelSplitter/Merger, but this is simpler.
        const merger = audioContext.createChannelMerger(2);
        oscillatorL.connect(merger, 0, 0); // Connect output 0 of oscL to input 0 of merger
        oscillatorR.connect(merger, 0, 1); // Connect output 0 of oscR to input 1 of merger
        merger.connect(gainNode);


        // --- Setup Background Music ---
        const response = await fetch('meditation_music.mp3');
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        musicSource = audioContext.createBufferSource();
        musicSource.buffer = audioBuffer;
        musicSource.loop = true;

        musicGain = audioContext.createGain();
        musicSource.connect(musicGain);
        musicGain.connect(gainNode);

        // --- Connect to Destination & Start ---
        gainNode.connect(audioContext.destination);

        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 3); // Binaural/music volume
        musicGain.gain.setValueAtTime(0.5, audioContext.currentTime); // Relative music volume

        oscillatorL.start();
        oscillatorR.start();
        musicSource.start();

        audioState = STATE_PLAYING;
        currentFrequencyDisplay.textContent = 'Meditación Cuántica Activa (6Hz Binaural)';
    }

    function playSound(frequency) {
        initAudioContext();

        if (audioState === STATE_PLAYING) {
            stopSound(false); // Stop previous sound without resetting display
        }

        oscillator = audioContext.createOscillator();
        gainNode = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.5); // Fade in

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start();
        audioState = STATE_PLAYING;
        currentFrequencyDisplay.textContent = `Reproduciendo: ${frequency} Hz`;
    }

    function stopSound(resetDisplay = true) {
        if (audioState !== STATE_PLAYING) return;

        if (gainNode) {
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1.5); // Longer fade out
        }
        
        if (oscillator) oscillator.stop(audioContext.currentTime + 1.5);
        if (oscillatorL) oscillatorL.stop(audioContext.currentTime + 1.5);
        if (oscillatorR) oscillatorR.stop(audioContext.currentTime + 1.5);
        if (musicSource) musicSource.stop(audioContext.currentTime + 1.5);

        audioState = STATE_STOPPED;
        oscillator = oscillatorL = oscillatorR = musicSource = null;

        if(resetDisplay) {
            currentFrequencyDisplay.textContent = "Sonido detenido.";
             frequencyButtons.forEach(btn => btn.classList.remove('active'));
        }
    }
    
    // --- Breathing Exercise Functions ---

    function toggleBreathingExercise() {
        if (isBreathingExerciseRunning) {
            stopBreathingExercise();
        } else {
            startBreathingExercise();
        }
    }

    function startBreathingExercise() {
        // Stop other activities
        stopSound();
        isHealing = false;
        stopMeditation(false);
        createParticles();

        isBreathingExerciseRunning = true;
        startBreathingBtn.textContent = 'Detener Ejercicio';
        startBreathingBtn.classList.remove('btn-outline-success');
        startBreathingBtn.classList.add('btn-outline-warning');

        // Start the cycle
        runBreathingCycle('inhale');
    }

    function stopBreathingExercise(updateUI = true) {
        if (!isBreathingExerciseRunning) return;

        clearTimeout(breathingCycleTimeout);
        isBreathingExerciseRunning = false;
        breathingPhase = 'none';

        if(updateUI) {
            startBreathingBtn.textContent = 'Comenzar Ejercicio';
            startBreathingBtn.classList.remove('btn-outline-warning');
            startBreathingBtn.classList.add('btn-outline-success');
            breathingInstruction.textContent = 'Ejercicio detenido.';
        } else {
            breathingInstruction.textContent = '';
        }
        
        lungsImg.style.transform = 'scale(1)';
        
        // Reset particles to reflect the form state after a short delay
        setTimeout(createParticles, 100);
    }

    function runBreathingCycle(phase) {
        if (!isBreathingExerciseRunning) return;

        breathingPhase = phase;
        const inhaleTime = 4000;
        const holdTime = 4000;
        const exhaleTime = 6000; // Longer exhale is beneficial
        const holdOutTime = 2000;

        switch (phase) {
            case 'inhale':
                breathingInstruction.textContent = 'Inhala profundamente...';
                lungsImg.style.transform = 'scale(1.15)'; // expand
                breathingCycleTimeout = setTimeout(() => runBreathingCycle('hold-in'), inhaleTime);
                break;
            case 'hold-in':
                breathingInstruction.textContent = 'Sostén...';
                breathingCycleTimeout = setTimeout(() => runBreathingCycle('exhale'), holdTime);
                break;
            case 'exhale':
                breathingInstruction.textContent = 'Exhala lentamente...';
                lungsImg.style.transform = 'scale(1)'; // contract
                breathingCycleTimeout = setTimeout(() => runBreathingCycle('hold-out'), exhaleTime);
                break;
            case 'hold-out':
                breathingInstruction.textContent = 'Descansa...';
                breathingCycleTimeout = setTimeout(() => runBreathingCycle('inhale'), holdOutTime);
                break;
        }
    }

    // --- Meditation Functions ---

    const meditationScript = [
        { time: 0, text: "Comienza encontrando una postura cómoda... Cierra los ojos." },
        { time: 5, text: "Respira profundamente, llenando tus pulmones por completo." },
        { time: 15, text: "Con cada exhalación, libera cualquier tensión... física o mental." },
        { time: 30, text: "Visualiza una luz blanca y pura descendiendo desde el universo." },
        { time: 45, text: "Esta luz es energía de sanación universal. Siente su calor y paz." },
        { time: 60, text: "Permite que esta luz entre por tu coronilla y fluya hacia tus pulmones." },
        { time: 90, text: "Observa cómo la luz llena cada rincón de tu sistema respiratorio." },
        { time: 120, text: "Ahora, viaja con tu conciencia al interior de tus pulmones." },
        { time: 150, text: "Mira los billones de células que trabajan para ti. Agradéceles." },
        { time: 180, text: "Encuentra cualquier área que se sienta densa, oscura o enferma." },
        { time: 210, text: "No la juzgues. Simplemente obsérvala con compasión." },
        { time: 240, text: "Ahora, dirige la luz sanadora directamente a esas áreas." },
        { time: 270, text: "La luz, a nivel cuántico, disuelve las frecuencias de la enfermedad." },
        { time: 300, text: "Visualiza las células dañadas vibrando y transformándose." },
        { time: 330, text: "Patrones viejos y densos se desvanecen, reemplazados por luz pura." },
        { time: 360, text: "Siente cómo tus alveolos se regeneran, volviéndose flexibles y vibrantes." },
        { time: 390, text: "La fibrosis se disuelve en pura energía luminosa." },
        { time: 420, text: "Tus pulmones se reprograman con el código de la salud perfecta." },
        { time: 450, text: "Siente una profunda gratitud por esta transformación." },
        { time: 480, text: "La vitalidad y la facilidad regresan a tu respiración." },
        { time: 510, text: "Permanece en este estado de sanación y luz." },
        { time: 540, text: "Poco a poco, trae tu conciencia de vuelta a tu cuerpo." },
        { time: 570, text: "Siente el aire fresco al respirar. Siente la calma en tu ser." },
        { time: 590, text: "Cuando estés listo, abre los ojos lentamente." },
        { time: 600, text: "Meditación completada. Lleva esta paz contigo." },
    ];

    function toggleMeditation() {
        if (isMeditating) {
            stopMeditation();
        } else {
            startMeditation();
        }
    }

    function startMeditation() {
        // Stop other activities
        stopSound();
        stopBreathingExercise(false);
        isHealing = false;
        createParticles();

        isMeditating = true;
        startMeditationBtn.textContent = 'Detener Meditación';
        startMeditationBtn.classList.remove('btn-outline-info');
        startMeditationBtn.classList.add('btn-outline-warning');

        meditationProgressContainer.style.display = 'block';
        playBinauralAndMusic();

        const duration = 600; // 10 minutes in seconds
        let elapsed = 0;
        let scriptIndex = 0;

        meditationInstruction.textContent = meditationScript[0].text;

        meditationInterval = setInterval(() => {
            elapsed++;
            const progress = (elapsed / duration) * 100;
            meditationProgressBar.style.width = `${progress}%`;
            const minutes = Math.floor((duration - elapsed) / 60);
            const seconds = (duration - elapsed) % 60;
            meditationTimerDisplay.textContent = `Tiempo restante: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            
            // Update script
            if (scriptIndex < meditationScript.length -1 && elapsed >= meditationScript[scriptIndex + 1].time) {
                scriptIndex++;
                meditationInstruction.textContent = meditationScript[scriptIndex].text;
            }

            if (elapsed >= duration) {
                stopMeditation();
            }
        }, 1000);
    }
    
    function stopMeditation(updateUI = true) {
        if (!isMeditating) return;

        clearInterval(meditationInterval);
        clearTimeout(meditationTimeout);
        isMeditating = false;
        
        stopSound(updateUI);

        if (updateUI) {
            startMeditationBtn.textContent = 'Comenzar Meditación';
            startMeditationBtn.classList.remove('btn-outline-warning');
            startMeditationBtn.classList.add('btn-outline-info');
            meditationInstruction.textContent = 'Meditación detenida.';
            meditationProgressContainer.style.display = 'none';
            meditationProgressBar.style.width = '0%';
            meditationTimerDisplay.textContent = '';
        } else {
            meditationInstruction.textContent = '';
            meditationProgressContainer.style.display = 'none';
        }

        // Reset particles
        setTimeout(createParticles, 100);
    }

    // --- Journal Functions ---
    function handleJournalSubmit(e) {
        e.preventDefault();

        const entry = {
            id: Date.now(),
            date: journalDate.value,
            progress: journalProgress.value,
            improvements: journalImprovements.value,
            dreams: journalDreams.value,
        };

        const entries = getJournalEntries();
        entries.unshift(entry); // Add new entry to the beginning
        saveJournalEntries(entries);
        renderJournalEntries(entries);

        journalForm.reset();
        journalProgressValue.textContent = '50%';
        // Set date back to today
        journalDate.value = new Date().toISOString().slice(0, 10);
    }

    function getJournalEntries() {
        const entriesJSON = localStorage.getItem('healingJournalEntries');
        return entriesJSON ? JSON.parse(entriesJSON) : [];
    }

    function saveJournalEntries(entries) {
        localStorage.setItem('healingJournalEntries', JSON.stringify(entries));
    }

    function loadJournalEntries() {
        const entries = getJournalEntries();
        renderJournalEntries(entries);
        // Set initial date
        journalDate.value = new Date().toISOString().slice(0, 10);
    }

    function renderJournalEntries(entries) {
        journalEntriesContainer.innerHTML = '';
        if (entries.length === 0) {
            journalEntriesContainer.innerHTML = '<p class="text-center text-muted">Aún no hay entradas en tu diario.</p>';
            return;
        }

        entries.forEach(entry => {
            const entryElement = document.createElement('div');
            entryElement.className = 'list-group-item journal-entry';
            
            const formattedDate = new Date(entry.date + 'T00:00:00').toLocaleDateString('es-ES', {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            entryElement.innerHTML = `
                <div class="d-flex w-100 justify-content-between mb-3">
                    <h5 class="mb-1">${formattedDate}</h5>
                    <small>Progreso: ${entry.progress}%</small>
                </div>
                <div class="progress mb-3">
                    <div class="progress-bar bg-info" role="progressbar" style="width: ${entry.progress}%;" aria-valuenow="${entry.progress}" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
                ${entry.improvements ? `<p class="mb-1"><strong>Mejoras:</strong> ${entry.improvements.replace(/\n/g, '<br>')}</p>` : ''}
                ${entry.dreams ? `<p class="mb-1 text-muted"><em><strong>Sueños:</strong> ${entry.dreams.replace(/\n/g, '<br>')}</em></p>` : ''}
            `;
            journalEntriesContainer.appendChild(entryElement);
        });
    }

    function clearJournal() {
        if (confirm('¿Estás seguro de que quieres borrar permanentemente todo tu historial del diario? Esta acción no se puede deshacer.')) {
            localStorage.removeItem('healingJournalEntries');
            renderJournalEntries([]);
        }
    }

    // --- Helper Functions ---
    function getCurrentScore() {
        return parseInt(sintomasSelect.value) + parseInt(energiaSelect.value) + parseInt(emocionSelect.value);
    }

    function lerpColor(a, b, amount) {
        const ar = parseInt(a.slice(1, 3), 16),
              ag = parseInt(a.slice(3, 5), 16),
              ab = parseInt(a.slice(5, 7), 16),
              br = parseInt(b.slice(1, 3), 16),
              bg = parseInt(b.slice(3, 5), 16),
              bb = parseInt(b.slice(5, 7), 16),
              rr = Math.round(ar + amount * (br - ar)),
              rg = Math.round(ag + amount * (bg - ag)),
              rb = Math.round(ab + amount * (bb - ab));
        return '#' + ((1 << 24) + (rr << 16) + (rg << 8) + rb).toString(16).slice(1).padStart(6, '0');
    }

    // --- Start the App ---
    init();
});