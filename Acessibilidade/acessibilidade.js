// --- Accessibility Features ---
        const accessibilityBtn = document.getElementById('accessibilityBtn');
        const accessibilityPanel = document.getElementById('accessibilityPanel');
        const mainContentContainer = document.getElementById('content-container');

        const increaseFontBtn = document.getElementById('increaseFontBtn');
        const decreaseFontBtn = document.getElementById('decreaseFontBtn');
        const resetFontBtn = document.getElementById('resetFontBtn');

        const defaultContrastBtn = document.getElementById('defaultContrastBtn');
        const bwContrastBtn = document.getElementById('bwContrastBtn');
        const ybContrastBtn = document.getElementById('ybContrastBtn');

        const playTTSBtn = document.getElementById('playTTSBtn');
        const pauseTTSBtn = document.getElementById('pauseTTSBtn');
        const stopTTSBtn = document.getElementById('stopTTSBtn');
        const ttsVoiceSelect = document.getElementById('ttsVoiceSelect');
        const ttsRateRange = document.getElementById('ttsRateRange');
        const ttsRateValue = document.getElementById('ttsRateValue');
        const ttsPitchRange = document.getElementById('ttsPitchRange');
        const ttsPitchValue = document.getElementById('ttsPitchValue');


        let currentFontSizeMultiplier = 1;
        const FONT_SIZE_STEP_ACC = 0.1;
        const MIN_FONT_MULTIPLIER_ACC = 0.7;
        const MAX_FONT_MULTIPLIER_ACC = 1.8;
        let originalFontSizesMap = new Map();

        if (accessibilityBtn && accessibilityPanel) {
            accessibilityBtn.addEventListener('click', () => {
                accessibilityPanel.classList.toggle('active');
                accessibilityPanel.classList.toggle('hidden');
            });
        }

        function storeOriginalFontSizesAcc() {
            if (originalFontSizesMap.size === 0 && mainContentContainer) {
                mainContentContainer.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, a, span:not([class*="icon"])').forEach((el, index) => {
                    const computedStyle = window.getComputedStyle(el);
                    const elId = el.dataset.accId || `acc-el-${index}`;
                    el.dataset.accId = elId;
                    originalFontSizesMap.set(elId, parseFloat(computedStyle.fontSize));
                });
            }
        }

        function updateFontSizesAcc(multiplier) {
            if (!mainContentContainer) return;
            storeOriginalFontSizesAcc();

            currentFontSizeMultiplier = Math.max(MIN_FONT_MULTIPLIER_ACC, Math.min(multiplier, MAX_FONT_MULTIPLIER_ACC));

            mainContentContainer.querySelectorAll('[data-acc-id]').forEach(el => {
                const originalSize = originalFontSizesMap.get(el.dataset.accId);
                if (originalSize) {
                    el.style.fontSize = (originalSize * currentFontSizeMultiplier) + 'px';
                }
            });

            mainContentContainer.querySelectorAll('p, li').forEach(el => {
                const currentElementFontSize = parseFloat(el.style.fontSize || window.getComputedStyle(el).fontSize);
                let newLineHeight = originalFontSizesMap.get(el.dataset.accId) * 1.7;
                if (currentFontSizeMultiplier !== 1) {
                    newLineHeight = (originalFontSizesMap.get(el.dataset.accId) * 1.7 * currentFontSizeMultiplier * 0.9);
                }
                el.style.lineHeight = Math.max(originalFontSizesMap.get(el.dataset.accId) * 1.5, newLineHeight) + 'px';
            });
        }


        if (increaseFontBtn) {
            increaseFontBtn.addEventListener('click', () => {
                updateFontSizesAcc(currentFontSizeMultiplier + FONT_SIZE_STEP_ACC);
            });
        }
        if (decreaseFontBtn) {
            decreaseFontBtn.addEventListener('click', () => {
                updateFontSizesAcc(currentFontSizeMultiplier - FONT_SIZE_STEP_ACC);
            });
        }
        if (resetFontBtn) {
            resetFontBtn.addEventListener('click', () => {
                currentFontSizeMultiplier = 1;
                mainContentContainer.querySelectorAll('[data-acc-id]').forEach(el => {
                    const originalSize = originalFontSizesMap.get(el.dataset.accId);
                    if (originalSize) {
                        el.style.fontSize = originalSize + 'px';
                        if (el.tagName === 'P' || el.tagName === 'LI') {
                           el.style.lineHeight = (originalSize * 1.7) + 'px';
                        }
                    } else {
                           el.style.fontSize = '';
                           if (el.tagName === 'P' || el.tagName === 'LI') {
                                el.style.lineHeight = '';
                           }
                    }
                });
            });
        }

        function applyContrast(themeClass) {
            document.body.classList.remove('contrast-default', 'contrast-bw', 'contrast-yb');
            if (themeClass !== 'contrast-default') {
                document.body.classList.add(themeClass);
            }
        }
        if (defaultContrastBtn) defaultContrastBtn.addEventListener('click', () => applyContrast('contrast-default'));
        if (bwContrastBtn) bwContrastBtn.addEventListener('click', () => applyContrast('contrast-bw'));
        if (ybContrastBtn) ybContrastBtn.addEventListener('click', () => applyContrast('contrast-yb'));

        let speechSynth = window.speechSynthesis;
        let currentUtterance = null;
        let elementsToRead = [];
        let currentElementIndex = 0;
        let isReadingPaused = false;
        let availableVoices = [];

        function populateVoiceList() {
            if(typeof speechSynthesis === 'undefined' || !ttsVoiceSelect) {
                return;
            }
            availableVoices = speechSynth.getVoices();
            ttsVoiceSelect.innerHTML = '';

            if (availableVoices.length === 0) {
                   ttsVoiceSelect.innerHTML = '<option value="">Nenhuma voz disponível</option>';
                   ttsVoiceSelect.disabled = true;
                   return;
            }

            let hasPortugueseVoice = false;
            availableVoices.forEach(voice => {
                if (voice.lang.startsWith('pt')) {
                    const option = document.createElement('option');
                    option.textContent = `${voice.name} (${voice.lang})`;
                    option.setAttribute('data-lang', voice.lang);
                    option.setAttribute('data-name', voice.name);
                    ttsVoiceSelect.appendChild(option);
                    hasPortugueseVoice = true;
                }
            });

            if (!hasPortugueseVoice) {
                   availableVoices.forEach(voice => {
                    const option = document.createElement('option');
                    option.textContent = `${voice.name} (${voice.lang})`;
                    option.setAttribute('data-lang', voice.lang);
                    option.setAttribute('data-name', voice.name);
                    ttsVoiceSelect.appendChild(option);
                });
            }
            ttsVoiceSelect.disabled = false;
        }

        populateVoiceList();
        if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = populateVoiceList;
        }


        function prepareTextToRead() {
            if (!mainContentContainer) return '';
            let textSegments = [];
            mainContentContainer.querySelectorAll('section.mb-10, section.p-6.bg-white').forEach(section => {
                const titleElement = section.querySelector('h1, h2');
                if (titleElement && titleElement.textContent.trim().length > 0) {
                    textSegments.push(titleElement.textContent.trim() + ".");
                }
                section.querySelectorAll('p, h3, h4, li').forEach(el => {
                    if (el.closest('.mt-8.p-6.border.border-violet-300') || el.closest('ul.list-disc')) {
                        if (el.tagName.toLowerCase() === 'li' && el.closest('ul.list-disc')) {
                               const link = el.querySelector('a');
                               if (link && link.textContent.trim().length > 0) {
                                   textSegments.push(link.textContent.trim() + ", link.");
                               } else if (el.textContent.trim().length > 0) {
                                   textSegments.push(el.textContent.trim() + ".");
                               }
                        }
                        return;
                    }
                    if (el.textContent.trim().length > 0) {
                        textSegments.push(el.textContent.trim().replace(/\s+/g, ' ') + ".");
                    }
                });
            });
            return textSegments.join(' \n ');
        }

        function speakNextSegment() {
            if (currentElementIndex >= elementsToRead.length || !speechSynth) {
                playTTSBtn.disabled = false;
                pauseTTSBtn.disabled = true;
                stopTTSBtn.disabled = true;
                currentElementIndex = 0;
                currentUtterance = null;
                elementsToRead = [];
                return;
            }
            if (speechSynth.paused && isReadingPaused) { return; }
            if (speechSynth.speaking && !isReadingPaused) { return; }

            currentUtterance = new SpeechSynthesisUtterance(elementsToRead[currentElementIndex]);
            currentUtterance.lang = 'pt-BR';
            currentUtterance.rate = parseFloat(ttsRateRange.value) || 1;
            currentUtterance.pitch = parseFloat(ttsPitchRange.value) || 1;

            const selectedVoiceName = ttsVoiceSelect.selectedOptions[0]?.getAttribute('data-name');
            if (selectedVoiceName) {
                const voice = availableVoices.find(v => v.name === selectedVoiceName);
                if (voice) currentUtterance.voice = voice;
            } else {
                const portugueseVoice = availableVoices.find(v => v.lang.startsWith('pt-BR') || v.lang.startsWith('pt-PT'));
                if(portugueseVoice) currentUtterance.voice = portugueseVoice;
            }


            currentUtterance.onend = () => {
                if (elementsToRead.length === 0) return;

                if (currentElementIndex < elementsToRead.length - 1) {
                    currentElementIndex++;
                    speakNextSegment();
                } else {
                    playTTSBtn.disabled = false;
                    pauseTTSBtn.disabled = true;
                    stopTTSBtn.disabled = true;
                    currentElementIndex = 0;
                    currentUtterance = null;
                    elementsToRead = [];
                }
            };
            currentUtterance.onerror = (event) => {
                console.error('Erro na síntese de voz:', event.error);
                isReadingPaused = false;
                currentElementIndex = 0;
                elementsToRead = [];
                currentUtterance = null;
                if (speechSynth) { speechSynth.cancel(); }
                playTTSBtn.disabled = false;
                pauseTTSBtn.disabled = true;
                stopTTSBtn.disabled = true;
            };
            speechSynth.speak(currentUtterance);
            playTTSBtn.disabled = true;
            pauseTTSBtn.disabled = false;
            stopTTSBtn.disabled = false;
            isReadingPaused = false;
        }

        if (playTTSBtn) {
            playTTSBtn.addEventListener('click', () => {
                if (!speechSynth) {
                    // Using custom modal instead of alert
                    showGeminiModal("Erro", "<p>A síntese de voz não é suportada neste navegador.</p>");
                    return;
                }
                if (speechSynth.paused && currentUtterance && isReadingPaused) {
                    speechSynth.resume();
                    isReadingPaused = false;
                    playTTSBtn.disabled = true;
                    pauseTTSBtn.disabled = false;
                    stopTTSBtn.disabled = false;
                } else {
                    speechSynth.cancel();
                    currentUtterance = null;
                    isReadingPaused = false;
                    elementsToRead = [];
                    currentElementIndex = 0;

                    const fullText = prepareTextToRead();
                    elementsToRead = fullText.split('. ')
                                            .map(s => s.trim())
                                            .filter(segment => segment.length > 0)
                                            .map(s => s.endsWith('.') ? s : s + '.');

                    if (elementsToRead.length > 0) {
                        speakNextSegment();
                    } else {
                        showGeminiModal("Informação", "<p>Não há conteúdo textual para ler na página.</p>");
                        playTTSBtn.disabled = false;
                        pauseTTSBtn.disabled = true;
                        stopTTSBtn.disabled = true;
                    }
                }
            });
        }

        if (pauseTTSBtn) {
            pauseTTSBtn.addEventListener('click', () => {
                if (speechSynth && speechSynth.speaking && !speechSynth.paused) {
                    speechSynth.pause();
                    isReadingPaused = true;
                    playTTSBtn.disabled = false;
                    pauseTTSBtn.disabled = true;
                }
            });
            pauseTTSBtn.disabled = true;
        }

        if (stopTTSBtn) {
            stopTTSBtn.addEventListener('click', () => {
                isReadingPaused = false;
                currentElementIndex = 0;
                elementsToRead = [];
                currentUtterance = null;
                if (speechSynth) { speechSynth.cancel(); }
                playTTSBtn.disabled = false;
                pauseTTSBtn.disabled = true;
                stopTTSBtn.disabled = true;
            });
            stopTTSBtn.disabled = true;
        }

        if (ttsRateRange && ttsRateValue) {
            ttsRateRange.addEventListener('input', () => {
                ttsRateValue.textContent = ttsRateRange.value;
                if (currentUtterance && speechSynth.speaking && !speechSynth.paused) {
                    speechSynth.cancel();
                    currentUtterance.rate = parseFloat(ttsRateRange.value);
                    speechSynth.speak(currentUtterance);
                } else if (currentUtterance && speechSynth.paused && isReadingPaused) {
                    currentUtterance.rate = parseFloat(ttsRateRange.value);
                }
            });
        }
        if (ttsPitchRange && ttsPitchValue) {
            ttsPitchRange.addEventListener('input', () => {
                ttsPitchValue.textContent = ttsPitchRange.value;
                if (currentUtterance && speechSynth.speaking && !speechSynth.paused) {
                    speechSynth.cancel();
                    currentUtterance.pitch = parseFloat(ttsPitchRange.value);
                    speechSynth.speak(currentUtterance);
                } else if (currentUtterance && speechSynth.paused && isReadingPaused) {
                    currentUtterance.pitch = parseFloat(ttsPitchRange.value);
                }
            });
        }


        window.addEventListener('load', storeOriginalFontSizesAcc);

    