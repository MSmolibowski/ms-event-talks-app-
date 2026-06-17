// State Management
let state = {
    releases: [],          // Raw releases data from server
    filteredReleases: [],  // Filtered releases based on current filters
    activeTypes: new Set(['feature', 'issue', 'deprecation', 'change', 'announcement', 'update']),
    searchQuery: '',
    selectedUpdate: null,  // Currently selected update for tweeting
    lastFetched: ''
};

// DOM Elements
const elements = {
    notesContainer: document.getElementById('notes-container'),
    loadingContainer: document.getElementById('loading-container'),
    errorContainer: document.getElementById('error-container'),
    errorMessage: document.getElementById('error-message'),
    btnRefresh: document.getElementById('btn-refresh'),
    btnRefreshText: document.getElementById('btn-refresh-text'),
    refreshIcon: document.getElementById('refresh-icon'),
    btnRetry: document.getElementById('btn-retry'),
    feedStatus: document.getElementById('feed-status'),
    
    // Stats
    statTotal: document.getElementById('stat-total'),
    statFeatures: document.getElementById('stat-features'),
    statIssues: document.getElementById('stat-issues'),
    statOthers: document.getElementById('stat-others'),
    
    // Filters
    searchInput: document.getElementById('search-input'),
    typeFilters: document.querySelectorAll('.type-filter'),
    btnSelectAllFilters: document.getElementById('btn-select-all-filters'),
    btnClearFilters: document.getElementById('btn-clear-filters'),
    
    // Tweet Modal
    tweetModal: document.getElementById('tweet-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    previewDate: document.getElementById('tweet-preview-date'),
    previewBadge: document.getElementById('tweet-preview-badge'),
    previewSource: document.getElementById('tweet-preview-source'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charCount: document.getElementById('char-count'),
    charProgress: document.getElementById('char-progress'),
    tweetWarning: document.getElementById('tweet-warning'),
    btnCopyTweet: document.getElementById('btn-copy-tweet'),
    btnSendTweet: document.getElementById('btn-send-tweet'),
    
    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message'),
    toastIcon: document.getElementById('toast-icon'),
    
    // JP2 Spinner Overlay
    jp2Overlay: document.getElementById('jp2-overlay')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    fetchReleases();
});

// Event Listeners
function initEventListeners() {
    // Refresh feed
    elements.btnRefresh.addEventListener('click', () => fetchReleases(true));
    elements.btnRetry.addEventListener('click', () => fetchReleases(true));
    
    // Search input
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        applyFilters();
    });
    
    // Type filters
    elements.typeFilters.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const value = checkbox.value;
            if (checkbox.checked) {
                state.activeTypes.add(value);
            } else {
                state.activeTypes.delete(value);
            }
            applyFilters();
        });
    });
    
    // Filter shortcuts
    elements.btnSelectAllFilters.addEventListener('click', () => {
        elements.typeFilters.forEach(checkbox => {
            checkbox.checked = true;
            state.activeTypes.add(checkbox.value);
        });
        applyFilters();
    });
    
    elements.btnClearFilters.addEventListener('click', () => {
        elements.typeFilters.forEach(checkbox => {
            checkbox.checked = false;
            state.activeTypes.delete(checkbox.value);
        });
        applyFilters();
    });
    
    // Modal controls
    elements.btnCloseModal.addEventListener('click', hideTweetModal);
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) hideTweetModal();
    });
    
    // Tweet composition character count
    elements.tweetTextarea.addEventListener('input', updateTweetCharCount);
    
    // Modal action buttons
    elements.btnCopyTweet.addEventListener('click', copyTweetToClipboard);
    elements.btnSendTweet.addEventListener('click', postTweet);
}

// Fetch Releases from Flask API
async function fetchReleases(force = false) {
    let delayPromise = Promise.resolve();
    
    if (force) {
        // Show spinning John Paul II overlay, play Barka synth, and start sparks
        elements.jp2Overlay.classList.remove('hidden');
        barkaPlayer.play();
        startSparks();
        delayPromise = new Promise(resolve => setTimeout(resolve, 5000));
    } else {
        showLoading(true);
    }
    
    elements.refreshIcon.classList.add('spinning');
    elements.btnRefreshText.textContent = force ? 'Refreshing...' : 'Loading...';
    
    try {
        const fetchPromise = fetch(`/api/releases?refresh=${force}`).then(async r => {
            if (!r.ok) {
                const errData = await r.json().catch(() => ({}));
                throw new Error(errData.error || `Server error: ${r.status}`);
            }
            return r.json();
        });
        
        // Wait for both the network request and the 5-second delay to complete
        const [result] = await Promise.all([fetchPromise, delayPromise]);
        
        if (!result.success) {
            throw new Error(result.error || `Server returned success false`);
        }
        
        state.releases = result.data.entries;
        state.lastFetched = result.data.fetched_at;
        
        // Update top header status
        const cacheIndicator = result.from_cache ? '(Cached)' : '(Fresh)';
        elements.feedStatus.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Last updated: ${state.lastFetched} <span class="cache-badge">${cacheIndicator}</span>`;
        
        showError(false);
        applyFilters();
        
    } catch (error) {
        console.error('Error fetching release notes:', error);
        elements.errorMessage.textContent = `Error: ${error.message}. Please check your connection or try again.`;
        showError(true);
    } finally {
        if (force) {
            barkaPlayer.stop();
            stopSparks();
            elements.jp2Overlay.classList.add('hidden');
        } else {
            showLoading(false);
        }
        elements.refreshIcon.classList.remove('spinning');
        elements.btnRefreshText.textContent = 'Refresh Feed';
    }
}

// Show/Hide Loading Skeleton
function showLoading(isLoading) {
    if (isLoading) {
        elements.loadingContainer.classList.remove('hidden');
        elements.notesContainer.classList.add('hidden');
        elements.errorContainer.classList.add('hidden');
    } else {
        elements.loadingContainer.classList.add('hidden');
        elements.notesContainer.classList.remove('hidden');
    }
}

// Show/Hide Error Card
function showError(hasError) {
    if (hasError) {
        elements.errorContainer.classList.remove('hidden');
        elements.notesContainer.classList.add('hidden');
        elements.loadingContainer.classList.add('hidden');
        elements.feedStatus.textContent = 'Failed to load';
    } else {
        elements.errorContainer.classList.add('hidden');
    }
}

// Apply Search and Type Filters
function applyFilters() {
    state.filteredReleases = state.releases.map(entry => {
        // Filter the updates array within each entry
        const matchingUpdates = entry.updates.filter(update => {
            const typeLower = update.type.toLowerCase();
            
            // Check if update type is enabled in filters
            const matchesType = state.activeTypes.has(typeLower) || 
                                (typeLower === 'announcement' && state.activeTypes.has('announcement')) ||
                                (!['feature', 'issue', 'deprecation', 'change', 'announcement'].includes(typeLower) && state.activeTypes.has('update'));
            
            // Check if search query matches type or text
            const matchesSearch = !state.searchQuery || 
                                  update.text.toLowerCase().includes(state.searchQuery) || 
                                  update.type.toLowerCase().includes(state.searchQuery);
            
            return matchesType && matchesSearch;
        });
        
        return {
            ...entry,
            updates: matchingUpdates
        };
    }).filter(entry => entry.updates.length > 0); // Only keep days with matching updates
    
    calculateStats();
    renderTimeline();
}

// Calculate stats for the sidebar
function calculateStats() {
    let totalItems = 0;
    let featuresCount = 0;
    let issuesCount = 0;
    let othersCount = 0;
    
    // Count based on the unfiltered releases to show totals
    state.releases.forEach(entry => {
        entry.updates.forEach(update => {
            totalItems++;
            const type = update.type.toLowerCase();
            if (type === 'feature') {
                featuresCount++;
            } else if (type === 'issue') {
                issuesCount++;
            } else {
                othersCount++;
            }
        });
    });
    
    // Animate stats numbers
    animateNumber(elements.statTotal, totalItems);
    animateNumber(elements.statFeatures, featuresCount);
    animateNumber(elements.statIssues, issuesCount);
    animateNumber(elements.statOthers, othersCount);
}

// Animate counting numbers
function animateNumber(element, target) {
    const start = parseInt(element.textContent) || 0;
    if (start === target) return;
    
    const duration = 800; // ms
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing out quadratic
        const easeProgress = progress * (2 - progress);
        const value = Math.floor(start + (target - start) * easeProgress);
        
        element.textContent = value;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target;
        }
    }
    
    requestAnimationFrame(update);
}

// Render the Releases Timeline
function renderTimeline() {
    elements.notesContainer.innerHTML = '';
    
    if (state.filteredReleases.length === 0) {
        elements.notesContainer.innerHTML = `
            <div class="no-results">
                <i class="fa-regular fa-folder-open"></i>
                <p>No release notes found matching the selected filters.</p>
            </div>
        `;
        return;
    }
    
    state.filteredReleases.forEach((entry, entryIndex) => {
        const dayGroup = document.createElement('div');
        dayGroup.className = 'day-group';
        
        // Day marker (Timeline circle)
        const dayMarker = document.createElement('div');
        dayMarker.className = 'day-marker';
        const dayDot = document.createElement('div');
        dayDot.className = 'day-dot';
        dayMarker.appendChild(dayDot);
        dayGroup.appendChild(dayMarker);
        
        // Day Header
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        
        const dayTitle = document.createElement('h3');
        dayTitle.className = 'day-title';
        dayTitle.textContent = entry.date;
        dayHeader.appendChild(dayTitle);
        
        if (entry.link) {
            const dayLink = document.createElement('a');
            dayLink.className = 'day-link';
            dayLink.href = entry.link;
            dayLink.target = '_blank';
            dayLink.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square"></i> Docs`;
            dayHeader.appendChild(dayLink);
        }
        
        dayGroup.appendChild(dayHeader);
        
        // Updates List
        const updatesList = document.createElement('div');
        updatesList.className = 'updates-list';
        
        entry.updates.forEach((update, updateIndex) => {
            const card = document.createElement('div');
            const typeClass = `type-${update.type.toLowerCase()}`;
            card.className = `update-card ${typeClass}`;
            
            // Set dataset attribute to link card details
            card.dataset.entryIndex = entryIndex;
            card.dataset.updateIndex = updateIndex;
            
            // Card click to select/highlight card
            card.addEventListener('click', (e) => {
                // If clicked an action button, don't toggle card selection
                if (e.target.closest('.card-actions') || e.target.closest('.card-select-btn')) {
                    return;
                }
                
                // Toggle select class
                const isSelected = card.classList.contains('selected');
                
                // Deselect all cards
                document.querySelectorAll('.update-card').forEach(c => c.classList.remove('selected'));
                
                // Change select button icons
                document.querySelectorAll('.card-select-btn i').forEach(icon => {
                    icon.className = 'fa-regular fa-square';
                });
                
                if (!isSelected) {
                    card.classList.add('selected');
                    const selectBtnIcon = card.querySelector('.card-select-btn i');
                    if (selectBtnIcon) selectBtnIcon.className = 'fa-solid fa-square-check';
                }
            });
            
            // Header Row (Type Badge & Selection Checkbox)
            const headerRow = document.createElement('div');
            headerRow.className = 'card-header-row';
            
            const typeArea = document.createElement('div');
            typeArea.className = 'card-type-area';
            
            const badge = document.createElement('span');
            badge.className = `badge badge-${update.type.toLowerCase()}`;
            badge.textContent = update.type;
            typeArea.appendChild(badge);
            
            headerRow.appendChild(typeArea);
            
            // Selection checkbox icon
            const selectBtn = document.createElement('button');
            selectBtn.className = 'card-select-btn';
            selectBtn.title = 'Select this update';
            selectBtn.innerHTML = '<i class="fa-regular fa-square"></i>';
            selectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const isSelected = card.classList.contains('selected');
                document.querySelectorAll('.update-card').forEach(c => c.classList.remove('selected'));
                document.querySelectorAll('.card-select-btn i').forEach(icon => {
                    icon.className = 'fa-regular fa-square';
                });
                
                if (!isSelected) {
                    card.classList.add('selected');
                    selectBtn.querySelector('i').className = 'fa-solid fa-square-check';
                }
            });
            headerRow.appendChild(selectBtn);
            
            card.appendChild(headerRow);
            
            // Body Content (HTML)
            const body = document.createElement('div');
            body.className = 'card-body';
            body.innerHTML = update.html;
            card.appendChild(body);
            
            // Actions Row
            const actions = document.createElement('div');
            actions.className = 'card-actions';
            
            // Copy action
            const copyBtn = document.createElement('button');
            copyBtn.className = 'action-btn';
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy Text';
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                copyText(update.text);
            });
            actions.appendChild(copyBtn);
            
            // Tweet action
            const tweetBtn = document.createElement('button');
            tweetBtn.className = 'action-btn btn-tweet-action';
            tweetBtn.innerHTML = '<i class="fa-brands fa-x-twitter"></i> Tweet';
            tweetBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openTweetModal(entry.date, update.type, update.text, entry.link);
            });
            actions.appendChild(tweetBtn);
            
            card.appendChild(actions);
            updatesList.appendChild(card);
        });
        
        dayGroup.appendChild(updatesList);
        elements.notesContainer.appendChild(dayGroup);
    });
}

// Clipboard Copy Helper
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Text copied to clipboard!', 'fa-solid fa-circle-check');
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        showToast('Failed to copy text', 'fa-solid fa-circle-xmark', true);
    });
}

// Toast Notification System
function showToast(message, iconClass, isError = false) {
    elements.toastMessage.textContent = message;
    elements.toastIcon.className = iconClass;
    
    if (isError) {
        elements.toast.style.borderColor = 'var(--color-deprecation)';
        elements.toastIcon.style.color = 'var(--color-deprecation)';
    } else {
        elements.toast.style.borderColor = 'var(--color-announcement)';
        elements.toastIcon.style.color = 'var(--color-announcement)';
    }
    
    elements.toast.classList.remove('hidden');
    
    // Clear previous timeouts if click-spamming
    if (window.toastTimeout) {
        clearTimeout(window.toastTimeout);
    }
    
    window.toastTimeout = setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

// Tweet Modal Operations
function openTweetModal(date, type, plainText, docLink) {
    state.selectedUpdate = { date, type, plainText, docLink };
    
    // Set static details
    elements.previewDate.textContent = date;
    elements.previewBadge.textContent = type;
    elements.previewBadge.className = `preview-badge badge badge-${type.toLowerCase()}`;
    elements.previewSource.textContent = `Original: "${plainText}"`;
    
    // Construct default tweet text
    // Example: BigQuery Feature: Gemini Cloud Assist is in Preview! Link: docLink #BigQuery #GoogleCloud
    let cleanText = plainText;
    
    // Format links: if tweet content is long, truncate it
    // Twitter's URL is counted as exactly 23 characters, so we need to account for it.
    const urlPlaceholder = docLink ? ` ${docLink}` : '';
    const tagString = '\n\n#BigQuery #GoogleCloud';
    
    // Max characters available for text: 280 - (23 if URL) - (tags length) - (prefix length)
    const urlLength = docLink ? 23 : 0;
    const tagLength = tagString.length;
    const prefix = `BigQuery ${type}: `;
    const maxTextLength = 280 - prefix.length - urlLength - tagLength - 5; // offset buffer
    
    if (cleanText.length > maxTextLength) {
        cleanText = cleanText.substring(0, maxTextLength - 3) + '...';
    }
    
    const defaultTweetText = `${prefix}${cleanText}${urlPlaceholder}${tagString}`;
    
    elements.tweetTextarea.value = defaultTweetText;
    updateTweetCharCount();
    
    // Show modal
    elements.tweetModal.classList.remove('hidden');
    elements.tweetTextarea.focus();
}

function hideTweetModal() {
    elements.tweetModal.classList.add('hidden');
    state.selectedUpdate = null;
}

// Twitter character counting rules: URLs count as 23 characters
function calculateTwitterLength(text) {
    // Matches http:// and https:// URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex) || [];
    const textWithoutUrls = text.replace(urlRegex, '');
    
    // Character count excluding urls + 23 characters per URL
    return textWithoutUrls.length + (urls.length * 23);
}

function updateTweetCharCount() {
    const text = elements.tweetTextarea.value;
    const count = calculateTwitterLength(text);
    
    elements.charCount.textContent = count;
    
    // Progress bar fill calculation
    const progress = Math.min((count / 280) * 100, 100);
    elements.charProgress.style.width = `${progress}%`;
    
    // Coloring classes for states
    if (count > 280) {
        elements.charProgress.className = 'char-progress-fill danger';
        elements.charCount.style.color = 'var(--color-deprecation)';
        elements.tweetWarning.classList.remove('hidden');
        elements.btnSendTweet.disabled = true;
        elements.btnSendTweet.style.opacity = '0.5';
    } else {
        elements.tweetWarning.classList.add('hidden');
        elements.btnSendTweet.disabled = false;
        elements.btnSendTweet.style.opacity = '1';
        
        if (count > 250) {
            elements.charProgress.className = 'char-progress-fill warning';
            elements.charCount.style.color = 'var(--color-issue)';
        } else {
            elements.charProgress.className = 'char-progress-fill';
            elements.charCount.style.color = 'var(--text-secondary)';
        }
    }
}

// Copy Tweet Text
function copyTweetToClipboard() {
    const tweetText = elements.tweetTextarea.value;
    copyText(tweetText);
}

// Post on X (Twitter intent)
function postTweet() {
    const tweetText = elements.tweetTextarea.value;
    const count = calculateTwitterLength(tweetText);
    
    if (count > 280) {
        showToast('Tweet text exceeds 280 characters!', 'fa-solid fa-circle-exclamation', true);
        return;
    }
    
    const encodedText = encodeURIComponent(tweetText);
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    
    window.open(tweetUrl, '_blank');
    hideTweetModal();
}

// Spark Particles Effect Engine
let sparkAnimationId = null;
let sparks = [];

function startSparks() {
    sparks = [];
    const container = document.body;
    
    function createSpark() {
        const angle = Math.random() * Math.PI * 2;
        // Spawns sparks in a circle around the center of the viewport (near the JP2 image)
        const radius = 125; // JP2 image radius is 125px
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2 - 20; // Caption offset
        
        const startX = centerX + Math.cos(angle) * (radius - 20 + Math.random() * 40);
        const startY = centerY + Math.sin(angle) * (radius - 20 + Math.random() * 40);
        
        const spark = document.createElement('div');
        spark.className = 'jp2-spark';
        
        // Random golden/fire colors
        const colors = [
            'rgba(251, 191, 36, 0.8)',  // Amber
            'rgba(249, 115, 22, 0.8)',  // Orange
            'rgba(239, 68, 68, 0.8)',   // Red
            'rgba(253, 224, 71, 0.8)',  // Yellow
            'rgba(255, 255, 255, 0.9)'  // Bright white-gold
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        const size = 3 + Math.random() * 6; // random size
        
        spark.style.width = `${size}px`;
        spark.style.height = `${size}px`;
        spark.style.backgroundColor = color;
        spark.style.boxShadow = `0 0 10px ${color}, 0 0 20px ${color}`;
        
        container.appendChild(spark);
        
        // Physics variables for the falling sparks animation
        sparks.push({
            element: spark,
            x: startX,
            y: startY,
            vx: (Math.random() - 0.5) * 2 + Math.cos(angle) * 1.5, // moderate horizontal speed
            vy: (Math.random() - 0.3) * 1 + Math.sin(angle) * 1, // slight initial vertical velocity
            gravity: 0.18, // positive gravity pulls sparks DOWN the screen
            alpha: 1,
            decay: 0.007 + Math.random() * 0.01 // slower decay to allow sparks to fall down the screen
        });
    }
    
    // Animation loop
    function updateSparks() {
        if (!sparkAnimationId) return;
        
        // Randomly spawn new sparks
        if (sparks.length < 150 && Math.random() < 0.7) {
            createSpark();
        }
        
        for (let i = sparks.length - 1; i >= 0; i--) {
            const s = sparks[i];
            s.x += s.vx;
            s.y += s.vy;
            s.vy += s.gravity; // Pull downwards
            s.alpha -= s.decay;
            
            if (s.alpha <= 0) {
                s.element.remove();
                sparks.splice(i, 1);
            } else {
                s.element.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
                s.element.style.opacity = s.alpha;
            }
        }
        
        sparkAnimationId = requestAnimationFrame(updateSparks);
    }
    
    sparkAnimationId = requestAnimationFrame(updateSparks);
}

function stopSparks() {
    if (sparkAnimationId) {
        cancelAnimationFrame(sparkAnimationId);
        sparkAnimationId = null;
    }
    
    // Remove remaining spark DOM nodes
    sparks.forEach(s => s.element.remove());
    sparks = [];
}

// "Barka" Web Audio API Synthesizer Player
class BarkaPlayer {
    constructor() {
        this.ctx = null;
        this.timeoutIds = [];
    }
    
    initContext() {
        // Safe standard context fallback
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
    }
    
    playNote(frequency, startTime, duration) {
        if (!this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        // Use soft triangle waves for organ-like sound
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(frequency, startTime);
        
        // Soft envelope: attack and decay release
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.05); // Attack
        gainNode.gain.setValueAtTime(0.25, startTime + duration - 0.08);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // Release
        
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
    }
    
    play() {
        this.stop(); // Clear any previous notes
        this.initContext();
        
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        // Tempo: 120 BPM -> 1 beat = 0.5s
        const beat = 0.55;
        const now = this.ctx.currentTime;
        
        // Note frequencies in Hz (octave 4)
        const notes = {
            'C': 261.63, 'D': 293.66, 'E': 329.63, 'F': 349.23, 'G': 392.00, 'A': 440.00, 'H': 493.88,
            'C2': 523.25, 'D2': 587.33, 'E2': 659.25, 'F2': 698.46, 'G2': 783.99, 'A2': 880.00
        };
        
        // Refren "Barki" (O Panie, to Ty na mnie spojrzałeś...)
        // formatted as: [noteName, beatDuration]
        const melody = [
            ['C', 1], ['F', 1], ['A', 1], ['A', 1.5], ['A', 0.5], ['H', 1], ['C2', 1], ['H', 1], ['A', 1],
            ['C', 1], ['G', 2.5], ['G', 1.5], // O Panie, to Ty na mnie spojrzałeś...
            ['A', 1], ['F', 1], ['E', 1], ['F', 1.5], ['F', 0.5], ['F', 1], ['G', 1], ['A', 1], ['G', 1],
            ['F', 1], ['E', 2.5], ['E', 1.5]  // Twoje usta dziś wyrzekły me imię...
        ];
        
        let elapsed = 0.1;
        melody.forEach(item => {
            const noteName = item[0];
            const durationBeats = item[1];
            const durationSec = durationBeats * beat;
            const frequency = notes[noteName];
            
            this.playNote(frequency, now + elapsed, durationSec);
            elapsed += durationSec;
        });
    }
    
    stop() {
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
    }
}

const barkaPlayer = new BarkaPlayer();

