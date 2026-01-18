/**
 * TurboVoicer - Installation Modal UI
 * Interface de instalação de dependências com progresso
 */

class InstallerUI {
    constructor() {
        this.hardware = null;
        this.isInstalling = false;
        this.isCancelling = false;
        this.progressCleanup = null;
        this.animationInterval = null;
        this.animatedMessages = [
            'Detectando hardware...',
            'Baixando Motor de Processamento (2.5 GB)...',
            'Extraindo arquivos (expande para 5.5 GB)...',
            'Verificando integridade dos arquivos...',
            'Configurando ambiente de conversão...',
            'Finalizando instalação...'
        ];
        this.currentMessageIndex = 0;
    }

    /**
     * Gerar SVG de check (sucesso)
     */
    getCheckIcon(size = 24, color = '#34C759') {
        return `
            <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="8 12 11 15 16 9"/>
            </svg>
        `;
    }

    /**
     * Gerar SVG de loading spinner (animado)
     */
    getLoadingIcon(size = 24, color = '#FF0033') {
        return `
            <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" class="tv-icon-spin">
                <circle cx="12" cy="12" r="10" opacity="0.25"/>
                <path d="M12 2 A10 10 0 0 1 22 12"/>
            </svg>
        `;
    }

    /**
     * Gerar SVG de erro
     */
    getErrorIcon(size = 24, color = '#FF3B30') {
        return `
            <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="8" y1="8" x2="16" y2="16"/>
                <line x1="16" y1="8" x2="8" y2="16"/>
            </svg>
        `;
    }

    /**
     * Gerar SVG de warning
     */
    getWarningIcon(size = 24, color = '#FF9500') {
        return `
            <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
        `;
    }

    /**
     * Mostrar modal de instalação
     */
    async show() {
        // Criar modal HTML
        const modalHTML = `
            <div id="tv-installer-modal" class="tv-installer-modal">
                <div class="tv-installer-overlay"></div>
                <div class="tv-installer-content">
                    <div class="tv-installer-header">
                        <svg width="48" height="48" viewBox="0 0 10637.44 8067.79" fill="currentColor">
                            <path d="M249.5 4742.48c-137.79,0 -249.5,-111.71 -249.5,-249.5 0,-137.79 111.71,-249.5 249.5,-249.5l2192.72 0 720.12 -3300.33 491.21 23.38 386.77 3276.94 240.02 0 529.37 -4243.48 496.08 10.72 348.21 4232.76 358 0 292.82 -2024.63 491.21 -11.7 393.64 2036.33 406.16 0 442.13 -1587.66 470.74 -27.29 653.74 1614.94 1225.51 0c137.79,0 249.5,111.71 249.5,249.5 0,137.79 -111.71,249.5 -249.5,249.5l-2414.67 0 -421.39 1513.15 -484.38 -19.49 -288.74 -1493.66 -335.65 0 -480.95 3325.32 -495.1 -15.6 -272.28 -3309.72 -474.07 0 -322.96 2588.94 -495.11 -0.97 -305.46 -2587.97 -753.59 0 -353.01 1617.9 -479.51 25.35 -546.95 -1643.25 -1214.63 0zm2702.98 -499l585.82 0 -205.65 -1742.34 -380.17 1742.34zm1830.49 0l370.77 0 -147.34 -1791 -223.42 1791zm1732.32 0l167.02 0 -95.54 -494.23 -71.48 494.23zm1596.94 0l512.47 0 -303.61 -750.01 -208.86 750.01zm-655.38 499l-170.74 0 69.96 361.89 100.78 -361.89zm-1517.04 0l-244.78 0 88.75 1078.78 156.03 -1078.78zm-1721.73 0l-118.88 0 57.79 489.65 61.09 -489.65zm-1884.74 0l-345.6 0 208.75 627.15 136.85 -627.15z"/>
                        </svg>
                        <h2>TurboVoicer - Configuração Inicial</h2>
                    </div>
                    
                    <div class="tv-installer-body" id="tv-installer-body">
                        <div class="tv-installer-welcome" id="tv-installer-welcome">
                            <div class="tv-installer-warning">
                                <div class="tv-warning-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                                <div class="tv-warning-content">
                                    <strong>Atenção: Requisitos do Sistema</strong>
                                    <p>O TurboVoicer usa processamento intensivo de IA. Requisitos mínimos:</p>
                                    <ul>
                                        <li><strong>CPU:</strong> Intel i5 / AMD Ryzen 5 ou superior (4+ cores)</li>
                                        <li><strong>RAM:</strong> 16 GB mínimo (32 GB recomendado)</li>
                                        <li><strong>GPU (opcional):</strong> NVIDIA RTX 10/20/30/40/50 series com 4+ GB VRAM</li>
                                        <li><strong>Espaço:</strong> 15 GB livres em disco (motor + vozes)</li>
                                        <li><strong>Internet:</strong> Não usar Wi-Fi. Conecte seu computador em uma internet via cabo.</li>
                                    </ul>
                                </div>
                            </div>
                            
                            <p class="tv-installer-description">
                                Para funcionar, precisamos instalar os Motores que farão a magia do TurboVoicer acontecer!
                            </p>
                            
                            <div class="tv-installer-hardware" id="tv-installer-hardware">
                                <div class="tv-spinner"></div>
                                <p>Detectando hardware...</p>
                            </div>
                            
                            <div class="tv-installer-info" id="tv-installer-info" style="display: none;">
                                <div class="tv-info-header">
                                    <strong>Configurações detectadas em seu PC:</strong>
                                </div>
                                <div class="tv-info-item">
                                    <strong>CPU:</strong>
                                    <span id="tv-hw-cpu"></span>
                                </div>
                                <div class="tv-info-item">
                                    <strong>RAM:</strong>
                                    <span id="tv-hw-ram"></span>
                                </div>
                                <div class="tv-info-item">
                                    <strong>GPU:</strong>
                                    <span id="tv-hw-gpu"></span>
                                </div>
                                <div class="tv-info-item">
                                    <strong>Tamanho total:</strong>
                                    <span id="tv-hw-size">~5.5 GB</span>
                                </div>
                                <div class="tv-info-item">
                                    <strong>Espaço livre obrigatório:</strong>
                                    <span>15 GB</span>
                                </div>
                                <div class="tv-info-item">
                                    <strong>Tempo estimado:</strong>
                                    <span id="tv-hw-time">10-20 minutos</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="tv-installer-progress" id="tv-installer-progress" style="display: none;">
                            <div class="tv-progress-step" id="tv-progress-step">
                                Preparando instalação...
                            </div>
                            
                            <div class="tv-progress-bar-container">
                                <div class="tv-progress-bar" id="tv-progress-bar"></div>
                            </div>
                            
                            <div class="tv-progress-percent" id="tv-progress-percent">0%</div>
                            
                            <div class="tv-progress-details" id="tv-progress-details">
                                <div class="tv-detail-item">
                                    <span>Motor de Processamento (2.5 GB compactado)</span>
                                    <span id="tv-status-rvc-gui" style="color: #666;">Pendente</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="tv-installer-consent" id="tv-installer-consent">
                        <label class="tv-consent-label">
                            <input type="checkbox" id="tv-consent-checkbox" class="tv-consent-checkbox">
                            <span>Li e compreendi os requisitos mínimos do sistema.</span>
                        </label>
                    </div>
                    
                    <div class="tv-installer-footer" id="tv-installer-footer">
                        <button class="tv-btn tv-btn-secondary" id="tv-installer-cancel">
                            Cancelar
                        </button>
                        <button class="tv-btn tv-btn-primary" id="tv-installer-start" disabled>
                            Iniciar Instalação
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Adicionar ao DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Adicionar estilos
        this.addStyles();

        // Setup event listeners
        this.setupEventListeners();

        // Detectar hardware
        await this.detectHardware();
    }

    /**
     * Adicionar estilos CSS
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .tv-installer-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .tv-installer-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(8px);
            }

            .tv-installer-content {
                position: relative;
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 12px;
                width: 90%;
                max-width: 550px;
                max-height: 85vh;
                overflow-y: auto;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                animation: modalSlideIn 0.3s ease-out;
            }

            .tv-installer-header {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px 20px;
                border-bottom: 1px solid #333;
            }

            .tv-installer-header svg {
                color: #FF0033;
                width: 32px;
                height: 32px;
            }

            .tv-installer-header h2 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #fff;
            }

            .tv-installer-body {
                padding: 16px 20px;
            }

            .tv-installer-intro {
                font-size: 14px;
                margin-bottom: 12px;
                color: #e6e6e6;
            }

            .tv-installer-description {
                font-size: 13px;
                margin-bottom: 12px;
                color: #999;
            }

            .tv-installer-requirements {
                list-style: none;
                padding: 0;
                margin: 0 0 12px 0;
            }

            .tv-installer-requirements li {
                padding: 4px 0;
                font-size: 13px;
                color: #e6e6e6;
            }

            .tv-installer-warning {
                display: flex;
                gap: 10px;
                padding: 12px;
                background: rgba(255, 153, 0, 0.1);
                border: 1px solid rgba(255, 153, 0, 0.3);
                border-radius: 6px;
                margin: 12px 0;
            }

            .tv-warning-icon {
                font-size: 20px;
                flex-shrink: 0;
            }

            .tv-warning-content {
                flex: 1;
            }

            .tv-warning-content strong {
                display: block;
                color: #FF9500;
                margin-bottom: 6px;
                font-size: 13px;
            }

            .tv-warning-content p {
                margin: 3px 0;
                font-size: 12px;
                color: #e6e6e6;
            }

            .tv-warning-content ul {
                margin: 6px 0;
                padding-left: 18px;
                list-style: disc;
            }

            .tv-warning-content li {
                margin: 2px 0;
                font-size: 11px;
                color: #ccc;
                line-height: 1.4;
            }

            .tv-installer-hardware {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px;
                background: #0f0f0f;
                border-radius: 6px;
                margin-bottom: 12px;
            }

            .tv-installer-info {
                background: #0f0f0f;
                border-radius: 6px;
                padding: 10px;
            }

            .tv-info-header {
                padding: 6px 0 8px 0;
                margin-bottom: 6px;
                border-bottom: 1px solid #333;
                font-size: 13px;
                color: #FF0033;
            }

            .tv-info-header strong {
                color: #FF0033;
            }

            .tv-info-item {
                display: flex;
                justify-content: space-between;
                padding: 4px 0;
                font-size: 12px;
                color: #e6e6e6;
            }

            .tv-info-item strong {
                color: #fff;
            }

            .tv-installer-progress {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .tv-progress-step {
                font-size: 14px;
                font-weight: 500;
                color: #FF0033;
            }

            .tv-progress-bar-container {
                width: 100%;
                height: 8px;
                background: #0f0f0f;
                border-radius: 4px;
                overflow: hidden;
            }

            .tv-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #FF0033, #FF3355);
                width: 0%;
                transition: width 0.3s ease;
            }

            .tv-progress-percent {
                text-align: center;
                font-size: 24px;
                font-weight: 600;
                color: #FF0033;
            }

            .tv-progress-details {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .tv-detail-item {
                display: flex;
                justify-content: space-between;
                padding: 8px 12px;
                background: #0f0f0f;
                border-radius: 6px;
                font-size: 13px;
                color: #e6e6e6;
            }

            .tv-installer-consent {
                padding: 8px 20px;
                border-top: 1px solid #333;
                background: #0f0f0f;
            }

            .tv-consent-label {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                cursor: pointer;
                font-size: 12px;
                color: #e6e6e6;
                user-select: none;
            }

            .tv-consent-label:hover {
                color: #fff;
            }

            .tv-consent-checkbox {
                margin-top: 2px;
                width: 18px;
                height: 18px;
                cursor: pointer;
                accent-color: #FF0033;
                flex-shrink: 0;
            }

            .tv-installer-footer {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                padding: 12px 20px;
                border-top: 1px solid #333;
            }
            
            /* Animação do spinner SVG */
            @keyframes tv-spin {
                from {
                    transform: rotate(0deg);
                }
                to {
                    transform: rotate(360deg);
                }
            }
            
            .tv-icon-spin {
                animation: tv-spin 1s linear infinite;
            }
            
            /* Alinhamento inline de SVG icons */
            .tv-status-icon {
                display: inline-block;
                vertical-align: middle;
                margin-right: 4px;
            }
            
            /* Responsividade para telas menores */
            @media (max-height: 768px) {
                .tv-installer-content {
                    max-height: 90vh;
                }
                
                .tv-installer-body {
                    padding: 12px 20px;
                }
                
                .tv-installer-warning {
                    padding: 10px;
                    margin: 10px 0;
                }
                
                .tv-warning-content li {
                    font-size: 10px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const btnCancel = document.getElementById('tv-installer-cancel');
        const btnStart = document.getElementById('tv-installer-start');
        const consentCheckbox = document.getElementById('tv-consent-checkbox');

        btnCancel.addEventListener('click', () => this.cancel());
        btnStart.addEventListener('click', () => this.startInstallation());
        
        // Controlar botão baseado no checkbox
        consentCheckbox.addEventListener('change', (e) => {
            btnStart.disabled = !e.target.checked;
        });
    }

    /**
     * Detectar hardware
     */
    async detectHardware() {
        try {
            const result = await window.electronAPI.detectHardware();
            
            if (result.success) {
                this.hardware = result.hardware;
                
                // Atualizar UI
                document.getElementById('tv-installer-hardware').style.display = 'none';
                document.getElementById('tv-installer-info').style.display = 'block';
                
                // Hardware é um objeto com { gpu, cpu, ram, platform }
                const { gpu, cpu, ram } = this.hardware;
                const isCuda = gpu?.hasNvidia || false;
                
                // CPU
                const cpuEl = document.getElementById('tv-hw-cpu');
                if (cpuEl) {
                    cpuEl.textContent = cpu?.model || 'Não detectado';
                }
                
                // RAM
                const ramEl = document.getElementById('tv-hw-ram');
                if (ramEl) {
                    const ramGB = ram?.totalGB ? `${ram.totalGB} GB` : 'Não detectado';
                    ramEl.textContent = ramGB;
                }
                
                // GPU
                const gpuEl = document.getElementById('tv-hw-gpu');
                if (gpuEl) {
                    if (isCuda && gpu?.name) {
                        const vramText = gpu.vramGB ? ` (${gpu.vramGB} GB VRAM)` : '';
                        gpuEl.textContent = gpu.name + vramText;
                    } else {
                        gpuEl.textContent = 'CPU apenas (sem GPU NVIDIA)';
                    }
                }
                
                // Tamanho e tempo
                const sizeEl = document.getElementById('tv-hw-size');
                if (sizeEl) {
                    sizeEl.textContent = '~5.5 GB';
                }
                
                const timeEl = document.getElementById('tv-hw-time');
                if (timeEl) {
                    timeEl.textContent = isCuda ? '15-30 minutos' : '10-20 minutos';
                }
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('[InstallerUI] Erro ao detectar hardware:', error);
            document.getElementById('tv-installer-hardware').innerHTML = `
                <p style="color: #FF0033;">❌ Erro ao detectar hardware: ${error.message}</p>
            `;
        }
    }

    /**
     * Iniciar instalação
     */
    async startInstallation() {
        if (this.isInstalling) return;
        
        this.isInstalling = true;
        
        // Esconder welcome, mostrar progress
        document.getElementById('tv-installer-welcome').style.display = 'none';
        document.getElementById('tv-installer-progress').style.display = 'flex';
        
        // Esconder checkbox e botão "Iniciar Instalação"
        const consentCheckbox = document.getElementById('tv-consent-checkbox');
        const consentLabel = consentCheckbox?.parentElement;
        if (consentLabel) consentLabel.style.display = 'none';
        
        const btnStart = document.getElementById('tv-installer-start');
        if (btnStart) btnStart.style.display = 'none';
        
        // ATIVAR botão Cancelar durante instalação
        const btnCancel = document.getElementById('tv-installer-cancel');
        if (btnCancel) {
            btnCancel.disabled = false;
            btnCancel.style.display = 'inline-block';
        }
        
        // Registrar listener de progresso
        console.log('[InstallerUI] Registrando listener de progresso...');
        console.log('[InstallerUI] window.electronAPI.onInstallProgress:', typeof window.electronAPI.onInstallProgress);
        
        this.progressCleanup = window.electronAPI.onInstallProgress((progress) => {
            console.log('[InstallerUI] ✅ PROGRESSO RECEBIDO:', progress);
            this.updateProgress(progress);
        });
        
        console.log('[InstallerUI] Listener registrado com sucesso');
        
        // Iniciar animação de mensagens
        this.startMessageAnimation();
        
        try {
            // Chamar instalação
            const result = await window.electronAPI.installDependencies();
            
            if (result.success) {
                // Sucesso!
                this.showSuccess();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            // ✅ Ignorar erro se cancelamento está em progresso
            if (this.isCancelling) {
                console.log('[InstallerUI] Erro ignorado - cancelamento em progresso');
                return;
            }
            
            console.error('[InstallerUI] Erro na instalação:', error);
            this.showError(error.message);
        }
    }

    /**
     * Iniciar animação de mensagens rotativas
     */
    startMessageAnimation() {
        this.animationInterval = setInterval(() => {
            if (!this.isInstalling) {
                clearInterval(this.animationInterval);
                return;
            }
            
            this.currentMessageIndex = (this.currentMessageIndex + 1) % this.animatedMessages.length;
            const message = this.animatedMessages[this.currentMessageIndex];
            const dots = '.'.repeat((Math.floor(Date.now() / 500) % 3) + 1);
            
            const stepEl = document.getElementById('tv-progress-step');
            if (stepEl && !stepEl.dataset.locked) {
                stepEl.textContent = message + dots;
            }
        }, 3000); // Trocar mensagem a cada 3 segundos
    }
    
    /**
     * Atualizar progresso com informações detalhadas
     */
    updateProgress(progress) {
        // Proteger contra elementos removidos do DOM (ex: após cancelamento)
        if (!this.isInstalling) {
            console.log('[InstallerUI] Ignorando progresso - instalação não está ativa');
            return;
        }
        
        console.log('[InstallerUI] Progresso:', progress);
        
        // Atualizar step atual com informações de download
        let message = progress.message || 'Instalando...';
        
        // Se tiver informações de velocidade e download, mostrar detalhes
        if (progress.speed && progress.speed > 0 && progress.downloaded && progress.total) {
            const speed = this.formatSpeed(progress.speed);
            const downloaded = this.formatBytes(progress.downloaded);
            const total = this.formatBytes(progress.total);
            
            // Mensagem completa com progresso de download
            message = `${progress.message || 'Baixando'} ${downloaded} / ${total} (${speed})`;
        } else if (progress.speed && progress.speed > 0) {
            // Só velocidade disponível
            const speed = this.formatSpeed(progress.speed);
            message = `${progress.message || 'Baixando'} (${speed})`;
        }
        
        const stepEl = document.getElementById('tv-progress-step');
        if (stepEl) {
            stepEl.textContent = message;
            stepEl.dataset.locked = 'true'; // Bloquear animação enquanto há progresso real
            
            // Desbloquear após 2 segundos
            setTimeout(() => {
                const el = document.getElementById('tv-progress-step');
                if (el) el.dataset.locked = '';
            }, 2000);
        }
        
        // Atualizar barra de progresso (com proteção)
        const percent = Math.round(progress.percent || 0);
        const progressBar = document.getElementById('tv-progress-bar');
        const progressPercent = document.getElementById('tv-progress-percent');
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
        
        // Atualizar status dos componentes
        const statusMap = {
            'hardware': 'tv-status-rvc-gui',
            'rvc-gui': 'tv-status-rvc-gui',
            'verify': 'tv-status-rvc-gui',
            'complete': 'tv-status-rvc-gui'
        };
        
        if (progress.step && statusMap[progress.step]) {
            const statusEl = document.getElementById(statusMap[progress.step]);
            if (statusEl) {
                if (percent === 100) {
                    statusEl.innerHTML = `<span class="tv-status-icon">${this.getCheckIcon(16, '#34C759')}</span>Concluído`;
                    statusEl.style.color = '#34C759';
                } else if (progress.speed && progress.speed > 0) {
                    // Mostrar velocidade durante download
                    const speed = this.formatSpeed(progress.speed);
                    statusEl.innerHTML = `<span class="tv-status-icon">${this.getLoadingIcon(16, '#FF9500')}</span>${percent}% (${speed})`;
                    statusEl.style.color = '#FF9500';
                } else {
                    statusEl.innerHTML = `<span class="tv-status-icon">${this.getLoadingIcon(16, '#FF9500')}</span>${percent}%`;
                    statusEl.style.color = '#FF9500';
                }
            }
        }
    }
    
    /**
     * Formatar bytes para leitura humana
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    /**
     * Formatar velocidade
     */
    formatSpeed(bytesPerSecond) {
        return this.formatBytes(bytesPerSecond) + '/s';
    }

    /**
     * Mostrar sucesso
     */
    showSuccess() {
        // Tocar som de conclusão
        this.playSuccessSound();
        
        const body = document.getElementById('tv-installer-body');
        body.innerHTML = `
            <div style="text-align: center; padding: 40px 0;">
                <div style="margin-bottom: 16px;">${this.getCheckIcon(64, '#34C759')}</div>
                <h3 style="margin: 0 0 8px 0; color: #fff;">Instalação Concluída!</h3>
                <p style="color: #999; margin-bottom: 20px;">O TurboVoicer está pronto para uso.</p>
                <div style="background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 8px; padding: 16px; margin: 0 20px;">
                    <p style="color: #FFA500; margin: 0; font-size: 14px; line-height: 1.6;">
                        ⚠️ <strong>Importante:</strong><br>
                        Feche a aba do TurboVoicer e abra novamente para ativar os motores instalados.
                    </p>
                </div>
            </div>
        `;
        
        const footer = document.getElementById('tv-installer-footer');
        footer.innerHTML = `
            <button class="tv-btn tv-btn-primary" id="tv-installer-close">
                Entendido
            </button>
        `;
        
        document.getElementById('tv-installer-close').addEventListener('click', () => {
            this.close();
        });
    }

    /**
     * Mostrar erro
     */
    showError(message) {
        // Simplificar mensagem de erro para o usuário (sem detalhes técnicos)
        const userMessage = message.includes('WARNING') || message.includes('PATH') || message.includes('wheel.exe')
            ? 'Ocorreu um problema durante a instalação. Tente novamente.'
            : message;
        
        const body = document.getElementById('tv-installer-body');
        body.innerHTML = `
            <div style="text-align: center; padding: 40px 0;">
                <div style="margin-bottom: 16px;">${this.getErrorIcon(64, '#FF3B30')}</div>
                <h3 style="margin: 0 0 8px 0; color: #fff;">Erro na Instalação</h3>
                <p style="color: #999; margin-bottom: 16px;">${userMessage}</p>
                <p style="color: #666; font-size: 12px;">Pressione ESC para fechar ou tente novamente.</p>
            </div>
        `;
        
        const footer = document.getElementById('tv-installer-footer');
        footer.innerHTML = `
            <button class="tv-btn tv-btn-secondary" id="tv-installer-close-error">
                Fechar
            </button>
            <button class="tv-btn tv-btn-primary" id="tv-installer-retry">
                Tentar Novamente
            </button>
        `;
        
        // Adicionar listener ESC
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.close();
                window.location.reload();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        document.getElementById('tv-installer-close-error').addEventListener('click', () => {
            this.close();
            window.location.reload();
            document.removeEventListener('keydown', escHandler);
        });
        
        document.getElementById('tv-installer-retry').addEventListener('click', () => {
            this.close();
            window.location.reload();
            document.removeEventListener('keydown', escHandler);
        });
    }

    /**
     * Cancelar instalação - MATA TODOS os processos Python/pip BRUTALMENTE
     * Aguarda 15s e limpa pasta TEMP
     */
    async cancel() {
        if (this.isInstalling) {
            // Mostrar modal de confirmação customizado
            const confirmed = await this.showCancelConfirmation();
            if (!confirmed) {
                return;
            }
            
            console.log('[InstallerUI] ⚡ CANCELAMENTO BRUTAL INICIADO ⚡');
            
            // ✅ Marcar que cancelamento está em progresso
            this.isCancelling = true;
            
            // Parar animação de mensagens
            if (this.animationInterval) {
                clearInterval(this.animationInterval);
            }
            
            // Mostrar UI de cancelamento com contador regressivo
            const body = document.getElementById('tv-installer-body');
            const footer = document.getElementById('tv-installer-footer');
            
            body.innerHTML = `
                <div style="text-align: center; padding: 40px 0;">
                    <div style="margin-bottom: 16px;">${this.getLoadingIcon(64, '#FF0033')}</div>
                    <h3 style="margin: 0 0 8px 0; color: #fff;">Cancelando Instalação...</h3>
                    <p style="color: #999; margin-bottom: 16px;">Matando processos Python/pip...</p>
                    
                    <div style="background: #0f0f0f; border-radius: 8px; padding: 16px; margin: 16px auto; max-width: 400px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 12px;">
                            <div style="font-size: 32px; font-weight: 600; color: #FF0033;" id="tv-cancel-countdown">15</div>
                            <div style="color: #666;">segundos restantes</div>
                        </div>
                        <div style="font-size: 12px; color: #666;" id="tv-cancel-status">Aguardando processos finalizarem...</div>
                    </div>
                </div>
            `;
            
            // Desabilitar botões
            footer.innerHTML = `<button class="tv-btn tv-btn-secondary" disabled>Cancelando...</button>`;
            
            try {
                // Marcar como não instalando para parar de receber eventos de progresso
                this.isInstalling = false;
                
                // Chamar cancelamento brutal via IPC (demora ~15s)
                const result = await window.electronAPI.cancelInstallation();
                
                if (result.success) {
                    console.log('[InstallerUI] ⚡ CANCELAMENTO BRUTAL CONCLUÍDO ⚡');
                    console.log('[InstallerUI] Processos mortos:', result.killedProcesses);
                    console.log('[InstallerUI] TEMP limpo:', result.cleaned);
                    
                    // Mostrar mensagem simples (SEM checkbox)
                    body.innerHTML = `
                        <div style="text-align: center; padding: 40px 0;">
                            <div style="margin-bottom: 16px;">${this.getCheckIcon(64, '#34C759')}</div>
                            <h3 style="margin: 0 0 8px 0; color: #fff;">Instalação Cancelada</h3>
                            <p style="color: #999;">Operação cancelada pelo usuário.</p>
                        </div>
                    `;
                    
                    footer.innerHTML = `<button class="tv-btn tv-btn-primary" id="tv-cancel-close">Fechar</button>`;
                    document.getElementById('tv-cancel-close').addEventListener('click', () => {
                        this.close();
                        window.location.reload();
                    });
                    
                    setTimeout(() => {
                        this.isCancelling = false;
                        this.close();
                        window.location.reload();
                    }, 5000);
                } else {
                    console.error('[InstallerUI] Erro ao cancelar:', result.error);
                    body.innerHTML = `
                        <div style="text-align: center; padding: 40px 0;">
                            <div style="margin-bottom: 16px;">${this.getCheckIcon(64, '#FF9500')}</div>
                            <h3 style="margin: 0 0 8px 0; color: #fff;">Instalação Cancelada</h3>
                            <p style="color: #999; margin-bottom: 16px;">Os processos foram finalizados com sucesso.</p>
                            <p style="color: #666; font-size: 12px;">Você pode tentar instalar novamente quando quiser.</p>
                        </div>
                    `;
                    footer.innerHTML = `<button class="tv-btn tv-btn-primary" id="tv-cancel-close-error">Fechar</button>`;
                    document.getElementById('tv-cancel-close-error').addEventListener('click', () => {
                        this.isCancelling = false;
                        this.close();
                        window.location.reload();
                    });
                }
            } catch (error) {
                console.error('[InstallerUI] Erro ao cancelar:', error);
                body.innerHTML = `
                    <div style="text-align: center; padding: 40px 0;">
                        <div style="margin-bottom: 16px;">${this.getCheckIcon(64, '#FF9500')}</div>
                        <h3 style="margin: 0 0 8px 0; color: #fff;">Instalação Cancelada</h3>
                        <p style="color: #999; margin-bottom: 16px;">Os processos foram finalizados.</p>
                        <p style="color: #666; font-size: 12px;">Você pode tentar instalar novamente quando quiser.</p>
                    </div>
                `;
                footer.innerHTML = `<button class="tv-btn tv-btn-primary" id="tv-cancel-close-error">Fechar</button>`;
                document.getElementById('tv-cancel-close-error').addEventListener('click', () => {
                    this.isCancelling = false;
                    this.close();
                    window.location.reload();
                });
            }
            
            this.isInstalling = false;
            this.isCancelling = false;
        } else {
            this.close();
        }
    }

    /**
     * Mostrar modal de confirmação de cancelamento (padrão TurboStudio)
     */
    showCancelConfirmation() {
        return new Promise((resolve) => {
            // Criar overlay e modal
            const modalOverlay = document.createElement('div');
            modalOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.2s ease-out;
            `;
            
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%);
                border: 2px solid #FF0033;
                border-radius: 12px;
                padding: 0;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(255, 0, 51, 0.3);
                animation: modalSlideIn 0.3s ease-out;
            `;
            
            modalContent.innerHTML = `
                <div style="padding: 24px; border-bottom: 1px solid #333;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <div style="font-size: 48px;">⚠️</div>
                        <h2 style="margin: 0; color: #ffc107; font-size: 20px;">Cancelar Instalação?</h2>
                    </div>
                    <p style="color: #ccc; margin: 0 0 16px 0; line-height: 1.6;">
                        A instalação está em andamento.
                    </p>
                    <div style="background: #0f0f0f; border-left: 3px solid #FF0033; padding: 12px; border-radius: 4px;">
                        <p style="color: #FF0033; margin: 0 0 8px 0; font-weight: 600;">ISTO VAI:</p>
                        <ul style="color: #999; margin: 0; padding-left: 20px; font-size: 13px;">
                            <li>Matar TODOS os processos Python e pip no seu sistema</li>
                            <li>Aguardar 15 segundos</li>
                            <li>Limpar arquivos temporários</li>
                        </ul>
                    </div>
                </div>
                <div style="padding: 16px 24px; display: flex; gap: 12px; justify-content: flex-end;">
                    <button id="tv-cancel-no" style="
                        padding: 10px 24px;
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        border-radius: 6px;
                        color: #fff;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.2s;
                    ">Continuar Instalação</button>
                    <button id="tv-cancel-yes" style="
                        padding: 10px 24px;
                        background: linear-gradient(135deg, #FF0033 0%, #B80025 100%);
                        border: none;
                        border-radius: 6px;
                        color: #fff;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        transition: all 0.2s;
                        box-shadow: 0 4px 12px rgba(255, 0, 51, 0.3);
                    ">Cancelar Instalação</button>
                </div>
            `;
            
            // Adicionar animações
            const style = document.createElement('style');
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes modalSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                #tv-cancel-no:hover {
                    background: rgba(255, 255, 255, 0.15) !important;
                    border-color: rgba(255, 255, 255, 0.3) !important;
                }
                #tv-cancel-yes:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(255, 0, 51, 0.4) !important;
                }
            `;
            document.head.appendChild(style);
            
            modalOverlay.appendChild(modalContent);
            document.body.appendChild(modalOverlay);
            
            // Event listeners
            const btnNo = document.getElementById('tv-cancel-no');
            const btnYes = document.getElementById('tv-cancel-yes');
            
            const cleanup = () => {
                modalOverlay.remove();
                style.remove();
            };
            
            btnNo.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            btnYes.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
            
            // ESC para cancelar
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    }

    /**
     * Tocar som de sucesso
     */
    playSuccessSound() {
        try {
            const audio = new Audio('assets/sounds/Alarm_end_ok.wav');
            audio.volume = 0.5;
            audio.play().catch(err => {
                console.warn('[InstallerUI] Não foi possível tocar som de conclusão:', err);
            });
        } catch (error) {
            console.warn('[InstallerUI] Erro ao criar áudio:', error);
        }
    }

    /**
     * Fechar modal
     */
    close() {
        if (this.progressCleanup) {
            this.progressCleanup();
        }
        
        const modal = document.getElementById('tv-installer-modal');
        if (modal) {
            modal.remove();
        }
    }
}

// Exportar para uso global
window.InstallerUI = InstallerUI;
