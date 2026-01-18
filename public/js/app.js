/**
 * TurboVoicer - Main Application Logic
 * Conversão de Voz com RVC-API e Azure TTS
 */

class TurboVoicerApp {
    constructor() {
        this.state = {
            script: '',
            partitions: [],
            azureVoice: 'ava',
            rvcVoice: '',
            outputPath: '',
            isGenerating: false,
            installationChecked: false,
            hardwareProfile: null,
            manualMethod: null,
            // Audio controls
            pitch: 0,        // Edge TTS pitch (-12 a +12 semitons)
            rate: 1.0,       // Edge TTS rate (0.5x a 2.0x)
            rvcPitch: 0      // RVC f0_up_key (-12 a +12)
        };
        
        // Initialize TextPartitioner
        this.partitioner = new TextPartitioner(2000);
        
        // Initialize AudioSourceManager
        this.audioSourceManager = new AudioSourceManager();
        
        // Initialize PresetManager
        this.presetManager = new PresetManager();
        
        // Load saved audio settings
        this.loadAudioSettings();
        
        this.init();
    }
    
    async init() {
        console.log('[TurboVoicer] Inicialização aplicação...');
        
        // Inicializar acordeões
        this.initializeAccordions();
        
        // Verificar instalação de dependências
        await this.checkInstallation();
        
        // Se instalação OK, garantir que servidor RVC está rodando
        if (this.state.installationChecked) {
            await this.ensureRVCServerRunning();
        }
        
        // Detectar hardware e renderizar painel
        await this.detectAndRenderHardware();
        
        // Registrar listener de progresso de geração
        this.registerProgressListener();
        
        // Configurar event listeners
        this.setupEventListeners();
        
        // Carregar vozes RVC disponíveis
        await this.loadRVCVoices();
        
        console.log('[TurboVoicer] Aplicação inicializada com sucesso');
    }
    
    /**
     * Inicializar sistema de acordeões
     */
    initializeAccordions() {
        const accordions = document.querySelectorAll('.tv-accordion-section');
        
        accordions.forEach(accordion => {
            const header = accordion.querySelector('.tv-accordion-header');
            
            if (header) {
                header.addEventListener('click', () => {
                    const isExpanded = accordion.getAttribute('data-expanded') === 'true';
                    
                    // Fechar todos os outros acordeões
                    accordions.forEach(acc => {
                        acc.setAttribute('data-expanded', 'false');
                        const accHeader = acc.querySelector('.tv-accordion-header');
                        if (accHeader) {
                            accHeader.setAttribute('aria-expanded', 'false');
                        }
                    });
                    
                    // Toggle o acordeão clicado
                    if (!isExpanded) {
                        accordion.setAttribute('data-expanded', 'true');
                        header.setAttribute('aria-expanded', 'true');
                    }
                });
            }
        });
        
        console.log('[TurboVoicer] Acordeões inicializados:', accordions.length);
    }
    
    /**
     * Garantir que servidor RVC está rodando
     * Mostra loading overlay durante inicialização
     */
    async ensureRVCServerRunning() {
        try {
            console.log('[TurboVoicer] Verificando servidor RVC...');
            
            // Verificar se servidor já está rodando
            const statusResult = await window.electronAPI.checkServerStatus();
            
            if (statusResult.running) {
                console.log('[TurboVoicer] ✅ Servidor RVC já está rodando');
                return;
            }
            
            // Servidor não está rodando - mostrar loading e iniciar
            console.log('[TurboVoicer] Servidor RVC não está rodando. Iniciando...');
            this.showLoadingOverlay('Carregando motor de conversão de voz...');
            
            const result = await window.electronAPI.ensureServerRunning();
            
            this.hideLoadingOverlay();
            
            if (result.success && result.running) {
                console.log('[TurboVoicer] ✅ Servidor RVC iniciado com sucesso');
            } else {
                console.error('[TurboVoicer] ❌ Falha ao iniciar servidor RVC');
                window.modal.warning('Para o TurboVoicer funcionar, é preciso fechar e abrir novamente', 'Atenção');
            }
        } catch (error) {
            this.hideLoadingOverlay();
            console.error('[TurboVoicer] Erro ao verificar/iniciar servidor RVC:', error);
            window.modal.error('Erro ao iniciar motor de conversão. Tente reiniciar o aplicativo.');
        }
    }
    
    /**
     * Mostrar overlay de loading
     */
    showLoadingOverlay(message = 'Carregando...') {
        let overlay = document.getElementById('tv-loading-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'tv-loading-overlay';
            overlay.innerHTML = `
                <div class="tv-loading-content">
                    <div class="tv-loading-spinner"></div>
                    <p class="tv-loading-message">${message}</p>
                    <p class="tv-loading-submessage">O carregamento inicial pode levar até 15 minutos. Aguarde...</p>
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            const messageEl = overlay.querySelector('.tv-loading-message');
            if (messageEl) messageEl.textContent = message;
        }
        
        overlay.style.display = 'flex';
    }
    
    /**
     * Esconder overlay de loading
     */
    hideLoadingOverlay() {
        const overlay = document.getElementById('tv-loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    async detectAndRenderHardware() {
        try {
            console.log('[TurboVoicer] Detectando hardware...');
            
            const result = await window.electronAPI.detectHardware();
            
            if (result.success) {
                this.state.hardwareProfile = result.profile;
                this.renderHardwarePanel(result.hardware, result.profile);
                
                // Show warning if needed
                if (result.profile.warning) {
                    this.showHardwareWarning(result.profile);
                }
                
                // GPU Manager v2.0.8 - REMOVIDO
                // Não desabilitamos mais GPU no Device Manager (causa tela preta)
                // Agora forçamos CPU internamente quando GPU é incompatível
            }
        } catch (error) {
            console.error('[TurboVoicer] Erro ao detectar hardware:', error);
        }
    }
    
    renderHardwarePanel(hardware, profile) {
        const container = document.getElementById('tv-hardware-info');
        if (!container) return;
        
        container.innerHTML = `
            <div class="tv-hw-profile">
                <div class="tv-hw-header">
                    <h3 class="tv-hw-type">
                        ${profile.name}
                        <span class="tv-hw-badge ${profile.type}">${profile.type.toUpperCase()}</span>
                    </h3>
                    <p class="tv-hw-description">${profile.description}</p>
                </div>
                
                <div class="tv-hw-specs-grid">
                    ${hardware.gpu?.hasNvidia ? `
                        <div class="tv-hw-card">
                            <div class="tv-hw-card-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                                    <line x1="8" y1="21" x2="16" y2="21"/>
                                    <line x1="12" y1="17" x2="12" y2="21"/>
                                </svg>
                            </div>
                            <div class="tv-hw-card-content">
                                <p class="tv-hw-card-label">GPU</p>
                                <p class="tv-hw-card-value">${hardware.gpu.name}</p>
                            </div>
                        </div>
                        <div class="tv-hw-card">
                            <div class="tv-hw-card-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                </svg>
                            </div>
                            <div class="tv-hw-card-content">
                                <p class="tv-hw-card-label">VRAM</p>
                                <p class="tv-hw-card-value">${hardware.gpu.vramGB}GB</p>
                            </div>
                        </div>
                    ` : ''}
                    <div class="tv-hw-card">
                        <div class="tv-hw-card-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
                                <rect x="9" y="9" width="6" height="6"/>
                                <line x1="9" y1="1" x2="9" y2="4"/>
                                <line x1="15" y1="1" x2="15" y2="4"/>
                                <line x1="9" y1="20" x2="9" y2="23"/>
                                <line x1="15" y1="20" x2="15" y2="23"/>
                                <line x1="20" y1="9" x2="23" y2="9"/>
                                <line x1="20" y1="14" x2="23" y2="14"/>
                                <line x1="1" y1="9" x2="4" y2="9"/>
                                <line x1="1" y1="14" x2="4" y2="14"/>
                            </svg>
                        </div>
                        <div class="tv-hw-card-content">
                            <p class="tv-hw-card-label">CPU</p>
                            <p class="tv-hw-card-value">${hardware.cpu.cores} cores</p>
                        </div>
                    </div>
                    <div class="tv-hw-card">
                        <div class="tv-hw-card-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                                <line x1="12" y1="22.08" x2="12" y2="12"/>
                            </svg>
                        </div>
                        <div class="tv-hw-card-content">
                            <p class="tv-hw-card-label">RAM</p>
                            <p class="tv-hw-card-value">${hardware.ram.totalGB}GB</p>
                        </div>
                    </div>
                </div>
                
                <div class="tv-hw-requirements">
                    <h4>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="16" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        Requisitos Mínimos do Sistema
                    </h4>
                    <ul class="tv-hw-requirements-list">
                        <li><strong>Espaço em disco:</strong> Mínimo 10 GB livres</li>
                        <li><strong>CPU:</strong> Intel i5 Décima Geração ou AMD Ryzen 5 3600</li>
                        <li><strong>RAM:</strong> Mínimo 16 GB (32 GB recomendado)</li>
                        <li><strong>GPU:</strong> NVIDIA com 4GB+ VRAM (opcional, mas recomendado)</li>
                    </ul>
                </div>
                
                ${profile.warning ? `
                    <div class="tv-hw-warning">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <p>${profile.warning}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    showHardwareWarning(profile) {
        const warningPanel = document.getElementById('tv-warning-panel');
        const warningMessage = document.getElementById('tv-warning-message');
        
        if (warningPanel && warningMessage && profile.warning) {
            warningMessage.textContent = profile.warning;
            warningPanel.style.display = 'flex';
        }
    }
    
    renderPartitionsPanel(partitions) {
        const panel = document.getElementById('tv-partitions-panel');
        const list = document.getElementById('tv-partitions-list');
        
        if (!panel || !list) return;
        
        // Show panel
        panel.style.display = 'block';
        
        // Clear existing content
        list.innerHTML = '';
        
        if (!partitions || partitions.length === 0) {
            list.innerHTML = `
                <div class="tv-partitions-empty">
                    <div class="tv-partitions-empty-icon">📝</div>
                    <div class="tv-partitions-empty-text">Nenhuma partição gerada ainda</div>
                </div>
            `;
            return;
        }
        
        // Render overall progress
        const stats = this.partitioner.getStatistics();
        const overallProgress = document.createElement('div');
        overallProgress.className = 'tv-overall-progress';
        overallProgress.innerHTML = `
            <h4>📊 Progresso Geral</h4>
            <div class="tv-overall-stats">
                <div class="tv-overall-stat">
                    <div class="tv-overall-stat-label">Total</div>
                    <div class="tv-overall-stat-value">${stats.total}</div>
                </div>
                <div class="tv-overall-stat">
                    <div class="tv-overall-stat-label">Pendentes</div>
                    <div class="tv-overall-stat-value pending">${stats.pending}</div>
                </div>
                <div class="tv-overall-stat">
                    <div class="tv-overall-stat-label">Processando</div>
                    <div class="tv-overall-stat-value processing">${stats.processing}</div>
                </div>
                <div class="tv-overall-stat">
                    <div class="tv-overall-stat-label">Concluídas</div>
                    <div class="tv-overall-stat-value completed">${stats.completed}</div>
                </div>
                <div class="tv-overall-stat">
                    <div class="tv-overall-stat-label">Erros</div>
                    <div class="tv-overall-stat-value errors">${stats.errors}</div>
                </div>
            </div>
            <div class="tv-overall-progress-bar-container">
                <div class="tv-overall-progress-bar" style="width: ${stats.completionPercentage}%"></div>
            </div>
        `;
        list.appendChild(overallProgress);
        
        // Render each partition
        partitions.forEach((text, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'tv-partition-wrapper';
            wrapper.id = `tv-partition-${index}`;
            
            const state = this.partitioner.getPartitionState(index);
            
            wrapper.innerHTML = `
                <div class="tv-partition-item">
                    <div class="tv-part-number">${String(index + 1).padStart(2, '0')}</div>
                    <textarea 
                        class="tv-part-text" 
                        rows="4" 
                        readonly
                        id="tv-part-text-${index}"
                    >${text}</textarea>
                    <div class="tv-part-side">
                        <div class="tv-status-icon tv-status-${state.status}" id="tv-status-${index}"></div>
                    </div>
                </div>
                <div class="tv-part-progress">
                    <div class="tv-part-progress-bar" id="tv-progress-${index}" style="width: ${state.progress}%"></div>
                </div>
                <div class="tv-part-audio" id="tv-audio-${index}" style="display: none;">
                    <audio controls>
                        <source src="" type="audio/mpeg">
                    </audio>
                </div>
                <div class="tv-part-error" id="tv-error-${index}" style="display: none;"></div>
            `;
            
            list.appendChild(wrapper);
            
            // Add double-click to edit
            const textarea = wrapper.querySelector(`#tv-part-text-${index}`);
            textarea.addEventListener('dblclick', () => {
                textarea.readOnly = false;
                textarea.focus();
                textarea.selectionStart = textarea.value.length;
            });
            
            textarea.addEventListener('blur', () => {
                textarea.readOnly = true;
                const newText = textarea.value || '';
                this.partitioner.updatePartitionText(index, newText);
            });
        });
    }
    
    updatePartitionStatus(index, status, progress = null, audioPath = null, error = null) {
        const statusIcon = document.getElementById(`tv-status-${index}`);
        const progressBar = document.getElementById(`tv-progress-${index}`);
        const audioContainer = document.getElementById(`tv-audio-${index}`);
        const errorContainer = document.getElementById(`tv-error-${index}`);
        
        // Update partitioner state
        const updates = { status };
        if (progress !== null) updates.progress = progress;
        if (audioPath !== null) updates.audioPath = audioPath;
        if (error !== null) updates.error = error;
        
        this.partitioner.updatePartitionState(index, updates);
        
        // Update UI
        if (statusIcon) {
            statusIcon.className = `tv-status-icon tv-status-${status}`;
        }
        
        if (progressBar && progress !== null) {
            progressBar.style.width = `${progress}%`;
        }
        
        if (audioContainer && audioPath) {
            const audio = audioContainer.querySelector('audio source');
            if (audio) {
                audio.src = audioPath;
                audioContainer.querySelector('audio').load();
                audioContainer.style.display = 'block';
            }
        }
        
        if (errorContainer && error) {
            errorContainer.textContent = error;
            errorContainer.style.display = 'block';
        } else if (errorContainer) {
            errorContainer.style.display = 'none';
        }
        
        // Update overall progress
        this.updateOverallProgress();
    }
    
    updateOverallProgress() {
        const stats = this.partitioner.getStatistics();
        const overallProgress = document.querySelector('.tv-overall-progress');
        
        if (!overallProgress) return;
        
        // Update stats
        const statValues = overallProgress.querySelectorAll('.tv-overall-stat-value');
        if (statValues.length >= 5) {
            statValues[0].textContent = stats.total;
            statValues[1].textContent = stats.pending;
            statValues[2].textContent = stats.processing;
            statValues[3].textContent = stats.completed;
            statValues[4].textContent = stats.errors;
        }
        
        // Update progress bar
        const progressBar = overallProgress.querySelector('.tv-overall-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${stats.completionPercentage}%`;
        }
    }
    
    async checkInstallation() {
        try {
            console.log('[TurboVoicer] Verificando instalação de dependências...');
            
            const result = await window.electronAPI.checkInstallation();
            
            if (!result.installed) {
                console.log('[TurboVoicer] Dependências não instaladas. Iniciando instalação...');
                await this.showInstallationModal();
                // Após instalação bem-sucedida, marcar como verificado
                this.state.installationChecked = true;
            } else {
                console.log('[TurboVoicer] Dependências já instaladas');
                this.state.installationChecked = true;
            }
        } catch (error) {
            console.error('[TurboVoicer] Erro ao verificar instalação:', error);
            
            // Mostrar botão de reparar instalação
            const repairBtn = document.createElement('button');
            repairBtn.className = 'tv-btn tv-btn-primary';
            repairBtn.textContent = '🔧 Reparar Instalação';
            repairBtn.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999;';
            repairBtn.onclick = () => this.repairInstallation();
            document.body.appendChild(repairBtn);
            
            window.modal.error('Erro ao verificar instalação. Clique em "Reparar Instalação" para corrigir.');
        }
    }
    
    async repairInstallation() {
        try {
            console.log('[TurboVoicer] Reparando instalação...');
            await this.showInstallationModal();
        } catch (error) {
            console.error('[TurboVoicer] Erro ao reparar instalação:', error);
            window.modal.error('Erro ao reparar instalação. Tente reiniciar o aplicativo.');
        }
    }
    
    async showInstallationModal() {
        try {
            console.log('[TurboVoicer] Mostrando modal de instalação...');
            
            // Criar e mostrar modal de instalação
            const installer = new InstallerUI();
            await installer.show();
            
            this.state.installationChecked = true;
        } catch (error) {
            console.error('[TurboVoicer] Erro ao mostrar modal de instalação:', error);
            window.modal.error('Erro ao iniciar instalação. Por favor, reinicie o aplicativo.');
        }
    }
    
    setupEventListeners() {
        console.log('[TurboVoicer] Configurando event listeners...');
        
        // Script input
        const scriptInput = document.getElementById('tv-script-input');
        if (scriptInput) {
            scriptInput.addEventListener('input', () => this.handleScriptChange());
        }
        
        // Azure voice selection
        const azureVoiceInputs = document.querySelectorAll('input[name="azure-voice"]');
        azureVoiceInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                this.state.azureVoice = e.target.value;
            });
        });
        
        // RVC voice selection
        const rvcVoiceSelect = document.getElementById('tv-rvc-voice');
        if (rvcVoiceSelect) {
            rvcVoiceSelect.addEventListener('change', (e) => {
                this.state.rvcVoice = e.target.value;
                this.updateConfigurationBadge();
            });
        }
        
        // Output folder selection
        const btnSelectFolder = document.getElementById('tv-btn-select-folder');
        const inputOutputPath = document.getElementById('tv-output-path');
        
        const selectFolderHandler = (e) => {
            console.log('[TurboVoicer] ⚡ Seleção de pasta solicitada!', e.target.id, e.target.className);
            e.preventDefault();
            e.stopPropagation();
            this.selectOutputFolder();
        };
        
        if (btnSelectFolder) {
            console.log('[TurboVoicer] Botão encontrado:', btnSelectFolder);
            btnSelectFolder.addEventListener('click', selectFolderHandler);
            btnSelectFolder.addEventListener('mousedown', (e) => {
                console.log('[TurboVoicer] MOUSEDOWN no botão!', e);
            });
            btnSelectFolder.addEventListener('mouseup', (e) => {
                console.log('[TurboVoicer] MOUSEUP no botão!', e);
            });
        }
        
        // Permitir clicar no input também
        if (inputOutputPath) {
            console.log('[TurboVoicer] Input encontrado - adicionando listener');
            inputOutputPath.style.cursor = 'pointer';
            inputOutputPath.addEventListener('click', selectFolderHandler);
            
            // Adicionar listener no parent div também - sempre chamar quando clicar em qualquer lugar
            const parentDiv = inputOutputPath.parentElement;
            if (parentDiv) {
                console.log('[TurboVoicer] Parent div encontrado:', parentDiv.className);
                parentDiv.addEventListener('click', (e) => {
                    console.log('[TurboVoicer] ⚡ CLIQUE detectado no parent div! Target:', e.target.id || e.target.className);
                    // Sempre chamar, independente do target
                    selectFolderHandler(e);
                });
            }
        }
        
        // Manage voices
        const btnManageVoices = document.getElementById('tv-btn-manage-voices');
        btnManageVoices.addEventListener('click', () => this.manageVoices());
        
        // Generate button
        const btnGenerate = document.getElementById('tv-btn-generate');
        btnGenerate.addEventListener('click', () => this.generateAudio());
        
        // Cancel button
        const btnCancel = document.getElementById('tv-btn-cancel');
        btnCancel.addEventListener('click', () => this.cancelGeneration());
        
        // Clear button
        const btnClear = document.getElementById('tv-btn-clear');
        btnClear.addEventListener('click', () => this.clearAll());
        
        // Load TXT button
        const btnLoadTxt = document.getElementById('tv-btn-load-txt');
        btnLoadTxt?.addEventListener('click', () => this.loadTextFile());
        
        // Manual override checkbox
        const manualOverride = document.getElementById('tv-manual-override');
        const overrideControls = document.getElementById('tv-override-controls');
        manualOverride?.addEventListener('change', (e) => {
            if (overrideControls) {
                overrideControls.style.display = e.target.checked ? 'block' : 'none';
            }
        });
        
        // Method selector
        const methodSelect = document.getElementById('tv-method-select');
        methodSelect?.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            
            // Bloquear seleção de GPU se GPU for incompatível
            if (this.state.hardwareProfile?.gpuIncompatible && selectedValue === 'rmvpe') {
                window.modal.warning(
                    `GPU ${this.state.hardwareProfile.incompatibleGpuName} não tem suporte para Motores Modificadores de Vozes.`,
                    'GPU Incompatível'
                );
                // Resetar para CPU
                methodSelect.value = 'pm';
                this.state.manualMethod = 'pm';
                return;
            }
            
            this.state.manualMethod = selectedValue === 'auto' ? null : selectedValue;
            console.log('[TurboVoicer] Método manual selecionado:', this.state.manualMethod);
        });
        
        // Audio Controls - Pitch Slider (Edge TTS)
        const pitchSlider = document.getElementById('tv-pitch-slider');
        const pitchValue = document.getElementById('tv-pitch-value');
        pitchSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.state.pitch = value;
            pitchValue.textContent = `${value > 0 ? '+' : ''}${value} st`;
            this.saveAudioSettings();
        });
        
        // Audio Controls - Rate Slider (Edge TTS)
        const rateSlider = document.getElementById('tv-rate-slider');
        const rateValue = document.getElementById('tv-rate-value');
        rateSlider?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.state.rate = value;
            rateValue.textContent = `${value.toFixed(1)}x`;
            this.saveAudioSettings();
        });
        
        // Audio Controls - RVC Pitch Slider (Tom)
        const rvcPitchSlider = document.getElementById('tv-pitch-slider');
        const rvcPitchValue = document.getElementById('tv-pitch-value');
        rvcPitchSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.state.rvcPitch = value;
            rvcPitchValue.textContent = `${value > 0 ? '+' : ''}${value} st`;
            console.log(`[TurboVoicer] 🎵 RVC Pitch alterado para: ${value}`);
            this.saveAudioSettings();
        });
        
        // Botão Resetar Controles de Áudio
        const btnResetAudioControls = document.getElementById('tv-btn-reset-audio-controls');
        btnResetAudioControls?.addEventListener('click', () => this.resetAudioControls());
    }
    
    handleScriptChange() {
        const scriptInput = document.getElementById('tv-script-input');
        const charCount = document.getElementById('tv-char-count');
        const partitionPreview = document.getElementById('tv-partition-preview');
        
        this.state.script = scriptInput.value;
        charCount.textContent = this.state.script.length;
        
        // Preview de particionamento
        if (this.state.script.trim()) {
            const partitions = this.partitionText(this.state.script);
            partitionPreview.textContent = `(~${partitions.length} partições)`;
        } else {
            partitionPreview.textContent = '';
        }
        
        // Atualizar badges
        this.updateScriptBadge();
        this.updateConfigurationBadge();
    }
    
    /**
     * Atualizar badge de roteiro
     */
    updateScriptBadge() {
        const badge = document.getElementById('status-script');
        if (!badge) return;
        
        const hasScript = this.state.script && this.state.script.trim().length > 0;
        
        if (hasScript) {
            badge.textContent = 'Configurado';
            badge.className = 'tv-status-badge success';
        } else {
            badge.textContent = 'Pendente';
            badge.className = 'tv-status-badge pending';
        }
    }
    
    partitionText(text, maxLen = 2000) {
        // Reutilizar lógica do TurboTTS
        const normalized = text
            .replace(/\r/g, ' ')
            .replace(/\n+/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
        
        if (!normalized) return [];
        
        const sentences = normalized.match(/[^.!?]+[.!?]?/g) || [normalized];
        const parts = [];
        let current = '';
        
        for (const s of sentences) {
            const seg = s.trim();
            if (!seg) continue;
            
            const candidate = (current ? current + ' ' : '') + seg;
            if (candidate.length > maxLen && current) {
                parts.push(current.trim());
                current = seg;
            } else {
                current = candidate;
            }
        }
        
        if (current.trim()) parts.push(current.trim());
        
        return parts;
    }
    
    async loadRVCVoices() {
        try {
            console.log('[TurboVoicer] Carregando vozes RVC instaladas...');
            
            const select = document.getElementById('tv-rvc-voice');
            select.innerHTML = '<option value="">Carregando...</option>';
            
            // Get installed voices
            const result = await window.electronAPI.getInstalledVoices();
            const installedVoices = result?.voices || [];
            
            // Load catalog to get voice names
            const catalogResult = await window.electronAPI.loadCatalog();
            const catalog = catalogResult?.catalog;
            
            select.innerHTML = '';
            
            if (installedVoices.length === 0) {
                select.innerHTML = '<option value="">Nenhuma voz instalada - Clique em "Gerenciar Vozes"</option>';
            } else {
                // Map installed voices to catalog entries
                installedVoices.forEach(installedVoice => {
                    // Find voice in catalog
                    let voiceName = installedVoice.voiceId;
                    let isCustom = false;
                    
                    if (catalog) {
                        for (const [categoryKey, category] of Object.entries(catalog.categories)) {
                            const voice = category.voices.find(v => v.id === installedVoice.voiceId);
                            if (voice) {
                                voiceName = `${voice.name} (${voice.descriptor})`;
                                break;
                            }
                        }
                    }
                    
                    // Se não encontrou no catálogo, é uma voz customizada
                    if (voiceName === installedVoice.voiceId) {
                        isCustom = true;
                        // Formatar nome customizado: remover prefixo "custom_" e capitalizar
                        const cleanName = installedVoice.voiceId.replace(/^custom_/, '').replace(/_/g, ' ');
                        voiceName = `${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)} (Customizada)`;
                    }
                    
                    const option = document.createElement('option');
                    option.value = installedVoice.voiceId;
                    option.textContent = voiceName;
                    select.appendChild(option);
                });
                
                // Selecionar primeira voz
                if (installedVoices.length > 0) {
                    this.state.rvcVoice = installedVoices[0].voiceId;
                }
            }
            
            console.log('[TurboVoicer] Vozes RVC carregadas:', installedVoices.length);
        } catch (error) {
            console.error('[TurboVoicer] Erro ao carregar vozes RVC:', error);
            const select = document.getElementById('tv-rvc-voice');
            select.innerHTML = '<option value="">Erro ao carregar vozes</option>';
        }
    }
    
    async loadTextFile() {
        try {
            console.log('[TurboVoicer] Abrindo diálogo para selecionar arquivo TXT...');
            
            // Open file dialog usando selectFiles (método correto)
            const fileResult = await window.electronAPI.selectFiles({
                properties: ['openFile'],
                filters: [
                    { name: 'Arquivos de Texto', extensions: ['txt'] },
                    { name: 'Todos os Arquivos', extensions: ['*'] }
                ]
            });
            
            console.log('[TurboVoicer] selectFiles retornou:', fileResult);
            
            // selectFiles retorna array de strings diretamente
            if (fileResult && Array.isArray(fileResult) && fileResult.length > 0) {
                const filePath = fileResult[0];
                console.log('[TurboVoicer] Lendo arquivo:', filePath);
                
                // Read file content via IPC
                const fileContent = await window.electronAPI.readFile(filePath);
                
                // Converter ArrayBuffer para string
                let content;
                if (fileContent instanceof ArrayBuffer) {
                    const decoder = new TextDecoder('utf-8');
                    content = decoder.decode(fileContent);
                } else {
                    content = fileContent?.data || fileContent;
                }
                
                console.log('[TurboVoicer] Conteúdo lido:', content ? content.length + ' chars' : 'vazio');
                
                if (content) {
                    const scriptInput = document.getElementById('tv-script-input');
                    scriptInput.value = content;
                    
                    // Trigger change event
                    this.handleScriptChange();
                    
                    console.log('[TurboVoicer] Arquivo TXT carregado com sucesso:', filePath);
                } else {
                    console.warn('[TurboVoicer] Arquivo vazio ou erro ao ler');
                }
            } else {
                console.log('[TurboVoicer] Seleção de arquivo cancelada ou sem resultado');
            }
        } catch (error) {
            console.error('[TurboVoicer] Erro ao carregar arquivo TXT:', error);
            window.modal.error('Erro ao carregar arquivo: ' + error.message);
        }
    }
    
    async selectOutputFolder() {
        try {
            console.log('[TurboVoicer] Chamando selectFolder...');
            const result = await window.electronAPI.selectFolder();
            console.log('[TurboVoicer] selectFolder retornou:', result);
            
            // O selectFolder retorna a string do caminho diretamente
            if (result && typeof result === 'string') {
                this.state.outputPath = result;
                const inputElement = document.getElementById('tv-output-path');
                if (inputElement) {
                    inputElement.value = this.state.outputPath;
                    inputElement.placeholder = this.state.outputPath;
                }
                console.log('[TurboVoicer] Pasta selecionada:', this.state.outputPath);
                this.updateConfigurationBadge();
            } else {
                console.log('[TurboVoicer] Seleção cancelada ou sem resultado');
            }
        } catch (error) {
            console.error('[TurboVoicer] Erro ao selecionar pasta:', error);
            window.modal.error('Erro ao selecionar pasta de saída.');
        }
    }
    
    manageVoices() {
        // TODO: Implementar gerenciamento de vozes na Fase 4
        window.modal.info('Gerenciamento de vozes será implementado na próxima fase.');
    }
    
    /**
     * Atualizar badge de configuração baseado no estado atual
     */
    updateConfigurationBadge() {
        const badge = document.getElementById('status-configuration');
        if (!badge) return;
        
        const audioSource = this.audioSourceManager.getCurrentSource();
        const sourceData = this.audioSourceManager.getSourceData();
        
        let isConfigured = false;
        
        // Verificar se voz RVC está selecionada
        const hasRvcVoice = this.state.rvcVoice && this.state.rvcVoice !== '';
        
        // Verificar se pasta de saída está selecionada
        const hasOutputPath = this.state.outputPath && this.state.outputPath !== '';
        
        // Para fonte 'batch', verificar se pasta de origem foi selecionada
        if (audioSource === 'batch') {
            const hasBatchFolder = sourceData.batchFolder && sourceData.batchFiles && sourceData.batchFiles.length > 0;
            isConfigured = hasRvcVoice && hasBatchFolder;
        } else {
            // Para outras fontes, verificar voz + pasta de saída
            isConfigured = hasRvcVoice && hasOutputPath;
        }
        
        if (isConfigured) {
            badge.textContent = 'Configurado';
            badge.className = 'tv-status-badge success';
        } else {
            badge.textContent = 'Pendente';
            badge.className = 'tv-status-badge pending';
        }
        
        console.log('[TurboVoicer] Badge de configuração atualizado:', {
            audioSource,
            hasRvcVoice,
            hasOutputPath,
            hasBatchFolder: audioSource === 'batch' ? (sourceData.batchFolder && sourceData.batchFiles?.length > 0) : null,
            isConfigured
        });
    }
    
    async generateAudio() {
        try {
            // Obter fonte de áudio atual
            const audioSource = this.audioSourceManager.getCurrentSource();
            const sourceData = this.audioSourceManager.getSourceData();
            
            // Configuração para validação
            const config = {
                script: this.state.script,
                rvcVoice: this.state.rvcVoice,
                outputPath: this.state.outputPath,
                hardwareProfile: this.state.hardwareProfile,
                audioSource: audioSource
            };
            
            // Validações específicas por fonte
            if (audioSource === 'recording') {
                // Verificar se há gravação
                const recordedBlob = this.audioSourceManager.audioRecorder.getRecordedBlob();
                if (!recordedBlob) {
                    window.modal.show('warning', 'Atenção', 'Nenhuma gravação disponível. Por favor, grave um áudio primeiro.');
                    return;
                }
                
                // Salvar gravação antes de processar
                const saveResult = await this.audioSourceManager.saveRecording();
                if (!saveResult.success) {
                    window.modal.show('error', 'Erro', `Falha ao salvar gravação: ${saveResult.error}`);
                    return;
                }
                
                config.sourceAudioPaths = [saveResult.path];
            } else if (audioSource === 'import') {
                // Verificar se arquivo foi selecionado
                if (!sourceData.importedFile) {
                    window.modal.show('warning', 'Atenção', 'Nenhum arquivo selecionado. Por favor, selecione um arquivo de áudio.');
                    return;
                }
                
                config.sourceAudioPaths = [sourceData.importedFile];
            } else if (audioSource === 'batch') {
                // Verificar se pasta foi selecionada e tem arquivos
                if (!sourceData.batchFolder || !sourceData.batchFiles || sourceData.batchFiles.length === 0) {
                    window.modal.show('warning', 'Atenção', 'Nenhuma pasta selecionada ou nenhum arquivo de áudio encontrado. Por favor, selecione uma pasta com arquivos de áudio.');
                    return;
                }
                
                // Marcar como conversão em lote para não esconder a barra no finally
                this.isBatchConversion = true;
                
                // Executar conversão em lote
                // IMPORTANTE: A barra de progresso será gerenciada pelos eventos de progresso do AudioSourceManager
                try {
                    await this.audioSourceManager.convertBatch();
                } catch (error) {
                    console.error('[TurboVoicer] Erro na conversão em lote:', error);
                    window.modal.show('error', 'Erro', `Falha na conversão em lote:\n\n${error.message}`);
                    this.isBatchConversion = false; // Resetar flag em caso de erro
                }
                return; // Retornar ANTES do finally
            }
            
            // Validar com ValidationManager
            if (window.validationManager) {
                const validation = await window.validationManager.validateBeforeGeneration(config);
                
                if (!validation.valid) {
                    if (validation.error) {
                        window.modal.show('warning', 'Atenção', validation.error);
                    }
                    return;
                }
                
                // Mostrar estimativas
                if (validation.estimates) {
                    console.log('[TurboVoicer] Estimativas:', validation.estimates);
                }
            }
            
            this.state.isGenerating = true;
            this.updateUIForGeneration(true);
            
            // Mostrar barra de progresso
            this.showProgressBar();
            
            // Obter nome personalizado do arquivo
            const outputName = document.getElementById('tv-output-name').value.trim() || 'TurboVoicer';
            
            // Configuração completa de geração
            const generationConfig = {
                audioSource: audioSource,
                rvcVoice: this.state.rvcVoice,
                rvcPitch: this.state.rvcPitch,
                outputPath: this.state.outputPath,
                outputName: outputName,
                hardwareProfile: this.state.hardwareProfile
            };
            
            // Adicionar configurações específicas por fonte
            if (audioSource === 'text') {
                // Particionar texto
                this.state.partitions = this.partitioner.partition(this.state.script);
                this.renderPartitions(this.state.partitions);
                
                generationConfig.script = this.state.script;
                generationConfig.partitions = this.state.partitions;
                generationConfig.edgeVoice = this.state.azureVoice;
                generationConfig.pitch = this.state.pitch;
                generationConfig.rate = this.state.rate;
            } else {
                // Usar áudio fornecido
                generationConfig.sourceAudioPaths = config.sourceAudioPaths;
                // Aplicar rate também para áudios importados/gravados (via FFmpeg)
                generationConfig.rate = this.state.rate;
            }
            
            console.log('[TurboVoicer] Iniciando geração de áudio...', generationConfig);
            console.log('[TurboVoicer] Pitch config:', {
                edgePitch: generationConfig.pitch,      // Edge TTS (sempre 0)
                rvcPitch: generationConfig.rvcPitch     // RVC (valor do usuário)
            });
            
            const startTime = Date.now();
            
            // Chamar backend para gerar áudio
            const result = await window.electronAPI.generateAudio(generationConfig);
            
            const totalTime = Math.floor((Date.now() - startTime) / 1000);
            
            console.log('[TurboVoicer] Geração concluída:', result);
            
            // Mostrar modal de sucesso com botão "Abrir Pasta"
            if (window.validationManager) {
                window.validationManager.showSuccessWithOpenFolder(result.outputPath, {
                    partitions: audioSource === 'text' ? this.state.partitions.length : 1,
                    totalTime: totalTime
                });
            } else {
                window.modal.show('success', 'Sucesso', 
                    `Áudio gerado com sucesso!\n\nArquivo: ${result.outputPath}`
                );
            }
            
        } catch (error) {
            console.error('[TurboVoicer] Erro ao gerar áudio:', error);
            window.modal.show('error', 'Erro', `Falha ao gerar áudio:\n\n${error.message}`);
        } finally {
            this.state.isGenerating = false;
            this.updateUIForGeneration(false);
            
            // Ocultar barra de progresso (exceto para conversão em lote)
            if (!this.isBatchConversion) {
                this.hideProgressBar();
            }
        }
    }
    
    async cancelGeneration() {
        try {
            await window.electronAPI.cancelGeneration();
            this.state.isGenerating = false;
            this.updateUIForGeneration(false);
            window.modal.info('Geração cancelada.');
        } catch (error) {
            console.error('[TurboVoicer] Erro ao cancelar geração:', error);
        }
    }
    
    clearAll() {
        // Limpar script
        document.getElementById('tv-script-input').value = '';
        this.state.script = '';
        this.handleScriptChange();
        
        // Limpar partições
        this.state.partitions = [];
        document.getElementById('tv-partitions-panel').style.display = 'none';
        
        // Limpar pasta de saída
        this.state.outputPath = '';
        document.getElementById('tv-output-path').value = '';
        
        console.log('[TurboVoicer] Tudo limpo');
    }
    
    loadAudioSettings() {
        try {
            const saved = localStorage.getItem('turbovoicer_audio_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.state.pitch = settings.pitch || 0;
                this.state.rate = settings.rate || 1.0;
                this.state.rvcPitch = settings.rvcPitch || 0;
                
                console.log('[TurboVoicer] Configurações de áudio carregadas:', settings);
                
                // Aplicar valores nos sliders após DOM carregar
                setTimeout(() => {
                    this.applyAudioSettingsToUI();
                }, 100);
            }
        } catch (error) {
            console.error('[TurboVoicer] Erro ao carregar configurações de áudio:', error);
        }
    }
    
    saveAudioSettings() {
        try {
            const settings = {
                pitch: this.state.pitch,
                rate: this.state.rate,
                rvcPitch: this.state.rvcPitch
            };
            localStorage.setItem('turbovoicer_audio_settings', JSON.stringify(settings));
            console.log('[TurboVoicer] Configurações de áudio salvas:', settings);
        } catch (error) {
            console.error('[TurboVoicer] Erro ao salvar configurações de áudio:', error);
        }
    }
    
    applyAudioSettingsToUI() {
        // Pitch slider
        const pitchSlider = document.getElementById('tv-pitch-slider');
        const pitchValue = document.getElementById('tv-pitch-value');
        if (pitchSlider && pitchValue) {
            pitchSlider.value = this.state.pitch;
            pitchValue.textContent = `${this.state.pitch > 0 ? '+' : ''}${this.state.pitch} st`;
        }
        
        // Rate slider
        const rateSlider = document.getElementById('tv-rate-slider');
        const rateValue = document.getElementById('tv-rate-value');
        if (rateSlider && rateValue) {
            rateSlider.value = this.state.rate;
            rateValue.textContent = `${this.state.rate.toFixed(1)}x`;
        }
        
        // RVC Pitch slider (Tom)
        const rvcPitchSlider = document.getElementById('tv-pitch-slider');
        const rvcPitchValue = document.getElementById('tv-pitch-value');
        if (rvcPitchSlider && rvcPitchValue) {
            rvcPitchSlider.value = this.state.rvcPitch;
            rvcPitchValue.textContent = `${this.state.rvcPitch > 0 ? '+' : ''}${this.state.rvcPitch} st`;
        }
    }
    
    resetAudioControls() {
        console.log('[TurboVoicer] Resetando controles de áudio para valores padrão');
        
        // Resetar valores no state para os padrões
        this.state.pitch = 0;
        this.state.rate = 1.0;
        this.state.rvcPitch = 0;
        
        // Aplicar valores resetados na UI
        this.applyAudioSettingsToUI();
        
        // Salvar configurações resetadas
        this.saveAudioSettings();
        
        console.log('[TurboVoicer] Controles de áudio resetados:', {
            pitch: this.state.pitch,
            rate: this.state.rate,
            rvcPitch: this.state.rvcPitch
        });
    }
    
    updateUIForGeneration(isGenerating) {
        const btnGenerate = document.getElementById('tv-btn-generate');
        const btnCancel = document.getElementById('tv-btn-cancel');
        const btnClear = document.getElementById('tv-btn-clear');
        const scriptInput = document.getElementById('tv-script-input');
        
        if (isGenerating) {
            btnGenerate.style.display = 'none';
            btnCancel.style.display = 'inline-block';
            btnClear.disabled = true;
            scriptInput.disabled = true;
        } else {
            btnGenerate.style.display = 'inline-block';
            btnCancel.style.display = 'none';
            btnClear.disabled = false;
            scriptInput.disabled = false;
        }
    }
    
    renderPartitions() {
        const panel = document.getElementById('tv-partitions-panel');
        const list = document.getElementById('tv-partitions-list');
        
        panel.style.display = 'block';
        list.innerHTML = '';
        
        this.state.partitions.forEach((text, index) => {
            const item = document.createElement('div');
            item.className = 'tv-partition-item';
            item.innerHTML = `
                <div class="tv-partition-header">
                    <span class="tv-partition-number">Partição ${String(index + 1).padStart(2, '0')}</span>
                </div>
                <div class="tv-partition-text">${text}</div>
                <div class="tv-partition-progress">
                    <div class="tv-partition-progress-bar" style="width: 0%"></div>
                </div>
            `;
            list.appendChild(item);
        });
    }
    
    /**
     * Registrar listener de progresso de geração
     */
    registerProgressListener() {
        if (window.electronAPI && window.electronAPI.onGenerationProgress) {
            window.electronAPI.onGenerationProgress((data) => {
                this.updateProgressBar(data);
            });
            console.log('[TurboVoicer] Listener de progresso registrado');
        }
    }
    
    /**
     * Mostrar barra de progresso
     */
    showProgressBar() {
        const container = document.getElementById('tv-progress-container');
        if (container) {
            container.style.display = 'block';
            this.updateProgressBar({ partition: 0, total: 1, status: 'starting', message: 'Iniciando...' });
        }
    }
    
    /**
     * Ocultar barra de progresso
     */
    hideProgressBar() {
        const container = document.getElementById('tv-progress-container');
        if (container) {
            setTimeout(() => {
                container.style.display = 'none';
            }, 1000);
        }
    }
    
    /**
     * Atualizar barra de progresso
     */
    updateProgressBar(data) {
        const { partition, total, status, message } = data;
        
        // Calcular porcentagem
        const percentage = total > 0 ? Math.round(((partition + 1) / total) * 100) : 0;
        
        // Atualizar elementos
        const progressFill = document.getElementById('tv-progress-fill');
        const progressMessage = document.getElementById('tv-progress-message');
        const progressPercentage = document.getElementById('tv-progress-percentage');
        const progressPartition = document.getElementById('tv-progress-partition');
        const progressStatus = document.getElementById('tv-progress-status');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressMessage) {
            progressMessage.textContent = message || 'Processando...';
        }
        
        if (progressPercentage) {
            progressPercentage.textContent = `${percentage}%`;
        }
        
        if (progressPartition) {
            if (status === 'concatenating') {
                progressPartition.textContent = 'Finalizando...';
            } else {
                progressPartition.textContent = `Partição ${partition + 1}/${total}`;
            }
        }
        
        if (progressStatus) {
            const statusText = {
                'processing': '⏳ Processando',
                'completed': '✅ Concluído',
                'concatenating': '🔗 Concatenando',
                'starting': '🚀 Iniciando'
            };
            progressStatus.textContent = statusText[status] || '';
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.turboVoicerApp = new TurboVoicerApp();
    window.turboVoicerApp.registerProgressListener();
    
    // Expor função de detecção de hardware globalmente (para GPU UI v2.0.8)
    window.detectHardware = () => window.turboVoicerApp.detectAndRenderHardware();
});
