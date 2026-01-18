# TurboVoicer - Python Resources

Este diretório contém os scripts Python e recursos necessários para o TurboVoicer.

## 📁 Estrutura

```
resources/
├── edge_tts/
│   └── generate_edge_tts.py    # Script para gerar áudio com Edge TTS
├── rvc/
│   └── convert_rvc.py          # Script para converter áudio com RVC
├── python/
│   └── ...                     # Python Embedded (instalado automaticamente)
└── requirements.txt            # Dependências Python
```

## 🎙️ Edge TTS Script

**Arquivo:** `edge_tts/generate_edge_tts.py`

Gera áudio usando Microsoft Edge TTS com controles de pitch e rate.

### Uso:

```bash
python generate_edge_tts.py \
  --text "Texto para sintetizar" \
  --voice "en-US-AvaMultilingualNeural" \
  --pitch "+5Hz" \
  --rate "+50%" \
  --output "output.mp3"
```

### Parâmetros:

- `--text`: Texto para sintetizar (obrigatório)
- `--voice`: Nome da voz Edge TTS (obrigatório)
- `--pitch`: Ajuste de pitch em Hz (ex: +5Hz, -10Hz)
- `--rate`: Ajuste de velocidade em % (ex: +50%, -25%)
- `--output`: Caminho do arquivo de saída (obrigatório)

### Vozes Suportadas:

- `en-US-AvaMultilingualNeural` - Feminina, Multilingual
- `en-US-BrianMultilingualNeural` - Masculina, Multilingual

## 🎵 RVC Converter Script

**Arquivo:** `rvc/convert_rvc.py`

Converte áudio usando modelos RVC via RVC-API.

### Uso:

```bash
python convert_rvc.py \
  --input "input.mp3" \
  --model "path/to/rvc/model" \
  --pitch 0 \
  --output "output.mp3" \
  --api-url "http://127.0.0.1:9880"
```

### Parâmetros:

- `--input`: Caminho do áudio de entrada (obrigatório)
- `--model`: Caminho do diretório do modelo RVC (obrigatório)
- `--pitch`: Ajuste de pitch/f0_up_key (-12 a +12)
- `--output`: Caminho do arquivo de saída (obrigatório)
- `--api-url`: URL da RVC-API (padrão: http://127.0.0.1:9880)

### Requisitos:

- RVC-API rodando em `http://127.0.0.1:9880`
- Modelo RVC com arquivo `.pth` e opcionalmente `.index`

## 📦 Dependências

As dependências Python são instaladas automaticamente pelo RVC Installer:

- `edge-tts>=6.1.9` - Microsoft Edge TTS
- `requests>=2.31.0` - HTTP client para RVC-API
- PyTorch, torchaudio, librosa (instalados com RVC-API)

## 🔧 Instalação Manual (Desenvolvimento)

Para testar os scripts manualmente:

```bash
# Instalar dependências
pip install -r requirements.txt

# Testar Edge TTS
python edge_tts/generate_edge_tts.py --text "Hello world" --voice "en-US-AvaMultilingualNeural" --output test.mp3

# Testar RVC (requer RVC-API rodando)
python rvc/convert_rvc.py --input test.mp3 --model path/to/model --output converted.mp3
```

## 🚀 Pipeline de Preview

O sistema de preview executa os seguintes passos:

1. **Edge TTS:** Gera áudio base com voz Azure TTS
   - Aplica pitch e rate configurados
   - Salva em arquivo temporário

2. **RVC Conversion:** Converte áudio com modelo RVC
   - Aplica f0_up_key (pitch adjustment)
   - Usa RVC-API para processamento
   - Salva resultado final

3. **Cache:** Armazena preview com hash de configuração
   - Reutiliza previews idênticos
   - Economiza tempo e recursos

## 📝 Notas Técnicas

- **Edge TTS** é executado de forma assíncrona (asyncio)
- **RVC** usa API REST (HTTP POST com multipart/form-data)
- Arquivos temporários são limpos automaticamente
- Cache é persistente entre sessões
- Timeout de 5 minutos para conversão RVC
