const NotionService = require('./notion');
const WordPressService = require('./wordpress');
const ImageHandler = require('./image-handler');
require('dotenv').config();

async function main() {
  try {
    console.log('🚀 Iniciando publicação automática...');

    const notionService = new NotionService();
    const wordpressService = new WordPressService();
    const imageHandler = new ImageHandler();

    
    const post = await notionService.getNextPostToPublish();
    
    if (!post) {
      console.log('✅ Nenhum post para publicar hoje');
      return;
    }

    console.log(`📝 Post encontrado: ${post.title}`);

    
    let featuredImageId = null;
    if (post.featuredImageKeyword) {
      console.log('🖼️ Buscando imagem destacada...');
      const image = await imageHandler.getUnsplashImage(post.featuredImageKeyword);
      
      if (image) {
        featuredImageId = await wordpressService.uploadImage(image.buffer, image.filename);
        console.log('✅ Imagem destacada enviada');
      }
    }

    
    console.log('📤 Publicando no WordPress...');
    const publishedPost = await wordpressService.createPost({
      ...post,
      featuredImageId
    });

    
    await notionService.markAsPublished(post.id);

    console.log('🎉 Post publicado com sucesso!');
    console.log(`🔗 Link: ${publishedPost.link}`);

  } catch (error) {
    console.error('❌ Erro durante a publicação:', error);
    process.exit(1);
  }
}

main();
