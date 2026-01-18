/**
 * GPU UI Manager - TurboVoicer v2.0.8
 * 
 * Módulo ISOLADO para interface do GPU Manager
 * Modal de confirmação + Botão de reativação
 * 
 * REGRAS DE OURO:
 * 1. Este módulo é 100% ISOLADO - não modifica código existente
 * 2. Pode ser removido facilmente sem afetar o resto do app
 * 3. Estilos inline para evitar conflitos com CSS existente
 * 
 * @version 1.0.0
 * @date 18/01/2026
 */

(function() {
    'use strict';
    
    // Estado interno
    let gpuDisabled = false;
    let gpuName = '';
    let modalElement = null;
    let statusBarElement = null;
    
    /**
     * Criar modal de confirmação
     */
    function createModal() {
        if (modalElement) return modalElement;
        
        const modal = document.createElement('div');
        modal.id = 'tv-gpu-warning-modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            z-index: 10000;
            justify-content: center;
            align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        modal.innerHTML = `
            <div style="
                background: #1a1a2e;
                border-radius: 16px;
                max-width: 500px;
                width: 90%;
                padding: 0;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                border: 1px solid #333;
                overflow: hidden;
            ">
                <!-- Header -->
                <div style="
                    background: linear-gradient(135deg, #ff6b35, #f7c531);
                    padding: 20px 24px;
                    text-align: center;
                ">
                    <h2 style="
                        margin: 0;
                        color: #000;
                        font-size: 20px;
                        font-weight: 600;
                    ">⚠️ GPU Moderna Detectada</h2>
                </div>
                
                <!-- Body -->
                <div style="padding: 24px;">
                    <p style="
                        color: #e0e0e0;
                        margin: 0 0 16px 0;
                        font-size: 15px;
                        line-height: 1.5;
                    ">
                        Sua GPU <strong id="tv-gpu-name-modal" style="color: #4facfe;"></strong> requer compatibilidade especial.
                    </p>
                    
                    <!-- Warning Box -->
                    <div style="
                        background: rgba(255, 107, 53, 0.1);
                        border: 1px solid rgba(255, 107, 53, 0.3);
                        border-radius: 8px;
                        padding: 16px;
                        margin-bottom: 16px;
                    ">
                        <h3 style="
                            margin: 0 0 12px 0;
                            color: #ff6b35;
                            font-size: 14px;
                            font-weight: 600;
                        ">🔧 O que vai acontecer:</h3>
                        <ul style="
                            margin: 0;
                            padding-left: 20px;
                            color: #ccc;
                            font-size: 13px;
                            line-height: 1.8;
                        ">
                            <li>Sua GPU será <strong style="color: #ff6b35;">temporariamente desabilitada</strong></li>
                            <li>O TurboVoicer usará a <strong style="color: #4facfe;">CPU</strong> para processamento</li>
                            <li>Seus <strong style="color: #f7c531;">monitores podem piscar</strong> por alguns segundos</li>
                            <li>A GPU será <strong style="color: #00ff88;">reabilitada automaticamente</strong> ao fechar</li>
                        </ul>
                    </div>
                    
                    <!-- Info Box -->
                    <div style="
                        background: rgba(79, 172, 254, 0.1);
                        border: 1px solid rgba(79, 172, 254, 0.3);
                        border-radius: 8px;
                        padding: 16px;
                        margin-bottom: 20px;
                    ">
                        <h3 style="
                            margin: 0 0 12px 0;
                            color: #4facfe;
                            font-size: 14px;
                            font-weight: 600;
                        ">ℹ️ Importante:</h3>
                        <ul style="
                            margin: 0;
                            padding-left: 20px;
                            color: #ccc;
                            font-size: 13px;
                            line-height: 1.8;
                        ">
                            <li><strong style="color: #f7c531;">O Windows pedirá permissão de administrador</strong> (UAC) - isso é normal e seguro</li>
                            <li>Você pode <strong style="color: #4facfe;">reativar a GPU manualmente</strong> a qualquer momento</li>
                            <li>O processamento será <strong style="color: #f7c531;">mais lento</strong> usando CPU</li>
                            <li>Evite outras tarefas pesadas durante a conversão</li>
                        </ul>
                    </div>
                    
                    <p style="
                        color: #e0e0e0;
                        margin: 0;
                        font-size: 15px;
                        font-weight: 500;
                        text-align: center;
                    ">Deseja continuar?</p>
                </div>
                
                <!-- Footer -->
                <div style="
                    display: flex;
                    gap: 12px;
                    padding: 16px 24px 24px;
                    justify-content: center;
                ">
                    <button id="tv-gpu-warning-cancel" style="
                        padding: 12px 24px;
                        border: 1px solid #555;
                        background: transparent;
                        color: #aaa;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='#333'; this.style.color='#fff';" 
                       onmouseout="this.style.background='transparent'; this.style.color='#aaa';">
                        ❌ Cancelar
                    </button>
                    <button id="tv-gpu-warning-confirm" style="
                        padding: 12px 24px;
                        border: none;
                        background: linear-gradient(135deg, #00ff88, #00cc6a);
                        color: #000;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    " onmouseover="this.style.transform='scale(1.05)';" 
                       onmouseout="this.style.transform='scale(1)';">
                        ✅ Permitir e Continuar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modalElement = modal;
        
        // Event listeners
        document.getElementById('tv-gpu-warning-cancel').addEventListener('click', () => {
            hideModal();
        });
        
        document.getElementById('tv-gpu-warning-confirm').addEventListener('click', async () => {
            hideModal();
            await disableGPU();
        });
        
        return modal;
    }
    
    /**
     * Criar barra de status GPU
     */
    function createStatusBar() {
        if (statusBarElement) return statusBarElement;
        
        const statusBar = document.createElement('div');
        statusBar.id = 'tv-gpu-status-bar';
        statusBar.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #ff6b35, #f7c531);
            padding: 8px 16px;
            z-index: 9999;
            display: none;
            align-items: center;
            justify-content: center;
            gap: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        statusBar.innerHTML = `
            <span style="
                color: #000;
                font-size: 14px;
                font-weight: 500;
            ">⚠️ GPU desabilitada para compatibilidade</span>
            <button id="tv-enable-gpu-btn" style="
                padding: 6px 16px;
                border: none;
                background: #000;
                color: #fff;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            " onmouseover="this.style.background='#333';" 
               onmouseout="this.style.background='#000';">
                🔄 Reativar GPU Agora
            </button>
        `;
        
        document.body.appendChild(statusBar);
        statusBarElement = statusBar;
        
        // Event listener
        document.getElementById('tv-enable-gpu-btn').addEventListener('click', async () => {
            await enableGPU();
        });
        
        return statusBar;
    }
    
    /**
     * Mostrar modal de confirmação
     */
    function showModal(gpuNameParam) {
        gpuName = gpuNameParam;
        const modal = createModal();
        document.getElementById('tv-gpu-name-modal').textContent = gpuName;
        modal.style.display = 'flex';
    }
    
    /**
     * Esconder modal
     */
    function hideModal() {
        if (modalElement) {
            modalElement.style.display = 'none';
        }
    }
    
    /**
     * Mostrar barra de status
     */
    function showStatusBar() {
        const statusBar = createStatusBar();
        statusBar.style.display = 'flex';
        
        // Ajustar padding do body para compensar a barra
        document.body.style.paddingTop = '44px';
    }
    
    /**
     * Esconder barra de status
     */
    function hideStatusBar() {
        if (statusBarElement) {
            statusBarElement.style.display = 'none';
            document.body.style.paddingTop = '0';
        }
    }
    
    /**
     * Desabilitar GPU
     * @param {string} gpuNameToDisable - Nome da GPU específica para desabilitar
     */
    async function disableGPU(gpuNameToDisable = null) {
        try {
            const targetGpu = gpuNameToDisable || gpuName;
            console.log('[GPU UI] Desabilitando GPU:', targetGpu || 'primeira encontrada');
            
            // Mostrar loading
            const confirmBtn = document.getElementById('tv-gpu-warning-confirm');
            if (confirmBtn) {
                confirmBtn.textContent = '⏳ Processando...';
                confirmBtn.disabled = true;
            }
            
            const result = await window.electronAPI.turboVoicerDisableGPU(targetGpu);
            
            if (result.success) {
                console.log('[GPU UI] ✅ GPU desabilitada com sucesso');
                gpuDisabled = true;
                showStatusBar();
                
                // Re-detectar hardware para atualizar UI
                if (typeof window.detectHardware === 'function') {
                    await window.detectHardware();
                }
                
                // Notificar sucesso
                if (typeof window.showNotification === 'function') {
                    window.showNotification('GPU desabilitada. Usando CPU para compatibilidade.', 'success');
                }
            } else {
                console.error('[GPU UI] ❌ Falha ao desabilitar GPU:', result.error);
                alert('Erro ao desabilitar GPU: ' + (result.error || 'Erro desconhecido'));
            }
        } catch (error) {
            console.error('[GPU UI] Erro:', error);
            alert('Erro ao desabilitar GPU: ' + error.message);
        }
    }
    
    /**
     * Reabilitar GPU
     */
    async function enableGPU() {
        try {
            console.log('[GPU UI] Reabilitando GPU...');
            
            // Mostrar loading
            const btn = document.getElementById('tv-enable-gpu-btn');
            if (btn) {
                btn.textContent = '⏳ Processando...';
                btn.disabled = true;
            }
            
            const result = await window.electronAPI.turboVoicerEnableGPU();
            
            if (result.success) {
                console.log('[GPU UI] ✅ GPU reabilitada com sucesso');
                gpuDisabled = false;
                hideStatusBar();
                
                // Re-detectar hardware para atualizar UI
                if (typeof window.detectHardware === 'function') {
                    await window.detectHardware();
                }
                
                // Notificar sucesso
                if (typeof window.showNotification === 'function') {
                    window.showNotification('GPU reabilitada com sucesso!', 'success');
                } else {
                    alert('GPU reabilitada com sucesso!');
                }
            } else {
                console.error('[GPU UI] ❌ Falha ao reabilitar GPU:', result.error);
                alert('Erro ao reabilitar GPU: ' + (result.error || 'Erro desconhecido'));
                
                // Restaurar botão
                if (btn) {
                    btn.textContent = '🔄 Reativar GPU Agora';
                    btn.disabled = false;
                }
            }
        } catch (error) {
            console.error('[GPU UI] Erro:', error);
            alert('Erro ao reabilitar GPU: ' + error.message);
        }
    }
    
    /**
     * Verificar se GPU precisa ser desabilitada e mostrar modal
     * Chamado após detecção de hardware
     */
    async function checkGPUCompatibility(hardwareResult) {
        if (!hardwareResult || !hardwareResult.profile) {
            console.log('[GPU UI] Hardware result inválido');
            return;
        }
        
        const profile = hardwareResult.profile;
        
        console.log('[GPU UI] Verificando compatibilidade GPU...');
        console.log('[GPU UI] needsGpuDisable:', profile.needsGpuDisable);
        console.log('[GPU UI] architecture:', profile.architecture);
        
        if (profile.needsGpuDisable && !gpuDisabled) {
            console.log('[GPU UI] GPU requer desabilitação. Mostrando modal...');
            const gpuName = profile.hardware?.gpu || 'GPU NVIDIA';
            showModal(gpuName);
        }
    }
    
    /**
     * Obter status atual
     */
    function getStatus() {
        return {
            gpuDisabled,
            gpuName
        };
    }
    
    /**
     * Inicializar e verificar estado anterior
     */
    async function initialize() {
        try {
            // Verificar se GPU estava desabilitada na sessão anterior
            const status = await window.electronAPI.turboVoicerGetGPUStatus();
            
            if (status.success && status.gpuDisabled) {
                console.log('[GPU UI] GPU estava desabilitada na sessão anterior');
                gpuDisabled = true;
                gpuName = status.disabledGpuName || 'GPU NVIDIA';
                showStatusBar();
            }
        } catch (error) {
            console.error('[GPU UI] Erro ao verificar estado anterior:', error);
        }
    }
    
    // Expor API pública
    window.gpuUI = {
        checkGPUCompatibility,
        showModal,
        hideModal,
        showStatusBar,
        hideStatusBar,
        disableGPU,
        enableGPU,
        getStatus,
        initialize
    };
    
    console.log('[GPU UI] ✅ Módulo GPU UI inicializado');
    
    // Inicializar automaticamente após 500ms (dar tempo para electronAPI estar pronto)
    setTimeout(() => {
        initialize();
    }, 500);
})();
