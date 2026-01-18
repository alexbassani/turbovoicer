// Voice Catalog - Isolated Component
// Manages voice browsing, preview, download, and favorites

class VoiceCatalog {
    constructor() {
        this.catalog = null;
        this.installedVoices = [];
        this.favorites = this.loadFavorites();
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.currentAudio = null;
        this.selectedZipPath = null;
        
        this.init();
    }

    async init() {
        await this.loadCatalog();
        await this.loadInstalledVoices();
        this.setupEventListeners();
        this.renderCategories();
    }

    async loadCatalog() {
        try {
            const result = await window.electronAPI.loadCatalog();
            if (result.success) {
                this.catalog = result.catalog;
                console.log('[VoiceCatalog] Catálogo carregado:', Object.keys(this.catalog.categories).length, 'categorias');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('[VoiceCatalog] Erro ao carregar catálogo:', error);
            this.showError('Erro ao carregar catálogo de vozes');
        }
    }

    async loadInstalledVoices() {
        try {
            const result = await window.electronAPI.getInstalledVoices();
            if (result.success) {
                this.installedVoices = result.voices;
                console.log('[VoiceCatalog] Vozes instaladas:', this.installedVoices.length);
                
                // Adicionar vozes customizadas ao catálogo dinamicamente
                this.addCustomVoicesToCatalog();
            }
        } catch (error) {
            console.error('[VoiceCatalog] Erro ao carregar vozes instaladas:', error);
        }
    }
    
    /**
     * Adicionar vozes customizadas importadas ao catálogo
     */
    addCustomVoicesToCatalog() {
        if (!this.catalog || !this.installedVoices) return;
        
        // Criar categoria "Customizadas" se não existir
        if (!this.catalog.categories.custom) {
            this.catalog.categories.custom = {
                displayName: 'Vozes Customizadas',
                description: 'Vozes importadas por você',
                icon: '🎤',
                voices: []
            };
        }
        
        // Adicionar vozes customizadas que não estão no catálogo
        const customVoices = this.installedVoices.filter(v => v.isCustom);
        
        for (const voice of customVoices) {
            // Verificar se já existe no catálogo
            const existsInCatalog = this.catalog.categories.custom.voices.some(
                v => v.id === voice.voiceId
            );
            
            if (!existsInCatalog) {
                // Usar preview local se disponível (arquivo mp3/wav do ZIP)
                const previewLocal = voice.previewPath ? `file://${voice.previewPath}` : null;
                
                this.catalog.categories.custom.voices.push({
                    id: voice.voiceId,
                    name: voice.name,
                    descriptor: 'Customizada',
                    gender: voice.metadata?.gender || 'Neutro',
                    tags: ['customizada', 'importada'],
                    previewUrl: null,
                    previewLocal: previewLocal,
                    downloadUrl: null
                });
                
                console.log('[VoiceCatalog] Voz customizada adicionada ao catálogo:', voice.name);
                if (previewLocal) {
                    console.log('[VoiceCatalog] Preview local disponível:', previewLocal);
                }
            }
        }
    }

    setupEventListeners() {
        // Back button
        document.getElementById('btn-back-to-main')?.addEventListener('click', () => {
            window.location.href = 'index.html';
        });

        // Search
        document.getElementById('vc-search-input')?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderCategories();
        });

        // Filters
        document.querySelectorAll('.vc-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.vc-filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderCategories();
            });
        });

        // Import voice
        document.getElementById('btn-import-voice')?.addEventListener('click', () => {
            this.showImportModal();
        });

        // Import modal
        document.getElementById('btn-close-import')?.addEventListener('click', () => {
            this.closeImportModal();
        });

        document.getElementById('btn-cancel-import')?.addEventListener('click', () => {
            this.closeImportModal();
        });

        document.getElementById('btn-select-zip')?.addEventListener('click', async () => {
            const result = await window.electronAPI.selectFiles({
                filters: [{ name: 'ZIP Files', extensions: ['zip'] }],
                properties: ['openFile']
            });
            
            if (result && result.length > 0) {
                this.selectedZipPath = result[0];
                document.getElementById('vc-import-file-name').textContent = result[0].split(/[/\\]/).pop();
                this.validateImportForm();
            }
        });

        document.getElementById('vc-import-name')?.addEventListener('input', () => {
            this.validateImportForm();
        });

        document.getElementById('btn-confirm-import')?.addEventListener('click', () => {
            this.importCustomVoice();
        });

        // Download progress listener
        if (window.electronAPI.onDownloadProgress) {
            window.electronAPI.onDownloadProgress((progress) => {
                this.updateDownloadProgress(progress);
            });
        }

        // Premium modal event listeners
        document.getElementById('btn-close-premium')?.addEventListener('click', () => {
            this.closePremiumModal();
        });

        document.getElementById('btn-cancel-premium')?.addEventListener('click', () => {
            this.closePremiumModal();
        });

        document.getElementById('btn-unlock-premium')?.addEventListener('click', () => {
            this.authenticatePremium();
        });

        // Enter key on password input
        document.getElementById('vc-premium-password')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.authenticatePremium();
            }
        });

        // Toggle password visibility
        document.getElementById('vc-toggle-password')?.addEventListener('click', () => {
            this.togglePasswordVisibility();
        });
    }

    /**
     * Toggle visibilidade da senha
     */
    togglePasswordVisibility() {
        const passwordInput = document.getElementById('vc-premium-password');
        const eyeIcon = document.querySelector('.vc-eye-icon');
        const eyeOffIcon = document.querySelector('.vc-eye-off-icon');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.style.display = 'none';
            eyeOffIcon.style.display = 'block';
        } else {
            passwordInput.type = 'password';
            eyeIcon.style.display = 'block';
            eyeOffIcon.style.display = 'none';
        }
    }

    /**
     * Verificar status Premium e renderizar seção apropriada
     */
    async checkPremiumStatus() {
        try {
            const result = await window.electronAPI.turboVoicerCheckPremiumStatus();
            if (result.success) {
                this.isPremiumUnlocked = result.unlocked;
                console.log('[VoiceCatalog] Status Premium:', this.isPremiumUnlocked ? 'Desbloqueado' : 'Bloqueado');
                return result.unlocked;
            }
        } catch (error) {
            console.error('[VoiceCatalog] Erro ao verificar status Premium:', error);
        }
        return false;
    }

    /**
     * Mostrar modal de autenticação Premium
     */
    showPremiumModal() {
        const modal = document.getElementById('vc-premium-modal');
        const usernameInput = document.getElementById('vc-premium-username');
        const passwordInput = document.getElementById('vc-premium-password');
        const errorDiv = document.getElementById('vc-premium-error');
        
        if (modal) {
            modal.style.display = 'flex';
            
            // Limpar campos
            if (usernameInput) usernameInput.value = '';
            if (passwordInput) passwordInput.value = '';
            if (errorDiv) errorDiv.style.display = 'none';
            
            // Focar no input de usuário
            setTimeout(() => usernameInput?.focus(), 100);
        }
    }

    /**
     * Fechar modal de autenticação Premium
     */
    closePremiumModal() {
        const modal = document.getElementById('vc-premium-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Autenticar usuário e senha Premium
     */
    async authenticatePremium() {
        const usernameInput = document.getElementById('vc-premium-username');
        const passwordInput = document.getElementById('vc-premium-password');
        const errorDiv = document.getElementById('vc-premium-error');
        const errorText = document.getElementById('vc-premium-error-text');
        const unlockBtn = document.getElementById('btn-unlock-premium');
        
        const username = usernameInput?.value.trim();
        const password = passwordInput?.value.trim();
        
        if (!username || !password) {
            if (errorDiv && errorText) {
                errorText.textContent = 'Digite o usuário e senha para continuar.';
                errorDiv.style.display = 'flex';
            }
            return;
        }

        // Desabilitar botão durante autenticação
        if (unlockBtn) {
            unlockBtn.disabled = true;
            unlockBtn.textContent = 'Verificando...';
        }

        try {
            const result = await window.electronAPI.turboVoicerAuthenticatePremium(username, password);
            
            if (result.success) {
                // Sucesso - fechar modal e recarregar catálogo
                console.log('[VoiceCatalog] ✅ Premium desbloqueado com sucesso!');
                this.closePremiumModal();
                this.isPremiumUnlocked = true;
                
                // Recarregar catálogo com vozes Premium
                await this.loadCatalog();
                this.renderCategories();
                
                // Mostrar mensagem de sucesso
                this.showAlert('Vozes Premium Desbloqueadas!', 'Todas as vozes premium estão agora disponíveis no catálogo.');
            } else {
                // Erro - mostrar mensagem
                console.log('[VoiceCatalog] ❌ Usuário ou senha incorretos');
                if (errorDiv && errorText) {
                    errorText.textContent = result.error || 'Usuário ou senha incorretos. Verifique a aula na Kiwify.';
                    errorDiv.style.display = 'flex';
                }
            }
        } catch (error) {
            console.error('[VoiceCatalog] Erro na autenticação Premium:', error);
            if (errorDiv && errorText) {
                errorText.textContent = 'Erro ao conectar ao servidor. Tente novamente.';
                errorDiv.style.display = 'flex';
            }
        } finally {
            // Reabilitar botão
            if (unlockBtn) {
                unlockBtn.disabled = false;
                unlockBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                    </svg>
                    Desbloquear
                `;
            }
        }
    }

    /**
     * Carregar catálogo com suporte a Starter + Premium
     */
    async loadCatalog() {
        try {
            // Verificar status Premium
            const isPremium = await this.checkPremiumStatus();
            
            // Carregar vozes apropriadas
            let result;
            if (isPremium) {
                // Carregar todas as vozes (Starter + Premium)
                result = await window.electronAPI.turboVoicerGetVoicesByCategory();
            } else {
                // Carregar apenas Starter
                const starterResult = await window.electronAPI.turboVoicerGetStarterVoices();
                if (starterResult.success) {
                    // Organizar vozes Starter em categorias
                    result = {
                        success: true,
                        categories: {
                            starter: {
                                displayName: 'Starter (Gratuito)',
                                description: 'Vozes incluídas no TurboStudio',
                                icon: '🎁',
                                voices: starterResult.voices
                            }
                        }
                    };
                }
            }
            
            if (result && result.success) {
                this.catalog = { categories: result.categories };
                console.log('[VoiceCatalog] Catálogo carregado:', Object.keys(this.catalog.categories).length, 'categorias');
            } else {
                throw new Error(result?.error || 'Erro ao carregar catálogo');
            }
        } catch (error) {
            console.error('[VoiceCatalog] Erro ao carregar catálogo:', error);
            this.showError('Erro ao carregar catálogo de vozes');
        }
    }

    renderCategories() {
        const container = document.getElementById('vc-categories');
        if (!container || !this.catalog) return;

        container.innerHTML = '';

        const categories = Object.entries(this.catalog.categories);
        let hasResults = false;

        categories.forEach(([categoryKey, category]) => {
            const filteredVoices = this.filterVoices(category.voices);
            
            if (filteredVoices.length === 0) return;
            
            hasResults = true;

            const categoryEl = document.createElement('div');
            categoryEl.className = 'vc-category';
            categoryEl.innerHTML = `
                <div class="vc-category-header">
                    <span class="vc-category-icon">${category.icon}</span>
                    <div>
                        <h2 class="vc-category-title">${category.displayName}</h2>
                        <p class="vc-category-description">${category.description}</p>
                    </div>
                    <span class="vc-category-count">${filteredVoices.length} ${filteredVoices.length === 1 ? 'voz' : 'vozes'}</span>
                </div>
                <div class="vc-voices-grid" id="category-${categoryKey}"></div>
            `;

            container.appendChild(categoryEl);

            const gridEl = document.getElementById(`category-${categoryKey}`);
            filteredVoices.forEach(voice => {
                gridEl.appendChild(this.createVoiceCard(voice, categoryKey));
            });
        });

        // Renderizar seção Premium bloqueada se não estiver desbloqueado
        if (!this.isPremiumUnlocked) {
            const premiumSection = document.createElement('div');
            premiumSection.className = 'vc-premium-locked';
            premiumSection.innerHTML = `
                <h3>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Vozes Premium
                </h3>
                <p>
                    Desbloqueie o pacote completo de vozes premium com centenas de opções profissionais.<br>
                    <strong>Liberado após 7 dias da compra</strong> na aula "SENHA PACK DE VOZES FULL" na Kiwify.
                </p>
                <button class="vc-btn-unlock-premium" id="btn-show-premium-modal">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                    </svg>
                    ACESSAR VOZES PREMIUM
                </button>
            `;
            container.appendChild(premiumSection);
            
            // Event listener para o botão
            document.getElementById('btn-show-premium-modal')?.addEventListener('click', () => {
                this.showPremiumModal();
            });
        }

        if (!hasResults && this.isPremiumUnlocked) {
            container.innerHTML = `
                <div class="vc-loading">
                    <p>Nenhuma voz encontrada</p>
                </div>
            `;
        }
    }

    filterVoices(voices) {
        return voices.filter(voice => {
            // Search filter
            if (this.searchQuery) {
                const searchableText = `${voice.name} ${voice.descriptor} ${voice.tags.join(' ')}`.toLowerCase();
                if (!searchableText.includes(this.searchQuery)) {
                    return false;
                }
            }

            // Status filter
            if (this.currentFilter === 'installed') {
                if (!this.isVoiceInstalled(voice.id)) {
                    return false;
                }
            } else if (this.currentFilter === 'favorites') {
                if (!this.isFavorite(voice.id)) {
                    return false;
                }
            }

            return true;
        });
    }

    createVoiceCard(voice, category) {
        const card = document.createElement('div');
        card.className = 'vc-voice-card';
        
        const isInstalled = this.isVoiceInstalled(voice.id);
        const isFavorited = this.isFavorite(voice.id);
        
        if (isInstalled) {
            card.classList.add('installed');
        }

        const descriptorType = voice.descriptor.toLowerCase().replace(/\s+/g, '-');
        const audioId = `audio-${voice.id}`;
        const hasPreview = voice.previewLocal || voice.previewUrl;

        const starIcon = isFavorited 
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>'
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>';

        card.innerHTML = `
            <div class="vc-voice-header">
                <h3 class="vc-voice-name">${voice.name}</h3>
                <div class="vc-voice-actions">
                    <button class="vc-btn-icon ${isFavorited ? 'favorited' : ''}" data-action="favorite" title="Favoritar">
                        ${starIcon}
                    </button>
                    ${isInstalled ? '<span class="vc-btn-icon installed" title="Instalada"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></span>' : ''}
                    ${isInstalled ? '<button class="vc-btn-icon delete" data-action="delete" title="Excluir voz instalada"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' : ''}
                </div>
            </div>
            <span class="vc-voice-descriptor" data-type="${descriptorType}">${voice.descriptor}</span>
            <div class="vc-voice-tags">
                ${voice.tags.map(tag => `<span class="vc-voice-tag">${tag}</span>`).join('')}
            </div>
            <div class="vc-audio-preview" style="display: none;" id="preview-${voice.id}">
                <audio id="${audioId}" style="width: 100%; margin: 12px 0;">
                    <source src="${voice.previewLocal}" type="audio/mpeg">
                </audio>
            </div>
            <div class="vc-voice-footer">
                <button class="vc-btn-preview" data-action="preview" ${!hasPreview ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    ${hasPreview ? 'Preview' : 'Sem Preview'}
                </button>
                <button class="vc-btn-download ${isInstalled ? 'installed' : ''}" data-action="download">
                    ${isInstalled ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Instalada' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Baixar'}
                </button>
            </div>
        `;

        // Event listeners
        const favoriteBtn = card.querySelector('[data-action="favorite"]');
        favoriteBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFavorite(voice);
            
            // Swap SVG icon
            const isFav = this.isFavorite(voice.id);
            const newIcon = isFav 
                ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>'
                : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>';
            
            favoriteBtn.innerHTML = newIcon;
            
            if (isFav) {
                favoriteBtn.classList.add('favorited');
            } else {
                favoriteBtn.classList.remove('favorited');
            }
        });

        const previewBtn = card.querySelector('[data-action="preview"]');
        const audioPreview = card.querySelector(`#preview-${voice.id}`);
        const audio = card.querySelector(`#${audioId}`);
        
        // Só adicionar listener se houver preview disponível
        if (hasPreview) {
            previewBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Stop any currently playing audio
                if (this.currentAudio && this.currentAudio !== audio) {
                    this.currentAudio.pause();
                    this.currentAudio.currentTime = 0;
                    // Resetar botão do áudio anterior
                    const prevBtn = document.querySelector(`[data-audio-id="${this.currentAudio.id}"]`);
                    if (prevBtn) {
                        prevBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Preview';
                    }
                }
                
                // Toggle audio play/pause (SEM mostrar player)
                if (audio.paused) {
                    previewBtn.innerHTML = '⏸️ Fechar';
                    audio.play();
                    this.currentAudio = audio;
                } else {
                    previewBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Preview';
                    audio.pause();
                    audio.currentTime = 0;
                }
            });
            
            // Adicionar data-attribute para identificar o botão
            previewBtn.setAttribute('data-audio-id', audioId);
        }
        
        // Reset button when audio ends
        audio?.addEventListener('ended', () => {
            previewBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Preview';
        });

        const downloadBtn = card.querySelector('[data-action="download"]');
        if (!isInstalled) {
            downloadBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.downloadVoice({ ...voice, category });
            });
        }

        const deleteBtn = card.querySelector('[data-action="delete"]');
        if (isInstalled && deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteVoice(voice);
            });
        }

        return card;
    }

    async downloadVoice(voiceData) {
        // Stop any playing audio
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
        }
        
        const modal = document.getElementById('vc-download-modal');
        const voiceName = document.getElementById('vc-download-voice-name');
        const stage = document.getElementById('vc-download-stage');
        const progress = document.getElementById('vc-download-progress');
        const percent = document.getElementById('vc-download-percent');

        voiceName.textContent = voiceData.name;
        stage.textContent = 'Iniciando download...';
        progress.style.width = '0%';
        percent.textContent = '0%';

        modal.style.display = 'flex';

        try {
            const result = await window.electronAPI.downloadVoice(voiceData);
            
            if (result.success) {
                stage.textContent = 'Download concluído!';
                progress.style.width = '100%';
                percent.textContent = '100%';
                
                await this.loadInstalledVoices();
                
                setTimeout(() => {
                    modal.style.display = 'none';
                    this.renderCategories();
                }, 1500);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('[VoiceCatalog] Erro ao baixar voz:', error);
            modal.style.display = 'none';
            this.showError('Erro ao baixar voz: ' + error.message);
        }
    }

    updateDownloadProgress(progressData) {
        const stage = document.getElementById('vc-download-stage');
        const progress = document.getElementById('vc-download-progress');
        const percent = document.getElementById('vc-download-percent');

        if (progressData.stage === 'downloading') {
            stage.textContent = 'Baixando...';
            progress.style.width = progressData.progress + '%';
            percent.textContent = progressData.progress + '%';
        } else if (progressData.stage === 'extracting') {
            stage.textContent = 'Extraindo arquivos...';
            progress.style.width = '100%';
            percent.textContent = '100%';
        } else if (progressData.stage === 'completed') {
            stage.textContent = 'Concluído!';
        }
    }

    showImportModal() {
        const modal = document.getElementById('vc-import-modal');
        document.getElementById('vc-import-name').value = '';
        document.getElementById('vc-import-file-name').textContent = 'Nenhum arquivo selecionado';
        this.selectedZipPath = null;
        document.getElementById('btn-confirm-import').disabled = true;
        modal.style.display = 'flex';
    }

    closeImportModal() {
        const modal = document.getElementById('vc-import-modal');
        modal.style.display = 'none';
    }

    validateImportForm() {
        const name = document.getElementById('vc-import-name').value.trim();
        const btn = document.getElementById('btn-confirm-import');
        
        btn.disabled = !(name && this.selectedZipPath);
    }

    async importCustomVoice() {
        const name = document.getElementById('vc-import-name').value.trim();

        if (!name || !this.selectedZipPath) return;

        this.closeImportModal();

        const modal = document.getElementById('vc-download-modal');
        const voiceName = document.getElementById('vc-download-voice-name');
        const stage = document.getElementById('vc-download-stage');
        const progress = document.getElementById('vc-download-progress');
        const percent = document.getElementById('vc-download-percent');

        voiceName.textContent = name;
        stage.textContent = 'Importando voz customizada...';
        progress.style.width = '50%';
        percent.textContent = '50%';

        modal.style.display = 'flex';

        try {
            const result = await window.electronAPI.importCustomVoice(this.selectedZipPath, name);
            
            if (result.success) {
                stage.textContent = 'Importação concluída!';
                progress.style.width = '100%';
                percent.textContent = '100%';
                
                await this.loadInstalledVoices();
                
                setTimeout(() => {
                    modal.style.display = 'none';
                    this.renderCategories();
                    this.showSuccess('Voz customizada importada com sucesso!');
                }, 1500);
            } else if (result.error === 'duplicate') {
                // Voz já existe - mostrar aviso e focar na voz existente
                modal.style.display = 'none';
                await this.loadInstalledVoices();
                this.renderCategories();
                this.showAlert('Voz Já Importada', `A voz "${name}" já foi importada anteriormente e está disponível em "Instaladas".`);
            } else {
                throw new Error(result.error || result.message);
            }
        } catch (error) {
            console.error('[VoiceCatalog] Erro ao importar voz:', error);
            modal.style.display = 'none';
            this.showError('Erro ao importar voz: ' + error.message);
        }
    }

    async deleteVoice(voice) {
        // Confirmar exclusão usando modal nativo
        const confirmed = await this.showConfirm(
            'Excluir Voz',
            `Deseja realmente excluir a voz "${voice.name}"?\n\nEsta voz será removida do seu sistema e não aparecerá mais no catálogo. Se quiser usar novamente, será necessário fazer um novo download.`
        );
        
        if (!confirmed) return;
        
        try {
            // Buscar voz instalada para pegar o caminho completo
            const installedVoice = this.installedVoices.find(v => v.voiceId === voice.id);
            
            if (!installedVoice) {
                throw new Error('Voz não encontrada na lista de instaladas');
            }
            
            // Usar o caminho completo da voz instalada
            const result = await window.electronAPI.deleteVoice(installedVoice.path);
            
            if (result.success) {
                // Atualizar lista de vozes instaladas
                await this.loadInstalledVoices();
                
                // Re-renderizar categorias
                this.renderCategories();
                
                // Mostrar sucesso
                this.showAlert('Voz Excluída', `A voz "${voice.name}" foi removida com sucesso.`);
                
                console.log('[VoiceCatalog] Voz excluída:', voice.id);
            } else {
                throw new Error(result.error || 'Erro ao excluir voz');
            }
        } catch (error) {
            console.error('[VoiceCatalog] Erro ao excluir voz:', error);
            this.showAlert('Erro', `Falha ao excluir voz:\n\n${error.message}`);
        }
    }

    showConfirm(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('vc-confirm-modal');
            const titleEl = document.getElementById('vc-confirm-title');
            const messageEl = document.getElementById('vc-confirm-message');
            const btnCancel = document.getElementById('vc-confirm-cancel');
            const btnOk = document.getElementById('vc-confirm-ok');
            
            titleEl.textContent = title;
            messageEl.textContent = message;
            
            const handleCancel = () => {
                modal.style.display = 'none';
                btnCancel.removeEventListener('click', handleCancel);
                btnOk.removeEventListener('click', handleOk);
                resolve(false);
            };
            
            const handleOk = () => {
                modal.style.display = 'none';
                btnCancel.removeEventListener('click', handleCancel);
                btnOk.removeEventListener('click', handleOk);
                resolve(true);
            };
            
            btnCancel.addEventListener('click', handleCancel);
            btnOk.addEventListener('click', handleOk);
            
            modal.style.display = 'flex';
        });
    }

    showAlert(title, message) {
        const modal = document.getElementById('vc-alert-modal');
        const titleEl = document.getElementById('vc-alert-title');
        const messageEl = document.getElementById('vc-alert-message');
        const btnOk = document.getElementById('vc-alert-ok');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        
        const handleOk = () => {
            modal.style.display = 'none';
            btnOk.removeEventListener('click', handleOk);
        };
        
        btnOk.addEventListener('click', handleOk);
        
        modal.style.display = 'flex';
    }

    toggleFavorite(voice) {
        const voiceId = voice.id || voice;
        const index = this.favorites.indexOf(voiceId);
        
        if (index > -1) {
            this.favorites.splice(index, 1);
            console.log('[VoiceCatalog] Removido dos favoritos:', voiceId);
        } else {
            this.favorites.push(voiceId);
            console.log('[VoiceCatalog] Adicionado aos favoritos:', voiceId);
        }
        
        this.saveFavorites();
        console.log('[VoiceCatalog] Favoritos atuais:', this.favorites);
        
        // Re-render if on favorites filter
        if (this.currentFilter === 'favorites') {
            this.renderCategories();
        }
    }

    isFavorite(voiceId) {
        return this.favorites.includes(voiceId);
    }

    isVoiceInstalled(voiceId) {
        return this.installedVoices.some(v => v.voiceId === voiceId);
    }

    loadFavorites() {
        try {
            const stored = localStorage.getItem('turbovoicer_favorites');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('[VoiceCatalog] Erro ao carregar favoritos:', error);
            return [];
        }
    }

    saveFavorites() {
        try {
            localStorage.setItem('turbovoicer_favorites', JSON.stringify(this.favorites));
        } catch (error) {
            console.error('[VoiceCatalog] Erro ao salvar favoritos:', error);
        }
    }

    showError(message) {
        this.showAlert('Erro', message);
    }

    showSuccess(message) {
        this.showAlert('Sucesso', message);
    }

    showAlert(title, message) {
        const modal = document.getElementById('vc-alert-modal');
        const titleEl = document.getElementById('vc-alert-title');
        const messageEl = document.getElementById('vc-alert-message');
        const btnOk = document.getElementById('vc-alert-ok');
        
        if (!modal || !titleEl || !messageEl || !btnOk) return;
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        
        const handleOk = () => {
            modal.style.display = 'none';
            btnOk.removeEventListener('click', handleOk);
        };
        
        btnOk.addEventListener('click', handleOk);
        modal.style.display = 'flex';
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new VoiceCatalog();
    });
} else {
    new VoiceCatalog();
}
