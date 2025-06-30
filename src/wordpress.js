const axios = require('axios');
class WordPressHandler {
    constructor(url, username, password) {
        this.baseUrl = url;
        this.auth = Buffer.from(`${username}:${password}`).toString('base64');
    }
   
  formatContent(content) {
    if (!content) return '';
    
    let formatted = content
        // NOVO: Converter tabelas markdown para HTML
        .replace(/\|(.+)\|\n\|[\s\-\|:]+\|\n((?:\|.+\|\n?)*)/g, (match, header, rows) => {
            // Processar cabeçalho
            const headerCells = header.split('|')
                .map(cell => cell.trim())
                .filter(cell => cell !== '')
                .map(cell => `<th>${cell}</th>`)
                .join('');
            
            // Processar linhas de dados
            const dataRows = rows.trim().split('\n')
                .map(row => {
                    const cells = row.split('|')
                        .map(cell => cell.trim())
                        .filter(cell => cell !== '')
                        .map(cell => `<td>${cell}</td>`)
                        .join('');
                    return `<tr>${cells}</tr>`;
                })
                .join('');
            
            return `<table class="wp-block-table"><thead><tr>${headerCells}</tr></thead><tbody>${dataRows}</tbody></table>`;
        })
        
        // Converter títulos com emojis para H2
        .replace(/^\*\*(.*?)\*\*$/gm, '<h2>$1</h2>')
        
        // Converter subtítulos começando com emoji para H3
        .replace(/^([🔹💡⚠️📌]\s*\*\*.*?\*\*)/gm, '<h3>$1</h3>')
        
        // Converter listas com emojis numerados para HTML
        .replace(/^(\d️⃣\s*\*\*.*?\*\*.*?)$/gm, '<li><strong>$1</strong></li>')
        
        // Converter listas com bullets emoji para HTML
        .replace(/^[-•]\s*(.*?)$/gm, '<li>$1</li>')
        
        // Agrupar listas consecutivas
        .replace(/(<li>.*?<\/li>\s*?\n)+/gs, '<ul>$&</ul>')
        
        // Melhorar formatação de negrito
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        
        // Melhorar formatação de itálico
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        
        // Converter quebras duplas em parágrafos
        .replace(/\n\n/g, '</p><p>')
        
        // Adicionar parágrafos no início e fim
        .replace(/^/, '<p>')
        .replace(/$/, '</p>')
        
        // Limpar parágrafos vazios
        .replace(/<p>\s*<\/p>/g, '')
        
        // Limpar parágrafos que contêm apenas tabelas
        .replace(/<p>(<table.*?<\/table>)<\/p>/g, '$1')
        
        // Melhorar espaçamento de citações bíblicas
        .replace(/\*"(.*?)"\*\s*\((.*?)\)/g, '<blockquote><em>"$1"</em><br><strong>($2)</strong></blockquote>')
        
        // Melhorar formatação de links
        .replace(/🔗\s*(.*?):\s*(https?:\/\/[^\s]+)/g, '<p><strong>🔗 $1:</strong><br><a href="$2" target="_blank">$2</a></p>');
    
    return formatted;
}


    async publishPost(title, content, featuredImageId = null, contentImageId = null, category = 'Uncategorized') {
        try {
            // Primeiro formatar o conteúdo
            let formattedContent = this.formatContent(content);
            
            // Depois inserir imagem no terceiro parágrafo se existe
            if (contentImageId) {
                console.log('🖼️ Inserindo imagem no conteúdo...');
                const imageUrl = await this.getImageUrl(contentImageId);
                
                if (imageUrl) {
                    // Dividir por parágrafos formatados
                    const paragraphs = formattedContent.split('</p>');
                    
                    // Verificar se temos pelo menos 3 parágrafos
                    if (paragraphs.length >= 3) {
                        const imageHtml = `<figure class="wp-block-image aligncenter size-large">
<img src="${imageUrl}" alt="Imagem ilustrativa do artigo" class="wp-image-${contentImageId}"/>
</figure>`;
                        
                        // Inserir após o segundo parágrafo (posição 2)
                        paragraphs.splice(2, 0, imageHtml);
                        formattedContent = paragraphs.join('</p>');
                        console.log('✅ Imagem inserida no conteúdo');
                    } else {
                        // Se não há parágrafos suficientes, inserir no meio
                        const imageHtml = `<figure class="wp-block-image aligncenter size-large">
<img src="${imageUrl}" alt="Imagem ilustrativa do artigo" class="wp-image-${contentImageId}"/>
</figure>`;
                        
                        const halfPoint = Math.floor(formattedContent.length / 2);
                        formattedContent = formattedContent.substring(0, halfPoint) + imageHtml + formattedContent.substring(halfPoint);
                        console.log('✅ Imagem inserida no meio do conteúdo');
                    }
                }
            }
            
            const postData = {
                title: title,
                content: formattedContent,
                status: 'publish',
                categories: await this.getCategoryId(category),
                featured_media: featuredImageId || 0
            };
            
            const response = await axios.post(
                `${this.baseUrl}/wp-json/wp/v2/posts`,
                postData,
                {
                    headers: {
                        'Authorization': `Basic ${this.auth}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            return response.data.link;
        } catch (error) {
            console.error('Erro ao publicar post:', error.response?.data || error.message);
            throw error;
        }
    }
    async getCategoryId(categoryName) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/wp-json/wp/v2/categories?search=${encodeURIComponent(categoryName)}`,
                {
                    headers: {
                        'Authorization': `Basic ${this.auth}`
                    }
                }
            );
            if (response.data.length > 0) {
                return [response.data[0].id];
            }
            // Se categoria não existe, criar nova
            const newCategory = await axios.post(
                `${this.baseUrl}/wp-json/wp/v2/categories`,
                { name: categoryName },
                {
                    headers: {
                        'Authorization': `Basic ${this.auth}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return [newCategory.data.id];
        } catch (error) {
            console.error('Erro ao buscar/criar categoria:', error.message);
            return [1]; // Categoria padrão
        }
    }
    async uploadImage(imageBuffer, filename) {
        try {
            const FormData = require('form-data');
            const form = new FormData();
            form.append('file', imageBuffer, filename);
            const response = await axios.post(
                `${this.baseUrl}/wp-json/wp/v2/media`,
                form,
                {
                    headers: {
                        ...form.getHeaders(),
                        'Authorization': `Basic ${this.auth}`
                    }
                }
            );
            return response.data.id;
        } catch (error) {
            console.error('Erro ao fazer upload da imagem:', error.response?.data || error.message);
            throw error;
        }
    }
    async getImageUrl(imageId) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/wp-json/wp/v2/media/${imageId}`,
                {
                    headers: {
                        'Authorization': `Basic ${this.auth}`
                    }
                }
            );
            return response.data.source_url;
        } catch (error) {
            console.error('Erro ao buscar URL da imagem:', error.message);
            return '';
        }
    }
}
module.exports = WordPressHandler;
