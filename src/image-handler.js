const axios = require('axios');
const sharp = require('sharp');

class ImageHandler {
    constructor() {
        this.pexelsApiKey = process.env.PEXELS_API_KEY;
        this.pixabayApiKey = process.env.PIXABAY_API_KEY;
        this.usedImages = new Set(); // Evitar duplicatas
        
        // ✅ TERMOS BÍBLICOS + NATUREZA (SEM PESSOAS)
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
        
        // ✅ MAPEAMENTO INTELIGENTE DE KEYWORDS
        this.keywordMapping = {
            // Palavras relacionadas a fé/oração
            'fé': ['cross', 'light', 'sunrise', 'mountain'],
            'faith': ['cross', 'light', 'sunrise', 'mountain'],
            'oração': ['candle', 'sunset', 'peaceful lake'],
            'prayer': ['candle', 'sunset', 'peaceful lake'],
            'jesus': ['cross', 'light beam', 'crown of thorns', 'olive tree'],
            'deus': ['sky', 'clouds', 'heavenly light', 'throne'],
            'god': ['sky', 'clouds', 'heavenly light', 'throne'],
            
            // Palavras relacionadas a natureza bíblica
            'amor': ['heart shape in nature', 'dove', 'sunset'],
            'love': ['heart shape in nature', 'dove', 'sunset'],
            'paz': ['dove', 'calm water', 'peaceful garden'],
            'peace': ['dove', 'calm water', 'peaceful garden'],
            'esperança': ['rainbow', 'sunrise', 'green field'],
            'hope': ['rainbow', 'sunrise', 'green field'],
            
            // Objetos bíblicos
            'palavra': ['bible', 'ancient book', 'scroll'],
            'word': ['bible', 'ancient book', 'scroll'],
            'verdade': ['light', 'bible', 'golden light'],
            'truth': ['light', 'bible', 'golden light'],
            'sabedoria': ['old book', 'ancient tree', 'owl'],
            'wisdom': ['old book', 'ancient tree', 'owl'],
            
            // Natureza bíblica
            'caminho': ['path', 'road', 'stone path'],
            'path': ['path', 'road', 'stone path'],
            'way': ['path', 'road', 'stone path'],
            'vida': ['tree', 'flowing water', 'green valley'],
            'life': ['tree', 'flowing water', 'green valley'],
            'luz': ['sunbeam', 'golden light', 'lamp'],
            'light': ['sunbeam', 'golden light', 'lamp']
        };
    }

    // ✅ FUNÇÃO PARA GERAR QUERY INTELIGENTE
    generateSearchQuery(keyword) {
        if (!keyword) return this.getRandomBiblicalKeyword();
        
        const keywordLower = keyword.toLowerCase();
        
        // Buscar mapeamento direto
        for (const [key, values] of Object.entries(this.keywordMapping)) {
            if (keywordLower.includes(key)) {
                const randomValue = values[Math.floor(Math.random() * values.length)];
                console.log(`🎯 Mapeamento encontrado: "${keyword}" → "${randomValue}"`);
                return randomValue;
            }
        }
        
        // Se não encontrar mapeamento, combinar com termo bíblico
        const biblicalTerm = this.getRandomBiblicalKeyword();
        console.log(`🔀 Combinando: "${keyword}" + "${biblicalTerm}"`);
        return `${keyword} ${biblicalTerm}`;
    }
    
    // ✅ TERMO BÍBLICO ALEATÓRIO
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
                    query: searchQuery,  // ✅ QUERY INTELIGENTE
                    per_page: 15,        // ✅ MAIS VARIEDADE
                    orientation: 'landscape',
                    size: 'large',
                    page: Math.floor(Math.random() * 5) + 1 // ✅ PÁGINAS ALEATÓRIAS
                }
            });

            if (response.data.photos && response.data.photos.length > 0) {
                // ✅ FILTRAR IMAGENS NÃO USADAS
                let availablePhotos = response.data.photos.filter(
                    photo => !this.usedImages.has(`pexels-${photo.id}`)
                );
                
                // Se todas foram usadas, resetar e usar todas
                if (availablePhotos.length === 0) {
                    console.log('♻️ Resetando imagens usadas do Pexels...');
                    // Limpar apenas as do Pexels
                    Array.from(this.usedImages).forEach(id => {
                        if (id.startsWith('pexels-')) {
                            this.usedImages.delete(id);
                        }
                    });
                    availablePhotos = response.data.photos;
                }
                
                const randomIndex = Math.floor(Math.random() * availablePhotos.length);
                const photo = availablePhotos[randomIndex];
                
                // ✅ MARCAR COMO USADA
                this.usedImages.add(`pexels-${photo.id}`);
                
                // Download da imagem
                const imageResponse = await axios.get(photo.src.large, {
                    responseType: 'arraybuffer'
                });

                // Processar com Sharp
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
            // ✅ GERAR QUERIES DIFERENTES PARA CONTEÚDO
            const contentQueries = [
                this.generateSearchQuery(keyword),
                this.getRandomBiblicalKeyword(),
                `nature ${this.getRandomBiblicalKeyword()}`,
                `landscape ${this.getRandomBiblicalKeyword()}`
            ];
            
            console.log(`🔍 Buscando imagem de conteúdo no Pixabay...`);
            
            // ✅ TENTAR DIFERENTES QUERIES
            for (const query of contentQueries) {
                console.log(`🎯 Tentando: "${query}"`);
                
                const response = await axios.get('https://pixabay.com/api/', {
                    params: {
                        key: this.pixabayApiKey,
                        q: query,
                        image_type: 'photo',
                        orientation: 'horizontal',
                        category: 'nature,places,religion', // ✅ CATEGORIAS RELEVANTES
                        safesearch: 'true',
                        per_page: 20,
                        min_width: 800,
                        min_height: 600,
                        page: Math.floor(Math.random() * 3) + 1
                    }
                });

                if (response.data.hits && response.data.hits.length > 0) {
                    // ✅ FILTRAR IMAGENS NÃO USADAS
                    let availableImages = response.data.hits.filter(
                        img => !this.usedImages.has(`pixabay-${img.id}`)
                    );
                    
                    if (availableImages.length === 0) {
                        console.log('♻️ Resetando imagens usadas do Pixabay...');
                        // Limpar apenas as do Pixabay
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
                        
                        // ✅ MARCAR COMO USADA
                        this.usedImages.add(`pixabay-${image.id}`);
                        
                        // Download da imagem
                        const imageResponse = await axios.get(image.webformatURL, {
                            responseType: 'arraybuffer'
                        });

                        // Processar com Sharp
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

    // ✅ MÉTODO PARA DEBUG - VER IMAGENS USADAS
    getUsedImagesCount() {
        const pexelsCount = Array.from(this.usedImages).filter(id => id.startsWith('pexels-')).length;
        const pixabayCount = Array.from(this.usedImages).filter(id => id.startsWith('pixabay-')).length;
        console.log(`📊 Imagens usadas - Pexels: ${pexelsCount}, Pixabay: ${pixabayCount}`);
        return { pexels: pexelsCount, pixabay: pixabayCount };
    }
}

module.exports = ImageHandler;
