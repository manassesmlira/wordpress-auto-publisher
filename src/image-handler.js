const axios = require('axios');

class ImageHandler {
  async getUnsplashImage(keyword) {
    if (!process.env.UNSPLASH_ACCESS_KEY) {
      console.log('Chave do Unsplash não configurada');
      return null;
    }

    try {
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: {
          query: keyword || 'article blog post',
          per_page: 1,
          orientation: 'landscape'
        },
        headers: {
          Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
        }
      });

      if (response.data.results.length === 0) {
        console.log('Nenhuma imagem encontrada no Unsplash');
        return null;
      }

      const image = response.data.results[0];
      const imageResponse = await axios.get(image.urls.regular, {
        responseType: 'arraybuffer'
      });

      return {
        buffer: Buffer.from(imageResponse.data),
        filename: `${keyword || 'featured'}-${Date.now()}.jpg`
      };
    } catch (error) {
      console.error('Erro ao buscar imagem no Unsplash:', error);
      return null;
    }
  }

  
  async getPixabayImage(keyword) {
  
  }

  
  getPlaceholderImage(title) {
    
    return `https://via.placeholder.com/1200x630/2196F3/FFFFFF?text=${encodeURIComponent(title)}`;
  }
}

module.exports = ImageHandler;
