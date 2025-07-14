const axios = require('axios');
const sharp = require('sharp');

class ImageHandler {
    constructor() {
        // ✅ APIS EXISTENTES (MANTIDAS COMO FALLBACK)
        this.pexelsApiKey = process.env.PEXELS_API_KEY;
        this.pixabayApiKey = process.env.PIXABAY_API_KEY;
        
        // 🆕 REPLICATE API (GRATUITA)
        this.replicateApiKey = process.env.REPLICATE_API_KEY;
        
        // ✅ CONTROLE DE LIMITES DIÁRIOS
        this.replicateDailyLimit = 0;
        this.maxReplicateDaily = 50; // Replicate é bem generoso no tier gratuito
        
        // ✅ CONTROLE DE IMAGENS USADAS
        this.usedImages = new Set();
        
        // ✅ KEYWORDS BÍBLICAS (MANTIDAS)
        this.biblicalKeywords = [
            'bible', 'cross', 'church', 'cathedral', 'temple', 'altar',
            'candle', 'prayer', 'dove', 'light', 'holy', 'sacred',
            'scripture', 'book', 'ancient book', 'old book', 'manuscript',
            'sword', 'armor', 'shield', 'crown', 'throne', 'chalice',
            'mountain', 'valley', 'river', 'desert', 'wilderness', 'garden',
            'sunrise', 'sunset', 'clouds', 'sky', 'stars', 'heaven',
            'tree', 'olive tree', 'vine', 'wheat', 'harvest', 'fruit',
            'stone', 'rock', 'cave', 'path', 'road', 'gate', 'door',
            'lamp', 'lantern', 'fire', 'flame', 'burning bush',
            'wooden table', 'ancient scroll', 'golden cross'
        ];
        
        // ✅ MAPEAMENTO PARA PROMPTS DE IA
        this.aiPromptMapping = {
            // Livros bíblicos
            'gênesis': 'biblical genesis, creation scene, garden of eden, ancient times, divine light',
            'êxodo': 'biblical exodus, moses, desert journey, parting red sea, ancient egypt',
            'levítico': 'biblical temple, ancient altar, sacrificial system, holy place',
            'números': 'biblical wilderness, israelites journey, desert landscape, ancient times',
            'deuteronômio': 'biblical law, moses with tablets, mountain scene, covenant',
            'salmos': 'biblical psalms, david with harp, worship scene, spiritual atmosphere',
            'provérbios': 'biblical wisdom, ancient scrolls, teacher scene, knowledge',
            'isaías': 'biblical prophecy, ancient prophet, divine vision, holy light',
            'jeremias': 'biblical prophecy, ancient jerusalem, spiritual calling',
            'ezequiel': 'biblical vision, wheels of fire, divine revelation, prophetic scene',
            'daniel': 'biblical daniel, lions den, ancient babylon, divine protection',
            'oséias': 'biblical love story, covenant relationship, divine mercy',
            'joel': 'biblical locust plague, day of the lord, divine judgment',
            'amós': 'biblical justice, ancient israel, prophetic message',
            'mateus': 'biblical jesus, sermon on the mount, disciples, holy land',
            'marcos': 'biblical jesus, miracles, healing scene, ancient palestine',
            'lucas': 'biblical nativity, birth of jesus, shepherds, bethlehem',
            'joão': 'biblical jesus, divine light, eternal life, spiritual truth',
            'atos': 'biblical early church, pentecost, disciples, christian community',
            'romanos': 'biblical paul, ancient rome, christian doctrine, letters',
            'coríntios': 'biblical paul, ancient corinth, christian teaching',
            'gálatas': 'biblical freedom, christian liberty, spiritual truth',
            'efésios': 'biblical church, body of christ, spiritual unity',
            'filipenses': 'biblical joy, christian fellowship, spiritual strength',
            'colossenses': 'biblical christ, divine nature, spiritual supremacy',
            'tessalonicenses': 'biblical second coming, christian hope, end times',
            'timóteo': 'biblical pastoral care, church leadership, spiritual guidance',
            'tito': 'biblical church order, christian living, spiritual maturity',
            'filemom': 'biblical forgiveness, christian brotherhood, redemption',
            'hebreus': 'biblical high priest, tabernacle, old covenant vs new',
            'tiago': 'biblical wisdom, practical faith, christian living',
            'pedro': 'biblical suffering, christian hope, spiritual endurance',
            'judas': 'biblical warning, false teaching, spiritual discernment',
            'apocalipse': 'biblical revelation, end times, divine throne, new jerusalem',
            
            // Temas espirituais
            'fé': 'biblical faith, mountain moving, spiritual strength, divine trust',
            'esperança': 'biblical hope, sunrise, rainbow after storm, divine promise',
            'amor': 'biblical love, good shepherd, divine embrace, spiritual care',
            'paz': 'biblical peace, calm waters, dove, spiritual rest',
            'oração': 'biblical prayer, hands lifted, spiritual communion, divine presence',
            'salvação': 'biblical salvation, cross, empty tomb, divine rescue',
            'perdão': 'biblical forgiveness, prodigal son, divine mercy, restoration',
            'graça': 'biblical grace, divine favor, spiritual blessing, heavenly light',
            'misericórdia': 'biblical mercy, compassionate jesus, divine kindness',
            'santidade': 'biblical holiness, divine purity, spiritual consecration',
            'sabedoria': 'biblical wisdom, ancient scrolls, divine knowledge, spiritual understanding',
            'verdade': 'biblical truth, divine light, spiritual revelation, gods word',
            'justiça': 'biblical justice, divine judgment, spiritual righteousness',
            'humildade': 'biblical humility, servant heart, spiritual meekness',
            'obediência': 'biblical obedience, abraham sacrifice, spiritual submission',
            'arrependimento': 'biblical repentance, spiritual transformation, divine forgiveness',
            'adoração': 'biblical worship, temple scene, spiritual praise, divine glory',
            'jejum': 'biblical fasting, spiritual discipline, divine seeking',
            'batismo': 'biblical baptism, jordan river, spiritual rebirth, divine cleansing',
            'comunhão': 'biblical fellowship, disciples together, spiritual unity',
            'evangelização': 'biblical great commission, disciples preaching, spiritual mission',
            'discipulado': 'biblical discipleship, jesus teaching, spiritual growth',
            'ressurreição': 'biblical resurrection, empty tomb, divine victory, eternal life',
            'eternidade': 'biblical eternity, heavenly realm, divine timelessness',
            'reino': 'biblical kingdom, divine rule, spiritual authority, heavenly realm'
        };
    }

    // 🆕 GERAR PROMPT PARA IA BASEADO NO CONTEÚDO
    generateAIPrompt(title, content, type = 'featured') {
        const text = (title + ' ' + content).toLowerCase();
        let mainTheme = 'biblical scene, holy land, spiritual atmosphere';
        
        // Buscar tema específico
        for (const [key, prompt] of Object.entries(this.aiPromptMapping)) {
            if (text.includes(key)) {
                mainTheme = prompt;
                break;
            }
        }
        
        if (type === 'featured') {
            return `${mainTheme}, majestic landscape, divine light, high quality, detailed, inspirational, Christian art, no text, 16:9 aspect ratio, cinematic lighting, vibrant colors, professional photography style, masterpiece, best quality`;
        } else {
            // Para versículo (tipo 'verse')
            return `elegant biblical verse background, ${mainTheme}, minimalist design, soft lighting, spiritual atmosphere, clean space for text overlay, no existing text, inspirational, peaceful, 16:9 aspect ratio, high quality, artistic`;
        }
    }

    // 🆕 EXTRAIR VERSÍCULO DO CONTEÚDO
    extractBibleVerse(content) {
        const versePattern = /([12]?\s*[A-ZÁÊÇÕ][a-záêâãéèêíìîóòôõúùûç]+)\s+(\d+):(\d+(?:-\d+)?)/g;
        const matches = content.match(versePattern);
        
        if (matches && matches.length > 0) {
            return matches[0];
        }
        
        return null;
    }

    // 🆕 GERAR IMAGEM DESTACADA COM FLUX SCHNELL
    async generateFeaturedImage(title, content) {
        try {
            if (this.replicateDailyLimit >= this.maxReplicateDaily) {
                console.log(`⚠️ Limite diário Replicate atingido (${this.replicateDailyLimit}/${this.maxReplicateDaily})`);
                return null;
            }

            if (!this.replicateApiKey) {
                console.log('⚠️ Replicate API Key não configurada');
                return null;
            }

            const prompt = this.generateAIPrompt(title, content, 'featured');
            console.log('🎨 Gerando imagem destacada (Flux Schnell)...');
            console.log(`🎯 Prompt: ${prompt}`);

            const response = await axios.post('https://api.replicate.com/v1/predictions', {
                version: "black-forest-labs/flux-schnell",
                input: {
                    prompt: prompt,
                    go_fast: true,
                    num_outputs: 1,
                    aspect_ratio: "16:9",
                    output_format: "webp",
                    output_quality: 90
                }
            }, {
                headers: {
                    'Authorization': `Token ${this.replicateApiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.id) {
                const imageUrl = await this.waitForReplicateImage(response.data.id);
                
                if (imageUrl) {
                    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                    const processedBuffer = await sharp(imageResponse.data)
                        .resize(1200, 675, { fit: 'cover' })
                        .jpeg({ quality: 90 })
                        .toBuffer();

                    this.replicateDailyLimit++;
                    console.log(`✅ Imagem destacada gerada (${this.replicateDailyLimit}/${this.maxReplicateDaily})`);
                    
                    return {
                        buffer: processedBuffer,
                        filename: `flux-featured-${Date.now()}.jpg`,
                        alt: `Imagem bíblica: ${title}`,
                        credit: 'Gerada por IA - Flux'
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('❌ Erro Flux Featured:', error.message);
            return null;
        }
    }

    // 🆕 GERAR IMAGEM DE VERSÍCULO COM FLUX DEV (MELHOR PARA TEXTO)
    async generateVerseImage(title, content) {
        try {
            if (this.replicateDailyLimit >= this.maxReplicateDaily) {
                console.log(`⚠️ Limite diário Replicate atingido (${this.replicateDailyLimit}/${this.maxReplicateDaily})`);
                return null;
            }

            if (!this.replicateApiKey) {
                console.log('⚠️ Replicate API Key não configurada');
                return null;
            }

            const verse = this.extractBibleVerse(content);
            if (!verse) {
                console.log('⚠️ Nenhum versículo encontrado no conteúdo');
                return null;
            }

            const prompt = this.generateAIPrompt(title, content, 'verse');
            console.log('🎨 Gerando imagem de versículo (Flux Dev)...');
            console.log(`📖 Versículo: ${verse}`);
            console.log(`🎯 Prompt: ${prompt}`);

            const response = await axios.post('https://api.replicate.com/v1/predictions', {
                version: "black-forest-labs/flux-dev",
                input: {
                    prompt: prompt,
                    num_outputs: 1,
                    aspect_ratio: "16:9",
                    output_format: "webp",
                    output_quality: 85,
                    num_inference_steps: 28,
                    guidance_scale: 3.5
                }
            }, {
                headers: {
                    'Authorization': `Token ${this.replicateApiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.id) {
                const imageUrl = await this.waitForReplicateImage(response.data.id);
                
                if (imageUrl) {
                    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                    const processedBuffer = await sharp(imageResponse.data)
                        .resize(800, 450, { fit: 'cover' })
                        .jpeg({ quality: 85 })
                        .toBuffer();

                    this.replicateDailyLimit++;
                    console.log(`✅ Imagem de versículo gerada (${this.replicateDailyLimit}/${this.maxReplicateDaily})`);
                    
                    return {
                        buffer: processedBuffer,
                        filename: `flux-verse-${Date.now()}.jpg`,
                        alt: `Versículo bíblico: ${verse}`,
                        credit: 'Gerada por IA - Flux'
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('❌ Erro Flux Verse:', error.message);
            return null;
        }
    }

    // 🆕 AGUARDAR PROCESSAMENTO REPLICATE
    async waitForReplicateImage(predictionId) {
        const maxAttempts = 60; // Aumentei para 2 minutos
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                const response = await axios.get(`https://api.replicate.com/v1/predictions/${predictionId}`, {
                    headers: {
                        'Authorization': `Token ${this.replicateApiKey}`
                    }
                });

                if (response.data.status === 'succeeded' && response.data.output) {
                    return response.data.output[0];
                }

                if (response.data.status === 'failed') {
                    console.error('❌ Replicate falhou:', response.data.error);
                    break;
                }

                // Mostrar progresso
                if (attempts % 10 === 0) {
                    console.log(`⏳ Aguardando IA... (${attempts * 2}s)`);
                }

                await new Promise(resolve => setTimeout(resolve, 2000));
                attempts++;
            } catch (error) {
                console.error('❌ Erro ao aguardar Replicate:', error.message);
                break;
            }
        }
        return null;
    }

    // 🆕 MÉTODO PRINCIPAL - TENTAR IA PRIMEIRO, FALLBACK PARA PEXELS
    async getFeaturedImage(title, content) {
        console.log('🖼️ Buscando imagem destacada...');
        
        // 1. Tentar Flux Schnell primeiro
        const aiImage = await this.generateFeaturedImage(title, content);
        if (aiImage) {
            return aiImage;
        }
        
        // 2. Fallback para Pexels
        console.log('🔄 Fallback: Buscando no Pexels...');
        const keyword = this.extractKeywordFromContent(title, content);
        return await this.getPexelsImage(keyword);
    }

    // 🆕 MÉTODO PRINCIPAL - TENTAR IA PRIMEIRO, FALLBACK PARA PIXABAY
    async getContentImage(title, content) {
        console.log('🖼️ Buscando imagem de conteúdo...');
        
        // 1. Tentar Flux Dev primeiro
        const aiImage = await this.generateVerseImage(title, content);
        if (aiImage) {
            return aiImage;
        }
        
        // 2. Fallback para Pixabay
        console.log('🔄 Fallback: Buscando no Pixabay...');
        const keyword = this.extractKeywordFromContent(title, content);
        return await this.getPixabayImage(keyword);
    }

    // ✅ EXTRAIR KEYWORD DO CONTEÚDO
    extractKeywordFromContent(title, content) {
        const text = (title + ' ' + content).toLowerCase();
        
        for (const key of Object.keys(this.aiPromptMapping)) {
            if (text.includes(key)) {
                return key;
            }
        }
        
        return 'fé';
    }

    // ✅ FUNÇÕES ORIGINAIS MANTIDAS (PEXELS/PIXABAY)
    generateSearchQuery(keyword) {
        if (!keyword) return this.getRandomBiblicalKeyword();
        const keywordLower = keyword.toLowerCase();
        
        const keywordMapping = {
            'fé': ['cross', 'light', 'sunrise', 'mountain'],
            'faith': ['cross', 'light', 'sunrise', 'mountain'],
            'oração': ['candle', 'sunset', 'peaceful lake'],
            'prayer': ['candle', 'sunset', 'peaceful lake'],
            'jesus': ['cross', 'light beam', 'crown of thorns', 'olive tree'],
            'deus': ['sky', 'clouds', 'heavenly light', 'throne'],
            'god': ['sky', 'clouds', 'heavenly light', 'throne'],
            'amor': ['heart shape in nature', 'dove', 'sunset'],
            'love': ['heart shape in nature', 'dove', 'sunset'],
            'paz': ['dove', 'calm water', 'peaceful garden'],
            'peace': ['dove', 'calm water', 'peaceful garden'],
            'esperança': ['rainbow', 'sunrise', 'green field'],
            'hope': ['rainbow', 'sunrise', 'green field'],
            'palavra': ['bible', 'ancient book', 'scroll'],
            'word': ['bible', 'ancient book', 'scroll'],
            'verdade': ['light', 'bible', 'golden light'],
            'truth': ['light', 'bible', 'golden light'],
            'sabedoria': ['old book', 'ancient tree', 'owl'],
            'wisdom': ['old book', 'ancient tree', 'owl'],
            'caminho': ['path', 'road', 'stone path'],
            'path': ['path', 'road', 'stone path'],
            'way': ['path', 'road', 'stone path'],
            'vida': ['tree', 'flowing water', 'green valley'],
            'life': ['tree', 'flowing water', 'green valley'],
            'luz': ['sunbeam', 'golden light', 'lamp'],
            'light': ['sunbeam', 'golden light', 'lamp']
        };
        
        for (const [key, values] of Object.entries(keywordMapping)) {
            if (keywordLower.includes(key)) {
                const randomValue = values[Math.floor(Math.random() * values.length)];
                console.log(`🎯 Mapeamento encontrado: "${keyword}" → "${randomValue}"`);
                return randomValue;
            }
        }
        
        const biblicalTerm = this.getRandomBiblicalKeyword();
        console.log(`🔀 Combinando: "${keyword}" + "${biblicalTerm}"`);
        return `${keyword} ${biblicalTerm}`;
    }

    getRandomBiblicalKeyword() {
        return this.biblicalKeywords[Math.floor(Math.random() * this.biblicalKeywords.length)];
    }

    async getPexelsImage(keyword) {
        try {
            const searchQuery = this.generateSearchQuery(keyword);
            console.log(`🔍 Buscando imagem destacada no Pexels: "${searchQuery}"`);
            
            const response = await axios.get('https://api.pexels.com/v1/search', {
                headers: {
                    'Authorization': this.pexelsApiKey
                },
                params: {
                    query: searchQuery,
                    per_page: 15,
                    orientation: 'landscape',
                    size: 'large',
                    page: Math.floor(Math.random() * 5) + 1
                }
            });

            if (response.data.photos && response.data.photos.length > 0) {
                let availablePhotos = response.data.photos.filter(
                    photo => !this.usedImages.has(`pexels-${photo.id}`)
                );

                if (availablePhotos.length === 0) {
                    console.log('♻️ Resetando imagens usadas do Pexels...');
                    Array.from(this.usedImages).forEach(id => {
                        if (id.startsWith('pexels-')) {
                            this.usedImages.delete(id);
                        }
                    });
                    availablePhotos = response.data.photos;
                }

                const randomIndex = Math.floor(Math.random() * availablePhotos.length);
                const photo = availablePhotos[randomIndex];
                this.usedImages.add(`pexels-${photo.id}`);

                const imageResponse = await axios.get(photo.src.large, {
                    responseType: 'arraybuffer'
                });

                const processedBuffer = await sharp(imageResponse.data)
                    .resize(1200, 675, { fit: 'cover' })
                    .jpeg({ quality: 85 })
                    .toBuffer();

                console.log(`✅ Imagem destacada: ${photo.alt || searchQuery} (ID: ${photo.id})`);
                return {
                    buffer: processedBuffer,
                    filename: `pexels-featured-${photo.id}-${Date.now()}.jpg`,
                    alt: photo.alt || searchQuery,
                    credit: `Foto de ${photo.photographer} no Pexels`
                };
            }

            console.log('❌ Nenhuma imagem encontrada no Pexels');
            return null;
        } catch (error) {
            console.error('Erro ao buscar imagem no Pexels:', error.message);
            return null;
        }
    }

    async getPixabayImage(keyword) {
        try {
            const contentQueries = [
                this.generateSearchQuery(keyword),
                this.getRandomBiblicalKeyword(),
                `nature ${this.getRandomBiblicalKeyword()}`,
                `landscape ${this.getRandomBiblicalKeyword()}`
            ];

            console.log(`🔍 Buscando imagem de conteúdo no Pixabay...`);

            for (const query of contentQueries) {
                console.log(`🎯 Tentando: "${query}"`);
                
                const response = await axios.get('https://pixabay.com/api/', {
                    params: {
                        key: this.pixabayApiKey,
                        q: query,
                        image_type: 'photo',
                        orientation: 'horizontal',
                        category: 'nature,places,religion',
                        safesearch: 'true',
                        per_page: 20,
                        min_width: 800,
                        min_height: 600,
                        page: Math.floor(Math.random() * 3) + 1
                    }
                });

                if (response.data.hits && response.data.hits.length > 0) {
                    let availableImages = response.data.hits.filter(
                        img => !this.usedImages.has(`pixabay-${img.id}`)
                    );

                    if (availableImages.length === 0) {
                        console.log('♻️ Resetando imagens usadas do Pixabay...');
                        Array.from(this.usedImages).forEach(id => {
                            if (id.startsWith('pixabay-')) {
                                this.usedImages.delete(id);
                            }
                        });
                        availableImages = response.data.hits;
                    }

                    if (availableImages.length > 0) {
                        const randomIndex = Math.floor(Math.random() * availableImages.length);
                        const image = availableImages[randomIndex];
                        this.usedImages.add(`pixabay-${image.id}`);

                        const imageResponse = await axios.get(image.webformatURL, {
                            responseType: 'arraybuffer'
                        });

                        const processedBuffer = await sharp(imageResponse.data)
                            .resize(800, 600, { fit: 'cover' })
                            .jpeg({ quality: 80 })
                            .toBuffer();

                        console.log(`✅ Imagem de conteúdo: ${image.tags} (ID: ${image.id})`);
                        return {
                            buffer: processedBuffer,
                            filename: `pixabay-content-${image.id}-${Date.now()}.jpg`,
                            alt: image.tags,
                            credit: 'Imagem do Pixabay'
                        };
                    }
                }
            }

            console.log('❌ Nenhuma imagem encontrada no Pixabay');
            return null;
        } catch (error) {
            console.error('Erro ao buscar imagem no Pixabay:', error.message);
            return null;
        }
    }

    // ✅ MÉTODO PARA DEBUG
    getUsedImagesCount() {
        const pexelsCount = Array.from(this.usedImages).filter(id => id.startsWith('pexels-')).length;
        const pixabayCount = Array.from(this.usedImages).filter(id => id.startsWith('pixabay-')).length;
        console.log(`📊 Imagens usadas - Pexels: ${pexelsCount}, Pixabay: ${pixabayCount}`);
        console.log(`🤖 IA - Replicate: ${this.replicateDailyLimit}/${this.maxReplicateDaily}`);
        return { 
            pexels: pexelsCount, 
            pixabay: pixabayCount,
            replicate: this.replicateDailyLimit
        };
    }
}

module.exports = ImageHandler;
