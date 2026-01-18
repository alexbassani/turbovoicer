/**
 * GPU State Manager - TurboVoicer v2.0.8
 * 
 * Gerencia persistência do estado da GPU entre sessões
 * Salva em arquivo JSON para detectar se GPU foi desabilitada
 * 
 * @version 1.0.0
 * @date 18/01/2026
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class GPUStateManager {
    constructor() {
        // Caminho do arquivo de estado
        const userDataPath = app.getPath('userData');
        this.stateFilePath = path.join(userDataPath, 'turbovoicer', 'gpu-state.json');
        
        // Garantir que diretório existe
        const dir = path.dirname(this.stateFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        console.log('[GPUState] Arquivo de estado:', this.stateFilePath);
    }
    
    /**
     * Salvar estado da GPU
     * @param {boolean} disabled - GPU está desabilitada?
     * @param {string} gpuName - Nome da GPU desabilitada
     */
    saveState(disabled, gpuName = null) {
        try {
            const state = {
                gpuDisabled: disabled,
                gpuName: gpuName,
                timestamp: new Date().toISOString()
            };
            
            fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2), 'utf8');
            console.log('[GPUState] Estado salvo:', state);
        } catch (error) {
            console.error('[GPUState] Erro ao salvar estado:', error);
        }
    }
    
    /**
     * Carregar estado da GPU
     * @returns {{gpuDisabled: boolean, gpuName: string|null, timestamp: string}|null}
     */
    loadState() {
        try {
            if (!fs.existsSync(this.stateFilePath)) {
                console.log('[GPUState] Arquivo de estado não existe');
                return null;
            }
            
            const data = fs.readFileSync(this.stateFilePath, 'utf8');
            const state = JSON.parse(data);
            
            console.log('[GPUState] Estado carregado:', state);
            return state;
        } catch (error) {
            console.error('[GPUState] Erro ao carregar estado:', error);
            return null;
        }
    }
    
    /**
     * Limpar estado (GPU foi reabilitada)
     */
    clearState() {
        try {
            if (fs.existsSync(this.stateFilePath)) {
                fs.unlinkSync(this.stateFilePath);
                console.log('[GPUState] Estado limpo');
            }
        } catch (error) {
            console.error('[GPUState] Erro ao limpar estado:', error);
        }
    }
}

// Singleton instance
let gpuStateInstance = null;

/**
 * Obter instância singleton do GPUStateManager
 * @returns {GPUStateManager}
 */
function getGPUStateManager() {
    if (!gpuStateInstance) {
        gpuStateInstance = new GPUStateManager();
    }
    return gpuStateInstance;
}

module.exports = { getGPUStateManager };
