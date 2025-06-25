const axios = require('axios');
const sharp = require('sharp');

class ImageHandler {
    constructor() {
        this.pexelsApiKey = process.env.PEXELS_API_KEY;
        this.pixabayApiKey = process.env.PIXABAY_API_KEY;
    }

    async getPexelsImage(keyword) {
        try {
            console.log(`🔍 Buscando imagem destacada no Pexels: "${keyword}"`);
            
            const response = await axios.get('https://api.pexels.com/v1/search', {
                headers: {
                    'Authorization': this.pexelsApiKey
                },
                params: {
                    query: keyword,
                    per_page: 1,
                    orientation: 'landscape',
                    size: 'large'
                }
            });

            if (response.data.photos && response.data.photos.length > 0) {
                const photo = response.data.photos[0];
                
                // Download da imagem
                const imageResponse = await axios.get(photo.src.large, {
                    responseType: 'arraybuffer'
                });

                // Processar com Sharp
                const processedBuffer = await sharp(imageResponse.data)
                    .resize(1200, 675, { fit: 'cover' })
                    .jpeg({ quality: 85 })
                    .toBuffer();

                console.log(`✅ Imagem encontrada: ${photo.alt || 'Sem descrição'}`);

                return {
                    buffer: processedBuffer,
                    filename: `pexels-${photo.id}-${Date.now()}.jpg`,
                    alt: photo.alt || keyword,
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
            console.log(`🔍 Buscando imagem de conteúdo no Pixabay: "${keyword}"`);
            
            const response = await axios.get('https://pixabay.com/api/', {
                params: {
                    key: this.pixabayApiKey,
                    q: keyword,
                    image_type: 'photo',
                    orientation: 'horizontal',
                    category: 'people',
                    safesearch: 'true',
                    per_page: 3,
                    min_width: 800,
                    min_height: 600
                }
            });

            if (response.data.hits && response.data.hits.length > 0) {
                const image = response.data.hits[0];
                
                // Download da imagem
                const imageResponse = await axios.get(image.webformatURL, {
                    responseType: 'arraybuffer'
                });

                // Processar com Sharp
                const processedBuffer = await sharp(imageResponse.data)
                    .resize(800, 600, { fit: 'cover' })
                    .jpeg({ quality: 80 })
                    .toBuffer();

                console.log(`✅ Imagem encontrada: ${image.tags}`);

                return {
                    buffer: processedBuffer,
                    filename: `pixabay-${image.id}-${Date.now()}.jpg`,
                    alt: image.tags,
                    credit: 'Imagem do Pixabay'
                };
            }

            console.log('❌ Nenhuma imagem encontrada no Pixabay');
            return null;
        } catch (error) {
            console.error('Erro ao buscar imagem no Pixabay:', error.message);
            return null;
        }
    }
}

module.exports = ImageHandler;
