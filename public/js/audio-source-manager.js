/**
 * AudioSourceManager - Gerenciador de Fonte de Áudio
 * TurboVoicer - Controla UI e lógica de gravação/importação
 */

class AudioSourceManager {
    constructor() {
        this.currentSource = 'text'; // 'text' | 'recording' | 'import' | 'batch'
        this.audioRecorder = new AudioRecorder();
        
        // Gravação
        this.recordingFolder = null;
        this.savedRecordingPath = null; // Armazenar caminho do arquivo já salvo
        
        // Importação
        this.importedFile = null;
        this.importDestFolder = null;
        
        // Conversão em lote
        this.batchFolder = null;
        this.batchFiles = [];
        
        this.initializeUI();
        this.setupBatchProgressListener();
        
        // DEBUG: Monitorar mudanças no display da barra de progresso
        setTimeout(() => {
            const progressContainer = document.getElementById('tv-progress-container');
            if (progressContainer) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.attributeName === 'style') {
                            const display = progressContainer.style.display;
                            console.log('[AudioSourceManager] 🔴 BARRA DE PROGRESSO - display mudou para:', display);
                            console.trace('[AudioSourceManager] Stack trace de quem mudou:');
                        }
                    });
                });
                observer.observe(progressContainer, { attributes: true });
                console.log('[AudioSourceManager] 🔵 MutationObserver configurado para monitorar barra de progresso');
            }
        }, 1000);
    }

    /**
     * Inicializar UI e event listeners
     */
    initializeUI() {
        // Radio buttons
        const radioButtons = document.querySelectorAll('input[name="tv-audio-source"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (e) => this.handleSourceChange(e.target.value));
        });
        
        // Fazer cards clicáveis
        const audioSourceOptions = document.querySelectorAll('.tv-audio-source-option');
        audioSourceOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                // Não processar se clicou em botão ou controle
                if (e.target.closest('button') || e.target.closest('.tv-source-controls')) {
                    return;
                }
                
                // Encontrar radio button dentro do card
                const radio = option.querySelector('input[type="radio"]');
                if (radio && !radio.checked) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change'));
                }
            });
        });
        
        // === GRAVAÇÃO ===
        const btnRecord = document.getElementById('tv-btn-record');
        const btnStopRecord = document.getElementById('tv-btn-stop-record');
        const btnPreviewRecord = document.getElementById('tv-btn-preview-record');
        const btnChooseFolder = document.getElementById('tv-btn-choose-folder');
        
        // Criar funções bound para poder remover listeners
        this._startRecordingHandler = () => this.startRecording();
        this._stopRecordingHandler = () => this.stopRecording();
        this._previewRecordingHandler = () => this.previewRecording();
        this._chooseRecordingFolderHandler = () => this.chooseRecordingFolder();
        
        // Remover listeners antigos (se existirem) e adicionar novos
        btnRecord?.removeEventListener('click', this._startRecordingHandler);
        btnRecord?.addEventListener('click', this._startRecordingHandler);
        
        btnStopRecord?.removeEventListener('click', this._stopRecordingHandler);
        btnStopRecord?.addEventListener('click', this._stopRecordingHandler);
        
        btnPreviewRecord?.removeEventListener('click', this._previewRecordingHandler);
        btnPreviewRecord?.addEventListener('click', this._previewRecordingHandler);
        
        btnChooseFolder?.removeEventListener('click', this._chooseRecordingFolderHandler);
        btnChooseFolder?.addEventListener('click', this._chooseRecordingFolderHandler);
        
        // === IMPORTAÇÃO ===
        const btnSelectAudio = document.getElementById('tv-btn-select-audio');
        const btnPreviewImport = document.getElementById('tv-btn-preview-import');
        const btnChooseDest = document.getElementById('tv-btn-choose-dest');
        
        btnSelectAudio?.addEventListener('click', () => this.selectAudioFile());
        btnPreviewImport?.addEventListener('click', () => this.previewImportedAudio());
        btnChooseDest?.addEventListener('click', () => this.chooseDestFolder());
        
        // === CONVERSÃO EM LOTE ===
        const btnSelectBatchFolder = document.getElementById('tv-btn-select-batch-folder');
        const btnConvertBatch = document.getElementById('tv-btn-convert-batch');
        const checkboxSubfolders = document.getElementById('tv-batch-include-subfolders');
        const outputModeContainer = document.getElementById('tv-batch-output-mode-container');
        
        // Criar funções bound para poder remover listeners
        this._selectBatchFolderHandler = () => this.selectBatchFolder();
        this._convertBatchHandler = () => this.convertBatch();
        
        // Remover listeners antigos (se existirem) e adicionar novos
        btnSelectBatchFolder?.removeEventListener('click', this._selectBatchFolderHandler);
        btnSelectBatchFolder?.addEventListener('click', this._selectBatchFolderHandler);
        
        btnConvertBatch?.removeEventListener('click', this._convertBatchHandler);
        btnConvertBatch?.addEventListener('click', this._convertBatchHandler);
        
        // Mostrar/esconder opções de concatenação baseado no checkbox de subpastas
        checkboxSubfolders?.addEventListener('change', (e) => {
            if (outputModeContainer) {
                outputModeContainer.style.display = e.target.checked ? 'block' : 'none';
            }
        });
        
        console.log('[AudioSourceManager] UI inicializada');
    }

    /**
     * Lidar com mudança de fonte de áudio
     */
    handleSourceChange(source) {
        console.log('[AudioSourceManager] Fonte alterada:', source);
        this.currentSource = source;
        
        // Esconder todos os controles
        document.getElementById('tv-recording-controls').style.display = 'none';
        document.getElementById('tv-import-controls').style.display = 'none';
        document.getElementById('tv-batch-controls').style.display = 'none';
        
        // Mostrar controles da fonte selecionada
        if (source === 'recording') {
            document.getElementById('tv-recording-controls').style.display = 'block';
        } else if (source === 'import') {
            document.getElementById('tv-import-controls').style.display = 'block';
        } else if (source === 'batch') {
            document.getElementById('tv-batch-controls').style.display = 'block';
        }
        
        // Desabilitar campo "Nome do Arquivo" quando não for roteiro em texto
        const outputNameInput = document.getElementById('tv-output-name');
        const outputNameGroup = document.querySelector('.tv-output-name-group');
        
        if (source === 'text') {
            // Habilitar campo para roteiro em texto
            if (outputNameInput) {
                outputNameInput.disabled = false;
                outputNameInput.style.opacity = '1';
                outputNameInput.style.cursor = 'text';
            }
            if (outputNameGroup) {
                outputNameGroup.style.opacity = '1';
            }
        } else {
            // Desabilitar campo para outras fontes (recording, import, batch)
            if (outputNameInput) {
                outputNameInput.disabled = true;
                outputNameInput.style.opacity = '0.5';
                outputNameInput.style.cursor = 'not-allowed';
            }
            if (outputNameGroup) {
                outputNameGroup.style.opacity = '0.5';
            }
        }
    }

    /**
     * Obter fonte de áudio atual
     */
    getCurrentSource() {
        return this.currentSource;
    }

    // ========================================
    // GRAVAÇÃO
    // ========================================

    /**
     * Iniciar gravação
     */
    async startRecording() {
        // Verificar se pasta foi escolhida
        if (!this.recordingFolder) {
            window.modal.show('warning', 'Atenção', 'Por favor, escolha uma pasta de destino antes de gravar.');
            return;
        }
        
        // Resetar caminho salvo ao iniciar nova gravação
        this.savedRecordingPath = null;
        console.log('[AudioSourceManager] Iniciando nova gravação - caminho resetado');
        
        const btnRecord = document.getElementById('tv-btn-record');
        const btnStopRecord = document.getElementById('tv-btn-stop-record');
        const btnPreviewRecord = document.getElementById('tv-btn-preview-record');
        const timer = document.getElementById('tv-recording-timer');
        
        // Iniciar gravação
        const result = await this.audioRecorder.startRecording();
        
        if (!result.success) {
            window.modal.show('error', 'Erro', result.error);
            return;
        }
        
        // Atualizar UI
        btnRecord.disabled = true;
        btnRecord.classList.add('recording');
        btnStopRecord.disabled = false;
        btnPreviewRecord.disabled = true;
        
        // Adicionar animação de gravação no timer
        if (timer) {
            timer.classList.add('recording-active');
        }
        
        console.log('[AudioSourceManager] Gravação iniciada');
    }

    /**
     * Parar gravação
     */
    async stopRecording() {
        const btnRecord = document.getElementById('tv-btn-record');
        const btnStopRecord = document.getElementById('tv-btn-stop-record');
        const btnPreviewRecord = document.getElementById('tv-btn-preview-record');
        const timer = document.getElementById('tv-recording-timer');
        
        // Parar gravação
        const result = this.audioRecorder.stopRecording();
        
        if (!result.success) {
            window.modal.show('error', 'Erro', result.error);
            return;
        }
        
        // Atualizar UI
        btnRecord.disabled = false;
        btnRecord.classList.remove('recording');
        btnStopRecord.disabled = true;
        btnPreviewRecord.disabled = false;
        
        // Remover animação de gravação
        if (timer) {
            timer.classList.remove('recording-active');
        }
        
        console.log('[AudioSourceManager] Gravação parada');
        
        // Aguardar blob estar disponível (MediaRecorder.onstop é assíncrono)
        await this.waitForBlob();
        
        console.log('[AudioSourceManager] Blob disponível:', !!this.audioRecorder.getRecordedBlob());
        console.log('[AudioSourceManager] URL disponível:', !!this.audioRecorder.getRecordedURL());
        
        // Salvar automaticamente
        console.log('[AudioSourceManager] Salvando gravação automaticamente...');
        const saveResult = await this.saveRecording();
        
        if (saveResult.success) {
            // Armazenar caminho para reutilizar ao gerar áudio
            this.savedRecordingPath = saveResult.path;
            console.log('[AudioSourceManager] Caminho armazenado:', this.savedRecordingPath);
            window.modal.show('success', 'Sucesso', `Gravação salva em:\n${saveResult.path}`);
        } else {
            window.modal.show('error', 'Erro ao Salvar', saveResult.error);
        }
    }

    /**
     * Aguardar blob estar disponível (resolver race condition)
     */
    async waitForBlob() {
        return new Promise((resolve) => {
            const checkBlob = () => {
                if (this.audioRecorder.getRecordedBlob()) {
                    resolve();
                } else {
                    setTimeout(checkBlob, 100);
                }
            };
            checkBlob();
        });
    }

    /**
     * Preview da gravação
     */
    previewRecording() {
        const btnPreview = document.getElementById('tv-btn-preview-record');
        
        // Se já está tocando, parar
        if (this.previewAudio && !this.previewAudio.paused) {
            this.previewAudio.pause();
            this.previewAudio = null;
            btnPreview.textContent = '▶ Preview';
            btnPreview.classList.remove('playing');
            console.log('[AudioSourceManager] Preview parado');
            return;
        }
        
        const url = this.audioRecorder.getRecordedURL();
        
        if (!url) {
            window.modal.show('error', 'Erro', 'Nenhuma gravação disponível para preview.');
            return;
        }
        
        // Parar preview anterior se existir
        if (this.previewAudio) {
            this.previewAudio.pause();
            this.previewAudio = null;
        }
        
        // Criar elemento de áudio para preview
        this.previewAudio = new Audio(url);
        
        // Atualizar botão para "Parar Preview"
        btnPreview.textContent = '⏹ Parar Preview';
        btnPreview.classList.add('playing');
        
        // Quando terminar, voltar ao normal
        this.previewAudio.onended = () => {
            btnPreview.textContent = '▶ Preview';
            btnPreview.classList.remove('playing');
            this.previewAudio = null;
        };
        
        // Tocar áudio
        this.previewAudio.play().catch(error => {
            console.error('[AudioSourceManager] Erro ao tocar preview:', error);
            btnPreview.textContent = '▶ Preview';
            btnPreview.classList.remove('playing');
            this.previewAudio = null;
        });
        
        console.log('[AudioSourceManager] Preview da gravação iniciado');
    }

    /**
     * Escolher pasta de destino para gravação
     */
    async chooseRecordingFolder() {
        try {
            const result = await window.electronAPI.selectFolder();
            
            // selectFolder pode retornar string direta ou objeto {success, path}
            const folderPath = typeof result === 'string' ? result : result?.path;
            
            if (folderPath) {
                this.recordingFolder = folderPath;
                
                // Atualizar UI
                const pathValue = document.getElementById('tv-recording-path-value');
                if (pathValue) {
                    pathValue.textContent = folderPath;
                }
                
                console.log('[AudioSourceManager] Pasta de gravação selecionada:', folderPath);
            }
        } catch (error) {
            console.error('[AudioSourceManager] Erro ao selecionar pasta:', error);
            window.modal.show('error', 'Erro', 'Falha ao selecionar pasta de destino.');
        }
    }

    /**
     * Salvar gravação
     */
    async saveRecording() {
        console.log('[AudioSourceManager] saveRecording() chamado');
        
        // Se já existe um arquivo salvo, reutilizar ao invés de duplicar
        if (this.savedRecordingPath) {
            console.log('[AudioSourceManager] Reutilizando arquivo já salvo:', this.savedRecordingPath);
            return { success: true, path: this.savedRecordingPath };
        }
        
        const blob = this.audioRecorder.getRecordedBlob();
        
        if (!blob) {
            return { success: false, error: 'Nenhuma gravação disponível' };
        }
        
        if (!this.recordingFolder) {
            return { success: false, error: 'Pasta de destino não selecionada' };
        }
        
        try {
            // Obter nome personalizado ou gerar com timestamp
            const nameInput = document.getElementById('tv-recording-name');
            let fileName = nameInput?.value.trim();
            
            // Se não tiver nome, usar timestamp para evitar conflitos
            if (!fileName) {
                const now = new Date();
                const timestamp = now.toISOString().slice(0, 19).replace(/[-:T]/g, '');
                fileName = `gravacao_${timestamp}`;
            }
            
            // Converter blob para ArrayBuffer
            const arrayBuffer = await blob.arrayBuffer();
            
            // Enviar para backend
            const result = await window.electronAPI.saveRecording({
                audioData: Array.from(new Uint8Array(arrayBuffer)),
                destFolder: this.recordingFolder,
                fileName: fileName
            });
            
            if (result.success) {
                console.log('[AudioSourceManager] Gravação salva:', result.path);
                return { success: true, path: result.path };
            } else {
                throw new Error(result.error || 'Erro ao salvar gravação');
            }
        } catch (error) {
            console.error('[AudioSourceManager] Erro ao salvar gravação:', error);
            return { success: false, error: error.message };
        }
    }

    // ========================================
    // IMPORTAÇÃO
    // ========================================

    /**
     * Selecionar arquivo de áudio
     */
    async selectAudioFile() {
        try {
            const result = await window.electronAPI.selectAudioFile();
            
            if (result.success && result.path) {
                this.importedFile = result.path;
                
                // Atualizar UI
                const fileName = document.getElementById('tv-import-file-name');
                const importInfo = document.getElementById('tv-import-info');
                const btnPreview = document.getElementById('tv-btn-preview-import');
                
                if (fileName) {
                    fileName.textContent = result.path.split('\\').pop();
                }
                
                if (importInfo) {
                    importInfo.style.display = 'flex';
                }
                
                if (btnPreview) {
                    btnPreview.disabled = false;
                }
                
                console.log('[AudioSourceManager] Arquivo selecionado:', result.path);
            }
        } catch (error) {
            console.error('[AudioSourceManager] Erro ao selecionar arquivo:', error);
            window.modal.show('error', 'Erro', 'Falha ao selecionar arquivo de áudio.');
        }
    }

    /**
     * Preview do áudio importado
     */
    previewImportedAudio() {
        if (!this.importedFile) {
            window.modal.show('warning', 'Atenção', 'Nenhum arquivo selecionado.');
            return;
        }
        
        // Criar player de áudio
        const audio = new Audio(`file://${this.importedFile}`);
        audio.play();
        
        console.log('[AudioSourceManager] Preview do arquivo importado');
    }

    /**
     * Escolher pasta de destino para importação
     */
    async chooseDestFolder() {
        try {
            const result = await window.electronAPI.selectFolder();
            
            if (result.success && result.path) {
                this.importDestFolder = result.path;
                
                // Atualizar UI
                const destValue = document.getElementById('tv-import-dest-value');
                if (destValue) {
                    destValue.textContent = result.path;
                }
                
                console.log('[AudioSourceManager] Pasta de destino selecionada:', result.path);
            }
        } catch (error) {
            console.error('[AudioSourceManager] Erro ao selecionar pasta:', error);
            window.modal.show('error', 'Erro', 'Falha ao selecionar pasta de destino.');
        }
    }

    // ========================================
    // CONVERSÃO EM LOTE
    // ========================================

    /**
     * Selecionar pasta para conversão em lote
     */
    async selectBatchFolder() {
        console.log('[AudioSourceManager] selectBatchFolder() chamado');
        
        try {
            const result = await window.electronAPI.selectAudioFolder();
            
            console.log('[AudioSourceManager] Resultado do selectAudioFolder:', result);
            
            if (result.success && result.folder) {
                this.batchFolder = result.folder;
                this.batchFiles = result.files || [];
                
                // Atualizar UI
                const folderName = document.getElementById('tv-batch-folder-name');
                const filesCount = document.querySelector('.tv-files-count');
                const batchInfo = document.getElementById('tv-batch-info');
                const btnConvert = document.getElementById('tv-btn-convert-batch');
                
                if (folderName) {
                    folderName.textContent = result.folder;
                    folderName.title = result.folder; // Tooltip com caminho completo
                }
                
                if (filesCount) {
                    const countText = this.batchFiles.length === 0 
                        ? 'Nenhum arquivo de áudio encontrado'
                        : `${this.batchFiles.length} arquivo(s) de áudio encontrado(s)`;
                    filesCount.textContent = countText;
                }
                
                if (batchInfo) {
                    batchInfo.style.display = 'flex';
                }
                
                if (btnConvert) {
                    btnConvert.disabled = this.batchFiles.length === 0;
                }
                
                console.log('[AudioSourceManager] Pasta selecionada:', result.folder);
                console.log('[AudioSourceManager] Arquivos encontrados:', this.batchFiles.length);
                
                // Atualizar badge de configuração
                if (window.turboVoicerApp && window.turboVoicerApp.updateConfigurationBadge) {
                    window.turboVoicerApp.updateConfigurationBadge();
                }
                
                // Feedback visual de sucesso
                if (this.batchFiles.length > 0) {
                    window.modal.show('success', 'Pasta Selecionada', 
                        `${this.batchFiles.length} arquivo(s) de áudio encontrado(s) em:\n${result.folder}`);
                } else {
                    window.modal.show('warning', 'Atenção', 
                        `Nenhum arquivo de áudio (MP3, WAV, OGG) encontrado na pasta selecionada.`);
                }
            } else if (result.success === false && !result.error) {
                // Usuário cancelou a seleção
                console.log('[AudioSourceManager] Seleção de pasta cancelada pelo usuário');
            }
        } catch (error) {
            console.error('[AudioSourceManager] Erro ao selecionar pasta:', error);
            window.modal.show('error', 'Erro', `Falha ao selecionar pasta de áudios:\n${error.message}`);
        }
    }

    /**
     * Converter todos os arquivos em lote
     */
    async convertBatch() {
        if (this.batchFiles.length === 0) {
            window.modal.show('warning', 'Atenção', 'Nenhum arquivo para converter.');
            return;
        }
        
        // Obter configuração RVC e velocidade
        const rvcVoice = document.getElementById('tv-rvc-voice')?.value;
        const rvcPitch = parseInt(document.getElementById('tv-pitch-slider')?.value || 0);
        const rate = parseFloat(document.getElementById('tv-rate-slider')?.value || 1.0);
        
        // Obter opções de subpastas e concatenação
        const includeSubfolders = document.getElementById('tv-batch-include-subfolders')?.checked || false;
        const outputMode = document.getElementById('tv-batch-output-mode')?.value || 'individual';
        
        if (!rvcVoice) {
            window.modal.show('warning', 'Atenção', 'Selecione uma voz de destino antes de converter.');
            return;
        }
        
        console.log('[AudioSourceManager] Iniciando conversão em lote com:', {
            files: this.batchFiles.length,
            rvcVoice,
            rvcPitch,
            rate,
            includeSubfolders,
            outputMode
        });
        
        // Usar barra de progresso global (abaixo dos botões)
        const progressContainer = document.getElementById('tv-progress-container');
        const progressFill = document.getElementById('tv-progress-fill');
        const progressMessage = document.getElementById('tv-progress-message');
        const progressPercentage = document.getElementById('tv-progress-percentage');
        const progressPartition = document.getElementById('tv-progress-partition');
        const btnGenerate = document.getElementById('tv-btn-generate');
        const btnCancel = document.getElementById('tv-btn-cancel');
        
        if (progressContainer) {
            progressContainer.style.display = 'block';
            console.log('[AudioSourceManager] Barra de progresso global exibida');
        } else {
            console.warn('[AudioSourceManager] Elemento tv-progress-container não encontrado!');
        }
        
        if (btnGenerate) btnGenerate.disabled = true;
        if (btnCancel) {
            btnCancel.style.display = 'inline-block';
            btnCancel.onclick = () => this.cancelBatch();
        }
        
        try {
            console.log('[AudioSourceManager] 🔵 Verificando window.electronAPI.convertAudioBatch...');
            console.log('[AudioSourceManager] Existe?', !!window.electronAPI.convertAudioBatch);
            console.log('[AudioSourceManager] Tipo:', typeof window.electronAPI.convertAudioBatch);
            
            // Iniciar conversão em lote (retorna imediatamente)
            console.log('[AudioSourceManager] 🔵 Chamando convertAudioBatch com:', {
                files: this.batchFiles.length,
                rvcVoice,
                rvcPitch,
                rate
            });
            
            const result = await window.electronAPI.convertAudioBatch({
                files: this.batchFiles,
                folder: this.batchFolder,
                rvcVoice,
                rvcPitch,
                rate,
                includeSubfolders,
                outputMode
            });
            
            console.log('[AudioSourceManager] 🔵 Resultado de convertAudioBatch:', result);
            console.log('[AudioSourceManager] result.success?', result?.success);
            
            if (!result.success) {
                throw new Error(result.error || 'Erro ao iniciar conversão');
            }
            
            console.log('[AudioSourceManager] ✅ Conversão em lote iniciada com sucesso!');
            console.log('[AudioSourceManager] Aguardando eventos de progresso via setupBatchProgressListener...');
            
            // IMPORTANTE: Não esconder a barra aqui!
            // A barra só deve ser escondida quando os eventos completed/error chegarem
            // Os eventos são tratados por setupBatchProgressListener()
            
        } catch (error) {
            console.error('[AudioSourceManager] ❌ ERRO CRÍTICO ao iniciar conversão:', error);
            console.error('[AudioSourceManager] Tipo do erro:', error.constructor.name);
            console.error('[AudioSourceManager] Mensagem:', error.message);
            console.error('[AudioSourceManager] Stack do erro:', error.stack);
            console.error('[AudioSourceManager] ⚠️ ATENÇÃO: Vou esconder a barra de progresso por causa do erro!');
            window.modal.show('error', 'Erro', `Falha ao iniciar conversão: ${error.message}`);
            
            // Apenas resetar UI se realmente falhou ao iniciar
            const progressContainer = document.getElementById('tv-progress-container');
            const btnGenerate = document.getElementById('tv-btn-generate');
            const btnCancel = document.getElementById('tv-btn-cancel');
            const progressFill = document.getElementById('tv-progress-fill');
            
            console.log('[AudioSourceManager] 🔴 ESCONDENDO BARRA DE PROGRESSO (erro no catch)');
            if (progressContainer) progressContainer.style.display = 'none';
            if (btnGenerate) btnGenerate.disabled = false;
            if (btnCancel) btnCancel.style.display = 'none';
            if (progressFill) progressFill.style.width = '0%';
        }
    }

    /**
     * Configurar listener para progresso de conversão em lote
     */
    setupBatchProgressListener() {
        if (window.electronAPI && window.electronAPI.onBatchProgress) {
            console.log('[AudioSourceManager] ✅ Listener de progresso de lote registrado');
            window.electronAPI.onBatchProgress((progress) => {
                try {
                    console.log('[AudioSourceManager] 📥 Progresso de lote recebido:', progress);
                    console.log('[AudioSourceManager] Status:', progress.status);
                    
                    if (progress.status === 'completed') {
                        console.log('[AudioSourceManager] 🎉 Status COMPLETED detectado! Chamando handleBatchCompleted...');
                        // Conversão concluída
                        this.handleBatchCompleted(progress.files);
                    } else if (progress.status === 'error') {
                        console.log('[AudioSourceManager] ❌ Status ERROR detectado!');
                        // Erro na conversão
                        this.handleBatchError(progress.error);
                    } else if (progress.status === 'processing') {
                        console.log('[AudioSourceManager] ⏳ Status PROCESSING - atualizando progresso...');
                        // Atualizar progresso
                        this.updateBatchProgress(progress.current, progress.total, progress.file);
                    }
                } catch (error) {
                    console.error('[AudioSourceManager] ❌ ERRO CRÍTICO no listener de progresso:', error);
                    console.error('[AudioSourceManager] Stack trace:', error.stack);
                    // NÃO esconder a barra mesmo com erro
                }
            });
        } else {
            console.warn('[AudioSourceManager] ⚠️ onBatchProgress não disponível!');
        }
    }

    /**
     * Atualizar progresso da conversão em lote
     */
    updateBatchProgress(current, total, filename) {
        const progressFill = document.getElementById('tv-progress-fill');
        const progressMessage = document.getElementById('tv-progress-message');
        const progressPercentage = document.getElementById('tv-progress-percentage');
        const progressPartition = document.getElementById('tv-progress-partition');
        
        const percentage = Math.round((current / total) * 100);
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressMessage) {
            progressMessage.textContent = `Convertendo: ${filename || ''}`;
        }
        
        if (progressPercentage) {
            progressPercentage.textContent = `${percentage}%`;
        }
        
        if (progressPartition) {
            progressPartition.textContent = `Arquivo ${current}/${total}`;
        }
        
        console.log(`[AudioSourceManager] Progresso: ${current}/${total} (${percentage}%) - ${filename}`);
    }

    /**
     * Lidar com conclusão da conversão em lote
     */
    handleBatchCompleted(files) {
        console.log('[AudioSourceManager] 🎉 Conversão em lote concluída!');
        console.log('[AudioSourceManager] Files recebidos:', files);
        console.log('[AudioSourceManager] Tipo de files:', typeof files);
        console.log('[AudioSourceManager] Array?', Array.isArray(files));
        console.log('[AudioSourceManager] Length:', files ? files.length : 'undefined');
        
        const progressContainer = document.getElementById('tv-progress-container');
        const progressFill = document.getElementById('tv-progress-fill');
        const btnGenerate = document.getElementById('tv-btn-generate');
        const btnCancel = document.getElementById('tv-btn-cancel');
        
        // Resetar flag de conversão em lote no app
        if (window.app && window.app.isBatchConversion) {
            window.app.isBatchConversion = false;
            console.log('[AudioSourceManager] Flag isBatchConversion resetada no app');
        }
        
        // Resetar UI
        if (progressContainer) progressContainer.style.display = 'none';
        if (btnGenerate) btnGenerate.disabled = false;
        if (btnCancel) btnCancel.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
        
        // Usar modal com botão "Abrir Pasta" (mesmo modal do ValidationManager)
        if (window.validationManager && files && files.length > 0) {
            console.log('[AudioSourceManager] ✅ Usando ValidationManager.showSuccessWithOpenFolder');
            // Pegar a pasta do primeiro arquivo convertido
            const firstFile = files[0];
            const folderPath = firstFile.substring(0, firstFile.lastIndexOf('\\'));
            
            console.log('[AudioSourceManager] Pasta:', folderPath);
            console.log('[AudioSourceManager] Arquivos:', files.length);
            
            window.validationManager.showSuccessWithOpenFolder(folderPath, {
                partitions: files.length,
                totalTime: 0
            });
        } else {
            console.warn('[AudioSourceManager] ⚠️ Usando modal simples (SEM SOM)');
            console.warn('[AudioSourceManager] validationManager?', !!window.validationManager);
            console.warn('[AudioSourceManager] files?', !!files);
            console.warn('[AudioSourceManager] files.length?', files ? files.length : 'N/A');
            
            // Fallback para modal simples se ValidationManager não estiver disponível
            window.modal.show('success', 'Conversão Concluída', 
                `${files ? files.length : 0} arquivo(s) convertido(s) com sucesso!`);
        }
    }

    /**
     * Lidar com erro na conversão em lote
     */
    handleBatchError(error) {
        console.error('[AudioSourceManager] Erro na conversão em lote:', error);
        
        const progressContainer = document.getElementById('tv-progress-container');
        const progressFill = document.getElementById('tv-progress-fill');
        const btnGenerate = document.getElementById('tv-btn-generate');
        const btnCancel = document.getElementById('tv-btn-cancel');
        
        // Resetar flag de conversão em lote no app
        if (window.app && window.app.isBatchConversion) {
            window.app.isBatchConversion = false;
            console.log('[AudioSourceManager] Flag isBatchConversion resetada no app (erro)');
        }
        
        // Resetar UI
        if (progressContainer) progressContainer.style.display = 'none';
        if (btnGenerate) btnGenerate.disabled = false;
        if (btnCancel) btnCancel.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
        
        // Mostrar erro
        window.modal.show('error', 'Erro na Conversão', 
            `Falha ao converter arquivos:\n${error}`);
    }

    /**
     * Cancelar conversão em lote
     */
    cancelBatch() {
        console.log('[AudioSourceManager] Cancelamento solicitado');
        
        // Enviar sinal de cancelamento para backend
        if (window.electronAPI && window.electronAPI.cancelBatchConversion) {
            window.electronAPI.cancelBatchConversion();
        }
        
        // Resetar UI imediatamente
        const progressContainer = document.getElementById('tv-progress-container');
        const progressFill = document.getElementById('tv-progress-fill');
        const btnGenerate = document.getElementById('tv-btn-generate');
        const btnCancel = document.getElementById('tv-btn-cancel');
        
        if (progressContainer) progressContainer.style.display = 'none';
        if (btnGenerate) btnGenerate.disabled = false;
        if (btnCancel) btnCancel.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
        
        window.modal.show('info', 'Cancelado', 'Conversão em lote cancelada pelo usuário.');
    }

    /**
     * Obter dados da fonte de áudio atual
     */
    getSourceData() {
        return {
            source: this.currentSource,
            recordingFolder: this.recordingFolder,
            importedFile: this.importedFile,
            importDestFolder: this.importDestFolder,
            batchFolder: this.batchFolder,
            batchFiles: this.batchFiles
        };
    }
}

// Exportar para uso global
window.AudioSourceManager = AudioSourceManager;
