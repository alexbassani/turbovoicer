// TurboVoicer - Standalone Electron App
// Main Process

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Importar módulos do TurboVoicer
const { getRVCServerManager } = require('./rvc-server-manager');
const RVCInstaller = require('./rvc-installer');
const VoiceDownloader = require('./voice-downloader');
const HardwareDetector = require('./hardware-detector');
const audioCache = require('./audio-cache');
const { getGPUManager } = require('./gpu-manager');
const VoiceCatalogManager = require('./voice-catalog-manager');

// FFmpeg path
let ffmpegPath;
if (app.isPackaged) {
    ffmpegPath = path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe');
} else {
    try {
        ffmpegPath = require('ffmpeg-static');
    } catch (err) {
        console.error('[TurboVoicer] ERRO: ffmpeg-static não encontrado. Execute: npm install');
        ffmpegPath = null;
    }
}

// Instâncias globais
let mainWindow = null;
let installer = null;
let voiceDownloader = null;
let hardwareDetector = null;

// ============================================
// WINDOW MANAGEMENT
// ============================================

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        frame: false, // Barra de título customizada
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, '..', 'public', 'index.html'));
    
    // Abrir DevTools em desenvolvimento
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// ============================================
// WINDOW CONTROLS (Custom Titlebar)
// ============================================

ipcMain.on('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window:close', () => {
    if (mainWindow) mainWindow.close();
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Ajustar velocidade de áudio usando FFmpeg
 */
async function adjustAudioSpeed(inputPath, rate, outputPath) {
    return new Promise((resolve, reject) => {
        if (rate === 1.0) {
            fs.copyFileSync(inputPath, outputPath);
            resolve();
            return;
        }
        
        if (!ffmpegPath) {
            reject(new Error('FFmpeg não disponível'));
            return;
        }
        
        let atempoFilters = [];
        let currentRate = rate;
        
        while (currentRate > 2.0) {
            atempoFilters.push('atempo=2.0');
            currentRate /= 2.0;
        }
        while (currentRate < 0.5) {
            atempoFilters.push('atempo=0.5');
            currentRate /= 0.5;
        }
        
        if (currentRate !== 1.0) {
            atempoFilters.push(`atempo=${currentRate.toFixed(2)}`);
        }
        
        const filterComplex = atempoFilters.join(',');
        const args = [
            '-i', inputPath,
            '-filter:a', filterComplex,
            '-vn',
            '-y',
            outputPath
        ];
        
        const ffmpeg = spawn(ffmpegPath, args);
        let stderr = '';
        
        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`FFmpeg falhou: ${stderr}`));
            }
        });
    });
}

/**
 * Converter com RVC usando wrapper Python
 */
async function convertWithRVC(inputPath, rvcVoice, pitch, outputPath, f0Method = 'harvest') {
    return new Promise((resolve, reject) => {
        const rvcGuiPath = path.join(app.getPath('userData'), 'turbovoicer', 'rvc-gui', 'RVC-GUI');
        const pythonPath = path.join(rvcGuiPath, 'runtime', 'python.exe');
        
        const wrapperPath = app.isPackaged
            ? path.join(process.resourcesPath, 'turbovoicer', 'src', 'rvc_wrapper.py')
            : path.join(__dirname, 'rvc_wrapper.py');
        
        const voicesPath = path.join(app.getPath('userData'), 'turbovoicer', 'voices');
        
        // Buscar modelo
        let modelPath = null;
        const directPath = path.join(voicesPath, rvcVoice);
        
        if (fs.existsSync(directPath)) {
            modelPath = directPath;
        } else {
            try {
                const categories = fs.readdirSync(voicesPath, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
                
                for (const category of categories) {
                    const categoryPath = path.join(voicesPath, category, rvcVoice);
                    if (fs.existsSync(categoryPath)) {
                        modelPath = categoryPath;
                        break;
                    }
                }
            } catch (err) {
                console.error('[TurboVoicer] Erro ao buscar modelo:', err.message);
            }
        }
        
        if (!modelPath) {
            reject(new Error(`Modelo RVC não encontrado: ${rvcVoice}`));
            return;
        }
        
        if (!fs.existsSync(pythonPath)) {
            reject(new Error(`Python não encontrado: ${pythonPath}`));
            return;
        }
        
        if (!fs.existsSync(wrapperPath)) {
            reject(new Error(`Wrapper não encontrado: ${wrapperPath}`));
            return;
        }
        
        const args = [
            wrapperPath,
            '--input', inputPath,
            '--model_path', modelPath,
            '--output', outputPath,
            '--pitch', pitch.toString(),
            '--method', f0Method,
            '--index_rate', '0.75'
        ];
        
        // Forçar CPU se método for 'pm'
        if (f0Method === 'pm') {
            args.push('--force-cpu');
            console.log('[TurboVoicer] Forçando CPU (método pm) - CUDA desabilitado');
        }
        
        console.log('[TurboVoicer] Executando RVC Wrapper...');
        
        const pythonProcess = spawn(pythonPath, args, {
            cwd: rvcGuiPath,
            windowsHide: true,
            env: {
                ...process.env,
                PYTHONPATH: rvcGuiPath
            }
        });
        
        let stdout = '';
        let stderr = '';
        
        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            console.log('[RVC Wrapper]', output.trim());
        });
        
        pythonProcess.stderr.on('data', (data) => {
            const output = data.toString();
            stderr += output;
            console.error('[RVC Wrapper STDERR]', output.trim());
        });
        
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                console.log('[TurboVoicer] RVC Wrapper concluído');
                if (fs.existsSync(outputPath)) {
                    resolve(outputPath);
                } else {
                    reject(new Error('Arquivo de saída não foi criado'));
                }
            } else {
                console.error('[TurboVoicer] RVC Wrapper falhou:', code);
                reject(new Error(`RVC falhou (código ${code}): ${stderr || stdout}`));
            }
        });
    });
}

// ============================================
// IPC HANDLERS - BASIC
// ============================================

ipcMain.handle('dialog:openFile', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
});

ipcMain.handle('dialog:saveFile', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
});

ipcMain.handle('shell:openExternal', async (event, url) => {
    await shell.openExternal(url);
});

ipcMain.handle('shell:showItemInFolder', async (event, fullPath) => {
    shell.showItemInFolder(fullPath);
});

// ============================================
// IPC HANDLERS - TURBOVOICER
// ============================================

// Verificar instalação do RVC-GUI
ipcMain.handle('turbovoicer:checkInstallation', async () => {
    try {
        if (!installer) {
            installer = new RVCInstaller();
        }
        const isInstalled = await installer.checkInstallation();
        return { success: true, installed: isInstalled };
    } catch (error) {
        console.error('[TurboVoicer] Erro ao verificar instalação:', error);
        return { success: false, error: error.message };
    }
});

// Instalar RVC-GUI
ipcMain.handle('turbovoicer:installRVC', async () => {
    try {
        if (!installer) {
            installer = new RVCInstaller();
        }
        
        const result = await installer.install((progress) => {
            if (mainWindow) {
                mainWindow.webContents.send('turbovoicer:installProgress', progress);
            }
        });
        
        return { success: true, result };
    } catch (error) {
        console.error('[TurboVoicer] Erro na instalação:', error);
        return { success: false, error: error.message };
    }
});

// Detectar hardware
ipcMain.handle('turbovoicer:detectHardware', async () => {
    try {
        if (!hardwareDetector) {
            hardwareDetector = new HardwareDetector();
        }
        const result = await hardwareDetector.detect();
        return { success: true, ...result };
    } catch (error) {
        console.error('[TurboVoicer] Erro ao detectar hardware:', error);
        return { success: false, error: error.message };
    }
});

// Iniciar servidor RVC
ipcMain.handle('turbovoicer:startRVCServer', async () => {
    try {
        const serverManager = getRVCServerManager();
        await serverManager.start();
        return { success: true };
    } catch (error) {
        console.error('[TurboVoicer] Erro ao iniciar servidor RVC:', error);
        return { success: false, error: error.message };
    }
});

// Parar servidor RVC
ipcMain.handle('turbovoicer:stopRVCServer', async () => {
    try {
        const serverManager = getRVCServerManager();
        await serverManager.stop();
        return { success: true };
    } catch (error) {
        console.error('[TurboVoicer] Erro ao parar servidor RVC:', error);
        return { success: false, error: error.message };
    }
});

// Listar vozes instaladas
ipcMain.handle('turbovoicer:listVoices', async () => {
    try {
        const voicesPath = path.join(app.getPath('userData'), 'turbovoicer', 'voices');
        
        if (!fs.existsSync(voicesPath)) {
            return { success: true, voices: [] };
        }
        
        const voices = [];
        const categories = fs.readdirSync(voicesPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        for (const category of categories) {
            const categoryPath = path.join(voicesPath, category);
            const voiceNames = fs.readdirSync(categoryPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
            
            for (const voiceName of voiceNames) {
                voices.push({
                    name: voiceName,
                    category: category,
                    path: path.join(categoryPath, voiceName)
                });
            }
        }
        
        return { success: true, voices };
    } catch (error) {
        console.error('[TurboVoicer] Erro ao listar vozes:', error);
        return { success: false, error: error.message };
    }
});

// Download de voz
ipcMain.handle('turbovoicer:downloadVoice', async (event, voiceId) => {
    try {
        if (!voiceDownloader) {
            voiceDownloader = new VoiceDownloader();
        }
        
        const result = await voiceDownloader.download(voiceId, (progress) => {
            if (mainWindow) {
                mainWindow.webContents.send('turbovoicer:downloadProgress', progress);
            }
        });
        
        return { success: true, result };
    } catch (error) {
        console.error('[TurboVoicer] Erro no download:', error);
        return { success: false, error: error.message };
    }
});

// Cache handlers (stubs por enquanto)
ipcMain.handle('turbovoicer:getCacheStats', async () => {
    try {
        const stats = await audioCache.getStats();
        return { success: true, stats };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('turbovoicer:clearCache', async () => {
    try {
        await audioCache.clear();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// GPU Manager
ipcMain.handle('turbovoicer:getGPUStatus', async () => {
    try {
        const gpuManager = getGPUManager();
        const status = gpuManager.getStatus();
        return { success: true, ...status };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('turbovoicer:turboVoicerGetGPUStatus', async () => {
    try {
        const gpuManager = getGPUManager();
        const status = gpuManager.getStatus();
        return { success: true, ...status };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('turbovoicer:disableGPU', async (event, gpuName) => {
    try {
        const gpuManager = getGPUManager();
        await gpuManager.disableGPU(gpuName);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('turbovoicer:enableGPU', async () => {
    try {
        const gpuManager = getGPUManager();
        await gpuManager.enableGPU();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Server Status
ipcMain.handle('turbovoicer:checkServerStatus', async () => {
    try {
        const serverManager = getRVCServerManager();
        const isRunning = serverManager.isRunning();
        return { success: true, running: isRunning };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('turbovoicer:ensureServerRunning', async () => {
    try {
        const serverManager = getRVCServerManager();
        await serverManager.start();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Installed Voices
ipcMain.handle('turbovoicer:getInstalledVoices', async () => {
    try {
        const voicesPath = path.join(app.getPath('userData'), 'turbovoicer', 'voices');
        
        if (!fs.existsSync(voicesPath)) {
            return { success: true, voices: [] };
        }
        
        const voices = [];
        const categories = fs.readdirSync(voicesPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        for (const category of categories) {
            const categoryPath = path.join(voicesPath, category);
            const voiceNames = fs.readdirSync(categoryPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
            
            for (const voiceName of voiceNames) {
                voices.push({
                    name: voiceName,
                    category: category,
                    path: path.join(categoryPath, voiceName)
                });
            }
        }
        
        return { success: true, voices };
    } catch (error) {
        console.error('[TurboVoicer] Erro ao listar vozes:', error);
        return { success: false, error: error.message, voices: [] };
    }
});

// Cache Status
ipcMain.handle('turbovoicer:getCacheStatus', async () => {
    try {
        const stats = await audioCache.getStats();
        return { success: true, stats };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Presets (stub por enquanto)
ipcMain.handle('turbovoicer:loadPresets', async () => {
    try {
        // Stub - retornar array vazio por enquanto
        return { success: true, presets: [] };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('turbovoicer:savePreset', async (event, preset) => {
    try {
        // Stub - apenas retornar sucesso por enquanto
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Voice Catalog
let voiceCatalog = null;

ipcMain.handle('turbovoicer:loadCatalog', async () => {
    try {
        if (!voiceCatalog) {
            voiceCatalog = new VoiceCatalogManager();
        }
        const catalog = await voiceCatalog.loadCatalog();
        return { success: true, catalog };
    } catch (error) {
        console.error('[TurboVoicer] Erro ao carregar catálogo:', error);
        return { success: false, error: error.message, catalog: [] };
    }
});

ipcMain.handle('turbovoicer:checkPremiumStatus', async () => {
    try {
        if (!voiceCatalog) {
            voiceCatalog = new VoiceCatalogManager();
        }
        const isUnlocked = voiceCatalog.isPremiumUnlocked();
        return { success: true, unlocked: isUnlocked };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('turbovoicer:getStarterVoices', async () => {
    try {
        if (!voiceCatalog) {
            voiceCatalog = new VoiceCatalogManager();
        }
        const voices = await voiceCatalog.getStarterVoices();
        return { success: true, voices };
    } catch (error) {
        return { success: false, error: error.message, voices: [] };
    }
});

ipcMain.handle('turbovoicer:getPremiumVoices', async () => {
    try {
        if (!voiceCatalog) {
            voiceCatalog = new VoiceCatalogManager();
        }
        const voices = await voiceCatalog.getPremiumVoices();
        return { success: true, voices };
    } catch (error) {
        return { success: false, error: error.message, voices: [] };
    }
});

ipcMain.handle('turbovoicer:getAllVoices', async () => {
    try {
        if (!voiceCatalog) {
            voiceCatalog = new VoiceCatalogManager();
        }
        const voices = await voiceCatalog.getAllVoices();
        return { success: true, voices };
    } catch (error) {
        return { success: false, error: error.message, voices: [] };
    }
});

console.log('[TurboVoicer] Main process initialized');
