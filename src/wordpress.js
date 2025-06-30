const axios = require('axios');

class WordPressHandler {
    constructor(url, username, password) {
        this.baseUrl = url;
        this.auth = Buffer.from(`${username}:${password}`).toString('base64');
        this.postsCache = [];
        this.lastCacheUpdate = null;
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 horas
        this.externalLinksCount = 0; // NOVO: Contador de links externos
        this.maxExternalLinks = 2; // NOVO: Limite de links externos
    }

    formatContent(content) {
        console.log('📝 Formatando conteúdo...');
        
        let formatted = content
            // 1. PRIMEIRO: Converter títulos "Capítulo X–Y:" para H2
            .replace(/^(Capítulo\s+\d+(?:–\d+)?:.*?)$/gm, '<h2>$1</h2>')
            
            // 2. Converter outros títulos markdown
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            
            // 3. TABELAS - Converter ANTES de outros processamentos
            .replace(/\|(.+)\|\n\|[\s\-\|:]+\|\n((?:\|.+\|\n?)*)/g, (match, header, rows) => {
                console.log('📊 Processando tabela...');
                
                const headerCells = header.split('|')
                    .map(cell => cell.trim())
                    .filter(cell => cell !== '')
                    .map(cell => `<th style="border: 1px solid #ddd; padding: 8px; background: #f2f2f2;">${cell}</th>`)
                    .join('');
                
                const dataRows = rows.trim().split('\n')
                    .map(row => {
                        const cells = row.split('|')
                            .map(cell => cell.trim())
                            .filter(cell => cell !== '')
                            .map(cell => `<td style="border: 1px solid #ddd; padding: 8px;">${cell}</td>`)
                            .join('');
                        return `<tr>${cells}</tr>`;
                    })
                    .join('');
                
                return `<table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
<thead><tr>${headerCells}</tr></thead>
<tbody>${dataRows}</tbody>
</table>`;
            })
            
            // 4. Converter formatação em negrito e itálico
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            
            // 5. Converter listas
            .replace(/^\* (.*$)/gm, '<li>$1</li>')
            .replace(/^- (.*$)/gm, '<li>$1</li>')
            .replace(/^(\d+)\. (.*$)/gm, '<li>$1. $2</li>')
            
            // 6. Agrupar listas em <ul>
            .replace(/(<li>.*<\/li>)/s, function(match) {
                if (match.includes('<li>')) {
                    return '<ul>' + match + '</ul>';
                }
                return match;
            })
            
            // 7. Converter links markdown para HTML
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            
            // 8. Converter quebras de linha em parágrafos
            .split('\n\n')
            .map(paragraph => {
                paragraph = paragraph.trim();
                if (!paragraph) return '';
                
                // Se já é HTML, não envolver em <p>
                if (paragraph.includes('<h') || paragraph.includes('<ul') || 
                    paragraph.includes('<ol') || paragraph.includes('<li') ||
                    paragraph.includes('<blockquote') || paragraph.includes('<div') ||
                    paragraph.includes('<table') || paragraph.includes('<figure')) {
                    return paragraph;
                }
                
                return `<p>${paragraph}</p>`;
            })
            .join('\n\n')
            
            // 9. Converter citações bíblicas em blockquotes
            .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
            
            // 10. Limpar parágrafos vazios e múltiplas quebras
            .replace(/<p>\s*<\/p>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/<p>(<h[1-6].*?<\/h[1-6]>)<\/p>/g, '$1')
            .replace(/<p>(<ul>.*?<\/ul>)<\/p>/gs, '$1')
            .replace(/<p>(<table.*?<\/table>)<\/p>/gs, '$1') // NOVO: Liberar tabelas
            .trim();

        console.log('✅ Conteúdo formatado');
        return formatted;
    }

    // NOVO: Função mais restritiva para links bíblicos
    addExternalBibleLinks(content) {
        if (this.externalLinksCount >= this.maxExternalLinks) {
            console.log(`⚠️ Limite de ${this.maxExternalLinks} links externos atingido`);
            return content;
        }

        console.log('🔗 Adicionando links bíblicos (máximo 2)...');
        
        // Padrão mais específico - só versículos completos
        const biblePattern = /\b([12]?\s*[A-ZÁÊÇÕ][a-záêâãéèêíìîóòôõúùûç]+)\s+(\d+):(\d+(?:-\d+)?)\b/g;
        
        let processedContent = content;
        let matchCount = 0;

        processedContent = processedContent.replace(biblePattern, (match, book, chapter, verse) => {
            // Verificar limites
            if (this.externalLinksCount >= this.maxExternalLinks || matchCount >= this.maxExternalLinks) {
                return match;
            }

            // Verificar se já é um link ou está em título
            const beforeMatch = processedContent.substring(0, processedContent.indexOf(match));
            if (beforeMatch.includes('<a ') && !beforeMatch.includes('</a>') ||
                beforeMatch.includes('<h') && !beforeMatch.includes('</h')) {
                return match;
            }

            const cleanBook = book.trim();
            const reference = `${cleanBook} ${chapter}:${verse}`;
            const bibleUrl = this.generateBibleUrl(cleanBook, chapter, verse);
            
            this.externalLinksCount++;
            matchCount++;
            
            console.log(`📖 Link bíblico ${matchCount}: ${reference}`);
            return `<a href="${bibleUrl}" target="_blank" rel="noopener" title="Ler ${reference} na Bíblia">${match}</a>`;
        });

        return processedContent;
    }

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

    // NOVO: Links internos mais seguros
    addInternalLinks(content, title) {
        console.log('🔗 Processando links internos...');
        
        const relatedPosts = this.findRelatedPosts(content, title);
        if (relatedPosts.length === 0) return content;

        let processedContent = content;
        const usedLinks = new Set();

        // Adicionar APENAS 1 link interno por post relacionado
        relatedPosts.slice(0, 2).forEach(post => { // Máximo 2 posts
            const keyword = post.matchedKeywords[0]; // Apenas a primeira palavra-chave
            if (usedLinks.has(keyword) || !keyword) return;

            // REGEX ULTRA SEGURA - Evita títulos HTML completamente
            const safeRegex = new RegExp(
                `(?<!<[^>]*>)(?<!<h[1-6][^>]*>.*?)\\b(${this.escapeRegex(keyword)})\\b(?![^<]*<\/h[1-6]>)(?![^<]*>)`, 
                'i'
            );
            
            let matched = false;
            processedContent = processedContent.replace(safeRegex, (match, word, offset, string) => {
                if (matched) return match; // Só uma substituição
                
                // Verificação adicional de contexto
                const beforeContext = string.substring(Math.max(0, offset - 100), offset);
                const afterContext = string.substring(offset, offset + 100);
                
                // Se está perto de tags HTML, não processar
                if (beforeContext.includes('<h') || beforeContext.includes('<a ') || 
                    afterContext.includes('</h') || afterContext.includes('</a>')) {
                    return match;
                }

                matched = true;
                usedLinks.add(keyword);
                console.log(`🔗 Link interno: ${keyword} -> ${post.title}`);
                return `<a href="${post.link}" title="Leia: ${post.title}">${match}</a>`;
            });
        });

        // Posts relacionados no final
        if (relatedPosts.length > 0) {
            const relatedSection = `
<div class="related-posts" style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-left: 4px solid #007cba;">
<h3>📚 Posts Relacionados:</h3>
<ul>
${relatedPosts.slice(0, 3).map(post => `<li><a href="${post.link}">${post.title}</a></li>`).join('')}
</ul>
</div>`;
            
            processedContent += relatedSection;
        }

        return processedContent;
    }

    // NOVO: Escape para regex
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Função principal melhorada
    async enhanceContentWithLinks(content, title) {
        try {
            console.log('🔗 Iniciando melhoria de conteúdo...');
            
            // Reset contador para cada post
            this.externalLinksCount = 0;
            
            // 1. Cache de posts
            await this.updatePostsCache();
            
            // 2. Links bíblicos (máximo 2)
            let enhancedContent = this.addExternalBibleLinks(content);
            
            // 3. Links internos (seguros)
            enhancedContent = this.addInternalLinks(enhancedContent, title);
            
            console.log(`✅ Conteúdo melhorado: ${this.externalLinksCount} links externos`);
            return enhancedContent;
            
        } catch (error) {
            console.error('⚠️ Erro ao melhorar conteúdo:', error.message);
            return content;
        }
    }

    // Cache e outras funções (mantidas iguais)
    async updatePostsCache() {
        try {
            const now = Date.now();
            if (this.postsCache.length > 0 && this.lastCacheUpdate && 
                (now - this.lastCacheUpdate) < this.cacheExpiry) {
                return;
            }

            console.log('🔄 Atualizando cache...');
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
            console.log(`✅ Cache: ${this.postsCache.length} posts`);
        } catch (error) {
            console.error('⚠️ Erro no cache:', error.message);
        }
    }

    extractKeywords(text) {
        const stopWords = ['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos', 
                          'e', 'ou', 'mas', 'para', 'por', 'com', 'em', 'na', 'no', 'nas', 'nos',
                          'que', 'se', 'não', 'mais', 'muito', 'como', 'quando', 'onde', 'é', 'são',
                          'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'];
        
        return text.toLowerCase()
            .replace(/[^\w\sáàâãéèêíìîóòôõúùûç]/gi, '')
            .split(/\s+/)
            .filter(word => word.length > 3 && !stopWords.includes(word))
            .slice(0, 20);
    }

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

    // Funções originais (inalteradas)
    async publishPost(title, content, featuredImageId = null, contentImageId = null, category = 'Uncategorized') {
        try {
            // 1. Formatar conteúdo
            let formattedContent = this.formatContent(content);
            
            // 2. Melhorar com links
            formattedContent = await this.enhanceContentWithLinks(formattedContent, title);
            
            // 3. Inserir imagem no conteúdo
            if (contentImageId) {
                console.log('🖼️ Inserindo imagem...');
                const imageUrl = await this.getImageUrl(contentImageId);
                if (imageUrl) {
                    const paragraphs = formattedContent.split('</p>');
                    if (paragraphs.length >= 3) {
                        const imageHtml = `<figure class="wp-block-image aligncenter size-large">
<img src="${imageUrl}" alt="Imagem ilustrativa do artigo" class="wp-image-${contentImageId}"/>
</figure>`;
                        paragraphs.splice(2, 0, imageHtml);
                        formattedContent = paragraphs.join('</p>');
                        console.log('✅ Imagem inserida');
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

            // Adicionar ao cache
            const newPost = {
                id: response.data.id,
                title: response.data.title.rendered,
                link: response.data.link,
                slug: response.data.slug,
                keywords: this.extractKeywords(title + ' ' + content)
            };
            this.postsCache.unshift(newPost);

            return response.data.link;
        } catch (error) {
            console.error('Erro ao publicar:', error.response?.data || error.message);
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
            console.error('Erro categoria:', error.message);
            return [1];
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
            console.error('Erro upload:', error.response?.data || error.message);
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
            console.error('Erro URL imagem:', error.message);
            return '';
        }
    }
}

module.exports = WordPressHandler;
