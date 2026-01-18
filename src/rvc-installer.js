// CONTEÚDO DE: apps/turbovoicer/src/rvc-installer.js
// TurboVoicer - RVC Installer System

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { execSync, spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const AdmZip = require('adm-zip');
const HardwareDetector = require('./hardware-detector');

class RVCInstaller {
    constructor() {
        this.installPath = path.join(app.getPath('userData'), 'turbovoicer');
        this.modelsPath = path.join(this.installPath, 'models');
        this.configPath = path.join(this.installPath, 'config.json');
        
        // RVC-GUI completo
        // Prioridade: Servidor próprio (mais rápido e confiável)
        // Fallback: GitHub Release (caso servidor esteja offline)
        this.rvcGuiUrls = [
            'https://cpmdark.com.br/downloads/turbovoicer-vozes/RVC-GUI.zip',
            'https://github.com/Tiger14n/RVC-GUI/releases/download/Windows-pkg/RVC-GUI.zip'
        ];
        this.rvcGuiPath = path.join(this.installPath, 'rvc-gui');
        
        // Autenticação para servidor cpmdark.com.br (mesma das vozes)
        this.authHeader = this.#decodeAuth();
        
        this.hardware = null;
        this.isInstalling = false;
        this.installProgress = 0;
        this.currentStep = '';
    }

    #decodeAuth() {
        // XOR obfuscated credentials: alexbassani:_0601.Alex_
        const obfuscated = {
            u: [35, 46, 39, 58, 32, 35, 49, 49, 35, 44, 43],
            p: [29, 114, 116, 114, 115, 108, 3, 46, 39, 58, 29]
        };
        
        const key = 0x42;
        
        const username = String.fromCharCode(...obfuscated.u.map(c => c ^ key));
        const password = String.fromCharCode(...obfuscated.p.map(c => c ^ key));
        
        return 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
    }

    /**
     * Verificar se instalação já existe
     */
    checkInstallation() {
        try {
            if (!fs.existsSync(this.configPath)) {
                return { installed: false };
            }

            const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
            
            // Verificar se RVC-GUI existe
            const rvcPythonPath = this.getRVCPythonPath();
            const rvcGuiExists = fs.existsSync(rvcPythonPath);
            
            if (!rvcGuiExists) {
                return { installed: false };
            }

            return {
                installed: config.installed === true,
                version: config.version || '1.0.0',
                hardware: config.hardware || 'cpu',
                installDate: config.installDate,
                rvcPythonPath: rvcPythonPath
            };
        } catch (error) {
            console.error('[RVCInstaller] Erro ao verificar instalação:', error);
            return { installed: false, error: error.message };
        }
    }

    /**
     * Retorna caminho do Python do RVC-GUI
     */
    getRVCPythonPath() {
        return path.join(this.rvcGuiPath, 'RVC-GUI', 'runtime', 'python.exe');
    }

    /**
     * Retorna caminho do script rvcgui.py
     */
    getRVCScriptPath() {
        return path.join(this.rvcGuiPath, 'RVC-GUI', 'rvcgui.py');
    }

    /**
     * Verificar se RVC-GUI está instalado corretamente
     */
    verifyRVCGui() {
        const pythonPath = this.getRVCPythonPath();
        const scriptPath = this.getRVCScriptPath();
        
        if (!fs.existsSync(pythonPath)) {
            throw new Error(`Python do RVC-GUI não encontrado: ${pythonPath}`);
        }
        
        if (!fs.existsSync(scriptPath)) {
            throw new Error(`Script rvcgui.py não encontrado: ${scriptPath}`);
        }
        
        // Verificar pasta runtime (essencial para Python)
        const runtimePath = path.join(this.rvcGuiPath, 'RVC-GUI', 'runtime');
        if (!fs.existsSync(runtimePath)) {
            throw new Error(`Pasta runtime não encontrada: ${runtimePath}`);
        }
        
        // Assets não é obrigatório - pode ser baixado pelo próprio RVC-GUI na primeira execução
        const assetsPath = path.join(this.rvcGuiPath, 'RVC-GUI', 'assets');
        if (fs.existsSync(assetsPath)) {
            console.log('[RVCInstaller] ✅ Pasta assets encontrada');
        } else {
            console.log('[RVCInstaller] ⚠️ Pasta assets não encontrada (será criada pelo RVC-GUI)');
        }
        
        console.log('[RVCInstaller] ✅ RVC-GUI verificado com sucesso');
        return true;
    }

    /**
     * Detectar hardware (GPU NVIDIA ou CPU)
     */
    detectHardware() {
        try {
            console.log('[RVCInstaller] Detectando hardware...');
            
            // Tentar detectar GPU NVIDIA via nvidia-smi
            try {
                const result = execSync('nvidia-smi --query-gpu=name,driver_version,compute_cap --format=csv,noheader', {
                    encoding: 'utf8',
                    timeout: 5000
                });
                
                if (result && result.includes('NVIDIA')) {
                    const lines = result.trim().split('\n');
                    const gpuInfo = lines[0].split(',').map(s => s.trim());
                    
                    console.log('[RVCInstaller] GPU NVIDIA detectada:', gpuInfo[0]);
                    console.log('[RVCInstaller] Driver:', gpuInfo[1]);
                    console.log('[RVCInstaller] Compute Capability:', gpuInfo[2]);
                    
                    this.hardware = {
                        type: 'cuda',
                        gpu: gpuInfo[0],
                        driver: gpuInfo[1],
                        computeCapability: gpuInfo[2]
                    };
                    
                    return this.hardware;
                }
            } catch (error) {
                console.log('[RVCInstaller] nvidia-smi não disponível ou erro:', error.message);
            }
            
            // Fallback para CPU
            console.log('[RVCInstaller] GPU NVIDIA não detectada. Usando CPU.');
            this.hardware = {
                type: 'cpu',
                gpu: 'CPU',
                cores: require('os').cpus().length
            };
            
            return this.hardware;
        } catch (error) {
            console.error('[RVCInstaller] Erro ao detectar hardware:', error);
            this.hardware = { type: 'cpu', gpu: 'CPU' };
            return this.hardware;
        }
    }

    /**
     * Baixar arquivo com progresso detalhado e retomada automática
     */
    async downloadFile(url, destPath, onProgress, maxRetries = 5) {
        const tempPath = destPath + '.download';
        let currentSize = 0;
        
        // Verificar se já existe download parcial
        if (fs.existsSync(tempPath)) {
            currentSize = fs.statSync(tempPath).size;
            console.log(`[RVCInstaller] Retomando download de ${(currentSize / 1024 / 1024).toFixed(2)} MB`);
        }
        
        return new Promise((resolve, reject) => {
            const attemptDownload = (retryCount = 0) => {
                console.log(`[RVCInstaller] Baixando: ${url} (tentativa ${retryCount + 1}/${maxRetries + 1})`);
                
                const options = {
                    headers: currentSize > 0 ? { 'Range': `bytes=${currentSize}-` } : {}
                };
                
                const urlObj = new URL(url);
                const requestOptions = {
                    hostname: urlObj.hostname,
                    path: urlObj.pathname + urlObj.search,
                    headers: {
                        ...options.headers,
                        // Adicionar autenticação se for cpmdark.com.br
                        ...(urlObj.hostname.includes('cpmdark.com.br') ? {
                            'Authorization': this.authHeader,
                            'User-Agent': 'TurboStudio/2.0.3'
                        } : {})
                    }
                };
                
                const request = https.get(requestOptions, (response) => {
                    // Seguir redirects
                    if (response.statusCode === 302 || response.statusCode === 301) {
                        console.log('[RVCInstaller] Seguindo redirect...');
                        return this.downloadFile(response.headers.location, destPath, onProgress, maxRetries)
                            .then(resolve)
                            .catch(reject);
                    }
                    
                    // Aceitar 200 (novo download) ou 206 (retomada)
                    if (response.statusCode !== 200 && response.statusCode !== 206) {
                        reject(new Error(`Falha no download: HTTP ${response.statusCode}`));
                        return;
                    }
                    
                    // Extrair tamanho total
                    let totalSize = 0;
                    if (response.statusCode === 206) {
                        // Retomada - extrair de content-range
                        const contentRange = response.headers['content-range'];
                        if (contentRange) {
                            totalSize = parseInt(contentRange.split('/')[1], 10);
                        }
                    } else {
                        // Download novo - extrair de content-length
                        totalSize = parseInt(response.headers['content-length'], 10);
                    }
                    
                    console.log(`[RVCInstaller] Total size: ${totalSize} bytes (${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB)`);
                    console.log(`[RVCInstaller] Current size: ${currentSize} bytes`);
                    console.log(`[RVCInstaller] Status code: ${response.statusCode}`);
                    
                    if (!totalSize || isNaN(totalSize)) {
                        console.error('[RVCInstaller] ERRO: Tamanho total não disponível!');
                        console.error('[RVCInstaller] Headers:', response.headers);
                        reject(new Error('Servidor não retornou tamanho do arquivo (content-length)'));
                        return;
                    }
                    
                    let downloadedSize = currentSize;
                    const startTime = Date.now();
                    let lastUpdate = Date.now();
                    
                    const fileStream = fs.createWriteStream(tempPath, { flags: 'a' });
                    
                    response.on('data', (chunk) => {
                        downloadedSize += chunk.length;
                        
                        // Atualizar progresso a cada 500ms
                        const now = Date.now();
                        if (onProgress && (now - lastUpdate > 500)) {
                            const percent = (downloadedSize / totalSize) * 100;
                            const elapsed = (now - startTime) / 1000;
                            const speed = (downloadedSize - currentSize) / elapsed;
                            
                            onProgress({
                                percent: percent,
                                downloaded: downloadedSize,
                                total: totalSize,
                                speed: speed
                            });
                            
                            lastUpdate = now;
                        }
                    });
                    
                    response.on('error', (error) => {
                        fileStream.close();
                        console.error('[RVCInstaller] Erro no stream:', error);
                        
                        if (retryCount < maxRetries) {
                            console.log(`[RVCInstaller] Retentando em 3 segundos... (${retryCount + 1}/${maxRetries})`);
                            currentSize = fs.existsSync(tempPath) ? fs.statSync(tempPath).size : 0;
                            setTimeout(() => attemptDownload(retryCount + 1), 3000);
                        } else {
                            reject(new Error(`Falha após ${maxRetries} tentativas: ${error.message}`));
                        }
                    });
                    
                    response.pipe(fileStream);
                    
                    fileStream.on('finish', () => {
                        fileStream.close();
                        
                        // Progresso final
                        if (onProgress && totalSize) {
                            onProgress({
                                percent: 100,
                                downloaded: totalSize,
                                total: totalSize,
                                speed: 0
                            });
                        }
                        
                        // Renomear arquivo temporário para final
                        fs.renameSync(tempPath, destPath);
                        console.log(`[RVCInstaller] Download concluído: ${destPath}`);
                        resolve(destPath);
                    });
                    
                    fileStream.on('error', (error) => {
                        fileStream.close();
                        console.error('[RVCInstaller] Erro no fileStream:', error);
                        
                        if (retryCount < maxRetries) {
                            console.log(`[RVCInstaller] Retentando em 3 segundos... (${retryCount + 1}/${maxRetries})`);
                            currentSize = fs.existsSync(tempPath) ? fs.statSync(tempPath).size : 0;
                            setTimeout(() => attemptDownload(retryCount + 1), 3000);
                        } else {
                            reject(new Error(`Falha após ${maxRetries} tentativas: ${error.message}`));
                        }
                    });
                });
                
                request.on('error', (error) => {
                    console.error('[RVCInstaller] Erro no request:', error);
                    
                    if (retryCount < maxRetries) {
                        console.log(`[RVCInstaller] Retentando em 3 segundos... (${retryCount + 1}/${maxRetries})`);
                        currentSize = fs.existsSync(tempPath) ? fs.statSync(tempPath).size : 0;
                        setTimeout(() => attemptDownload(retryCount + 1), 3000);
                    } else {
                        reject(new Error(`Falha após ${maxRetries} tentativas: ${error.message}`));
                    }
                });
            };
            
            attemptDownload();
        });
    }
    
    /**
     * Formatar bytes para leitura humana
     */
    static formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    /**
     * Formatar velocidade
     */
    static formatSpeed(bytesPerSecond) {
        return this.formatBytes(bytesPerSecond) + '/s';
    }

    /**
     * Extrair arquivo ZIP usando streaming (suporta arquivos > 2GB)
     */
    async extractZip(zipPath, destPath) {
        return new Promise((resolve, reject) => {
            console.log(`[RVCInstaller] Extraindo: ${zipPath} -> ${destPath}`);
            
            const yauzl = require('yauzl');
            const fs = require('fs');
            const path = require('path');
            
            // Criar diretório de destino
            if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath, { recursive: true });
            }
            
            let filesExtracted = 0;
            let totalFiles = 0;
            
            yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Contar total de arquivos
                zipfile.on('entry', (entry) => {
                    totalFiles++;
                });
                
                zipfile.readEntry();
                
                zipfile.on('entry', (entry) => {
                    const fullPath = path.join(destPath, entry.fileName);
                    
                    // Se for diretório
                    if (/\/$/.test(entry.fileName)) {
                        fs.mkdirSync(fullPath, { recursive: true });
                        zipfile.readEntry();
                        return;
                    }
                    
                    // Criar diretório pai se não existir
                    const dirname = path.dirname(fullPath);
                    if (!fs.existsSync(dirname)) {
                        fs.mkdirSync(dirname, { recursive: true });
                    }
                    
                    // Extrair arquivo
                    zipfile.openReadStream(entry, (err, readStream) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        const writeStream = fs.createWriteStream(fullPath);
                        
                        readStream.on('end', () => {
                            filesExtracted++;
                            
                            // Log de progresso a cada 100 arquivos
                            if (filesExtracted % 100 === 0) {
                                console.log(`[RVCInstaller] Extraídos ${filesExtracted} arquivos...`);
                            }
                            
                            zipfile.readEntry();
                        });
                        
                        readStream.on('error', reject);
                        writeStream.on('error', reject);
                        
                        readStream.pipe(writeStream);
                    });
                });
                
                zipfile.on('end', () => {
                    console.log(`[RVCInstaller] Extração concluída: ${filesExtracted} arquivos`);
                    resolve();
                });
                
                zipfile.on('error', reject);
            });
        });
    }

    /**
     * Salvar configuração de instalação
     */
    saveConfig() {
        const config = {
            installed: true,
            version: '1.0.0',
            installDate: new Date().toISOString(),
            hardware: this.hardware,
            paths: {
                install: this.installPath,
                rvcGui: this.rvcGuiPath,
                rvcPython: this.getRVCPythonPath(),
                rvcScript: this.getRVCScriptPath(),
                models: this.modelsPath
            }
        };
        
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
        console.log('[RVCInstaller] ✅ Configuração salva');
    }

    /**
     * Baixar e instalar RVC-GUI completo
     */
    async installRVCGui(onProgress) {
        try {
            console.log('[RVCInstaller] Baixando RVC-GUI completo...');
            
            if (onProgress) {
                onProgress({
                    step: 'rvc-gui',
                    percent: 75,
                    message: 'Baixando Motor de Processamento...'
                });
            }
            
            // Criar diretório
            if (!fs.existsSync(this.rvcGuiPath)) {
                fs.mkdirSync(this.rvcGuiPath, { recursive: true });
            }
            
            // Baixar RVC-GUI.zip (tentar múltiplos servidores)
            const zipPath = path.join(this.installPath, 'rvc-gui.zip');
            let downloadSuccess = false;
            let lastError = null;
            
            for (let i = 0; i < this.rvcGuiUrls.length; i++) {
                const url = this.rvcGuiUrls[i];
                const serverName = url.includes('cpmdark.com.br') ? 'CPM Dark' : 'GitHub';
                
                try {
                    console.log(`[RVCInstaller] Tentando baixar de: ${serverName} (${url})`);
                    
                    await this.downloadFile(url, zipPath, (progress) => {
                        if (onProgress) {
                            // progress.percent já vem calculado do downloadFile
                            const percent = progress.percent || 0;
                            onProgress({
                                step: 'rvc-gui',
                                percent: Math.round(percent),
                                message: `Baixando Motor de Processamento (${serverName}): ${Math.round(percent)}%`,
                                speed: progress.speed,
                                downloaded: progress.downloaded,
                                total: progress.total
                            });
                        }
                    });
                    
                    downloadSuccess = true;
                    console.log(`[RVCInstaller] Download concluído de: ${serverName}`);
                    break;
                } catch (error) {
                    console.warn(`[RVCInstaller] Falha ao baixar de ${serverName}:`, error.message);
                    lastError = error;
                    
                    // Se não for o último servidor, tentar próximo
                    if (i < this.rvcGuiUrls.length - 1) {
                        console.log('[RVCInstaller] Tentando próximo servidor...');
                        continue;
                    }
                }
            }
            
            if (!downloadSuccess) {
                throw new Error(`Falha ao baixar RVC-GUI de todos os servidores: ${lastError?.message}`);
            }
            
            console.log('[RVCInstaller] RVC-GUI baixado. Extraindo...');
            
            if (onProgress) {
                onProgress({
                    step: 'rvc-gui',
                    percent: 85,
                    message: 'Extraindo Motor de Processamento...'
                });
            }
            
            // Extrair ZIP
            await this.extractZip(zipPath, this.rvcGuiPath);
            
            // Remover ZIP
            if (fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
            }
            
            console.log('[RVCInstaller] RVC-GUI instalado com sucesso em:', this.rvcGuiPath);
            
            if (onProgress) {
                onProgress({
                    step: 'rvc-gui',
                    percent: 90,
                    message: 'Motor de Processamento instalado com sucesso!'
                });
            }
            
        } catch (error) {
            console.error('[RVCInstaller] Erro ao instalar RVC-GUI:', error);
            throw new Error(`Falha ao instalar Motor de Processamento: ${error.message}`);
        }
    }

    /**
     * Instalar edge-tts no Python do RVC-GUI
     */
    async installEdgeTTS() {
        try {
            console.log('[RVCInstaller] Instalando edge-tts no Python do RVC-GUI...');
            
            const pythonPath = this.getRVCPythonPath();
            
            if (!fs.existsSync(pythonPath)) {
                throw new Error('Python do RVC-GUI não encontrado');
            }
            
            // Instalar edge-tts usando pip do Python do RVC-GUI
            const pipArgs = ['-m', 'pip', 'install', 'edge-tts>=6.1.0', '--no-warn-script-location'];
            
            console.log('[RVCInstaller] Executando:', pythonPath, pipArgs.join(' '));
            
            const result = execSync(`"${pythonPath}" ${pipArgs.join(' ')}`, {
                encoding: 'utf8',
                stdio: 'pipe',
                windowsHide: true
            });
            
            console.log('[RVCInstaller] edge-tts instalado com sucesso');
            console.log('[RVCInstaller] Output:', result);
            
            return { success: true };
        } catch (error) {
            console.error('[RVCInstaller] Erro ao instalar edge-tts:', error);
            throw new Error(`Falha ao instalar Edge TTS: ${error.message}`);
        }
    }

    /**
     * Instalação completa
     */
    async install(onProgress) {
        try {
            if (this.isInstalling) {
                throw new Error('Instalação já em andamento');
            }
            
            this.isInstalling = true;
            this.installProgress = 0;
            
            console.log('[RVCInstaller] Iniciando instalação do RVC-GUI...');
            
            // 1. Detectar hardware
            this.currentStep = 'Detectando hardware...';
            const hardwareDetector = new HardwareDetector();
            const hardwareResult = await hardwareDetector.detect();
            
            console.log('[RVCInstaller] Hardware detectado:', hardwareResult.hardware?.gpu?.name || 'CPU');
            
            if (onProgress) {
                onProgress({
                    step: 'hardware',
                    percent: 5,
                    message: 'Hardware detectado com sucesso'
                });
            }
            
            // 2. Baixar RVC-GUI completo
            this.currentStep = 'Baixando RVC-GUI...';
            await this.installRVCGui(onProgress);
            
            // 3. Instalar edge-tts no Python do RVC-GUI
            this.currentStep = 'Instalando Edge TTS...';
            if (onProgress) {
                onProgress({
                    step: 'edge-tts',
                    percent: 92,
                    message: 'Instalando Edge TTS (Microsoft Azure)...'
                });
            }
            
            await this.installEdgeTTS();
            
            // 4. Verificar integridade
            this.currentStep = 'Verificando instalação...';
            if (onProgress) {
                onProgress({
                    step: 'verify',
                    percent: 95,
                    message: 'Verificando integridade dos arquivos...'
                });
            }
            
            this.verifyRVCGui();
            
            // 4. Criar diretório de modelos
            if (!fs.existsSync(this.modelsPath)) {
                fs.mkdirSync(this.modelsPath, { recursive: true });
            }
            
            // 5. Salvar configuração
            this.saveConfig();
            
            this.isInstalling = false;
            
            if (onProgress) {
                onProgress({
                    step: 'complete',
                    percent: 100,
                    message: 'Instalação concluída com sucesso!'
                });
            }
            
            console.log('[RVCInstaller] ✅ Instalação concluída com sucesso!');
            return { success: true };
        } catch (error) {
            this.isInstalling = false;
            console.error('[RVCInstaller] ❌ Erro na instalação:', error);
            throw error;
        }
    }

    /**
     * Cancelar instalação em andamento
     * Reseta flag isInstalling para permitir nova tentativa
     */
    cancelInstallation() {
        console.log('[RVCInstaller] Cancelando instalação...');
        this.isInstalling = false;
        this.installProgress = 0;
        this.currentStep = '';
        console.log('[RVCInstaller] Flag isInstalling resetada. Nova instalação pode ser iniciada.');
    }
}

module.exports = RVCInstaller;
