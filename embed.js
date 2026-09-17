/**
 * LiveSpeech MLX TX - Embedded Web Client Helper Script
 * Automatic container discovery, isolated iFrame injection, theme parameter passing & MutationObserver.
 */
(function() {
    'use strict';

    // Determine base URL from embed.js script source location
    function getBaseUrl() {
        if (document.currentScript && document.currentScript.src) {
            const src = document.currentScript.src;
            return src.substring(0, src.lastIndexOf('/'));
        }
        return '.';
    }

    const baseUrl = getBaseUrl();

    function initEmbeds() {
        const containers = document.querySelectorAll('[data-broadcast-id], [data-session], .livespeech-embed');
        
        containers.forEach(function(container) {
            if (container.getAttribute('data-ls-embedded') === 'true') {
                return; // Already initialized
            }

            const broadcastId = container.getAttribute('data-broadcast-id') || container.getAttribute('data-session') || '';
            const theme = container.getAttribute('data-theme') || 'dark';

            if (!broadcastId) {
                console.warn('[LiveSpeech Embed] Container missing data-broadcast-id attribute:', container);
                return;
            }

            container.setAttribute('data-ls-embedded', 'true');

            // Set default styling on container if not explicitly styled
            if (!container.style.height && !container.classList.contains('custom-height')) {
                container.style.height = '650px';
            }
            container.style.width = container.style.width || '100%';
            container.style.position = 'relative';
            container.style.overflow = 'hidden';

            // Create isolated iFrame
            const iframe = document.createElement('iframe');
            const targetUrl = `${baseUrl}/Client/index.html?session=${encodeURIComponent(broadcastId)}&theme=${encodeURIComponent(theme)}`;
            
            iframe.src = targetUrl;
            iframe.style.cssText = 'width: 100%; height: 100%; border: none; overflow: hidden; display: block;';
            iframe.allow = 'autoplay; encrypted-media; fullscreen';
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.title = `LiveSpeech Player - ${broadcastId}`;

            // Clear container loading placeholder if any, then append iframe
            container.innerHTML = '';
            container.appendChild(iframe);
        });
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEmbeds);
    } else {
        initEmbeds();
    }

    // Watch for dynamically added embed containers (MutationObserver)
    if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(function(mutations) {
            let shouldInit = false;
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                    shouldInit = true;
                }
            });
            if (shouldInit) {
                initEmbeds();
            }
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
    }
})();
