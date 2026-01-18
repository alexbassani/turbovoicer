const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const AdmZip = require('adm-zip');

class VoiceDownloader {
  constructor() {
    this.authHeader = this.#decodeAuth();
  }

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

  async downloadVoice(url, destinationPath, onProgress, customAuthHeader = null) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      // Usar authHeader customizado (Premium) ou o padrão (Starter)
      const authToUse = customAuthHeader || this.authHeader;
      
      const options = {
        headers: {
          'Authorization': authToUse,
          'User-Agent': 'TurboStudio/2.0.3'
        }
      };

      const request = protocol.get(url, options, (response) => {
        if (response.statusCode === 401) {
          reject(new Error('Autenticação falhou. Credenciais inválidas.'));
          return;
        }

        if (response.statusCode === 404) {
          reject(new Error('Arquivo não encontrado no servidor.'));
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Erro HTTP: ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        const fileStream = fs.createWriteStream(destinationPath);

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          
          if (onProgress && totalSize) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            onProgress(progress, downloadedSize, totalSize);
          }
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve(destinationPath);
        });

        fileStream.on('error', (error) => {
          fs.unlink(destinationPath, () => {});
          reject(error);
        });
      });

      request.on('error', (error) => {
        reject(new Error(`Erro de rede: ${error.message}`));
      });

      request.setTimeout(300000, () => {
        request.destroy();
        reject(new Error('Timeout: Download demorou mais de 5 minutos'));
      });
    });
  }

  async extractVoiceZip(zipPath, extractToPath) {
    try {
      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();

      const requiredFiles = {
        pth: null,
        index: null,
        preview: null
      };

      zipEntries.forEach(entry => {
        const fileName = entry.entryName.toLowerCase();
        
        if (fileName.endsWith('.pth')) {
          requiredFiles.pth = entry;
        } else if (fileName.endsWith('.index')) {
          requiredFiles.index = entry;
        } else if (fileName.endsWith('.mp3') || fileName.endsWith('.wav')) {
          requiredFiles.preview = entry;
        }
      });

      if (!requiredFiles.pth || !requiredFiles.index) {
        throw new Error('ZIP inválido: faltam arquivos .pth ou .index');
      }

      if (!fs.existsSync(extractToPath)) {
        fs.mkdirSync(extractToPath, { recursive: true });
      }

      zip.extractAllTo(extractToPath, true);

      // Buscar arquivo de preview diretamente na pasta extraída
      // (mais confiável do que usar entry.entryName que pode ter inconsistências)
      let previewPath = null;
      if (requiredFiles.preview) {
        const extractedFilesInFolder = fs.readdirSync(extractToPath);
        const previewFile = extractedFilesInFolder.find(f => 
          f.toLowerCase().endsWith('.mp3') || f.toLowerCase().endsWith('.wav')
        );
        if (previewFile) {
          previewPath = path.join(extractToPath, previewFile);
        }
      }

      const extractedFiles = {
        modelPath: path.join(extractToPath, requiredFiles.pth.entryName),
        indexPath: path.join(extractToPath, requiredFiles.index.entryName),
        previewPath: previewPath
      };

      return extractedFiles;
    } catch (error) {
      throw new Error(`Erro ao extrair ZIP: ${error.message}`);
    }
  }

  async downloadAndInstallVoice(voiceData, installBasePath, onProgress, customAuthHeader = null) {
    try {
      const tempDir = path.join(installBasePath, '.temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const zipFileName = path.basename(voiceData.downloadUrl);
      const tempZipPath = path.join(tempDir, zipFileName);

      onProgress && onProgress({ stage: 'downloading', progress: 0 });

      await this.downloadVoice(
        voiceData.downloadUrl,
        tempZipPath,
        (progress, downloaded, total) => {
          onProgress && onProgress({
            stage: 'downloading',
            progress,
            downloaded,
            total
          });
        },
        customAuthHeader
      );

      onProgress && onProgress({ stage: 'extracting', progress: 0 });

      const voiceInstallPath = path.join(
        installBasePath,
        voiceData.category,
        voiceData.id
      );

      const extractedFiles = await this.extractVoiceZip(tempZipPath, voiceInstallPath);

      fs.unlinkSync(tempZipPath);

      onProgress && onProgress({ stage: 'completed', progress: 100 });

      return {
        success: true,
        voiceId: voiceData.id,
        installPath: voiceInstallPath,
        files: extractedFiles
      };
    } catch (error) {
      throw new Error(`Falha na instalação: ${error.message}`);
    }
  }

  async importCustomVoice(zipPath, customVoicesPath, voiceName) {
    try {
      const voiceId = `custom_${voiceName.toLowerCase().replace(/\s+/g, '_')}`;
      const voiceInstallPath = path.join(customVoicesPath, voiceId);

      // Verificar se voz já existe (evitar duplicatas)
      if (fs.existsSync(voiceInstallPath)) {
        return {
          success: false,
          error: 'duplicate',
          message: 'Esta voz já foi importada anteriormente',
          voiceId,
          installPath: voiceInstallPath
        };
      }

      const extractedFiles = await this.extractVoiceZip(zipPath, voiceInstallPath);

      // Salvar metadados da voz importada
      const metadata = {
        voiceId,
        name: voiceName,
        isCustom: true,
        importDate: new Date().toISOString(),
        category: 'custom',
        files: {
          model: path.basename(extractedFiles.modelPath),
          index: path.basename(extractedFiles.indexPath),
          preview: extractedFiles.previewPath ? path.basename(extractedFiles.previewPath) : null
        }
      };

      const metadataPath = path.join(voiceInstallPath, '.voice-info.json');
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

      return {
        success: true,
        voiceId,
        name: voiceName,
        installPath: voiceInstallPath,
        files: extractedFiles,
        isCustom: true
      };
    } catch (error) {
      throw new Error(`Falha ao importar voz: ${error.message}`);
    }
  }

  async deleteVoice(voicePath) {
    try {
      if (fs.existsSync(voicePath)) {
        fs.rmSync(voicePath, { recursive: true, force: true });
        return { success: true };
      } else {
        throw new Error('Voz não encontrada');
      }
    } catch (error) {
      throw new Error(`Erro ao deletar voz: ${error.message}`);
    }
  }

  async getInstalledVoices(installBasePath) {
    try {
      const installedVoices = [];

      if (!fs.existsSync(installBasePath)) {
        return installedVoices;
      }

      const categories = fs.readdirSync(installBasePath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'));

      for (const category of categories) {
        const categoryPath = path.join(installBasePath, category.name);
        const voices = fs.readdirSync(categoryPath, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory());

        for (const voice of voices) {
          const voicePath = path.join(categoryPath, voice.name);
          const files = fs.readdirSync(voicePath);

          const hasPth = files.some(f => f.endsWith('.pth'));
          const hasIndex = files.some(f => f.endsWith('.index'));

          if (hasPth && hasIndex) {
            // Tentar ler metadados se existir
            const metadataPath = path.join(voicePath, '.voice-info.json');
            let metadata = null;
            let displayName = voice.name;
            let isCustom = false;
            let previewPath = null;

            if (fs.existsSync(metadataPath)) {
              try {
                const metadataContent = fs.readFileSync(metadataPath, 'utf8');
                metadata = JSON.parse(metadataContent);
                displayName = metadata.name || voice.name;
                isCustom = metadata.isCustom || false;
                
                // Se tem arquivo de preview nos metadados, construir caminho completo
                if (metadata.files && metadata.files.preview) {
                  const previewFile = path.join(voicePath, metadata.files.preview);
                  if (fs.existsSync(previewFile)) {
                    previewPath = previewFile;
                  }
                }
              } catch (err) {
                console.warn('[VoiceDownloader] Erro ao ler metadados:', err.message);
              }
            }

            installedVoices.push({
              voiceId: voice.name,
              name: displayName,
              category: category.name,
              path: voicePath,
              isInstalled: true,
              isCustom,
              metadata,
              previewPath
            });
          }
        }
      }

      return installedVoices;
    } catch (error) {
      console.error('[VoiceDownloader] Erro ao listar vozes instaladas:', error);
      return [];
    }
  }
}

module.exports = VoiceDownloader;
