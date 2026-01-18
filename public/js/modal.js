/**
 * Sistema de Modal Padrão TurboStudio
 * TurboVoicer - Conversão de Voz com RVC-API
 */

class TurboVoicerModal {
    constructor() {
        this.sounds = {
            success: null,
            error: null
        };
        
        // Tentar carregar sons
        try {
            this.sounds.success = new Audio('assets/sounds/Alarm_end_ok.wav');
            this.sounds.error = new Audio('assets/sounds/Alarm_error.wav');
        } catch (error) {
            console.warn('[Modal] Não foi possível carregar sons:', error);
        }
        
        this.createModalElement();
    }
    
    createModalElement() {
        // Criar estrutura do modal no padrão TurboStudio
        const modalHTML = `
            <div id="tv-modal" class="tv-modal" style="display: none;">
                <div class="tv-modal-overlay"></div>
                <div class="tv-modal-content">
                    <div class="tv-modal-header">
                        <div class="tv-modal-icon" id="tv-modal-icon">⚠️</div>
                        <h2 id="tv-modal-title">Atenção</h2>
                    </div>
                    <div class="tv-modal-body">
                        <p class="tv-modal-message" id="tv-modal-message"></p>
                        <div id="tv-modal-extra" class="tv-modal-extra"></div>
                    </div>
                    <div class="tv-modal-footer" id="tv-modal-footer">
                        <button class="tv-btn-modal tv-btn-primary" id="tv-modal-btn-ok">OK</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Event listeners
        const modal = document.getElementById('tv-modal');
        const overlay = modal.querySelector('.tv-modal-overlay');
        const btnOk = document.getElementById('tv-modal-btn-ok');
        
        btnOk.addEventListener('click', () => this.hide());
        overlay.addEventListener('click', () => this.hide());
        
        // Fechar com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                this.hide();
            }
        });
    }
    
    show(type, title, message, options = {}) {
        const modal = document.getElementById('tv-modal');
        const icon = document.getElementById('tv-modal-icon');
        const titleEl = document.getElementById('tv-modal-title');
        const messageEl = document.getElementById('tv-modal-message');
        const extraEl = document.getElementById('tv-modal-extra');
        const footerEl = document.getElementById('tv-modal-footer');
        
        // Limpar conteúdo extra
        extraEl.innerHTML = '';
        
        // Configurar ícone e título baseado no tipo
        if (type === 'error') {
            icon.textContent = '⚠️';
            titleEl.textContent = title || 'Atenção';
            
            // Tocar som de erro
            if (this.sounds.error) {
                this.sounds.error.volume = 0.85;
                this.sounds.error.play().catch(() => {});
            }
        } else if (type === 'success') {
            icon.textContent = '✅';
            titleEl.textContent = title || 'Sucesso';
            
            // Tocar som de sucesso
            if (this.sounds.success) {
                this.sounds.success.volume = 0.85;
                this.sounds.success.play().catch(() => {});
            }
        } else if (type === 'warning') {
            icon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
            titleEl.textContent = title || 'Atenção';
        } else {
            icon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
            titleEl.textContent = title || 'Informação';
        }
        
        messageEl.textContent = message;
        
        // Adicionar botão "Abrir Pasta" se fornecido
        if (options.outputPath) {
            const btnOpenFolder = document.createElement('button');
            btnOpenFolder.className = 'tv-btn-modal tv-btn-secondary';
            btnOpenFolder.textContent = 'Abrir Pasta';
            btnOpenFolder.onclick = async () => {
                try {
                    await window.electronAPI.openPath(options.outputPath);
                } catch (error) {
                    console.error('Erro ao abrir pasta:', error);
                }
            };
            
            // Inserir antes do botão OK
            const btnOk = document.getElementById('tv-modal-btn-ok');
            footerEl.insertBefore(btnOpenFolder, btnOk);
        }
        
        modal.style.display = 'flex';
    }
    
    hide() {
        const modal = document.getElementById('tv-modal');
        const footerEl = document.getElementById('tv-modal-footer');
        
        // Remover botões extras (manter apenas OK)
        const btnOk = document.getElementById('tv-modal-btn-ok');
        footerEl.innerHTML = '';
        footerEl.appendChild(btnOk);
        
        modal.style.display = 'none';
    }
    
    error(message, title = 'Atenção') {
        this.show('error', title, message);
    }
    
    success(message, title = 'Sucesso', options = {}) {
        this.show('success', title, message, options);
    }
    
    warning(message, title = 'Atenção') {
        this.show('warning', title, message);
    }
    
    info(message, title = 'Informação') {
        this.show('info', title, message);
    }
    
    /**
     * Mostrar confirmação com botões Sim/Não
     */
    confirm(title, message, options = {}) {
        return new Promise((resolve) => {
            const modal = document.getElementById('tv-modal');
            const icon = document.getElementById('tv-modal-icon');
            const titleEl = document.getElementById('tv-modal-title');
            const messageEl = document.getElementById('tv-modal-message');
            const extraEl = document.getElementById('tv-modal-extra');
            const footerEl = document.getElementById('tv-modal-footer');
            
            // Limpar conteúdo extra
            extraEl.innerHTML = '';
            
            // Configurar ícone e título
            if (options.danger) {
                icon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
            } else {
                icon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
            }
            titleEl.textContent = title;
            messageEl.textContent = message;
            
            // Configurar botões
            footerEl.innerHTML = '';
            
            const btnCancel = document.createElement('button');
            btnCancel.className = 'tv-btn-modal tv-btn-secondary';
            btnCancel.textContent = options.cancelText || 'Cancelar';
            btnCancel.onclick = () => {
                modal.style.display = 'none';
                resolve(false);
            };
            
            const btnConfirm = document.createElement('button');
            btnConfirm.className = options.danger ? 'tv-btn-modal tv-btn-danger' : 'tv-btn-modal tv-btn-primary';
            btnConfirm.textContent = options.confirmText || 'Confirmar';
            btnConfirm.onclick = () => {
                modal.style.display = 'none';
                resolve(true);
            };
            
            footerEl.appendChild(btnCancel);
            footerEl.appendChild(btnConfirm);
            
            // Mostrar modal
            modal.style.display = 'flex';
            
            // ESC para cancelar
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    btnCancel.click();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    }

    /**
     * Mostrar prompt para input do usuário
     */
    prompt(title, message, defaultValue = '') {
        return new Promise((resolve) => {
            const modal = document.getElementById('tv-modal');
            const icon = document.getElementById('tv-modal-icon');
            const titleEl = document.getElementById('tv-modal-title');
            const messageEl = document.getElementById('tv-modal-message');
            const extraEl = document.getElementById('tv-modal-extra');
            const footerEl = document.getElementById('tv-modal-footer');
            
            // Limpar conteúdo extra
            extraEl.innerHTML = '';
            
            // Configurar ícone e título
            icon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
            titleEl.textContent = title;
            messageEl.textContent = message;
            
            // Criar input
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tv-modal-input';
            input.value = defaultValue;
            input.placeholder = 'Digite aqui...';
            input.style.cssText = 'width: 100%; padding: 10px; margin-top: 10px; border: 1px solid #333; background: #1a1a1a; color: #fff; border-radius: 4px; font-size: 14px;';
            extraEl.appendChild(input);
            
            // Configurar botões
            footerEl.innerHTML = '';
            
            const btnCancel = document.createElement('button');
            btnCancel.className = 'tv-btn-modal tv-btn-secondary';
            btnCancel.textContent = 'Cancelar';
            btnCancel.onclick = () => {
                modal.style.display = 'none';
                resolve(null);
            };
            
            const btnOk = document.createElement('button');
            btnOk.className = 'tv-btn-modal tv-btn-primary';
            btnOk.textContent = 'OK';
            btnOk.onclick = () => {
                const value = input.value.trim();
                modal.style.display = 'none';
                resolve(value || null);
            };
            
            footerEl.appendChild(btnCancel);
            footerEl.appendChild(btnOk);
            
            // Mostrar modal
            modal.style.display = 'flex';
            
            // Focar no input
            setTimeout(() => input.focus(), 100);
            
            // Enter para confirmar
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    btnOk.click();
                } else if (e.key === 'Escape') {
                    btnCancel.click();
                }
            });
        });
    }
}

// Instância global
window.modal = new TurboVoicerModal();

// Expor sons globalmente para outros módulos (ValidationManager, PresetManager, etc.)
window.sounds = window.modal.sounds;
