const axios = require('axios');

class WordPressHandler {
    constructor(url, username, password) {
        this.baseUrl = url;
        this.auth = Buffer.from(`${username}:${password}`).toString('base64');
        this.postsCache = []; // Cache dos posts para links internos
        this.lastCacheUpdate = null;
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 horas em ms
    }

    // ========== FUNÇÕES ORIGINAIS (MANTIDAS) ==========
    
    formatContent(content) {
        console.log('📝 Formatando conteúdo...');
        
        const formatted = content
            // Converter títulos markdown para HTML
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            
            // Converter formatação em negrito e itálico ANTES de processar links
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            
            // Converter listas
            .replace(/^\* (.*$)/gm, '<li>$1</li>')
            .replace(/^- (.*$)/gm, '<li>$1</li>')
            .replace(/^(\d+)\. (.*$)/gm, '<li>$1. $2</li>')
            
            // Agrupar itens de lista em tags <ul>
            .replace(/(<li>.*<\/li>)/s, function(match) {
                if (match.includes('<li>')) {
                    return '<ul>' + match + '</ul>';
                }
                return match;
            })
            
            // Converter quebras de linha em parágrafos, mas preservar HTML existente
            .split('\n\n')
            .map(paragraph => {
                paragraph = paragraph.trim();
                if (!paragraph) return '';
                
                // Se já é HTML (contém tags), não envolver em <p>
                if (paragraph.includes('<h') || paragraph.includes('<ul') || 
                    paragraph.includes('<ol') || paragraph.includes('<li') ||
                    paragraph.includes('<blockquote') || paragraph.includes('<div') ||
                    paragraph.includes('<table') || paragraph.includes('<figure')) {
                    return paragraph;
                }
                
                // Caso contrário, envolver em <p>
                return `<p>${paragraph}</p>`;
            })
            .join('\n\n')
            
            // Limpar múltiplas quebras de linha
            .replace(/\n{3,}/g, '\n\n')
            
            // Converter citações bíblicas em blockquotes
            .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
            
            // Melhorar formatação de versículos
            .replace(/\*"(.*?)"\*\s*\((.*?)\)/g, '<blockquote><em>"$1"</em><br><strong>($2)</strong></blockquote>')
            
            // Converter links markdown para HTML
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            
            // Melhorar formatação de links com emojis
            .replace(/🔗\s*(.*?):\s*(https?:\/\/[^\s]+)/g, '<p><strong>🔗 $1:</strong><br><a href="$2" target="_blank" rel="noopener">$2</a></p>')
            
            // Converter links simples em HTML
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
            
            // Limpar parágrafos vazios
            .replace(/<p>\s*<\/p>/g, '')
            
            // Garantir que títulos não estejam dentro de parágrafos
            .replace(/<p>(<h[1-6].*?<\/h[1-6]>)<\/p>/g, '$1')
            
            // Garantir que listas não estejam dentro de parágrafos
            .replace(/<p>(<ul>.*?<\/ul>)<\/p>/gs, '$1')
            
            // Garantir que blockquotes não estejam dentro de parágrafos
            .replace(/<p>(<blockquote>.*?<\/blockquote>)<\/p>/gs, '$1')
            
            // Limpar espaços em excesso
            .replace(/\s+/g, ' ')
            .trim();

        console.log('✅ Conteúdo formatado com sucesso');
        return formatted;
    }

    // ========== NOVAS FUNÇÕES (ADICIONADAS) ==========

    // Cache dos posts existentes para links internos
    async updatePostsCache() {
        try {
            const now = Date.now();
            // Só atualiza cache se passou do tempo ou está vazio
            if (this.postsCache.length > 0 && this.lastCacheUpdate && 
                (now - this.lastCacheUpdate) < this.cacheExpiry) {
                return;
            }

            console.log('🔄 Atualizando cache de posts...');
            const response = await axios.get(
                `${this.baseUrl}/wp-json/wp/v2/posts?per_page=100&status=publish`,
                {
                    headers: {
                        'Authorization': `Basic ${this.auth}`
                    }
                }
            );

            this.postsCache = response.data.map(post => ({
                id: post.id,
                title: post.title.rendered,
                link: post.link,
                slug: post.slug,
                keywords: this.extractKeywords(post.title.rendered + ' ' + post.excerpt.rendered)
            }));

            this.lastCacheUpdate = now;
            console.log(`✅ Cache atualizado: ${this.postsCache.length} posts`);
        } catch (error) {
            console.error('⚠️ Erro ao atualizar cache:', error.message);
        }
    }

    // Extrair palavras-chave relevantes
    extractKeywords(text) {
        const stopWords = ['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos', 
                          'e', 'ou', 'mas', 'para', 'por', 'com', 'em', 'na', 'no', 'nas', 'nos',
                          'que', 'se', 'não', 'mais', 'muito', 'como', 'quando', 'onde', 'é', 'são',
                          'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'];
        
        return text.toLowerCase()
            .replace(/[^\w\sáàâãéèêíìîóòôõúùûç]/gi, '') // Remove pontuação
            .split(/\s+/)
            .filter(word => word.length > 3 && !stopWords.includes(word))
            .slice(0, 20); // Limita a 20 palavras-chave
    }

    // Encontrar posts relacionados
    findRelatedPosts(content, title, maxResults = 3) {
        if (this.postsCache.length === 0) return [];

        const contentKeywords = this.extractKeywords(content + ' ' + title);
        const scores = [];

        this.postsCache.forEach(post => {
            let score = 0;
            const matchedKeywords = [];

            contentKeywords.forEach(keyword => {
                if (post.keywords.includes(keyword)) {
                    score++;
                    matchedKeywords.push(keyword);
                }
                // Bonus para match no título
                if (post.title.toLowerCase().includes(keyword)) {
                    score += 2;
                }
            });

            if (score > 0) {
                scores.push({
                    ...post,
                    score,
                    matchedKeywords
                });
            }
        });

        return scores
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);
    }

    // Adicionar links para referências bíblicas externas
    addExternalBibleLinks(content) {
        // Padrões para referências bíblicas
        const biblePatterns = [
            // Formato: Gênesis 1:1, João 3:16, 1 João 2:3
            /\b([12]?\s*[A-ZÁÊÇÕ][a-záêâãéèêíìîóòôõúùûç]+)\s+(\d+):(\d+(?:-\d+)?)\b/g,
            // Formato: Salmos 23, Provérbios 31
            /\b([A-ZÁÊÇÕ][a-záêâãéèêíìîóòôõúùûç]+)\s+(\d+)\b(?!\d)/g
        ];

        let processedContent = content;

        biblePatterns.forEach(pattern => {
            processedContent = processedContent.replace(pattern, (match, book, chapter, verse) => {
                // Se já é um link, não processar
                if (match.includes('<a ') || match.includes('</a>')) {
                    return match;
                }

                const cleanBook = book.trim();
                const reference = verse ? `${cleanBook} ${chapter}:${verse}` : `${cleanBook} ${chapter}`;
                
                // URL para Bible.com (YouVersion)
                const bibleUrl = this.generateBibleUrl(cleanBook, chapter, verse);
                
                return `<a href="${bibleUrl}" target="_blank" rel="noopener" title="Ler ${reference} na Bíblia">${match}</a>`;
            });
        });

        return processedContent;
    }

    // Gerar URL para Bible.com
    generateBibleUrl(book, chapter, verse) {
        const bookMap = {
            'gênesis': 'GEN', 'êxodo': 'EXO', 'levítico': 'LEV', 'números': 'NUM', 'deuteronômio': 'DEU',
            'josué': 'JOS', 'juízes': 'JDG', 'rute': 'RUT', '1 samuel': '1SA', '2 samuel': '2SA',
            '1 reis': '1KI', '2 reis': '2KI', '1 crônicas': '1CH', '2 crônicas': '2CH',
            'esdras': 'EZR', 'neemias': 'NEH', 'ester': 'EST', 'jó': 'JOB', 'salmos': 'PSA',
            'provérbios': 'PRO', 'eclesiastes': 'ECC', 'cantares': 'SNG', 'isaías': 'ISA',
            'jeremias': 'JER', 'lamentações': 'LAM', 'ezequiel': 'EZK', 'daniel': 'DAN',
            'oséias': 'HOS', 'joel': 'JOL', 'amós': 'AMO', 'obadias': 'OBA', 'jonas': 'JON',
            'miquéias': 'MIC', 'naum': 'NAM', 'habacuque': 'HAB', 'sofonias': 'ZEP',
            'ageu': 'HAG', 'zacarias': 'ZEC', 'malaquias': 'MAL', 'mateus': 'MAT',
            'marcos': 'MRK', 'lucas': 'LUK', 'joão': 'JHN', 'atos': 'ACT', 'romanos': 'ROM',
            '1 coríntios': '1CO', '2 coríntios': '2CO', 'gálatas': 'GAL', 'efésios': 'EPH',
            'filipenses': 'PHP', 'colossenses': 'COL', '1 tessalonicenses': '1TH',
            '2 tessalonicenses': '2TH', '1 timóteo': '1TI', '2 timóteo': '2TI', 'tito': 'TIT',
            'filemom': 'PHM', 'hebreus': 'HEB', 'tiago': 'JAS', '1 pedro': '1PE',
            '2 pedro': '2PE', '1 joão': '1JN', '2 joão': '2JN', '3 joão': '3JN',
            'judas': 'JUD', 'apocalipse': 'REV'
        };

        const bookCode = bookMap[book.toLowerCase()] || 'GEN';
        const reference = verse ? `${bookCode}.${chapter}.${verse}` : `${bookCode}.${chapter}`;
        
        return `https://www.bible.com/pt/bible/1608/${reference}.ARC`;
    }

    // Adicionar links internos (SEM MODIFICAR TÍTULOS)
    addInternalLinks(content, title) {
        const relatedPosts = this.findRelatedPosts(content, title);
        
        if (relatedPosts.length === 0) return content;

        let processedContent = content;
        const usedLinks = new Set(); // Evitar links duplicados

        // Adicionar links baseados em palavras-chave matchadas
        relatedPosts.forEach(post => {
            post.matchedKeywords.forEach(keyword => {
                if (usedLinks.has(keyword)) return; // Evitar duplicatas

                // REGEX MELHORADA - Evita títulos HTML
                const regex = new RegExp(`(?<!<h[1-6][^>]*>.*?)\\b(${keyword})\\b(?!.*?<\/h[1-6]>)`, 'gi');
                let replacementCount = 0;

                processedContent = processedContent.replace(regex, (match, word, offset, string) => {
                    // Verificar se não está dentro de um link ou título
                    const before = string.substring(0, offset);
                    const after = string.substring(offset);
                    
                    // Evitar se já está em um link ou título
                    if (before.includes('<a ') && !before.includes('</a>') || 
                        before.includes('<h') && !before.includes('</h') ||
                        replacementCount > 0) { // Só uma substituição por palavra
                        return match;
                    }

                    replacementCount++;
                    usedLinks.add(keyword);
                    return `<a href="${post.link}" title="Leia mais sobre: ${post.title}">${match}</a>`;
                });
            });
        });

        // Adicionar seção de posts relacionados no final
        if (relatedPosts.length > 0) {
            const relatedSection = `
<div class="related-posts" style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-left: 4px solid #007cba;">
<h3>📚 Posts Relacionados:</h3>
<ul>
${relatedPosts.map(post => `<li><a href="${post.link}">${post.title}</a></li>`).join('')}
</ul>
</div>`;
            
            processedContent += relatedSection;
        }

        return processedContent;
    }

    // Função principal para melhorar conteúdo com links
    async enhanceContentWithLinks(content, title) {
        try {
            console.log('🔗 Melhorando conteúdo com links...');
            
            // 1. Atualizar cache de posts
            await this.updatePostsCache();
            
            // 2. Adicionar links para referências bíblicas
            let enhancedContent = this.addExternalBibleLinks(content);
            
            // 3. Adicionar links internos
            enhancedContent = this.addInternalLinks(enhancedContent, title);
            
            console.log('✅ Conteúdo melhorado com links');
            return enhancedContent;
            
        } catch (error) {
            console.error('⚠️ Erro ao melhorar conteúdo:', error.message);
            return content; // Retorna conteúdo original em caso de erro
        }
    }

    // ========== FUNÇÕES ORIGINAIS RESTANTES ==========

    async publishPost(title, content, featuredImageId = null, contentImageId = null, category = 'Uncategorized') {
        try {
            // 1. Formatar o conteúdo básico
            let formattedContent = this.formatContent(content);
            
            // 2. NOVO: Melhorar com links inteligentes
            formattedContent = await this.enhanceContentWithLinks(formattedContent, title);
            
            // 3. Inserir imagem no terceiro parágrafo se existe
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

            // 4. NOVO: Adicionar novo post ao cache
            const newPost = {
                id: response.data.id,
                title: response.data.title.rendered,
                link: response.data.link,
                slug: response.data.slug,
                keywords: this.extractKeywords(title + ' ' + content)
            };
            this.postsCache.unshift(newPost); // Adiciona no início

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
