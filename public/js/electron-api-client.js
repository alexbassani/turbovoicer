/**
 * 📡 TurboVoicer Electron API Client (iframe-bridge)
 * 
 * Este arquivo detecta automaticamente se está em iframe ou standalone
 * e cria um proxy de window.electronAPI adequado para cada contexto.
 * 
 * ✅ FUNCIONAMENTO:
 * - Standalone: usa window.electronAPI real (preload.js)
 * - Iframe: usa postMessage para comunicar com launcher via iframe-bridge
 */

(function() {
    'use strict';

    const isInIframe = window.self !== window.top;
    const APP_ID = 'turbovoicer';

    console.log('[TurboVoicer API Client] Inicializando...');
    console.log('[TurboVoicer API Client] Em iframe?', isInIframe);

    if (isInIframe) {
        console.log('[TurboVoicer API Client] 🔗 Modo IFRAME: criando proxy via postMessage');
        
        let requestId = 0;
        const pendingRequests = new Map();
        const eventListeners = new Map();

        // Escutar respostas do launcher
        window.addEventListener('message', (event) => {
            const data = event.data;
            
            // Resposta de método invocado
            if (data && data.type === 'ELECTRON_API_RESPONSE') {
                console.log('[TurboVoicer API Client] Resposta recebida:', data.id, 'success:', data.success, 'result:', data.result);
                const callback = pendingRequests.get(data.id);
                if (callback) {
                    if (data.success) {
                        console.log('[TurboVoicer API Client] Resolvendo promise para id:', data.id);
                        callback.resolve(data.result);
                    } else {
                        console.log('[TurboVoicer API Client] Rejeitando promise para id:', data.id, 'erro:', data.error);
                        callback.reject(new Error(data.error || 'Erro desconhecido'));
                    }
                    pendingRequests.delete(data.id);
                } else {
                    console.warn('[TurboVoicer API Client] Resposta recebida mas nenhum callback encontrado para id:', data.id);
                }
            }
            
            // Evento emitido pelo backend (formato genérico)
            if (data && data.type === 'ELECTRON_API_EVENT') {
                const listeners = eventListeners.get(data.eventName);
                if (listeners) {
                    listeners.forEach(listener => listener(data.data));
                }
            }
            
            // Eventos específicos do TurboVoicer (padrão da branch feature/turbovoicer)
            if (data && (data.type === 'turbovoicer:installProgress' || data.eventName === 'onTurboVoicerInstallProgress')) {
                console.log('[TurboVoicer API Client] 🎯 Evento de progresso de instalação recebido:', data);
                const progressData = data.data || data;
                const listeners = eventListeners.get('turbovoicer:installProgress');
                console.log('[TurboVoicer API Client] Listeners registrados:', listeners ? listeners.length : 0);
                if (listeners) {
                    console.log('[TurboVoicer API Client] Disparando callbacks...');
                    listeners.forEach(listener => {
                        console.log('[TurboVoicer API Client] Chamando listener com:', progressData);
                        listener(progressData);
                    });
                } else {
                    console.warn('[TurboVoicer API Client] ⚠️ Nenhum listener registrado para turbovoicer:installProgress!');
                }
            }
            
            if (data && (data.type === 'turbovoicer:downloadProgress' || data.eventName === 'onTurboVoicerDownloadProgress')) {
                console.log('[TurboVoicer API Client] Evento de progresso de download recebido:', data);
                const progressData = data.data || data;
                const listeners = eventListeners.get('turbovoicer:downloadProgress');
                if (listeners) {
                    listeners.forEach(listener => listener(progressData));
                }
            }
            
            if (data && (data.type === 'turbovoicer:generationProgress' || data.eventName === 'onTurboVoicerGenerationProgress')) {
                console.log('[TurboVoicer API Client] Evento de progresso de geração recebido:', data);
                const progressData = data.data || data;
                const listeners = eventListeners.get('turbovoicer:generationProgress');
                if (listeners) {
                    listeners.forEach(listener => listener(progressData));
                }
            }
            
            if (data && (data.type === 'turbovoicer:batchProgress' || data.eventName === 'onTurboVoicerBatchProgress')) {
                console.log('[TurboVoicer API Client] Evento de progresso de lote recebido:', data);
                const progressData = data.data || data;
                const listeners = eventListeners.get('turbovoicer:batchProgress');
                if (listeners) {
                    console.log('[TurboVoicer API Client] Disparando callbacks para', listeners.length, 'listeners');
                    listeners.forEach(listener => listener(progressData));
                } else {
                    console.warn('[TurboVoicer API Client] ⚠️ Nenhum listener registrado para turbovoicer:batchProgress!');
                }
            }
        });

        // Invocar métodos via postMessage
        function invokeMethod(method, ...args) {
            return new Promise((resolve, reject) => {
                const id = ++requestId;
                pendingRequests.set(id, { resolve, reject });
                
                window.parent.postMessage({
                    type: 'ELECTRON_API_CALL',
                    id: id,
                    method: method,
                    args: args
                }, '*');
                
                console.log('[TurboVoicer API Client] Chamando método:', method, 'id:', id);
                
                // Timeout baseado no tipo de operação
                let timeoutDuration;
                const isDialogMethod = method.includes('select') || method.includes('open') || method.includes('Open');
                
                if (method.includes('InstallDependencies') || method.includes('installDependencies')) {
                    // Instalação de dependências: PyTorch pode levar 20-30 minutos
                    timeoutDuration = 1800000; // 30 minutos
                } else if (method.includes('ReinstallRVCEngine') || method.includes('reinstallRVCEngine')) {
                    // Reinstalação do motor RVC: download + extração + configuração
                    timeoutDuration = 1200000; // 20 minutos
                } else if (method.includes('GenerateAudio') || method.includes('generateAudio')) {
                    // Geração de áudio: SEM TIMEOUT
                    // CPU pode levar 2.5x o tempo do áudio (10min áudio = 25min processamento)
                    // Filas grandes podem levar horas (20 áudios de 10min = ~8 horas)
                    timeoutDuration = null; // SEM TIMEOUT - processamento pode levar horas
                } else if (method.includes('GeneratePreview') || method.includes('generatePreview')) {
                    // Preview de voz: TTS + RVC pode levar tempo em CPU
                    timeoutDuration = 600000; // 10 minutos (preview geralmente é curto)
                } else if (method.includes('install') || method.includes('download') || method.includes('generate')) {
                    timeoutDuration = 300000; // 5 minutos para dialogs
                } else if (method.includes('ServerRunning') || method.includes('ServerStatus')) {
                    timeoutDuration = 180000; // 3 minutos para servidor RVC
                } else {
                    timeoutDuration = 30000; // 30 segundos padrão
                }
                
                console.log('[TurboVoicer API Client] Timeout configurado:', timeoutDuration, 'ms para método:', method);
                
                // Aplicar timeout apenas se definido (null = sem timeout)
                if (timeoutDuration !== null) {
                    setTimeout(() => {
                        if (pendingRequests.has(id)) {
                            pendingRequests.delete(id);
                            reject(new Error(`Timeout ao invocar ${method}`));
                        }
                    }, timeoutDuration);
                } else {
                    console.log('[TurboVoicer API Client] SEM TIMEOUT - processamento pode levar horas');
                }
            });
        }

        // Registrar listener de evento
        function registerEventListener(eventName, callback) {
            if (!eventListeners.has(eventName)) {
                eventListeners.set(eventName, []);
            }
            eventListeners.get(eventName).push(callback);
            
            return () => {
                const listeners = eventListeners.get(eventName);
                if (listeners) {
                    const index = listeners.indexOf(callback);
                    if (index > -1) {
                        listeners.splice(index, 1);
                    }
                }
            };
        }

        // Criar proxy da API do Electron
        window.electronAPI = {
            // === INSTALAÇÃO ===
            checkInstallation: () => invokeMethod('turboVoicerCheckInstallation'),
            detectHardware: () => invokeMethod('turboVoicerDetectHardware'),
            installDependencies: (options) => invokeMethod('turboVoicerInstallDependencies', options),
            cancelInstallation: () => invokeMethod('turboVoicerCancelInstallation'),
            onInstallProgress: (callback) => registerEventListener('turbovoicer:installProgress', callback),
            
            // === SERVIDOR RVC ===
            ensureServerRunning: () => invokeMethod('turboVoicerEnsureServerRunning'),
            checkServerStatus: () => invokeMethod('turboVoicerCheckServerStatus'),
            
            // === HARDWARE DETECTION ===
            getRVCConfig: (userOverride) => invokeMethod('turboVoicerGetRVCConfig', userOverride),
            validateTextLength: (textLength) => invokeMethod('turboVoicerValidateTextLength', textLength),
            
            // === GERENCIAMENTO DE VOZES ===
            loadCatalog: () => invokeMethod('turboVoicerLoadCatalog'),
            getInstalledVoices: () => invokeMethod('turboVoicerGetInstalledVoices'),
            downloadVoice: (voiceData) => invokeMethod('turboVoicerDownloadVoice', voiceData),
            importCustomVoice: (zipPath, voiceName) => invokeMethod('turboVoicerImportCustomVoice', zipPath, voiceName),
            deleteVoice: (voicePath) => invokeMethod('turboVoicerDeleteVoice', voicePath),
            onDownloadProgress: (callback) => registerEventListener('turbovoicer:downloadProgress', callback),
            
            // === GERAÇÃO DE ÁUDIO ===
            generateAudio: (config) => invokeMethod('turboVoicerGenerateAudio', config),
            cancelGeneration: () => invokeMethod('turboVoicerCancelGeneration'),
            onGenerationProgress: (callback) => registerEventListener('turbovoicer:generationProgress', callback),
            
            // === PREVIEW SYSTEM ===
            turboVoicerGenerateEdgeTTS: (config) => invokeMethod('turboVoicerGenerateEdgeTTS', config),
            turboVoicerGeneratePreview: (config) => invokeMethod('turboVoicerGeneratePreview', config, 120000), // 2 minutos para RVC
            turboVoicerCheckPreviewCache: (configHash) => invokeMethod('turboVoicerCheckPreviewCache', configHash),
            turboVoicerClearPreviewCache: () => invokeMethod('turboVoicerClearPreviewCache'), // Cache antigo (deprecated)
            turboVoicerClearCache: () => invokeMethod('turboVoicerClearCache'), // Cache inteligente (novo)
            turboVoicerGetCacheStatus: () => invokeMethod('turboVoicerGetCacheStatus'),
            
            // === PRESET SYSTEM ===
            turboVoicerSavePreset: (preset) => invokeMethod('turboVoicerSavePreset', preset),
            turboVoicerLoadPresets: () => invokeMethod('turboVoicerLoadPresets'),
            turboVoicerDeletePreset: (presetId) => invokeMethod('turboVoicerDeletePreset', presetId),
            turboVoicerExportPreset: (preset) => invokeMethod('turboVoicerExportPreset', preset),
            turboVoicerImportPreset: () => invokeMethod('turboVoicerImportPreset'),
            turboVoicerExportAllPresets: (presets) => invokeMethod('turboVoicerExportAllPresets', presets),
            
            // === GRAVAÇÃO E IMPORTAÇÃO ===
            selectFolder: () => invokeMethod('turboVoicerSelectFolder'),
            saveRecording: (config) => invokeMethod('turboVoicerSaveRecording', config),
            selectAudioFile: () => invokeMethod('turboVoicerSelectAudioFile'),
            selectAudioFolder: () => invokeMethod('turboVoicerSelectAudioFolder'),
            convertAudioBatch: (config) => invokeMethod('turboVoicerConvertAudioBatch', config),
            onBatchProgress: (callback) => registerEventListener('turbovoicer:batchProgress', callback),
            
            // === UTILITÁRIOS ===
            testAzureTTS: (text, voice) => invokeMethod('turboVoicerTestAzureTTS', text, voice),
            testRVCConversion: (audioPath, modelPath) => invokeMethod('turboVoicerTestRVCConversion', audioPath, modelPath),
            turboVoicerReinstallRVCEngine: () => invokeMethod('turboVoicerReinstallRVCEngine'),
            
            // === GPU MANAGER (v2.0.8) ===
            turboVoicerDisableGPU: (gpuName) => invokeMethod('turboVoicerDisableGPU', gpuName),
            turboVoicerEnableGPU: () => invokeMethod('turboVoicerEnableGPU'),
            turboVoicerGetGPUStatus: () => invokeMethod('turboVoicerGetGPUStatus'),
            
            // === VOZES PREMIUM ===
            turboVoicerCheckPremiumStatus: () => invokeMethod('turboVoicerCheckPremiumStatus'),
            turboVoicerAuthenticatePremium: (username, password) => invokeMethod('turboVoicerAuthenticatePremium', username, password),
            turboVoicerGetStarterVoices: () => invokeMethod('turboVoicerGetStarterVoices'),
            turboVoicerGetPremiumVoices: () => invokeMethod('turboVoicerGetPremiumVoices'),
            turboVoicerGetAllVoices: () => invokeMethod('turboVoicerGetAllVoices'),
            turboVoicerGetVoicesByCategory: () => invokeMethod('turboVoicerGetVoicesByCategory'),
            
            // === MÉTODOS BÁSICOS ===
            selectFolder: () => invokeMethod('selectFolder'),
            selectFiles: (options) => invokeMethod('selectFiles', options),
            readFile: (filePath) => invokeMethod('readFile', filePath),
            writeFile: (filePath, content) => invokeMethod('writeFile', filePath, content),
            fileExists: (filePath) => invokeMethod('fileExists', filePath),
            openPath: (path) => invokeMethod('openPath', path),
            playSound: (soundName) => invokeMethod('playSound', soundName)
        };

        console.log('[TurboVoicer API Client] ✅ Proxy criado via postMessage');
    } else {
        console.log('[TurboVoicer API Client] 🪟 Modo STANDALONE: usando window.electronAPI nativo');
    }
})();
