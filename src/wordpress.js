const axios = require('axios');
const FormData = require('form-data');

class WordPressService {
  constructor() {
    this.baseURL = process.env.WORDPRESS_URL;
    this.auth = {
      username: process.env.WORDPRESS_USERNAME,
      password: process.env.WORDPRESS_APP_PASSWORD
    };
  }

  async createPost(postData) {
    try {
      const response = await axios.post(
        `${this.baseURL}/wp-json/wp/v2/posts`,
        {
          title: postData.title,
          content: postData.content,
          excerpt: postData.excerpt,
          status: 'publish',
          categories: await this.getCategoryId(postData.category),
          tags: await this.getTagIds(postData.tags),
          featured_media: postData.featuredImageId || null
        },
        {
          auth: this.auth,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Post publicado com sucesso:', response.data.link);
      return response.data;
    } catch (error) {
      console.error('Erro ao publicar post:', error.response?.data || error.message);
      throw error;
    }
  }

  async uploadImage(imageBuffer, filename, altText = '') {
    try {
      const formData = new FormData();
      formData.append('file', imageBuffer, filename);
      formData.append('alt_text', altText);

      const response = await axios.post(
        `${this.baseURL}/wp-json/wp/v2/media`,
        formData,
        {
          auth: this.auth,
          headers: {
            ...formData.getHeaders()
          }
        }
      );

      console.log(`✅ Imagem "${filename}" enviada com sucesso`);
      return response.data.id;
    } catch (error) {
      console.error('Erro ao enviar imagem:', error.response?.data || error.message);
      throw error;
    }
  }

  async getImageUrl(imageId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/wp-json/wp/v2/media/${imageId}`,
        { auth: this.auth }
      );

      return response.data.source_url;
    } catch (error) {
      console.error('Erro ao buscar URL da imagem:', error);
      return null;
    }
  }

  async getCategoryId(categoryName) {
    try {
      const response = await axios.get(
        `${this.baseURL}/wp-json/wp/v2/categories?search=${categoryName}`,
        { auth: this.auth }
      );

      if (response.data.length > 0) {
        return [response.data[0].id];
      }

      // Criar categoria se não existir
      const newCategory = await axios.post(
        `${this.baseURL}/wp-json/wp/v2/categories`,
        { name: categoryName },
        { auth: this.auth }
      );

      return [newCategory.data.id];
    } catch (error) {
      console.error('Erro ao gerenciar categoria:', error);
      return [];
    }
  }

  async getTagIds(tagNames) {
    const tagIds = [];
    
    for (const tagName of tagNames) {
      try {
        const response = await axios.get(
          `${this.baseURL}/wp-json/wp/v2/tags?search=${tagName}`,
          { auth: this.auth }
        );

        if (response.data.length > 0) {
          tagIds.push(response.data[0].id);
        } else {
          // Criar tag se não existir
          const newTag = await axios.post(
            `${this.baseURL}/wp-json/wp/v2/tags`,
            { name: tagName },
            { auth: this.auth }
          );
          tagIds.push(newTag.data.id);
        }
      } catch (error) {
        console.error(`Erro ao gerenciar tag ${tagName}:`, error);
      }
    }

    return tagIds;
  }
}

module.exports = WordPressService;
