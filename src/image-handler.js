const axios = require('axios');

class ImageHandler {
  async getUnsplashImage(keyword) {
    if (!process.env.UNSPLASH_ACCESS_KEY) {
      console.log('Chave do Unsplash não configurada');
      return null;
    }

    try {
      console.log(`🔍 Buscando imagem destacada no Unsplash: "${keyword}"`);
      
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: {
          query: keyword || 'article blog post',
          per_page: 1,
          orientation: 'landscape',
          order_by: 'relevant'
        },
        headers: {
          Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
        }
      });

      if (response.data.results.length === 0) {
        console.log('❌ Nenhuma imagem encontrada no Unsplash');
        return null;
      }

      const image = response.data.results[0];
      console.log(`✅ Imagem encontrada: ${image.alt_description || 'Sem descrição'}`);
      
      const imageResponse = await axios.get(image.urls.regular, {
        responseType: 'arraybuffer'
      });

      return {
        buffer: Buffer.from(imageResponse.data),
        filename: `featured-${keyword?.replace(/\s+/g, '-') || 'image'}-${Date.now()}.jpg`,
        alt: image.alt_description || `Imagem sobre ${keyword}`,
        credit: `Foto de ${image.user.name} no Unsplash`
      };
    } catch (error) {
      console.error('Erro ao buscar imagem no Unsplash:', error);
      return null;
    }
  }

  async getPixabayImage(keyword) {
    if (!process.env.PIXABAY_API_KEY) {
      console.log('Chave do Pixabay não configurada');
      return null;
    }

    try {
      console.log(`🔍 Buscando imagem de conteúdo no Pixabay: "${keyword}"`);
      
      const response = await axios.get('https://pixabay.com/api/', {
        params: {
          key: process.env.PIXABAY_API_KEY,
          q: keyword || 'business article',
          image_type: 'photo',
          orientation: 'horizontal',
          category: 'business',
          min_width: 1200,
          min_height: 800,
          per_page: 3,
          safesearch: 'true'
        }
      });

      if (response.data.hits.length === 0) {
        console.log('❌ Nenhuma imagem encontrada no Pixabay');
        return null;
      }

      const image = response.data.hits[0];
      console.log(`✅ Imagem encontrada: ${image.tags}`);
      
      const imageResponse = await axios.get(image.webformatURL, {
        responseType: 'arraybuffer'
      });

      return {
        buffer: Buffer.from(imageResponse.data),
        filename: `content-${keyword?.replace(/\s+/g, '-') || 'image'}-${Date.now()}.jpg`,
        alt: `Imagem relacionada a ${keyword}`,
        credit: `Imagem do Pixabay por ${image.user}`
      };
    } catch (error) {
      console.error('Erro ao buscar imagem no Pixabay:', error);
      return null;
    }
  }

  // Função para converter markdown para HTML (WordPress usa HTML)
  convertMarkdownImageToHtml(content, imageUrl, imageAlt, imageCredit) {
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    
    if (paragraphs.length < 3) {
      const imageHtml = `\n\n<figure class="wp-block-image size-large">
        <img src="${imageUrl}" alt="${imageAlt}" />
        <figcaption><em>${imageCredit}</em></figcaption>
      </figure>`;
      return content + imageHtml;
    }

    const beforeImage = paragraphs.slice(0, 3).join('\n\n');
    const afterImage = paragraphs.slice(3).join('\n\n');
    
    const imageHtml = `\n\n<figure class="wp-block-image size-large">
      <img src="${imageUrl}" alt="${imageAlt}" />
      <figcaption><em>${imageCredit}</em></figcaption>
    </figure>\n\n`;
    
    return beforeImage + imageHtml + afterImage;
  }
}

module.exports = ImageHandler;
