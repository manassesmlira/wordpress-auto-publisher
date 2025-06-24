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
      const featuredImage = await imageHandler.getUnsplashImage(post.featuredImageKeyword);
      
      if (featuredImage) {
        featuredImageId = await wordpressService.uploadImage(
          featuredImage.buffer, 
          featuredImage.filename,
          featuredImage.alt
        );
        console.log('✅ Imagem destacada enviada');
      }
    }

    // 2. Buscar e processar imagem de conteúdo (Pixabay)
    let processedContent = post.content;
    if (post.contentImageKeyword) {
      console.log('🖼️ Processando imagem de conteúdo...');
      const contentImage = await imageHandler.getPixabayImage(post.contentImageKeyword);
      
      if (contentImage) {
        // Upload da imagem para WordPress
        const contentImageId = await wordpressService.uploadImage(
          contentImage.buffer,
          contentImage.filename,
          contentImage.alt
        );
        
        // Buscar URL da imagem no WordPress
        const imageUrl = await wordpressService.getImageUrl(contentImageId);
        
        // Inserir imagem no conteúdo
        processedContent = imageHandler.convertMarkdownImageToHtml(
          processedContent,
          imageUrl,
          contentImage.alt,
          contentImage.credit
        );
        
        console.log('✅ Imagem de conteúdo inserida no terceiro parágrafo');
      }
    }

    // 3. Publicar no WordPress
    console.log('📤 Publicando no WordPress...');
    const publishedPost = await wordpressService.createPost({
      ...post,
      content: processedContent,
      featuredImageId
    });

    // 4. Marcar como publicado no Notion
    await notionService.markAsPublished(post.id);

    console.log('🎉 Post publicado com sucesso!');
    console.log(`🔗 Link: ${publishedPost.link}`);
    console.log(`📊 Estatísticas:`);
    console.log(`   - Imagem destacada: ${featuredImageId ? '✅' : '❌'}`);
    console.log(`   - Imagem no conteúdo: ${processedContent !== post.content ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Erro durante a publicação:', error);
    process.exit(1);
  }
}

main();
