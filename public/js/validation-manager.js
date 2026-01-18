/**
 * Validation Manager - TurboVoicer
 * Sistema de validações inteligentes e feedback
 * Estimativas de tempo, confirmações, e validações pré-geração
 */

class ValidationManager {
    constructor() {
        this.dontShowAgain = {
            longScript: false,
            manyPartitions: false
        };
        
        this.initializeUI();
    }

    /**
     * Inicializar UI e event listeners
     */
    initializeUI() {
        // Atualizar contador de caracteres em tempo real
        const scriptInput = document.getElementById('tv-script-input');
        scriptInput?.addEventListener('input', () => this.updateCharacterCount());
    }

    /**
     * Atualizar contador de caracteres e preview de partições
     */
    updateCharacterCount() {
        const scriptInput = document.getElementById('tv-script-input');
        const charCount = document.getElementById('tv-char-count');
        const partitionPreview = document.getElementById('tv-partition-preview');
        
        if (!scriptInput || !charCount) return;
        
        const text = scriptInput.value;
        const length = text.length;
        
        charCount.textContent = length.toLocaleString();
        
        // Calcular partições estimadas
        if (length > 0 && window.textPartitioner) {
            const partitions = window.textPartitioner.partition(text);
            const partitionCount = partitions.length;
            
            if (partitionPreview) {
                if (partitionCount > 1) {
                    partitionPreview.textContent = `≈ ${partitionCount} partições`;
                    partitionPreview.style.color = partitionCount > 10 ? '#ff4444' : '#4facfe';
                } else {
                    partitionPreview.textContent = '';
                }
            }
        }
    }

    /**
     * Validar antes de gerar áudio
     */
    async validateBeforeGeneration(config) {
        const validations = [];
        
        // 1. Validar texto (apenas se fonte for 'text')
        if (config.audioSource === 'text') {
            if (!config.script || config.script.trim().length === 0) {
                return {
                    valid: false,
                    error: 'Digite ou cole um roteiro antes de gerar o áudio.'
                };
            }
        }
        
        // 2. Validar voz RVC
        if (!config.rvcVoice) {
            return {
                valid: false,
                error: 'Selecione uma voz RVC antes de gerar o áudio.'
            };
        }
        
        // 3. Validar pasta de saída
        if (!config.outputPath) {
            return {
                valid: false,
                error: 'Selecione uma pasta de saída antes de gerar o áudio.'
            };
        }
        
        // 4. Calcular estimativas
        const estimates = this.calculateEstimates(config);
        
        // 5. Validar roteiro longo
        if (estimates.partitions > 5 && !this.dontShowAgain.longScript) {
            const confirm = await this.confirmLongScript(estimates);
            if (!confirm.confirmed) {
                return { valid: false, cancelled: true };
            }
            if (confirm.dontShowAgain) {
                this.dontShowAgain.longScript = true;
            }
        }
        
        // 6. Validar muitas partições
        if (estimates.partitions > 20 && !this.dontShowAgain.manyPartitions) {
            const confirm = await this.confirmManyPartitions(estimates);
            if (!confirm.confirmed) {
                return { valid: false, cancelled: true };
            }
            if (confirm.dontShowAgain) {
                this.dontShowAgain.manyPartitions = true;
            }
        }
        
        return {
            valid: true,
            estimates: estimates
        };
    }

    /**
     * Calcular estimativas de tempo e partições
     */
    calculateEstimates(config) {
        const text = config.script;
        const partitions = window.textPartitioner ? window.textPartitioner.partition(text) : [text];
        const partitionCount = partitions.length;
        
        // Estimativas baseadas em testes reais
        const edgeTTSTimePerPartition = 3; // segundos
        const rvcTimePerPartition = 8; // segundos (varia com GPU/CPU)
        const overheadPerPartition = 2; // segundos (I/O, cache, etc)
        
        const totalTimePerPartition = edgeTTSTimePerPartition + rvcTimePerPartition + overheadPerPartition;
        const estimatedTimeSeconds = partitionCount * totalTimePerPartition;
        
        // Ajustar baseado no hardware
        let multiplier = 1.0;
        if (config.hardwareProfile) {
            if (config.hardwareProfile.type === 'cpu') {
                multiplier = 2.5; // CPU é muito mais lento
            } else if (config.hardwareProfile.type === 'low-gpu') {
                multiplier = 1.5; // GPU fraca é um pouco mais lenta
            }
        }
        
        const adjustedTimeSeconds = Math.ceil(estimatedTimeSeconds * multiplier);
        
        return {
            partitions: partitionCount,
            characters: text.length,
            estimatedTimeSeconds: adjustedTimeSeconds,
            estimatedTimeFormatted: this.formatTime(adjustedTimeSeconds),
            averageTimePerPartition: Math.ceil(adjustedTimeSeconds / partitionCount)
        };
    }

    /**
     * Formatar tempo em formato legível
     */
    formatTime(seconds) {
        if (seconds < 60) {
            return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
        }
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (remainingSeconds === 0) {
            return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
        }
        
        return `${minutes} minuto${minutes !== 1 ? 's' : ''} e ${remainingSeconds} segundo${remainingSeconds !== 1 ? 's' : ''}`;
    }

    /**
     * Confirmar roteiro longo
     */
    async confirmLongScript(estimates) {
        return new Promise((resolve) => {
            const modal = this.createConfirmModal({
                title: 'Roteiro Longo Detectado',
                icon: 'warning',
                message: `Seu roteiro será dividido em **${estimates.partitions} partições** para processamento.\n\n` +
                         `**Tempo estimado:** ${estimates.estimatedTimeFormatted}\n\n` +
                         `Deseja continuar com a geração?`,
                confirmText: 'Sim, Continuar',
                cancelText: 'Cancelar',
                showDontShowAgain: true,
                onConfirm: (dontShowAgain) => {
                    modal.remove();
                    resolve({ confirmed: true, dontShowAgain });
                },
                onCancel: () => {
                    modal.remove();
                    resolve({ confirmed: false, dontShowAgain: false });
                }
            });
        });
    }

    /**
     * Confirmar muitas partições
     */
    async confirmManyPartitions(estimates) {
        return new Promise((resolve) => {
            const modal = this.createConfirmModal({
                title: 'Roteiro Muito Longo',
                icon: 'warning',
                message: `Seu roteiro possui **${estimates.partitions} partições**!\n\n` +
                         `**Tempo estimado:** ${estimates.estimatedTimeFormatted}\n\n` +
                         `**Recomendação:** Considere dividir em múltiplos arquivos menores para melhor gerenciamento.\n\n` +
                         `Deseja realmente continuar?`,
                confirmText: 'Sim, Processar Tudo',
                cancelText: 'Cancelar',
                showDontShowAgain: true,
                onConfirm: (dontShowAgain) => {
                    modal.remove();
                    resolve({ confirmed: true, dontShowAgain });
                },
                onCancel: () => {
                    modal.remove();
                    resolve({ confirmed: false, dontShowAgain: false });
                }
            });
        });
    }

    /**
     * Criar modal de confirmação customizado
     */
    createConfirmModal(options) {
        const modal = document.createElement('div');
        modal.className = 'tv-validation-modal';
        modal.innerHTML = `
            <div class="tv-validation-modal-overlay"></div>
            <div class="tv-validation-modal-content">
                <div class="tv-validation-modal-header">
                    <div class="tv-validation-modal-icon ${options.icon}">
                        ${this.getIconSVG(options.icon)}
                    </div>
                    <h3>${options.title}</h3>
                </div>
                <div class="tv-validation-modal-body">
                    <p>${options.message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p>
                </div>
                ${options.showDontShowAgain ? `
                    <div class="tv-validation-modal-checkbox">
                        <label>
                            <input type="checkbox" id="tv-dont-show-again">
                            <span>Não mostrar novamente nesta sessão</span>
                        </label>
                    </div>
                ` : ''}
                <div class="tv-validation-modal-actions">
                    <button class="tv-btn tv-btn-secondary" id="tv-validation-cancel">
                        ${options.cancelText}
                    </button>
                    <button class="tv-btn tv-btn-primary" id="tv-validation-confirm">
                        ${options.confirmText}
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners
        const confirmBtn = modal.querySelector('#tv-validation-confirm');
        const cancelBtn = modal.querySelector('#tv-validation-cancel');
        const dontShowCheckbox = modal.querySelector('#tv-dont-show-again');
        
        confirmBtn.addEventListener('click', () => {
            const dontShowAgain = dontShowCheckbox ? dontShowCheckbox.checked : false;
            options.onConfirm(dontShowAgain);
        });
        
        cancelBtn.addEventListener('click', () => {
            options.onCancel();
        });
        
        // Fechar ao clicar no overlay
        modal.querySelector('.tv-validation-modal-overlay').addEventListener('click', () => {
            options.onCancel();
        });
        
        return modal;
    }

    /**
     * Obter SVG do ícone
     */
    getIconSVG(type) {
        const icons = {
            warning: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>`,
            info: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>`
        };
        
        return icons[type] || icons.info;
    }

    /**
     * Mostrar modal de sucesso com botão "Abrir Pasta"
     */
    showSuccessWithOpenFolder(outputPath, stats) {
        const modal = document.createElement('div');
        modal.className = 'tv-validation-modal';
        modal.innerHTML = `
            <div class="tv-validation-modal-overlay"></div>
            <div class="tv-validation-modal-content success">
                <div class="tv-validation-modal-header">
                    <div class="tv-validation-modal-icon success">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </div>
                    <h3>Áudio Gerado com Sucesso!</h3>
                </div>
                <div class="tv-validation-modal-body">
                    <p><strong>Partições processadas:</strong> ${stats.partitions}</p>
                    <p><strong>Tempo total:</strong> ${this.formatTime(stats.totalTime)}</p>
                    <p><strong>Arquivo de saída:</strong><br><code>${outputPath}</code></p>
                </div>
                <div class="tv-validation-modal-actions">
                    <button class="tv-btn tv-btn-secondary" id="tv-success-close">
                        Fechar
                    </button>
                    <button class="tv-btn tv-btn-primary" id="tv-success-open-folder">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                        Abrir Pasta
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners
        const closeBtn = modal.querySelector('#tv-success-close');
        const openFolderBtn = modal.querySelector('#tv-success-open-folder');
        
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });
        
        openFolderBtn.addEventListener('click', async () => {
            try {
                await window.electronAPI.openPath(outputPath);
                modal.remove();
            } catch (error) {
                console.error('[ValidationManager] Erro ao abrir pasta:', error);
            }
        });
        
        // Fechar ao clicar no overlay
        modal.querySelector('.tv-validation-modal-overlay').addEventListener('click', () => {
            modal.remove();
        });
        
        // Tocar som de sucesso
        if (window.sounds?.success) {
            window.sounds.success.volume = 0.5;
            window.sounds.success.play().catch(() => {});
        }
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.validationManager = new ValidationManager();
});
