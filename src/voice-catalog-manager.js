// CONTEÚDO DE: apps/turbovoicer/src/voice-catalog-manager.js
// TurboVoicer - Gerenciador de Catálogo de Vozes (Starter + Premium)

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const PremiumAuth = require('./premium-auth');

class VoiceCatalogManager {
    constructor() {
        this.starterUrl = 'https://cpmdark.com.br/downloads/turbovoicer-vozes/starter/';
        this.premiumUrl = 'https://cpmdark.com.br/downloads/turbovoicer-vozes-full/';
        
        // Autenticação Starter (senha criptografada no código)
        this.starterAuth = this.#decodeAuth();
        
        // Autenticação Premium (gerenciada pelo PremiumAuth)
        this.premiumAuth = new PremiumAuth();
        
        // Cache de vozes
        this.starterVoices = null;
        this.premiumVoices = null;
    }

    /**
     * Decodificar autenticação Starter (XOR obfuscation)
     */
    #decodeAuth() {
        // XOR obfuscated credentials: alexbassani:_0601.Alex_
        const obfuscated = {
            u: [35, 46, 39, 58, 32, 35, 49, 49, 35, 44, 43],
            p: [29, 114, 116, 114, 115, 108, 3, 46, 39, 58, 29]
        };
        
        const key = 0x42;
        
        const username = String.fromCharCode(...obfuscated.u.map(c => c ^ key));
        const password = String.fromCharCode(...obfuscated.p.map(c => c ^ key));
        
        return 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
    }

    /**
     * Obter vozes Starter (sempre disponíveis)
     */
    async getStarterVoices() {
        if (this.starterVoices) {
            return this.starterVoices;
        }

        this.starterVoices = [
            {
                id: 'starter_crianca_travessura_natal_h',
                name: 'Criança - Travessura Natal',
                category: 'Starter',
                gender: 'H',
                descriptor: 'Infantil',
                tags: ['criança', 'natal', 'travesso'],
                file: 'CPMDarkTurboVoicer_Crianca_Travessura_Natal_H.zip',
                downloadUrl: this.starterUrl + 'CPMDarkTurboVoicer_Crianca_Travessura_Natal_H.zip',
                previewLocal: 'assets/voices/previews/infantil/CPMDarkTurboVoicer_Crianca_Travessura_Natal_H.mp3'
            },
            {
                id: 'starter_narrativo_arabela_m',
                name: 'Narrativo - Arabela',
                category: 'Starter',
                gender: 'M',
                descriptor: 'Feminina',
                tags: ['narrativo', 'profissional', 'feminina'],
                file: 'CPMDarkTurboVoicer_Narrativo_Arabela_M.zip',
                downloadUrl: this.starterUrl + 'CPMDarkTurboVoicer_Narrativo_Arabela_M.zip',
                previewLocal: 'assets/voices/previews/narrativo/CPMDarkTurboVoicer_Narrativo_Arabela_M.mp3'
            },
            {
                id: 'starter_narrativo_brian_h',
                name: 'Narrativo - Brian',
                category: 'Starter',
                gender: 'H',
                descriptor: 'Masculina',
                tags: ['narrativo', 'profissional', 'masculina'],
                file: 'CPMDarkTurboVoicer_Narrativo_Brian_H.zip',
                downloadUrl: this.starterUrl + 'CPMDarkTurboVoicer_Narrativo_Brian_H.zip',
                previewLocal: 'assets/voices/previews/narrativo/CPMDarkTurboVoicer_Narrativo_Brian_H.mp3'
            },
            {
                id: 'starter_vovo_joe_h',
                name: 'Vovô - Joe',
                category: 'Starter',
                gender: 'H',
                descriptor: 'Idoso',
                tags: ['idoso', 'sábio', 'masculina'],
                file: 'CPMDarkTurboVoicer_Vovo_Joe_H.zip',
                downloadUrl: this.starterUrl + 'CPMDarkTurboVoicer_Vovo_Joe_H.zip',
                previewLocal: 'assets/voices/previews/vovos/CPMDarkTurboVoicer_Vovo_Joe_H.mp3'
            }
        ];

        return this.starterVoices;
    }

    /**
     * Obter vozes Premium (requer autenticação)
     */
    async getPremiumVoices() {
        if (!this.premiumAuth.isPremiumUnlocked()) {
            console.log('[VoiceCatalog] Premium não desbloqueado');
            return [];
        }

        if (this.premiumVoices) {
            return this.premiumVoices;
        }

        // Carregar vozes Premium do catalog.json
        try {
            const catalogPath = path.join(__dirname, '..', 'public', 'assets', 'voices', 'catalog.json');
            
            if (fs.existsSync(catalogPath)) {
                const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
                
                // Processar todas as vozes do catalog.json
                this.premiumVoices = [];
                
                // Iterar por todas as categorias
                Object.keys(catalog.categories).forEach(categoryKey => {
                    const category = catalog.categories[categoryKey];
                    
                    category.voices.forEach(voice => {
                        // Atualizar URL para pasta Premium
                        const updatedVoice = {
                            ...voice,
                            category: category.displayName,
                            downloadUrl: voice.downloadUrl.replace(
                                'https://cpmdark.com.br/downloads/turbovoicer-vozes/',
                                this.premiumUrl
                            )
                        };
                        
                        this.premiumVoices.push(updatedVoice);
                    });
                });
                
                console.log(`[VoiceCatalog] ${this.premiumVoices.length} vozes Premium carregadas`);
                return this.premiumVoices;
            }
        } catch (error) {
            console.error('[VoiceCatalog] Erro ao carregar vozes Premium:', error);
        }

        return [];
    }

    /**
     * Obter todas as vozes (Starter + Premium se desbloqueado)
     */
    async getAllVoices() {
        const starter = await this.getStarterVoices();
        const premium = await this.getPremiumVoices();
        
        return [...starter, ...premium];
    }

    /**
     * Organizar vozes por categoria
     */
    async getVoicesByCategory() {
        const allVoices = await this.getAllVoices();
        
        const categories = {};
        
        allVoices.forEach(voice => {
            const category = voice.category || 'Outros';
            
            if (!categories[category]) {
                categories[category] = {
                    displayName: category,
                    description: `Vozes ${category}`,
                    icon: category === 'Starter' ? '🎁' : '🎤',
                    voices: []
                };
            }
            
            categories[category].voices.push(voice);
        });
        
        return categories;
    }

    /**
     * Verificar se Premium está desbloqueado
     */
    isPremiumUnlocked() {
        return this.premiumAuth.isPremiumUnlocked();
    }

    /**
     * Autenticar Premium
     */
    async authenticatePremium(username, password) {
        return await this.premiumAuth.authenticate(username, password);
    }

    /**
     * Obter header de autenticação para download
     */
    getAuthHeader(isStarter = true) {
        if (isStarter) {
            return this.starterAuth;
        } else {
            return this.premiumAuth.getAuthHeader();
        }
    }

    /**
     * Limpar cache de vozes
     */
    clearCache() {
        this.starterVoices = null;
        this.premiumVoices = null;
    }
}

module.exports = VoiceCatalogManager;
