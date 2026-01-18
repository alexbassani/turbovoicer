/**
 * GPU Manager - TurboVoicer v2.0.8
 * 
 * Módulo ISOLADO para gerenciamento de GPU NVIDIA
 * Permite desabilitar/reabilitar GPU para compatibilidade com RTX 50 Series (Blackwell)
 * 
 * REGRAS DE OURO:
 * 1. Este módulo é 100% ISOLADO - não modifica código existente
 * 2. Só é ativado quando explicitamente chamado
 * 3. Sempre garante re-enable da GPU (mesmo em crash)
 * 4. Não afeta usuários com GPUs compatíveis
 * 
 * @version 1.0.0
 * @date 18/01/2026
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getGPUStateManager } = require('./gpu-state');

class GPUManager {
    constructor(appInstance) {
        this.app = appInstance;
        this.gpuDisabled = false;
        this.cleanupRegistered = false;
        this.disabledGpuName = null; // Nome da GPU que foi desabilitada (para multi-GPU)
        this.stateManager = getGPUStateManager();
        
        // Determinar caminho dos scripts
        if (this.app && this.app.isPackaged) {
            this.scriptsPath = path.join(process.resourcesPath, 'turbovoicer', 'scripts');
        } else {
            this.scriptsPath = path.join(__dirname, '..', '..', '..', 'resources', 'turbovoicer', 'scripts');
        }
        
        this.disableScriptPath = path.join(this.scriptsPath, 'disable-gpu.bat');
        this.enableScriptPath = path.join(this.scriptsPath, 'enable-gpu.bat');
        
        // Carregar estado anterior
        this.loadPreviousState();
        
        console.log('[GPUManager] Inicializado');
        console.log('[GPUManager] Scripts path:', this.scriptsPath);
    }
    
    /**
     * Carregar estado anterior da GPU
     */
    loadPreviousState() {
        const state = this.stateManager.loadState();
        if (state && state.gpuDisabled) {
            console.log('[GPUManager] Estado anterior detectado - GPU estava desabilitada');
            this.gpuDisabled = true;
            this.disabledGpuName = state.gpuName;
        }
    }
    
    /**
     * Verificar se scripts estão disponíveis
     */
    scriptsAvailable() {
        const disableExists = fs.existsSync(this.disableScriptPath);
        const enableExists = fs.existsSync(this.enableScriptPath);
        
        console.log('[GPUManager] disable-gpu.bat existe:', disableExists);
        console.log('[GPUManager] enable-gpu.bat existe:', enableExists);
        
        return disableExists && enableExists;
    }
    
    /**
     * Registrar handlers de cleanup para garantir re-enable
     * Chamado apenas quando GPU é desabilitada pela primeira vez
     */
    registerCleanupHandlers() {
        if (this.cleanupRegistered) {
            console.log('[GPUManager] Cleanup handlers já registrados');
            return;
        }
        
        console.log('[GPUManager] Registrando cleanup handlers...');
        
        // Handler para antes de fechar o app
        if (this.app) {
            this.app.on('before-quit', async (event) => {
                if (this.gpuDisabled) {
                    console.log('[GPUManager] App fechando - reabilitando GPU...');
                    event.preventDefault();
                    
                    try {
                        await this.enableGPU();
                    } catch (error) {
                        console.error('[GPUManager] Erro ao reabilitar GPU no shutdown:', error);
                    } finally {
                        this.app.exit(0);
                    }
                }
            });
        }
        
        // Handler para saída do processo (emergência)
        process.on('exit', () => {
            if (this.gpuDisabled) {
                console.log('[GPUManager] Processo terminando - tentando reabilitar GPU (síncrono)...');
                try {
                    // Usar PowerShell com elevação mesmo em modo síncrono
                    const targetGpu = this.disabledGpuName;
                    let psCommand = `Start-Process -FilePath "cmd.exe" -ArgumentList "/c","${this.enableScriptPath}"`;
                    if (targetGpu) {
                        psCommand += `,"${targetGpu}"`;
                    }
                    psCommand += ` -Verb RunAs -WindowStyle Hidden`;
                    
                    execSync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`, {
                        windowsHide: false,
                        timeout: 15000
                    });
                    console.log('[GPUManager] GPU reabilitada em emergência');
                } catch (error) {
                    console.error('[GPUManager] Falha ao reabilitar GPU em emergência:', error.message);
                }
            }
        });
        
        // Handler para sinais de interrupção
        ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(signal => {
            process.on(signal, async () => {
                if (this.gpuDisabled) {
                    console.log(`[GPUManager] Sinal ${signal} recebido - reabilitando GPU...`);
                    try {
                        await this.enableGPU();
                    } catch (error) {
                        console.error('[GPUManager] Erro ao reabilitar GPU:', error);
                    }
                    process.exit(0);
                }
            });
        });
        
        this.cleanupRegistered = true;
        console.log('[GPUManager] ✅ Cleanup handlers registrados');
    }
    
    /**
     * Desabilitar GPU NVIDIA
     * @param {string} gpuName - Nome da GPU específica para desabilitar (opcional)
     * @returns {Promise<{success: boolean, alreadyDisabled?: boolean, code?: number, output?: string, error?: string}>}
     */
    async disableGPU(gpuName = null) {
        // Verificar se já está desabilitada
        if (this.gpuDisabled) {
            console.log('[GPUManager] GPU já está desabilitada');
            return { success: true, alreadyDisabled: true };
        }
        
        // Verificar se script existe
        if (!fs.existsSync(this.disableScriptPath)) {
            const error = `Script não encontrado: ${this.disableScriptPath}`;
            console.error('[GPUManager]', error);
            return { success: false, error };
        }
        
        // Guardar nome da GPU para reabilitar depois
        this.disabledGpuName = gpuName;
        
        console.log('[GPUManager] Desabilitando GPU NVIDIA...');
        console.log('[GPUManager] GPU específica:', gpuName || 'primeira encontrada');
        console.log('[GPUManager] Executando com privilégios elevados:', this.disableScriptPath);
        
        // Preparar comando PowerShell para executar com elevação (UAC)
        // Start-Process executa o script como administrador
        let psCommand = `Start-Process -FilePath "cmd.exe" -ArgumentList "/c","${this.disableScriptPath}"`;
        if (gpuName) {
            psCommand = `Start-Process -FilePath "cmd.exe" -ArgumentList "/c","${this.disableScriptPath}","${gpuName}"`;
        }
        psCommand += ` -Verb RunAs -Wait -WindowStyle Hidden`;
        
        return new Promise((resolve) => {
            // Executar PowerShell com elevação
            const proc = spawn('powershell.exe', [
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-Command', psCommand
            ], {
                windowsHide: false // Mostrar UAC prompt
            });
            
            let stdout = '';
            let stderr = '';
            
            proc.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                console.log('[GPUManager]', output.trim());
            });
            
            proc.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                console.error('[GPUManager STDERR]', output.trim());
            });
            
            proc.on('close', (code) => {
                if (code === 0) {
                    this.gpuDisabled = true;
                    
                    // Salvar estado persistente
                    this.stateManager.saveState(true, gpuName);
                    
                    // Registrar cleanup handlers na primeira desabilitação
                    this.registerCleanupHandlers();
                    
                    console.log('[GPUManager] ✅ GPU desabilitada com sucesso');
                    resolve({ success: true, code, output: stdout });
                } else if (code === 2) {
                    // Código 2 = nenhuma GPU encontrada
                    console.log('[GPUManager] ⚠️ Nenhuma GPU NVIDIA encontrada');
                    resolve({ success: true, code, noGpuFound: true, output: stdout });
                } else {
                    console.error('[GPUManager] ❌ Falha ao desabilitar GPU (código:', code, ')');
                    resolve({ success: false, code, error: stderr || stdout });
                }
            });
            
            proc.on('error', (error) => {
                console.error('[GPUManager] Erro ao executar script:', error);
                resolve({ success: false, error: error.message });
            });
        });
    }
    
    /**
     * Reabilitar GPU NVIDIA
     * @param {string} gpuName - Nome da GPU específica para reabilitar (opcional, se null reabilita TODAS)
     * @returns {Promise<{success: boolean, alreadyEnabled?: boolean, code?: number, output?: string, error?: string}>}
     */
    async enableGPU(gpuName = null) {
        // Verificar se já está habilitada
        if (!this.gpuDisabled) {
            console.log('[GPUManager] GPU não está desabilitada');
            return { success: true, alreadyEnabled: true };
        }
        
        // Verificar se script existe
        if (!fs.existsSync(this.enableScriptPath)) {
            const error = `Script não encontrado: ${this.enableScriptPath}`;
            console.error('[GPUManager]', error);
            return { success: false, error };
        }
        
        // Usar o nome da GPU que foi desabilitada, ou o fornecido, ou null (reabilita todas)
        const targetGpu = gpuName || this.disabledGpuName;
        
        console.log('[GPUManager] Reabilitando GPU NVIDIA...');
        console.log('[GPUManager] GPU específica:', targetGpu || 'TODAS');
        console.log('[GPUManager] Executando com privilégios elevados:', this.enableScriptPath);
        
        // Preparar comando PowerShell para executar com elevação (UAC)
        let psCommand = `Start-Process -FilePath "cmd.exe" -ArgumentList "/c","${this.enableScriptPath}"`;
        if (targetGpu) {
            psCommand = `Start-Process -FilePath "cmd.exe" -ArgumentList "/c","${this.enableScriptPath}","${targetGpu}"`;
        }
        psCommand += ` -Verb RunAs -Wait -WindowStyle Hidden`;
        
        return new Promise((resolve) => {
            // Executar PowerShell com elevação
            const proc = spawn('powershell.exe', [
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-Command', psCommand
            ], {
                windowsHide: false // Mostrar UAC prompt se necessário
            });
            
            let stdout = '';
            let stderr = '';
            
            proc.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                console.log('[GPUManager]', output.trim());
            });
            
            proc.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                console.error('[GPUManager STDERR]', output.trim());
            });
            
            proc.on('close', (code) => {
                if (code === 0) {
                    this.gpuDisabled = false;
                    
                    // Limpar estado persistente
                    this.stateManager.clearState();
                    
                    console.log('[GPUManager] ✅ GPU reabilitada com sucesso');
                    resolve({ success: true, code, output: stdout });
                } else if (code === 2) {
                    // Código 2 = nenhuma GPU encontrada
                    this.gpuDisabled = false;
                    
                    // Limpar estado persistente
                    this.stateManager.clearState();
                    
                    console.log('[GPUManager] ⚠️ Nenhuma GPU NVIDIA encontrada');
                    resolve({ success: true, code, noGpuFound: true, output: stdout });
                } else {
                    // Não falhar completamente - melhor deixar flag como false
                    console.error('[GPUManager] ❌ Falha ao reabilitar GPU (código:', code, ')');
                    console.error('[GPUManager] Resetando flag gpuDisabled para false por segurança');
                    this.gpuDisabled = false;
                    
                    // Limpar estado persistente mesmo em erro
                    this.stateManager.clearState();
                    
                    resolve({ success: false, code, error: stderr || stdout });
                }
            });
            
            proc.on('error', (error) => {
                console.error('[GPUManager] Erro ao executar script:', error);
                this.gpuDisabled = false; // Reset por segurança
                resolve({ success: false, error: error.message });
            });
        });
    }
    
    /**
     * Obter status atual
     * @returns {{gpuDisabled: boolean, scriptsAvailable: boolean}}
     */
    getStatus() {
        return {
            gpuDisabled: this.gpuDisabled,
            scriptsAvailable: this.scriptsAvailable(),
            disableScriptPath: this.disableScriptPath,
            enableScriptPath: this.enableScriptPath
        };
    }
}

// Singleton instance
let gpuManagerInstance = null;

/**
 * Obter instância singleton do GPUManager
 * @param {Object} appInstance - Instância do Electron app (opcional, usado na primeira chamada)
 * @returns {GPUManager}
 */
function getGPUManager(appInstance = null) {
    if (!gpuManagerInstance) {
        gpuManagerInstance = new GPUManager(appInstance);
    }
    return gpuManagerInstance;
}

module.exports = { 
    GPUManager, 
    getGPUManager 
};
