// TurboVoicer - Sistema de Autenticação de Vozes Premium

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

class PremiumAuth {
    constructor() {
        this.configPath = path.join(app.getPath('userData'), 'turbovoicer', 'premium-auth.json');
        this.premiumUrl = 'https://cpmdark.com.br/downloads/turbovoicer-vozes-full/';
        // URL de teste para autenticação (arquivo específico, pois servidor bloqueia acesso à pasta raiz)
        this.testUrl = 'https://cpmdark.com.br/downloads/turbovoicer-vozes-full/Anime/CPMDarkTurboVoicer_Anime_Adam_H.zip';
    }

    /**
     * Autenticar usuário e senha no servidor
     * Usa EXATAMENTE o mesmo padrão do voice-downloader.js
     */
    async authenticate(username, password) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout ao autenticar Premium (10s)'));
            }, 10000);

            const authHeader = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
            
            const options = {
                headers: {
                    'Authorization': authHeader,
                    'User-Agent': 'TurboStudio/2.0.3'
                }
            };

            const request = https.get(this.testUrl, options, (response) => {
                clearTimeout(timeout);
                
                if (response.statusCode === 200) {
                    // Sucesso - salvar credencial
                    this.saveCredential(username, password);
                    resolve({ success: true });
                } else if (response.statusCode === 401) {
                    resolve({ success: false, error: 'Usuário ou senha incorretos' });
                } else {
                    resolve({ success: false, error: 'Erro no servidor (' + response.statusCode + ')' });
                }
            });

            request.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });

            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Timeout ao conectar ao servidor'));
            });
        });
    }

    saveCredential(username, password) {
        try {
            const credentials = username + ':' + password;
            const encrypted = this.encrypt(credentials);
            const config = {
                premium: encrypted,
                unlocked: true,
                unlockedAt: new Date().toISOString()
            };
            
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
            console.log('[PremiumAuth] Credencial salva com sucesso');
        } catch (error) {
            console.error('[PremiumAuth] Erro ao salvar credencial:', error);
        }
    }

    loadCredential() {
        try {
            if (fs.existsSync(this.configPath)) {
                const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                
                if (config.premium && config.unlocked) {
                    const credentials = this.decrypt(config.premium);
                    console.log('[PremiumAuth] Credencial carregada do cache');
                    return credentials;
                }
            }
            
            return null;
        } catch (error) {
            console.error('[PremiumAuth] Erro ao carregar credencial:', error);
            return null;
        }
    }

    isPremiumUnlocked() {
        try {
            if (fs.existsSync(this.configPath)) {
                const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                return config.unlocked === true;
            }
            return false;
        } catch (error) {
            console.error('[PremiumAuth] Erro ao verificar status Premium:', error);
            return false;
        }
    }

    getAuthHeader() {
        const credentials = this.loadCredential();
        
        if (credentials) {
            return 'Basic ' + Buffer.from(credentials).toString('base64');
        }
        
        return null;
    }

    clearCredential() {
        try {
            if (fs.existsSync(this.configPath)) {
                fs.unlinkSync(this.configPath);
                console.log('[PremiumAuth] Credencial removida');
            }
        } catch (error) {
            console.error('[PremiumAuth] Erro ao remover credencial:', error);
        }
    }

    encrypt(text) {
        const key = 0x42;
        return text.split('').map(c => c.charCodeAt(0) ^ key);
    }

    decrypt(encrypted) {
        const key = 0x42;
        return String.fromCharCode(...encrypted.map(c => c ^ key));
    }
}

module.exports = PremiumAuth;
