// CONTEÚDO DE: apps/turbovoicer/src/preload.js
// TurboVoicer - Preload Script (Regra #6: Cada app tem seu próprio preload)

const { contextBridge, ipcRenderer } = require('electron');

// Expor apenas os métodos que o TurboVoicer precisa
contextBridge.exposeInMainWorld('electronAPI', {
    // === INSTALAÇÃO ===
    checkInstallation: () => ipcRenderer.invoke('turbovoicer:checkInstallation'),
    detectHardware: () => ipcRenderer.invoke('turbovoicer:detectHardware'),
    installDependencies: (options) => ipcRenderer.invoke('turbovoicer:installDependencies', options),
    
    // === SERVIDOR RVC ===
    ensureServerRunning: () => ipcRenderer.invoke('turbovoicer:ensureServerRunning'),
    checkServerStatus: () => ipcRenderer.invoke('turbovoicer:checkServerStatus'),
    onInstallProgress: (callback) => {
        ipcRenderer.on('turbovoicer:installProgress', (event, data) => callback(data));
        return () => ipcRenderer.removeAllListeners('turbovoicer:installProgress');
    },
    cancelInstallation: () => ipcRenderer.invoke('turbovoicer:cancelInstallation'),
    onCancelProgress: (callback) => {
        ipcRenderer.on('turbovoicer:cancel-progress', (event, data) => callback(data));
        return () => ipcRenderer.removeAllListeners('turbovoicer:cancel-progress');
    },
    
    // === HARDWARE DETECTION ===
    getRVCConfig: (userOverride) => ipcRenderer.invoke('turbovoicer:getRVCConfig', userOverride),
    validateTextLength: (textLength) => ipcRenderer.invoke('turbovoicer:validateTextLength', textLength),
    
    // === GERENCIAMENTO DE VOZES ===
    loadCatalog: () => ipcRenderer.invoke('turbovoicer:loadCatalog'),
    getInstalledVoices: () => ipcRenderer.invoke('turbovoicer:getInstalledVoices'),
    downloadVoice: (voiceData) => ipcRenderer.invoke('turbovoicer:downloadVoice', voiceData),
    importCustomVoice: (zipPath, voiceName) => ipcRenderer.invoke('turbovoicer:importCustomVoice', zipPath, voiceName),
    deleteVoice: (voicePath) => ipcRenderer.invoke('turbovoicer:deleteVoice', voicePath),
    onDownloadProgress: (callback) => {
        ipcRenderer.on('turbovoicer:downloadProgress', (event, data) => callback(data));
        return () => ipcRenderer.removeAllListeners('turbovoicer:downloadProgress');
    },
    
    // === GERAÇÃO DE ÁUDIO ===
    generateAudio: (config) => ipcRenderer.invoke('turbovoicer:generateAudio', config),
    cancelGeneration: () => ipcRenderer.invoke('turbovoicer:cancelGeneration'),
    onGenerationProgress: (callback) => ipcRenderer.on('turbovoicer:generationProgress', (event, data) => callback(data)),
    
    // === PREVIEW SYSTEM ===
    turboVoicerGenerateEdgeTTS: (config) => ipcRenderer.invoke('turbovoicer:generateEdgeTTS', config),
    turboVoicerGeneratePreview: (config) => ipcRenderer.invoke('turbovoicer:generatePreview', config),
    turboVoicerCheckPreviewCache: (configHash) => ipcRenderer.invoke('turbovoicer:checkPreviewCache', configHash),
    turboVoicerClearPreviewCache: () => ipcRenderer.invoke('turbovoicer:clearPreviewCache'),
    turboVoicerGetCacheStatus: () => ipcRenderer.invoke('turbovoicer:getCacheStatus'),
    
    // === GPU MANAGEMENT ===
    turboVoicerGetGPUStatus: () => ipcRenderer.invoke('turbovoicer:getGPUStatus'),
    turboVoicerDisableGPU: (gpuName) => ipcRenderer.invoke('turbovoicer:disableGPU', gpuName),
    turboVoicerEnableGPU: () => ipcRenderer.invoke('turbovoicer:enableGPU'),
    
    // === PRESET SYSTEM ===
    turboVoicerSavePreset: (preset) => ipcRenderer.invoke('turbovoicer:savePreset', preset),
    turboVoicerLoadPresets: () => ipcRenderer.invoke('turbovoicer:loadPresets'),
    turboVoicerDeletePreset: (presetId) => ipcRenderer.invoke('turbovoicer:deletePreset', presetId),
    turboVoicerExportPreset: (preset) => ipcRenderer.invoke('turbovoicer:exportPreset', preset),
    turboVoicerImportPreset: () => ipcRenderer.invoke('turbovoicer:importPreset'),
    
    // === GRAVAÇÃO E IMPORTAÇÃO ===
    selectFolder: () => ipcRenderer.invoke('turbovoicer:selectFolder'),
    saveRecording: (config) => ipcRenderer.invoke('turbovoicer:saveRecording', config),
    selectAudioFile: () => ipcRenderer.invoke('turbovoicer:selectAudioFile'),
    selectAudioFolder: () => ipcRenderer.invoke('turbovoicer:selectAudioFolder'),
    convertAudioBatch: (config) => ipcRenderer.invoke('turbovoicer:convertAudioBatch', config),
    onBatchProgress: (callback) => {
        ipcRenderer.on('turbovoicer:batchProgress', (event, data) => callback(data));
        return () => ipcRenderer.removeAllListeners('turbovoicer:batchProgress');
    },
    turboVoicerExportAllPresets: (presets) => ipcRenderer.invoke('turbovoicer:exportAllPresets', presets),
    
    // === SYSTEM TESTS ===
    turboVoicerTestEdgeTTS: () => ipcRenderer.invoke('turbovoicer:testEdgeTTS'),
    turboVoicerTestRVC: (rvcVoice) => ipcRenderer.invoke('turbovoicer:testRVC', rvcVoice),
    
    // === UTILITÁRIOS ===
    testAzureTTS: (text, voice) => ipcRenderer.invoke('turbovoicer:testAzureTTS', text, voice),
    testRVCConversion: (audioPath, modelPath) => ipcRenderer.invoke('turbovoicer:testRVCConversion', audioPath, modelPath),
    
    // === MÉTODOS BÁSICOS (do launcher) ===
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
    selectFiles: (options) => ipcRenderer.invoke('dialog:selectFiles', options),
    openPath: (path) => ipcRenderer.invoke('shell:openPath', path),
    fileExists: (filePath) => ipcRenderer.invoke('fs:fileExists', filePath),
    
    // === MODAL SYSTEM ===
    playSound: (soundName) => ipcRenderer.invoke('modal:playSound', soundName),
});

console.log('[TurboVoicer Preload] API exposta com sucesso');
