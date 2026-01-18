# 🎙️ TurboVoicer

**Conversão de Voz com IA usando RVC (Retrieval-based Voice Conversion)**

TurboVoicer é um aplicativo standalone Electron que permite converter áudio usando modelos de voz RVC de alta qualidade.

## 🚀 Características

- ✅ Interface moderna e intuitiva
- ✅ Catálogo de vozes RVC para download
- ✅ Preview de vozes com Edge TTS
- ✅ Conversão em lote de arquivos
- ✅ Suporte para GPU (CUDA) e CPU
- ✅ Detecção automática de hardware
- ✅ Sistema de cache inteligente
- ✅ Compatibilidade com RTX 50 Series (CPU fallback)

## 📦 Instalação

### Desenvolvimento

```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm start
```

### Build

```bash
# Build para Windows
npm run build:win
```

## 🛠️ Tecnologias

- **Electron** - Framework desktop
- **RVC-GUI** - Engine de conversão de voz
- **Edge TTS** - Preview de vozes
- **Node.js** - Backend
- **FFmpeg** - Processamento de áudio

## 📂 Estrutura

```
TurboVoicer/
├── src/              # Código backend (Electron main process)
├── public/           # Interface (HTML/CSS/JS)
├── resources/        # Assets (logos, ícones, etc)
└── package.json
```

## 🎯 Compatibilidade GPU

- **RTX 10/20/30/40:** Usa GPU (método rmvpe - muito rápido)
- **RTX 50+:** Usa CPU (método pm - forçado via CUDA_VISIBLE_DEVICES)
- **CPU:** Usa pm (sem timeout, suporta filas longas)

## 📄 Licença

© Todos os Direitos Reservados | Alex Bassani Designer e Infoprodutor Digital Ltda

## 🔧 Desenvolvimento

**Status:** Fase 1 - App Standalone (sem autenticação)

**Próximos passos:**
- [ ] Testar instalação do RVC-GUI
- [ ] Testar conversão de voz
- [ ] Testar download de vozes
- [ ] Implementar sistema de login (Fase 2)
