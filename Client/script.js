/**
 * LiveSpeech MLX TX - Embedded Web Client Script
 * Config.json Resolver, Strict Theme Enforcement, Option B YouTube Controls,
 * Fullscreen Captions Engine, Autoplay Audio Unlocker, Supabase Realtime Sync, Emoji Flags & Telemetry.
 */

(function() {
    'use strict';

    // ==============================================================================
    // 1. URL Query Parameters & Theme Initialization
    // ==============================================================================
    const urlParams = new URLSearchParams(window.location.search);

    const sessionParam = urlParams.get('session') || urlParams.get('broadcast_id') || urlParams.get('v') || urlParams.get('id') || 'session_1';
    const themeParam = (urlParams.get('theme') || 'dark').toLowerCase() === 'light' ? 'light' : 'dark';

    // Strictly enforce theme via data-theme attribute
    document.documentElement.setAttribute('data-theme', themeParam);

    // Dynamic Variables populated by config.json with fallback defaults
    const DEFAULT_CONFIG_FALLBACK = {
        supabase: {
            project_url: "https://sjyrkjtsyymemgpounzw.supabase.co",
            anon_key: "sb_publishable_2fWGDIEvKLRw-ryDvp3LGA_0riZdvLC"
        },
        broadcast_id: {
            "session_1": "G5b1mC5-GEA",
            "session_satellite_1_topcon": "1Mg11sWcvCA",
            "session_2": "679t3yA1_Gw",
            "session_satellite_2_isr": "MamngCWslYs"
        }
    };

    let SUPABASE_URL = DEFAULT_CONFIG_FALLBACK.supabase.project_url;
    let SUPABASE_ANON_KEY = DEFAULT_CONFIG_FALLBACK.supabase.anon_key;
    let resolvedBroadcastId = DEFAULT_CONFIG_FALLBACK.broadcast_id[sessionParam] || sessionParam;

    // ==============================================================================
    // 2. Application State Variables
    // ==============================================================================
    let player = null;
    let supabaseClient = null;
    let realtimeChannel = null;

    let isSubtitlesEnabled = true;
    let selectedLanguage = 'Spanish';
    let ttsEnabled = false;

    // Timecode Subtitle Sync Engine & In-Memory Buffer
    let inMemoryCaptions = []; // Array of all session captions sorted by start_seconds
    let latestCaptionRecord = null;
    let syncTickerTimer = null;

    let availableLanguages = new Set(['Spanish', 'English', 'French', 'German', 'Italian', 'Portuguese']);
    let currentSessionCode = 'UNKNOWN';
    let currentPresentationCode = 'UNKNOWN';

    let viewerSessionId = localStorage.getItem('ls_viewer_session_id') || null;
    let heartbeatTimer = null;

    // ==============================================================================
    // 3. UI Element References
    // ==============================================================================
    const protocolWarning = document.getElementById('protocol-warning');
    const linkDirectYt = document.getElementById('link-direct-yt');

    const autoplayBanner = document.getElementById('autoplay-banner');
    const btnUnmuteAutoplay = document.getElementById('btn-unmute-autoplay');

    const btnCustomPlay = document.getElementById('btn-custom-play');
    const btnCustomMute = document.getElementById('btn-custom-mute');
    const inputCustomVolume = document.getElementById('input-custom-volume');
    const badgeLiveStatus = document.getElementById('badge-live-status');
    const displayPlayerTime = document.getElementById('display-player-time');
    const btnCustomFs = document.getElementById('btn-custom-fs');

    const btnToggleSubtitles = document.getElementById('btn-toggle-subtitles');
    const subtitlesStateText = document.getElementById('subtitles-state-text');
    const btnTts = document.getElementById('btn-tts');
    const ttsStateText = document.getElementById('tts-state-text');

    const selectLanguage = document.getElementById('select-language');
    const infoTag = document.getElementById('info-tag');
    const waitingTag = document.getElementById('waiting-tag');

    const subtitleBox = document.getElementById('subtitle-box');
    const subtitleText = document.getElementById('subtitle-text');

    // Emoji Flag Helper (UK flag 🇬🇧 for English, Spain flag 🇪🇸 for Spanish)
    function getFlagIcon(languageName) {
        const lang = (languageName || '').toLowerCase();
        if (lang.includes('spanish') || lang.includes('español')) return '🇪🇸';
        if (lang.includes('english')) return '🇬🇧';
        if (lang.includes('french') || lang.includes('français')) return '🇫🇷';
        if (lang.includes('german') || lang.includes('deutsch')) return '🇩🇪';
        if (lang.includes('italian') || lang.includes('italiano')) return '🇮🇹';
        if (lang.includes('portuguese') || lang.includes('português')) return '🇵🇹';
        return '🌐';
    }

    // ==============================================================================
    // 4. Config.json Loader & Session Resolver
    // ==============================================================================
    async function loadConfigAndInit() {
        try {
            let response = await fetch('./config.json').catch(() => null);
            if (!response || !response.ok) {
                response = await fetch('../config.json').catch(() => null);
            }
            if (!response || !response.ok) {
                response = await fetch('/config.json').catch(() => null);
            }
            if (!response || !response.ok) {
                response = await fetch('/TestSession1/config.json').catch(() => null);
            }

            if (response && response.ok) {
                const configData = await response.json();
                const mainConfig = Array.isArray(configData) ? configData[0] : configData;

                if (mainConfig.supabase) {
                    SUPABASE_URL = mainConfig.supabase.project_url || SUPABASE_URL;
                    SUPABASE_ANON_KEY = mainConfig.supabase.anon_key || SUPABASE_ANON_KEY;
                }

                if (mainConfig.broadcast_id && mainConfig.broadcast_id[sessionParam] && mainConfig.broadcast_id[sessionParam].trim().length > 0) {
                    resolvedBroadcastId = mainConfig.broadcast_id[sessionParam].trim();
                    console.log(`[Config Resolver] Resolved session '${sessionParam}' -> YouTube ID '${resolvedBroadcastId}'`);
                }
            } else {
                console.warn('[Config Resolver] Using built-in default YouTube & Supabase config:', resolvedBroadcastId);
            }
        } catch (err) {
            console.error('[Config Resolver] Error parsing config.json:', err);
        }

        if (linkDirectYt) linkDirectYt.href = `https://www.youtube.com/watch?v=${resolvedBroadcastId}`;

        initYouTubePlayer();
        initSupabase();
    }

    // ==============================================================================
    // 5. YouTube IFrame Player API Integration (Option B & Autoplay Audio Unlocker)
    // ==============================================================================
    function initYouTubePlayer() {
        if (typeof YT === 'undefined' || !YT.Player) {
            window.onYouTubeIframeAPIReady = createPlayerInstance;
        } else {
            createPlayerInstance();
        }
    }

    function createPlayerInstance() {
        console.log('[YouTube API] Creating Player for broadcast:', resolvedBroadcastId);
        const isFileProtocol = window.location.protocol === 'file:';

        try {
            player = new YT.Player('player', {
                videoId: resolvedBroadcastId,
                host: 'https://www.youtube-nocookie.com',
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    cc_load_policy: 0,
                    iv_load_policy: 3,
                    modestbranding: 1,
                    rel: 0,
                    fs: 1,
                    enablejsapi: 1,
                    origin: isFileProtocol ? '*' : window.location.origin
                },
                events: {
                    onReady: onPlayerReady,
                    onStateChange: onPlayerStateChange,
                    onError: onPlayerError
                }
            });
        } catch (e) {
            console.error('[YouTube API] Exception during YT.Player instantiation:', e);
            if (isFileProtocol && protocolWarning) protocolWarning.classList.remove('hidden');
        }
    }

    function onPlayerReady(event) {
        console.log('[YouTube API] Player Ready. Executing autoplay...');
        
        try {
            if (player && typeof player.unloadModule === 'function') {
                player.unloadModule('captions');
            }
        } catch (e) {}

        // Automatically unlock audio on the VERY FIRST user interaction anywhere on the page
        const autoUnmuteOnUserInteraction = () => {
            if (player && typeof player.isMuted === 'function' && player.isMuted()) {
                try {
                    unmuteYouTubeAudio();
                    if (autoplayBanner) autoplayBanner.classList.add('hidden');
                    console.log('[Autoplay Policy] Unmuted player audio automatically on user interaction.');
                } catch (e) {}
            }
            window.removeEventListener('click', autoUnmuteOnUserInteraction);
            window.removeEventListener('keydown', autoUnmuteOnUserInteraction);
            window.removeEventListener('touchstart', autoUnmuteOnUserInteraction);
            window.removeEventListener('pointerdown', autoUnmuteOnUserInteraction);
        };

        window.addEventListener('click', autoUnmuteOnUserInteraction, { once: true });
        window.addEventListener('keydown', autoUnmuteOnUserInteraction, { once: true });
        window.addEventListener('touchstart', autoUnmuteOnUserInteraction, { once: true });
        window.addEventListener('pointerdown', autoUnmuteOnUserInteraction, { once: true });

        // Try playing unmuted first
        try {
            player.unMute();
            if (btnCustomMute) btnCustomMute.textContent = '🔊 MUTE';
            event.target.playVideo();
        } catch (e) {
            console.warn('[Autoplay Unmuted Blocked]:', e);
        }

        setTimeout(() => {
            if (player && typeof player.getPlayerState === 'function') {
                const state = player.getPlayerState();
                if (state !== YT.PlayerState.PLAYING) {
                    console.log('[Autoplay Fallback] Attempting muted autoplay...');
                    player.mute();
                    if (btnCustomMute) btnCustomMute.textContent = '🔇 UNMUTE';
                    player.playVideo();
                }
            }
        }, 1000);

        if (syncTickerTimer) clearInterval(syncTickerTimer);
        syncTickerTimer = setInterval(tickSubtitleSync, 200);
    }

    function onPlayerStateChange(event) {
        if (!badgeLiveStatus || !btnCustomPlay) return;

        if (event.data === YT.PlayerState.PLAYING) {
            btnCustomPlay.textContent = '⏸ PAUSE';
            badgeLiveStatus.textContent = '🔴 LIVE';
            if (autoplayBanner && player && typeof player.isMuted === 'function' && !player.isMuted()) {
                autoplayBanner.classList.add('hidden');
            }
        } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
            btnCustomPlay.textContent = '▶ PLAY';
            badgeLiveStatus.textContent = '⏸ PAUSED';
        }
    }

    function onPlayerError(event) {
        console.error('[YouTube Player Error Code]:', event.data);
        if ((event.data === 150 || event.data === 153 || event.data === 101) && protocolWarning) {
            protocolWarning.classList.remove('hidden');
        }
    }

    function muteYouTubeAudio() {
        if (player && typeof player.mute === 'function') player.mute();
        if (btnCustomMute) btnCustomMute.textContent = '🔇 UNMUTE';
    }

    function unmuteYouTubeAudio() {
        if (player && typeof player.unMute === 'function') player.unMute();
        if (btnCustomMute) btnCustomMute.textContent = '🔊 MUTE';
    }

    // Custom Player Controls Event Listeners
    if (btnCustomPlay) {
        btnCustomPlay.addEventListener('click', () => {
            if (!player || typeof player.getPlayerState !== 'function') return;
            const state = player.getPlayerState();
            if (state === YT.PlayerState.PLAYING) {
                player.pauseVideo();
            } else {
                player.playVideo();
            }
        });
    }

    if (btnCustomMute) {
        btnCustomMute.addEventListener('click', () => {
            if (!player || typeof player.isMuted !== 'function') return;
            if (player.isMuted()) {
                unmuteYouTubeAudio();
                if (autoplayBanner) autoplayBanner.classList.add('hidden');
            } else {
                muteYouTubeAudio();
            }
        });
    }

    if (btnUnmuteAutoplay) {
        btnUnmuteAutoplay.addEventListener('click', () => {
            unmuteYouTubeAudio();
            if (autoplayBanner) autoplayBanner.classList.add('hidden');
        });
    }

    if (inputCustomVolume) {
        inputCustomVolume.addEventListener('input', (e) => {
            const vol = parseInt(e.target.value, 10);
            if (player && typeof player.setVolume === 'function') {
                player.setVolume(vol);
            }
        });
    }

    // Fullscreen Toggle Handler (Includes Video Player + Control Bar + Subtitle Display Box)
    if (btnCustomFs) {
        btnCustomFs.addEventListener('click', () => {
            const container = document.querySelector('.app-container') || document.documentElement;
            const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);

            if (!isFs) {
                if (container.requestFullscreen) {
                    container.requestFullscreen().catch(err => console.warn(err));
                } else if (container.webkitRequestFullscreen) {
                    container.webkitRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen().catch(err => console.warn(err));
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
            }
        });
    }

    function updateFullscreenButtonIcon() {
        if (!btnCustomFs) return;
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        btnCustomFs.textContent = isFs ? '🗗' : '⛶';
        btnCustomFs.title = isFs ? 'Exit Fullscreen' : 'Toggle Fullscreen';
    }

    document.addEventListener('fullscreenchange', updateFullscreenButtonIcon);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButtonIcon);

    // ==============================================================================
    // 6. Supabase Init & Dual-Fetch Sync Engine (Sibling Captions Object)
    // ==============================================================================
    async function initSupabase() {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.warn('[Supabase] Missing credentials URL or Anon Key.');
            return;
        }

        try {
            console.log('[Supabase] Initializing client for broadcast:', resolvedBroadcastId);
            const { createClient } = window.supabase;
            supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

            await fetchHistoricCaptions();

            if (realtimeChannel) {
                supabaseClient.removeChannel(realtimeChannel);
            }

            realtimeChannel = supabaseClient
                .channel(`public:captions:${resolvedBroadcastId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'captions',
                    filter: `broadcast_id=eq.${resolvedBroadcastId}`
                }, (payload) => {
                    handleNewCaption(payload.new);
                })
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'captions',
                    filter: `broadcast_id=eq.${resolvedBroadcastId}`
                }, (payload) => {
                    handleNewCaption(payload.new);
                })
                .subscribe((status) => {
                    console.log('[Supabase Realtime Status]:', status);
                });

            if (heartbeatTimer) clearInterval(heartbeatTimer);
            sendHeartbeat();
            heartbeatTimer = setInterval(sendHeartbeat, 20000);

        } catch (err) {
            console.error('[Supabase Error]:', err);
        }
    }

    async function fetchHistoricCaptions() {
        if (!supabaseClient) return;

        try {
            console.log('[Dual-Fetch] Fetching historic captions for broadcast:', resolvedBroadcastId);
            const { data, error } = await supabaseClient
                .from('captions')
                .select('*')
                .eq('broadcast_id', resolvedBroadcastId)
                .order('start_seconds', { ascending: true });

            if (error) {
                console.warn('[Dual-Fetch Error]:', error.message);
                return;
            }

            if (data && data.length > 0) {
                inMemoryCaptions = data;
                console.log(`[Dual-Fetch Loaded]: ${inMemoryCaptions.length} historic caption rows.`);

                const lastRow = inMemoryCaptions[inMemoryCaptions.length - 1];
                if (lastRow.session_code) currentSessionCode = lastRow.session_code;
                if (lastRow.presentation_code) currentPresentationCode = lastRow.presentation_code;

                inMemoryCaptions.forEach(row => processLanguagesFromRecord(row));
                latestCaptionRecord = lastRow;
                renderActiveCaption();
            }
        } catch (e) {
            console.warn('[Dual-Fetch Exception]:', e);
        }
    }

    function processLanguagesFromRecord(record) {
        if (!record) return;

        // Primary: Sibling Captions JSON Map
        if (record.captions && typeof record.captions === 'object') {
            Object.keys(record.captions).forEach(langKey => {
                if (!availableLanguages.has(langKey)) {
                    availableLanguages.add(langKey);
                    addLanguageToDropdown(langKey);
                }
            });
        }

        // Fallback: Legacy translations JSON Map
        if (record.translations && typeof record.translations === 'object') {
            Object.keys(record.translations).forEach(langKey => {
                if (!availableLanguages.has(langKey)) {
                    availableLanguages.add(langKey);
                    addLanguageToDropdown(langKey);
                }
            });
        }
    }

    function handleNewCaption(record) {
        if (!record) return;

        const existingIndex = inMemoryCaptions.findIndex(item => item.id === record.id);
        if (existingIndex >= 0) {
            inMemoryCaptions[existingIndex] = record;
        } else {
            inMemoryCaptions.push(record);
            inMemoryCaptions.sort((a, b) => (a.start_seconds || 0) - (b.start_seconds || 0));
        }

        if (record.session_code) currentSessionCode = record.session_code;
        if (record.presentation_code) currentPresentationCode = record.presentation_code;

        processLanguagesFromRecord(record);
        latestCaptionRecord = record;
        renderActiveCaption();
    }

    function addLanguageToDropdown(langName) {
        if (!selectLanguage) return;
        const exists = Array.from(selectLanguage.options).some(opt => opt.value === langName);
        if (!exists) {
            const option = document.createElement('option');
            option.value = langName;
            option.textContent = `${getFlagIcon(langName)} ${langName}`;
            selectLanguage.appendChild(option);
        }
    }

    // ==============================================================================
    // 7. Timecode Playback Matching Loop & Scrubbing Engine
    // ==============================================================================
    function tickSubtitleSync() {
        if (!player || typeof player.getCurrentTime !== 'function') return;

        const rawTime = player.getCurrentTime() || 0;

        if (displayPlayerTime) {
            const mins = Math.floor(rawTime / 60);
            const secs = Math.floor(rawTime % 60);
            displayPlayerTime.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }

        if (inMemoryCaptions.length === 0) {
            renderActiveCaption();
            return;
        }

        let matchedRecord = null;

        for (let i = inMemoryCaptions.length - 1; i >= 0; i--) {
            const item = inMemoryCaptions[i];
            const start = item.start_seconds || 0;
            const end = item.end_seconds || (start + 7.5);

            if (rawTime >= start && rawTime <= end) {
                matchedRecord = item;
                break;
            }
        }

        if (!matchedRecord) {
            const latest = inMemoryCaptions[inMemoryCaptions.length - 1];
            const start = latest.start_seconds || 0;
            if (rawTime >= start && rawTime <= start + 10.0) {
                matchedRecord = latest;
            }
        }

        if (matchedRecord !== latestCaptionRecord) {
            latestCaptionRecord = matchedRecord;
            renderActiveCaption();
        }
    }

    // ==============================================================================
    // 8. Subtitle Render Engine (Sibling Captions Support)
    // ==============================================================================
    function renderActiveCaption() {
        if (!subtitleBox || !subtitleText) return;

        if (!isSubtitlesEnabled) {
            subtitleBox.classList.add('hidden');
            subtitleText.textContent = '';
            if (infoTag) infoTag.className = 'info-tag hidden';
            if (waitingTag) waitingTag.className = 'waiting-tag hidden';
            return;
        }

        subtitleBox.classList.remove('hidden');

        if (!latestCaptionRecord) {
            subtitleText.textContent = '';
            if (infoTag) {
                infoTag.className = 'info-tag badge-original';
                infoTag.textContent = 'Original';
            }
            if (waitingTag) {
                waitingTag.className = 'waiting-tag';
                waitingTag.textContent = '⏳ Waiting ...';
            }
            return;
        }

        const captionsMap = latestCaptionRecord.captions || {};

        // Determine if selectedLanguage matches broadcast source speech language
        let sourceLangKey = null;
        for (const [langKey, obj] of Object.entries(captionsMap)) {
            if (obj && obj.sourceLanguage === true) {
                sourceLangKey = langKey;
                break;
            }
        }

        if (!sourceLangKey && latestCaptionRecord.source_language) {
            sourceLangKey = latestCaptionRecord.source_language;
        }

        const isOriginal = sourceLangKey ? (selectedLanguage.toLowerCase() === sourceLangKey.toLowerCase()) : (selectedLanguage.toLowerCase() === 'spanish');

        // Status badge
        if (infoTag) {
            infoTag.className = isOriginal ? 'info-tag badge-original' : 'info-tag badge-translated';
            infoTag.textContent = isOriginal ? 'Original' : 'Translated';
        }

        const captionObj = captionsMap[selectedLanguage];
        let displayText = '';

        if (captionObj && captionObj.text && captionObj.text.trim().length > 0) {
            displayText = captionObj.text.trim();
            if (waitingTag) waitingTag.className = 'waiting-tag hidden';
        } else if (latestCaptionRecord.original_text && isOriginal) {
            displayText = latestCaptionRecord.original_text.trim();
            if (waitingTag) waitingTag.className = 'waiting-tag hidden';
        } else {
            // Strict Rule: Never transition/fallback to original text when selected language is missing
            displayText = '';
            if (waitingTag) {
                waitingTag.className = 'waiting-tag';
                waitingTag.textContent = '⏳ Waiting ...';
            }
        }

        subtitleText.textContent = displayText.toUpperCase();

        if (ttsEnabled && displayText) {
            speakText(displayText, selectedLanguage);
        }
    }

    // ==============================================================================
    // 9. Web Speech Synthesis (TTS) Engine
    // ==============================================================================
    function speakText(text, languageName) {
        if (!('speechSynthesis' in window)) return;

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        
        let langCode = 'es-ES';
        const lang = (languageName || '').toLowerCase();
        if (lang.includes('english')) langCode = 'en-US';
        else if (lang.includes('spanish')) langCode = 'es-ES';
        else if (lang.includes('french')) langCode = 'fr-FR';
        else if (lang.includes('german')) langCode = 'de-DE';
        else if (lang.includes('italian')) langCode = 'it-IT';
        else if (lang.includes('portuguese')) langCode = 'pt-PT';

        utterance.lang = langCode;
        utterance.rate = 1.0;

        window.speechSynthesis.speak(utterance);
    }

    // ==============================================================================
    // 10. Telemetry Heartbeat RPC (`ping_viewer_session`)
    // ==============================================================================
    async function sendHeartbeat() {
        if (!supabaseClient) return;

        try {
            const { data, error } = await supabaseClient.rpc('ping_viewer_session', {
                p_viewer_session_id: viewerSessionId,
                p_broadcast_id: resolvedBroadcastId,
                p_session_code: currentSessionCode,
                p_presentation_code: currentPresentationCode,
                p_mode: 'live',
                p_selected_language: selectedLanguage,
                p_user_agent: navigator.userAgent
            });

            if (error) {
                console.warn('[Telemetry Heartbeat Error]:', error.message);
            } else if (data && !viewerSessionId) {
                viewerSessionId = data;
                localStorage.setItem('ls_viewer_session_id', viewerSessionId);
                console.log('[Telemetry Registered Viewer Session ID]:', viewerSessionId);
            }
        } catch (err) {
            console.warn('[Telemetry Heartbeat Exception]:', err);
        }
    }

    // ==============================================================================
    // 11. Event Controls Listener Setup
    // ==============================================================================
    function setupEventListeners() {
        if (btnToggleSubtitles) {
            btnToggleSubtitles.addEventListener('click', () => {
                isSubtitlesEnabled = !isSubtitlesEnabled;
                btnToggleSubtitles.classList.toggle('active', isSubtitlesEnabled);
                if (subtitlesStateText) subtitlesStateText.textContent = isSubtitlesEnabled ? 'ON' : 'OFF';
                renderActiveCaption();
                sendHeartbeat();
            });
        }

        if (selectLanguage) {
            selectLanguage.addEventListener('change', (e) => {
                selectedLanguage = e.target.value;
                console.log('[Language Selector] Changed target language to:', selectedLanguage);
                renderActiveCaption();
                sendHeartbeat();
            });
        }

        if (btnTts) {
            btnTts.addEventListener('click', () => {
                ttsEnabled = !ttsEnabled;
                btnTts.classList.toggle('active', ttsEnabled);
                if (ttsStateText) ttsStateText.textContent = ttsEnabled ? 'ON' : 'OFF';

                if (ttsEnabled) {
                    muteYouTubeAudio();
                    renderActiveCaption();
                } else {
                    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                    unmuteYouTubeAudio();
                }
            });
        }
    }

    // Initialize application on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        loadConfigAndInit();
    });
})();
