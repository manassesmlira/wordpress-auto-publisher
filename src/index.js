const NotionService = require('./notion');
const WordPressService = require('./wordpress');
const ImageHandler = require('./image-handler');
require('dotenv').config();

async function main() {
  try {
    console.log('🚀 Iniciando publicação automática...');
    
    const notionService = new NotionService();
    const wordpressService = new WordPressService(
      process.env.WORDPRESS_URL,
      process.env.WORDPRESS_USERNAME,
      process.env.WORDPRESS_APP_PASSWORD
    );
    const imageHandler = new ImageHandler();
    
    // Buscar próximo post para publicar
    const post = await notionService.getNextPostToPublish();
    if (!post) {
      console.log('✅ Nenhum post para publicar hoje');
      return;
    }
    
    console.log(`📝 Post encontrado: ${post.title}`);
    
    // 1. Buscar e processar imagem destacada (Unsplash)
    let featuredImageId = null;
    if (post.featuredImageKeyword) {
      console.log('🖼️ Processando imagem destacada...');
      try {
        const featuredImage = await imageHandler.getUnsplashImage(post.featuredImageKeyword);
        if (featuredImage) {
          featuredImageId = await wordpressService.uploadImage(
            featuredImage.buffer,
            featuredImage.filename
          );
          console.log('✅ Imagem destacada enviada');
        }
      } catch (error) {
        console.log('⚠️ Erro ao processar imagem destacada, continuando sem ela');
      }
    }
    
    // 2. Buscar e processar imagem de conteúdo (Pixabay)
    let contentImageId = null;
    if (post.contentImageKeyword) {
      console.log('🖼️ Processando imagem de conteúdo...');
      try {
        // Melhorar palavras-chave para ter mais sucesso
        const keywords = [
          post.contentImageKeyword,
          'igreja',
          'jovem cristão',
          'namoro cristão',
          'casal jovem',
          'relacionamento'
        ];
        
        let contentImage = null;
        for (const keyword of keywords) {
          console.log(`🔍 Tentando buscar com: "${keyword}"`);
          contentImage = await imageHandler.getPixabayImage(keyword);
          if (contentImage) break;
        }
        
        if (contentImage) {
          contentImageId = await wordpressService.uploadImage(
            contentImage.buffer,
            contentImage.filename
          );
          console.log('✅ Imagem de conteúdo enviada');
        }
      } catch (error) {
        console.log('⚠️ Erro ao processar imagem de conteúdo, continuando sem ela');
      }
    }
    
    // 3. Publicar no WordPress
    console.log('📤 Publicando no WordPress...');
    const postUrl = await wordpressService.publishPost(
      post.title, 
      post.content, 
      featuredImageId, 
      contentImageId, 
      post.category || 'Namoro Cristão'
    );
    
    // 4. Marcar como publicado no Notion
    await notionService.markAsPublished(post.id);
    
    console.log('🎉 Post publicado com sucesso!');
    console.log(`🔗 Link: ${postUrl}`);
    console.log(`📊 Estatísticas:`);
    console.log(` - Imagem destacada: ${featuredImageId ? '✅' : '❌'}`);
    console.log(` - Imagem no conteúdo: ${contentImageId ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Erro durante a publicação:', error);
    process.exit(1);
  }
}

main();
